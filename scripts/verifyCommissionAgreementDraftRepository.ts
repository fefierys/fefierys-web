import { equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  const { and, eq, inArray } = await import("drizzle-orm");

  const { db } = await import("../lib/db");

  const {
    commissionAgreements,
    commissionDeliverables,
    commissionEmailMessages,
    commissionEmailThreads,
    commissionEvents,
    commissionPaymentInstallments,
    commissionPayments,
    commissionQuoteItems,
    commissionQuotes,
    commissions,
    commissionStatusHistory,
  } = await import("../lib/db/schema/commissions");

  const { createCommission } =
    await import("../lib/repositories/commissionRepository");

  const { transitionCommissionStatus } =
    await import("../lib/repositories/commissionWorkflowRepository");

  const {
    createCommissionQuoteDraft,
    sendCommissionQuote,
    acceptCommissionQuote,
  } = await import("../lib/repositories/commissionQuoteRepository");

  const {
    createCommissionEmailThreadIfMissing,
    setCommissionEmailThreadRootMessageId,
    setCommissionEmailThreadRootProvider,
  } = await import("../lib/repositories/commissionEmailRepository");

  const { deliverCommissionEmailMessage } =
    await import("../lib/email/commissionEmailDeliveryService");

  const { createCommissionAgreementDraft } =
    await import(
      "../lib/repositories/commissionAgreements/commissionAgreementDraftRepository"
    );

  const {
    createEmptyCommissionAgreementDraftData,
  } = await import("../lib/commissions/commissionAgreementData");

  const {
    saveCommissionAgreementDraftData,
  } = await import(
    "../lib/repositories/commissionAgreements/commissionAgreementDataRepository"
  );

  const {
    createCommissionPaymentPlan,
    createCommissionGroupedPaymentPlan,
    updateCommissionGroupedPaymentPlan,
    updateCommissionPaymentPlan,
  } = await import(
    "../lib/repositories/commissionPayments/commissionPaymentPlanRepository"
  );

  const verificationId = randomUUID();
  const createdCommissionIds: string[] = [];

  const adminUserId = "agreement-draft-verifier";

  const senderEmail =
    process.env.SENDER_EMAIL?.trim() ||
    "agreement-verifier-sender@example.com";

  const replyToEmail =
    process.env.OWNER_EMAIL?.trim() ||
    "agreement-verifier-owner@example.com";

  async function createTemporaryCommission(label: string): Promise<string> {
    const commission = await createCommission({
      submissionId: randomUUID(),
      clientName: `Agreement ${label} Verification`,
      clientEmail: `agreement-${verificationId}@example.com`,
      initialMessage: `Temporary agreement verification: ${label}`,
      termsVersion: "2026.1",
    });

    createdCommissionIds.push(commission.id);

    return commission.id;
  }

  async function prepareAcceptedQuote(
    label: string,
  ): Promise<{ commissionId: string; quoteId: string }> {
    const commissionId = await createTemporaryCommission(label);

    const thread = await createCommissionEmailThreadIfMissing({
      commissionId,
      subject: `Fefierys Art - Agreement verification - ${commissionId}`,
    });

    const rootProviderEmailId = `agreement-verifier-root-${commissionId}`;

    const rootProviderResult =
      await setCommissionEmailThreadRootProvider({
        threadId: thread.thread.id,
        providerEmailId: rootProviderEmailId,
      });

    ok(
      rootProviderResult.outcome === "set" ||
        rootProviderResult.outcome === "already_set",
    );

    const rootMessageResult =
      await setCommissionEmailThreadRootMessageId({
        threadId: thread.thread.id,
        providerEmailId: rootProviderEmailId,
        rootMessageId:
          `<agreement-verifier-root-${commissionId}@email.fefierys.test>`,
      });

    ok(
      rootMessageResult.outcome === "set" ||
        rootMessageResult.outcome === "already_set",
    );

    const reviewResult = await transitionCommissionStatus({
      commissionId,
      fromStatus: "received",
      toStatus: "under_review",
      initiatedBy: "artist",
      changedByAdminUserId: adminUserId,
    });

    equal(reviewResult.outcome, "updated");

    const quotingResult = await transitionCommissionStatus({
      commissionId,
      fromStatus: "under_review",
      toStatus: "quoting",
      initiatedBy: "artist",
      changedByAdminUserId: adminUserId,
    });

    equal(quotingResult.outcome, "updated");

    const draftResult = await createCommissionQuoteDraft({
      commissionId,
      currency: "USD",
      description: `Agreement ${label} verification quote`,
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Agreement verification illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: adminUserId,
    });

    equal(draftResult.outcome, "created");

    if (draftResult.outcome !== "created") {
      throw new Error("Could not create the verification quote.");
    }

    const sentResult = await sendCommissionQuote({
      quoteId: draftResult.quote.id,
      expectedUpdatedAt: draftResult.quote.updatedAt,
      sentByAdminUserId: adminUserId,
      senderEmail,
      replyToEmail,
    });

    equal(sentResult.outcome, "sent");

    if (sentResult.outcome !== "sent") {
      throw new Error("Could not send the verification quote.");
    }

    /*
     * Simulated provider: no real email is sent.
     */
    const deliveryResult = await deliverCommissionEmailMessage(
      {
        messageId: sentResult.messageId,
        body: {
          text: "Synthetic agreement draft verification delivery.",
        },
      },
      {
        async send() {
          return {
            outcome: "sent" as const,
            providerEmailId: `agreement-verifier-${sentResult.messageId}`,
            providerMessageId:
              `<agreement-verifier-${sentResult.messageId}@email.fefierys.test>`,
          };
        },
      },
    );

    equal(deliveryResult.outcome, "sent");

    const acceptanceResult = await acceptCommissionQuote({
      quoteId: sentResult.quote.id,
      expectedUpdatedAt: sentResult.quote.updatedAt,
      acceptedByAdminUserId: adminUserId,
    });

    equal(acceptanceResult.outcome, "accepted");

    if (acceptanceResult.outcome !== "accepted") {
      throw new Error("Could not accept the verification quote.");
    }

    const commissionRows = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, commissionId))
      .limit(1);

    equal(commissionRows[0]?.status, "awaiting_agreement");

    return {
      commissionId,
      quoteId: sentResult.quote.id,
    };
  }

  try {
    /*
     * An Agreement cannot be created before the Commission
     * reaches awaiting_agreement.
     */
    const receivedCommissionId =
      await createTemporaryCommission("Wrong Status");

    const wrongStatusResult = await createCommissionAgreementDraft({
      commissionId: receivedCommissionId,
      quoteId: randomUUID(),
      termsVersion: "2026.1",
      agreementVersion: "verification-1",
      createdByAdminUserId: adminUserId,
    });

    equal(wrongStatusResult.outcome, "wrong_status");

    console.log("[OK] Agreement draft requires awaiting_agreement");

    /*
     * Prepare a real accepted Quote for the remaining tests.
     */
    const primary = await prepareAcceptedQuote("Primary");

    const baseInput = {
      commissionId: primary.commissionId,
      quoteId: primary.quoteId,
      termsVersion: "2026.1",
      agreementVersion: "verification-1",
      createdByAdminUserId: adminUserId,
    };

    const invalidTermsResult = await createCommissionAgreementDraft({
      ...baseInput,
      termsVersion: "   ",
    });

    equal(invalidTermsResult.outcome, "invalid");

    if (invalidTermsResult.outcome === "invalid") {
      equal(invalidTermsResult.field, "termsVersion");
    }

    const invalidAgreementVersionResult =
      await createCommissionAgreementDraft({
        ...baseInput,
        agreementVersion: "x".repeat(51),
      });

    equal(invalidAgreementVersionResult.outcome, "invalid");

    if (invalidAgreementVersionResult.outcome === "invalid") {
      equal(invalidAgreementVersionResult.field, "agreementVersion");
    }

    console.log("[OK] Invalid document versions were rejected");

    const wrongQuoteResult = await createCommissionAgreementDraft({
      ...baseInput,
      quoteId: randomUUID(),
    });

    equal(wrongQuoteResult.outcome, "quote_not_accepted");

    console.log("[OK] Agreement draft requires the accepted Quote");

    await db
      .update(commissions)
      .set({
        isOnHold: true,
        holdReason: "Temporary agreement verification hold.",
        holdStartedAt: new Date(),
      })
      .where(eq(commissions.id, primary.commissionId));

    const heldResult = await createCommissionAgreementDraft(baseInput);

    equal(heldResult.outcome, "on_hold");

    await db
      .update(commissions)
      .set({
        isOnHold: false,
        holdReason: null,
        holdStartedAt: null,
      })
      .where(eq(commissions.id, primary.commissionId));

    console.log("[OK] Held commission rejected agreement draft creation");

    const historyBeforeCreation = await db
      .select({
        id: commissionStatusHistory.id,
      })
      .from(commissionStatusHistory)
      .where(
        eq(
          commissionStatusHistory.commissionId,
          primary.commissionId,
        ),
      );

    const createdResult = await createCommissionAgreementDraft(baseInput);

    equal(createdResult.outcome, "created");

    if (createdResult.outcome !== "created") {
      throw new Error("Expected the Agreement draft to be created.");
    }

    const agreement = createdResult.agreement;

    equal(agreement.commissionId, primary.commissionId);
    equal(agreement.quoteId, primary.quoteId);
    equal(agreement.version, 1);
    equal(agreement.status, "draft");
    equal(agreement.termsVersion, baseInput.termsVersion);
    equal(agreement.agreementVersion, baseInput.agreementVersion);

    equal(agreement.agreementData, null);
    equal(agreement.documentId, null);
    equal(agreement.executedDocumentId, null);
    equal(agreement.publicTokenHash, null);
    equal(agreement.acceptedAt, null);

    const agreementEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, primary.commissionId),
          eq(commissionEvents.type, "agreement_created"),
        ),
      );

    equal(agreementEventRows.length, 1);

    const agreementEvent = agreementEventRows[0];

    ok(agreementEvent);
    equal(agreementEvent.actor, "artist");
    equal(agreementEvent.createdByAdminUserId, adminUserId);

    const metadata = agreementEvent.metadata as {
      agreementId?: string;
      quoteId?: string;
      version?: number;
    } | null;

    equal(metadata?.agreementId, agreement.id);
    equal(metadata?.quoteId, primary.quoteId);
    equal(metadata?.version, 1);

    const historyAfterCreation = await db
      .select({
        id: commissionStatusHistory.id,
      })
      .from(commissionStatusHistory)
      .where(
        eq(
          commissionStatusHistory.commissionId,
          primary.commissionId,
        ),
      );

    equal(historyAfterCreation.length, historyBeforeCreation.length);

    const commissionAfterCreation = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, primary.commissionId))
      .limit(1);

    equal(commissionAfterCreation[0]?.status, "awaiting_agreement");

    console.log("[OK] Agreement draft and audit event were created");

    const repeatedResult = await createCommissionAgreementDraft(baseInput);

    equal(repeatedResult.outcome, "active_agreement_exists");

    if (repeatedResult.outcome === "active_agreement_exists") {
      equal(repeatedResult.agreement.id, agreement.id);
    }

    console.log("[OK] A second active Agreement draft was rejected");

    /*
    * Save an incomplete Agreement draft using the primary
    * temporary Commission.
    */
    const emptyAgreementData =
      createEmptyCommissionAgreementDraftData();

    const saveAgreementDataInput = {
      commissionId: primary.commissionId,
      quoteId: primary.quoteId,
      agreementId: agreement.id,
      expectedAgreementUpdatedAt: agreement.updatedAt,
      agreementData: {
        ...emptyAgreementData,
        project: {
          ...emptyAgreementData.project,
          name: "Temporary verification project",
        },
      },
    };

    const savedAgreementDataResult =
      await saveCommissionAgreementDraftData(saveAgreementDataInput);

    equal(savedAgreementDataResult.outcome, "saved");

    if (savedAgreementDataResult.outcome !== "saved") {
      throw new Error("Expected the Agreement draft data to be saved.");
    }

    equal(
      (
        savedAgreementDataResult.agreement
          .agreementData as { project?: { name?: string } } | null
      )?.project?.name,
      "Temporary verification project",
    );

    equal(savedAgreementDataResult.agreement.status, "draft");

    ok(
      savedAgreementDataResult.agreement.updatedAt.getTime() >
        agreement.updatedAt.getTime(),
    );

    console.log(
      "[OK] Incomplete Agreement draft data was saved without presenting it",
    );

    /*
    * Reusing the previous Agreement version must not
    * overwrite the saved draft.
    */
    const staleAgreementDataResult =
      await saveCommissionAgreementDraftData({
        ...saveAgreementDataInput,
        agreementData: emptyAgreementData,
      });

    equal(staleAgreementDataResult.outcome, "conflict");

    const agreementAfterStaleSaveRows = await db
      .select({
        agreementData: commissionAgreements.agreementData,
        status: commissionAgreements.status,
      })
      .from(commissionAgreements)
      .where(eq(commissionAgreements.id, agreement.id))
      .limit(1);

    const agreementAfterStaleSave = agreementAfterStaleSaveRows[0];

    ok(agreementAfterStaleSave);
    equal(agreementAfterStaleSave.status, "draft");

    equal(
      (
        agreementAfterStaleSave.agreementData as {
          project?: { name?: string };
        } | null
      )?.project?.name,
      "Temporary verification project",
    );

    console.log(
      "[OK] Agreement draft data save rejected an outdated version",
    );

    const paymentPlanResult = await createCommissionPaymentPlan({
      commissionId: primary.commissionId,
      quoteId: primary.quoteId,
      agreementId: agreement.id,
      stages: [
        {
          label: "Initial payment",
          amount: "225.00",
          trigger: "before_start",
        },
        {
          label: "Final payment",
          amount: "225.00",
          trigger: "before_final_delivery",
        },
      ],
      createdByAdminUserId: adminUserId,
    });

    equal(paymentPlanResult.outcome, "created");

    if (paymentPlanResult.outcome !== "created") {
      throw new Error("Expected the payment plan to be created.");
    }

    equal(paymentPlanResult.installments.length, 2);

    equal(paymentPlanResult.installments[0]?.sequence, 1);
    equal(paymentPlanResult.installments[0]?.label, "Initial payment");
    equal(paymentPlanResult.installments[0]?.amount, "225.00");
    equal(paymentPlanResult.installments[0]?.currency, "USD");
    equal(paymentPlanResult.installments[0]?.trigger, "before_start");
    equal(paymentPlanResult.installments[0]?.status, "pending");

    equal(paymentPlanResult.installments[1]?.sequence, 2);
    equal(paymentPlanResult.installments[1]?.label, "Final payment");
    equal(paymentPlanResult.installments[1]?.amount, "225.00");
    equal(paymentPlanResult.installments[1]?.currency, "USD");
    equal(
      paymentPlanResult.installments[1]?.trigger,
      "before_final_delivery",
    );
    equal(paymentPlanResult.installments[1]?.status, "pending");

    const commissionAfterPaymentPlan = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, primary.commissionId))
      .limit(1);

    equal(
      commissionAfterPaymentPlan[0]?.status,
      "awaiting_agreement",
    );

    console.log(
      "[OK] Payment plan was created with pending installments without changing commission status",
    );

    const repeatedPaymentPlanResult = await createCommissionPaymentPlan({
      commissionId: primary.commissionId,
      quoteId: primary.quoteId,
      agreementId: agreement.id,
      stages: [
        {
          label: "Initial payment",
          amount: "225.00",
          trigger: "before_start",
        },
        {
          label: "Final payment",
          amount: "225.00",
          trigger: "before_final_delivery",
        },
      ],
      createdByAdminUserId: adminUserId,
    });

    equal(repeatedPaymentPlanResult.outcome, "plan_already_exists");

    const installmentsAfterRepeatedAttempt = await db
      .select()
      .from(commissionPaymentInstallments)
      .where(
        and(
          eq(
            commissionPaymentInstallments.commissionId,
            primary.commissionId,
          ),
          eq(
            commissionPaymentInstallments.quoteId,
            primary.quoteId,
          ),
        ),
      );

    equal(installmentsAfterRepeatedAttempt.length, 2);

    console.log(
      "[OK] Repeated payment plan creation did not duplicate installments",
    );

    /*
    * Edit the primary Commission's draft payment plan.
    * Preserve both existing installment IDs and append a third stage.
    */
    const agreementBeforePlanUpdateRows = await db
      .select({
        updatedAt: commissionAgreements.updatedAt,
      })
      .from(commissionAgreements)
      .where(eq(commissionAgreements.id, agreement.id))
      .limit(1);

    const agreementBeforePlanUpdate = agreementBeforePlanUpdateRows[0];

    ok(agreementBeforePlanUpdate);

    const originalInstallmentIds = paymentPlanResult.installments.map(
      (installment) => installment.id,
    );

    const planUpdateInput = {
      commissionId: primary.commissionId,
      quoteId: primary.quoteId,
      agreementId: agreement.id,
      expectedAgreementUpdatedAt: agreementBeforePlanUpdate.updatedAt,
      stages: [
        {
          id: originalInstallmentIds[0],
          label: "Initial payment - updated",
          amount: "200.00",
          trigger: "before_start",
        },
        {
          id: originalInstallmentIds[1],
          label: "Second payment - updated",
          amount: "100.00",
          trigger: "after_sketch_approval",
        },
        {
          label: "Final payment - new",
          amount: "150.00",
          trigger: "before_final_delivery",
        },
      ],
      updatedByAdminUserId: adminUserId,
    };

    const planUpdateResult = await updateCommissionPaymentPlan(
      planUpdateInput,
    );

    equal(planUpdateResult.outcome, "updated");

    if (planUpdateResult.outcome !== "updated") {
      throw new Error("Expected the payment plan to be updated.");
    }

    equal(planUpdateResult.installments.length, 3);

    equal(planUpdateResult.installments[0]?.id, originalInstallmentIds[0]);
    equal(planUpdateResult.installments[0]?.sequence, 1);
    equal(planUpdateResult.installments[0]?.label, "Initial payment - updated");
    equal(planUpdateResult.installments[0]?.amount, "200.00");

    equal(planUpdateResult.installments[1]?.id, originalInstallmentIds[1]);
    equal(planUpdateResult.installments[1]?.sequence, 2);
    equal(planUpdateResult.installments[1]?.label, "Second payment - updated");
    equal(planUpdateResult.installments[1]?.amount, "100.00");
    equal(
      planUpdateResult.installments[1]?.trigger,
      "after_sketch_approval",
    );

    equal(planUpdateResult.installments[2]?.sequence, 3);
    equal(planUpdateResult.installments[2]?.label, "Final payment - new");
    equal(planUpdateResult.installments[2]?.amount, "150.00");

    ok(
      !originalInstallmentIds.includes(planUpdateResult.installments[2]!.id),
    );

    equal(
      planUpdateResult.installments.every(
        (installment) => installment.status === "pending",
      ),
      true,
    );

    const agreementAfterPlanUpdateRows = await db
      .select({
        status: commissionAgreements.status,
        updatedAt: commissionAgreements.updatedAt,
      })
      .from(commissionAgreements)
      .where(eq(commissionAgreements.id, agreement.id))
      .limit(1);

    const agreementAfterPlanUpdate = agreementAfterPlanUpdateRows[0];

    ok(agreementAfterPlanUpdate);
    equal(agreementAfterPlanUpdate.status, "draft");

    ok(
      agreementAfterPlanUpdate.updatedAt.getTime() >
        agreementBeforePlanUpdate.updatedAt.getTime(),
    );

    console.log(
      "[OK] Draft payment plan update preserved existing IDs and added a pending installment",
    );

    /*
    * Reusing the previous Agreement version must not overwrite
    * the plan that was just updated.
    */
    const stalePlanUpdateResult = await updateCommissionPaymentPlan(
      planUpdateInput,
    );

    equal(stalePlanUpdateResult.outcome, "conflict");

    const installmentsAfterStaleUpdate = await db
      .select()
      .from(commissionPaymentInstallments)
      .where(
        and(
          eq(
            commissionPaymentInstallments.commissionId,
            primary.commissionId,
          ),
          eq(
            commissionPaymentInstallments.quoteId,
            primary.quoteId,
          ),
        ),
      );

    equal(installmentsAfterStaleUpdate.length, 3);

    console.log(
      "[OK] Payment plan update rejected an outdated Agreement version",
    );

    /*
    * Two simultaneous updates start from the same Agreement version.
    * Only one must be allowed to save.
    */
    const concurrentUpdateInput = {
      commissionId: primary.commissionId,
      quoteId: primary.quoteId,
      agreementId: agreement.id,
      expectedAgreementUpdatedAt: agreementAfterPlanUpdate.updatedAt,
      stages: [
        {
          id: planUpdateResult.installments[0]!.id,
          label: "Initial payment - concurrent update",
          amount: "175.00",
          trigger: "before_start",
        },
        {
          id: planUpdateResult.installments[1]!.id,
          label: "Second payment - concurrent update",
          amount: "125.00",
          trigger: "after_sketch_approval",
        },
        {
          id: planUpdateResult.installments[2]!.id,
          label: "Final payment - concurrent update",
          amount: "150.00",
          trigger: "before_final_delivery",
        },
      ],
      updatedByAdminUserId: adminUserId,
    };

    const concurrentUpdateResults = await Promise.all([
      updateCommissionPaymentPlan(concurrentUpdateInput),
      updateCommissionPaymentPlan(concurrentUpdateInput),
    ]);

    equal(
      concurrentUpdateResults.filter(
        (result) => result.outcome === "updated",
      ).length,
      1,
    );

    equal(
      concurrentUpdateResults.filter(
        (result) => result.outcome === "conflict",
      ).length,
      1,
    );

    const installmentsAfterConcurrentUpdate = await db
      .select()
      .from(commissionPaymentInstallments)
      .where(
        and(
          eq(
            commissionPaymentInstallments.commissionId,
            primary.commissionId,
          ),
          eq(
            commissionPaymentInstallments.quoteId,
            primary.quoteId,
          ),
        ),
      );

    equal(installmentsAfterConcurrentUpdate.length, 3);
    equal(
      installmentsAfterConcurrentUpdate.find(
        (installment) =>
          installment.id === planUpdateResult.installments[0]!.id,
      )?.amount,
      "175.00",
    );
    equal(
      installmentsAfterConcurrentUpdate.find(
        (installment) =>
          installment.id === planUpdateResult.installments[1]!.id,
      )?.amount,
      "125.00",
    );
    equal(
      installmentsAfterConcurrentUpdate.find(
        (installment) =>
          installment.id === planUpdateResult.installments[2]!.id,
      )?.amount,
      "150.00",
    );

    console.log(
      "[OK] Concurrent payment plan updates allowed one save and rejected the stale update",
    );

    /*
    * A payment linked to any installment locks the draft plan,
    * even when that payment is still pending.
    */
    const agreementBeforeLockedUpdateRows = await db
      .select({
        updatedAt: commissionAgreements.updatedAt,
      })
      .from(commissionAgreements)
      .where(eq(commissionAgreements.id, agreement.id))
      .limit(1);

    const agreementBeforeLockedUpdate = agreementBeforeLockedUpdateRows[0];

    ok(agreementBeforeLockedUpdate);

    const initialInstallmentId = planUpdateResult.installments[0]!.id;

    await db.insert(commissionPayments).values({
      commissionId: primary.commissionId,
      installmentId: initialInstallmentId,
      type: "installment",
      status: "pending",
      amount: "1.00",
      currency: "USD",
    });

    const lockedPlanUpdateResult = await updateCommissionPaymentPlan({
      commissionId: primary.commissionId,
      quoteId: primary.quoteId,
      agreementId: agreement.id,
      expectedAgreementUpdatedAt: agreementBeforeLockedUpdate.updatedAt,
      stages: [
        {
          id: planUpdateResult.installments[0]!.id,
          label: "This update must be rejected",
          amount: "175.00",
          trigger: "before_start",
        },
        {
          id: planUpdateResult.installments[1]!.id,
          label: "Second payment - concurrent update",
          amount: "125.00",
          trigger: "after_sketch_approval",
        },
        {
          id: planUpdateResult.installments[2]!.id,
          label: "Final payment - concurrent update",
          amount: "150.00",
          trigger: "before_final_delivery",
        },
      ],
      updatedByAdminUserId: adminUserId,
    });

    equal(lockedPlanUpdateResult.outcome, "plan_locked");

    const installmentsAfterLockedUpdate = await db
      .select()
      .from(commissionPaymentInstallments)
      .where(
        and(
          eq(
            commissionPaymentInstallments.commissionId,
            primary.commissionId,
          ),
          eq(
            commissionPaymentInstallments.quoteId,
            primary.quoteId,
          ),
        ),
      );

    equal(installmentsAfterLockedUpdate.length, 3);

    equal(
      installmentsAfterLockedUpdate.find(
        (installment) => installment.id === initialInstallmentId,
      )?.label,
      "Initial payment - concurrent update",
    );

    console.log(
      "[OK] Payment plan update rejected a plan with a linked pending payment",
    );

    /*
     * A separate Commission tests two simultaneous creation requests.
     */
    const concurrent = await prepareAcceptedQuote("Concurrent");

    const concurrentInput = {
      commissionId: concurrent.commissionId,
      quoteId: concurrent.quoteId,
      termsVersion: "2026.1",
      agreementVersion: "verification-1",
      createdByAdminUserId: adminUserId,
    };

    const concurrentResults = await Promise.all([
      createCommissionAgreementDraft(concurrentInput),
      createCommissionAgreementDraft(concurrentInput),
    ]);

    equal(
      concurrentResults.filter((result) => result.outcome === "created").length,
      1,
    );

    equal(
      concurrentResults.filter(
        (result) =>
          result.outcome === "active_agreement_exists" ||
          result.outcome === "conflict",
      ).length,
      1,
    );

    const concurrentAgreementRows = await db
      .select()
      .from(commissionAgreements)
      .where(
        eq(
          commissionAgreements.commissionId,
          concurrent.commissionId,
        ),
      );

    equal(concurrentAgreementRows.length, 1);
    equal(concurrentAgreementRows[0]?.status, "draft");

    const concurrentEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrent.commissionId),
          eq(commissionEvents.type, "agreement_created"),
        ),
      );

    equal(concurrentEventRows.length, 1);

    console.log(
      "[OK] Concurrent agreement creation produced one draft and one event",
    );

    const concurrentAgreement = concurrentAgreementRows[0];

    ok(concurrentAgreement);

    const concurrentPaymentPlanInput = {
      commissionId: concurrent.commissionId,
      quoteId: concurrent.quoteId,
      agreementId: concurrentAgreement.id,
      stages: [
        {
          label: "Initial payment",
          amount: "150.00",
          trigger: "before_start",
        },
        {
          label: "Final payment",
          amount: "300.00",
          trigger: "before_final_delivery",
        },
      ],
      createdByAdminUserId: adminUserId,
    };

    const concurrentPaymentPlanResults = await Promise.all([
      createCommissionPaymentPlan(concurrentPaymentPlanInput),
      createCommissionPaymentPlan(concurrentPaymentPlanInput),
    ]);

    equal(
      concurrentPaymentPlanResults.filter(
        (result) => result.outcome === "created",
      ).length,
      1,
    );

    equal(
      concurrentPaymentPlanResults.filter(
        (result) =>
          result.outcome === "plan_already_exists" ||
          result.outcome === "conflict",
      ).length,
      1,
    );

    const concurrentInstallmentRows = await db
      .select()
      .from(commissionPaymentInstallments)
      .where(
        and(
          eq(
            commissionPaymentInstallments.commissionId,
            concurrent.commissionId,
          ),
          eq(
            commissionPaymentInstallments.quoteId,
            concurrent.quoteId,
          ),
        ),
      );

    equal(concurrentInstallmentRows.length, 2);

    equal(
      concurrentInstallmentRows.filter(
        (installment) => installment.status === "pending",
      ).length,
      2,
    );

    console.log(
      "[OK] Concurrent payment plan creation produced one plan with two pending installments",
    );

    /*
    * An installment that is no longer pending must lock
    * the plan even when it has no linked payment.
    */
    const firstConcurrentInstallment = concurrentInstallmentRows.find(
      (installment) => installment.sequence === 1,
    );

    const secondConcurrentInstallment = concurrentInstallmentRows.find(
      (installment) => installment.sequence === 2,
    );

    ok(firstConcurrentInstallment);
    ok(secondConcurrentInstallment);

    await db
      .update(commissionPaymentInstallments)
      .set({
        status: "due",
      })
      .where(
        eq(
          commissionPaymentInstallments.id,
          firstConcurrentInstallment.id,
        ),
      );

    const agreementBeforeDueUpdateRows = await db
      .select({
        updatedAt: commissionAgreements.updatedAt,
      })
      .from(commissionAgreements)
      .where(eq(commissionAgreements.id, concurrentAgreement.id))
      .limit(1);

    const agreementBeforeDueUpdate = agreementBeforeDueUpdateRows[0];

    ok(agreementBeforeDueUpdate);

    const duePlanUpdateResult = await updateCommissionPaymentPlan({
      commissionId: concurrent.commissionId,
      quoteId: concurrent.quoteId,
      agreementId: concurrentAgreement.id,
      expectedAgreementUpdatedAt: agreementBeforeDueUpdate.updatedAt,
      stages: [
        {
          id: firstConcurrentInstallment.id,
          label: "This update must be rejected",
          amount: "150.00",
          trigger: "before_start",
        },
        {
          id: secondConcurrentInstallment.id,
          label: "Final payment",
          amount: "300.00",
          trigger: "before_final_delivery",
        },
      ],
      updatedByAdminUserId: adminUserId,
    });

    equal(duePlanUpdateResult.outcome, "plan_locked");

    const installmentsAfterDueUpdate = await db
      .select()
      .from(commissionPaymentInstallments)
      .where(
        and(
          eq(
            commissionPaymentInstallments.commissionId,
            concurrent.commissionId,
          ),
          eq(
            commissionPaymentInstallments.quoteId,
            concurrent.quoteId,
          ),
        ),
      );

    equal(installmentsAfterDueUpdate.length, 2);

    const firstInstallmentAfterDueUpdate =
      installmentsAfterDueUpdate.find(
        (installment) => installment.id === firstConcurrentInstallment.id,
      );

    ok(firstInstallmentAfterDueUpdate);
    equal(firstInstallmentAfterDueUpdate.status, "due");
    equal(firstInstallmentAfterDueUpdate.label, "Initial payment");
    equal(firstInstallmentAfterDueUpdate.amount, "150.00");

    console.log(
      "[OK] Payment plan update rejected a plan with a non-pending installment",
    );

    /*
    * Verify grouped payment plan creation using a separate
    * temporary Commission, accepted Quote and draft Agreement.
    */
    const grouped = await prepareAcceptedQuote("Grouped Payment Plan");

    const groupedAgreementResult = await createCommissionAgreementDraft({
      commissionId: grouped.commissionId,
      quoteId: grouped.quoteId,
      termsVersion: "2026.1",
      agreementVersion: "verification-1",
      createdByAdminUserId: adminUserId,
    });

    equal(groupedAgreementResult.outcome, "created");

    if (groupedAgreementResult.outcome !== "created") {
      throw new Error("Could not create the grouped verification Agreement.");
    }

    const groupedPlanInput = {
      commissionId: grouped.commissionId,
      quoteId: grouped.quoteId,
      agreementId: groupedAgreementResult.agreement.id,
      createdByAdminUserId: adminUserId,
      plan: {
        projectStages: [
          {
            label: "Project booking payment",
            amount: "50.00",
            trigger: "before_start",
          },
        ],
        deliverables: [
          {
            title: "Illustration 1",
            description: "First illustration",
            quantity: 1,
            stages: [
              {
                label: "Illustration 1 - Initial payment",
                amount: "100.00",
                trigger: "before_start",
              },
              {
                label: "Illustration 1 - Final payment",
                amount: "100.00",
                trigger: "before_final_delivery",
              },
            ],
          },
          {
            title: "Illustration 2",
            description: "Second illustration",
            quantity: 1,
            stages: [
              {
                label: "Illustration 2 - Initial payment",
                amount: "100.00",
                trigger: "before_start",
              },
              {
                label: "Illustration 2 - Final payment",
                amount: "100.00",
                trigger: "before_final_delivery",
              },
            ],
          },
        ],
      },
    };

    const groupedPlanResult = await createCommissionGroupedPaymentPlan(
      groupedPlanInput,
    );

    if (groupedPlanResult.outcome !== "created") {
      throw new Error(
        `Grouped payment plan was not created: ${groupedPlanResult.outcome}`,
      );
    }

    const { deliverables, installments } = groupedPlanResult;

    equal(deliverables.length, 2);
    equal(installments.length, 5);

    equal(deliverables[0]?.title, "Illustration 1");
    equal(deliverables[0]?.sequence, 1);
    equal(deliverables[1]?.title, "Illustration 2");
    equal(deliverables[1]?.sequence, 2);

    equal(installments[0]?.deliverableId, null);
    equal(installments[0]?.amount, "50.00");

    equal(installments[1]?.deliverableId, deliverables[0]?.id);
    equal(installments[2]?.deliverableId, deliverables[0]?.id);

    equal(installments[3]?.deliverableId, deliverables[1]?.id);
    equal(installments[4]?.deliverableId, deliverables[1]?.id);

    equal(
      installments.every(
        (installment) =>
          installment.commissionId === grouped.commissionId &&
          installment.quoteId === grouped.quoteId &&
          installment.currency === "USD" &&
          installment.status === "pending",
      ),
      true,
    );

    console.log(
      "[OK] Grouped plan created two deliverables and five correctly linked payment stages",
    );

    const repeatedGroupedResult =
      await createCommissionGroupedPaymentPlan(groupedPlanInput);

    equal(repeatedGroupedResult.outcome, "plan_already_exists");

    console.log(
      "[OK] Repeated grouped plan creation was rejected",
    );

    /*
     * Edit the existing grouped plan on this temporary Commission.
     * Add a stage to Illustration 1; Illustration 2 must keep its IDs
     * even though its global stage sequences move from 4-5 to 5-6.
     */
    const groupedAgreementBeforeUpdateRows = await db
      .select({ updatedAt: commissionAgreements.updatedAt })
      .from(commissionAgreements)
      .where(eq(commissionAgreements.id, groupedAgreementResult.agreement.id))
      .limit(1);

    const groupedAgreementBeforeUpdate = groupedAgreementBeforeUpdateRows[0];
    ok(groupedAgreementBeforeUpdate);

    const groupedUpdateInput = {
      commissionId: grouped.commissionId,
      quoteId: grouped.quoteId,
      agreementId: groupedAgreementResult.agreement.id,
      expectedAgreementUpdatedAt: groupedAgreementBeforeUpdate.updatedAt,
      updatedByAdminUserId: adminUserId,
      plan: {
        projectStages: [
          {
            id: installments[0]!.id,
            label: "Project booking payment",
            amount: "50.00",
            trigger: "before_start",
          },
        ],
        deliverables: [
          {
            id: deliverables[0]!.id,
            title: "Illustration 1 - revised",
            description: "Updated first illustration",
            quantity: 2,
            stages: [
              {
                id: installments[1]!.id,
                label: "Illustration 1 - Initial payment",
                amount: "90.00",
                trigger: "before_start",
              },
              {
                id: installments[2]!.id,
                label: "Illustration 1 - Second payment",
                amount: "60.00",
                trigger: "after_sketch_approval",
              },
              {
                label: "Illustration 1 - New final payment",
                amount: "50.00",
                trigger: "before_final_delivery",
              },
            ],
          },
          {
            id: deliverables[1]!.id,
            title: "Illustration 2",
            description: "Second illustration",
            quantity: 1,
            stages: [
              {
                id: installments[3]!.id,
                label: "Illustration 2 - Initial payment",
                amount: "110.00",
                trigger: "before_start",
              },
              {
                id: installments[4]!.id,
                label: "Illustration 2 - Final payment",
                amount: "90.00",
                trigger: "before_final_delivery",
              },
            ],
          },
          {
            title: "Illustration 3 - new",
            description: "Covered by project-wide payments",
            quantity: 1,
            stages: [],
          },
        ],
      },
    } satisfies import("../lib/repositories/commissionPayments/commissionPaymentPlanRepository")
      .UpdateCommissionGroupedPaymentPlanInput;

    const groupedUpdateResult = await updateCommissionGroupedPaymentPlan(
      groupedUpdateInput,
    );

    equal(groupedUpdateResult.outcome, "updated");
    if (groupedUpdateResult.outcome !== "updated") {
      throw new Error("Expected grouped payment plan update to succeed.");
    }

    equal(groupedUpdateResult.deliverables.length, 3);
    equal(groupedUpdateResult.installments.length, 6);
    equal(groupedUpdateResult.deliverables[0]?.id, deliverables[0]?.id);
    equal(groupedUpdateResult.deliverables[1]?.id, deliverables[1]?.id);
    equal(groupedUpdateResult.deliverables[0]?.title, "Illustration 1 - revised");
    equal(groupedUpdateResult.deliverables[0]?.quantity, 2);
    equal(groupedUpdateResult.deliverables[2]?.sequence, 3);
    ok(!deliverables.some((row) => row.id === groupedUpdateResult.deliverables[2]?.id));

    const expectedStageIds = [
      installments[0]!.id,
      installments[1]!.id,
      installments[2]!.id,
      null,
      installments[3]!.id,
      installments[4]!.id,
    ];

    groupedUpdateResult.installments.forEach((stage, index) => {
      equal(stage.sequence, index + 1);
      if (expectedStageIds[index] !== null) {
        equal(stage.id, expectedStageIds[index]);
      } else {
        ok(!installments.some((oldStage) => oldStage.id === stage.id));
        equal(stage.label, "Illustration 1 - New final payment");
      }
      equal(stage.status, "pending");
      equal(stage.currency, "USD");
    });

    equal(groupedUpdateResult.installments[3]?.deliverableId, deliverables[0]?.id);
    equal(groupedUpdateResult.installments[4]?.deliverableId, deliverables[1]?.id);
    equal(groupedUpdateResult.installments[5]?.deliverableId, deliverables[1]?.id);
    equal(groupedUpdateResult.installments[4]?.amount, "110.00");
    equal(groupedUpdateResult.installments[5]?.amount, "90.00");

    const groupedAgreementAfterUpdateRows = await db
      .select({ updatedAt: commissionAgreements.updatedAt })
      .from(commissionAgreements)
      .where(eq(commissionAgreements.id, groupedAgreementResult.agreement.id))
      .limit(1);

    const groupedAgreementAfterUpdate = groupedAgreementAfterUpdateRows[0];
    ok(groupedAgreementAfterUpdate);
    ok(
      groupedAgreementAfterUpdate.updatedAt.getTime() >
        groupedAgreementBeforeUpdate.updatedAt.getTime(),
    );

    console.log(
      "[OK] Grouped update preserved IDs and associations, added a stage and deliverable, and renumbered later stages",
    );

    // A rejected edit must leave both the Agreement and the entire plan intact.
    async function getGroupedSnapshot(): Promise<string> {
      const [savedDeliverables, savedStages, savedAgreement] = await Promise.all([
        db.select().from(commissionDeliverables)
          .where(eq(commissionDeliverables.commissionId, grouped.commissionId))
          .orderBy(commissionDeliverables.sequence),
        db.select().from(commissionPaymentInstallments)
          .where(eq(commissionPaymentInstallments.commissionId, grouped.commissionId))
          .orderBy(commissionPaymentInstallments.sequence),
        db.select({ updatedAt: commissionAgreements.updatedAt })
          .from(commissionAgreements)
          .where(eq(commissionAgreements.id, groupedPlanInput.agreementId)),
      ]);
      return JSON.stringify({ savedDeliverables, savedStages, savedAgreement });
    }

    const savedSnapshot = await getGroupedSnapshot();
    const staleGroupedResult = await updateCommissionGroupedPaymentPlan(
      groupedUpdateInput,
    );
    equal(staleGroupedResult.outcome, "conflict");
    equal(await getGroupedSnapshot(), savedSnapshot);
    console.log("[OK] Stale Agreement version rejected without modifying the grouped plan");

    // A valid structure with an incorrect monetary total must be rejected.
    const invalidAmountPlan = {
      projectStages: [
        {
          id: groupedUpdateResult.installments[0]!.id,
          label: "Project booking payment",
          amount: "51.00",
          trigger: "before_start" as const,
        },
      ],
      deliverables: groupedUpdateResult.deliverables.map((deliverable) => ({
        id: deliverable.id,
        title: deliverable.title,
        description: deliverable.description,
        quantity: deliverable.quantity,
        stages: groupedUpdateResult.installments
          .filter((stage) => stage.deliverableId === deliverable.id)
          .map((stage) => ({
            id: stage.id,
            label: stage.label,
            amount: stage.amount,
            trigger: stage.trigger,
            customTriggerNote: stage.customTriggerNote,
          })),
      })),
    };

    const invalidAmountResult = await updateCommissionGroupedPaymentPlan({
      ...groupedUpdateInput,
      expectedAgreementUpdatedAt: groupedAgreementAfterUpdate.updatedAt,
      plan: invalidAmountPlan,
    });
    equal(invalidAmountResult.outcome, "invalid");
    equal(await getGroupedSnapshot(), savedSnapshot);
    console.log("[OK] Invalid grouped monetary total rejected without writes");

    // Force a late SQL failure after a real UPDATE, then verify full rollback.
    // This uses ONLY the temporary Commission created by this test script.
    const { neon } = await import("@neondatabase/serverless");
    const testDatabaseUrl = process.env.DATABASE_URL;
    ok(testDatabaseUrl);
    const httpSql = neon(testDatabaseUrl);
    let rollbackErrorCode: string | undefined;

    try {
      await httpSql.transaction([
        httpSql`
          UPDATE commission_deliverables
          SET title = 'SHOULD ROLL BACK'
          WHERE id = ${deliverables[0]!.id}::uuid
            AND commission_id = ${grouped.commissionId}::uuid
        `,
        httpSql`
          INSERT INTO commission_payment_installments
            (commission_id, quote_id, sequence, label, amount, currency, trigger)
          VALUES (
            ${grouped.commissionId}::uuid,
            ${grouped.quoteId}::uuid,
            1, 'Deliberate duplicate sequence', 1.00, 'USD', 'before_start'
          )
        `,
      ]);
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        rollbackErrorCode = String(error.code);
      }
    }

    equal(rollbackErrorCode, "23505");
    equal(await getGroupedSnapshot(), savedSnapshot);
    console.log("[OK] Late SQL error rolled back an earlier change on the temporary plan");

    // A linked payment locks the entire plan, even when its status is pending.
    await db.insert(commissionPayments).values({
      commissionId: grouped.commissionId,
      installmentId: groupedUpdateResult.installments[0]!.id,
      type: "installment",
      status: "pending",
      amount: "1.00",
      currency: "USD",
    });
    const lockedSnapshot = await getGroupedSnapshot();
    const lockedGroupedResult = await updateCommissionGroupedPaymentPlan({
      ...groupedUpdateInput,
      expectedAgreementUpdatedAt: groupedAgreementAfterUpdate.updatedAt,
    });
    equal(lockedGroupedResult.outcome, "plan_locked");
    equal(await getGroupedSnapshot(), lockedSnapshot);
    console.log("[OK] Linked payment locked the grouped plan without modifying it");

    console.log(
      "[OK] Commission agreement draft repository verification passed",
    );
  } finally {
    if (createdCommissionIds.length > 0) {
      /*
       * Delete child records before the Quotes and Commissions
       * they reference. Only temporary Commission IDs are used.
       */
      await db
        .delete(commissionEmailMessages)
        .where(
          inArray(
            commissionEmailMessages.commissionId,
            createdCommissionIds,
          ),
        );

      await db
      .delete(commissionPayments)
      .where(
        inArray(
          commissionPayments.commissionId,
          createdCommissionIds,
        ),
      );

      await db
        .delete(commissionPaymentInstallments)
        .where(
          inArray(
            commissionPaymentInstallments.commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(commissionDeliverables)
        .where(
          inArray(
            commissionDeliverables.commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(commissionAgreements)
        .where(
          inArray(
            commissionAgreements.commissionId,
            createdCommissionIds,
          ),
        );

      const quoteRows = await db
        .select({
          id: commissionQuotes.id,
        })
        .from(commissionQuotes)
        .where(
          inArray(
            commissionQuotes.commissionId,
            createdCommissionIds,
          ),
        );

      const quoteIds = quoteRows.map((quote) => quote.id);

      if (quoteIds.length > 0) {
        await db
          .delete(commissionQuoteItems)
          .where(inArray(commissionQuoteItems.quoteId, quoteIds));

        await db
          .delete(commissionQuotes)
          .where(inArray(commissionQuotes.id, quoteIds));
      }

      await db
        .delete(commissionEvents)
        .where(
          inArray(
            commissionEvents.commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(commissionStatusHistory)
        .where(
          inArray(
            commissionStatusHistory.commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(commissionEmailThreads)
        .where(
          inArray(
            commissionEmailThreads.commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(commissions)
        .where(inArray(commissions.id, createdCommissionIds));

      const remainingCommissionRows = await db
        .select({
          id: commissions.id,
        })
        .from(commissions)
        .where(inArray(commissions.id, createdCommissionIds));

      equal(remainingCommissionRows.length, 0);

      console.log("[OK] Temporary agreement verification data was removed");
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    "Commission agreement draft repository verification failed:",
    error,
  );

  process.exitCode = 1;
});