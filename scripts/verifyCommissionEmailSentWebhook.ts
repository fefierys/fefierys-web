import {
  equal,
  ok,
} from "node:assert/strict";
import {
  randomUUID,
} from "node:crypto";

import {
  inArray,
} from "drizzle-orm";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Run this script with .env.local loaded.",
    );
  }

  const { db } =
    await import("../lib/db");
  const {
    commissionEmailMessages,
    commissionEmailThreads,
    commissions,
  } = await import(
    "../lib/db/schema/commissions"
  );
  const {
    claimCommissionEmailMessageForSending,
    createCommissionEmailThreadIfMissing,
    createQueuedCommissionEmailMessage,
    getCommissionEmailMessageById,
    getCommissionEmailThreadById,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );
  const {
    processCommissionEmailSentEvent,
  } = await import(
    "../lib/email/commissionEmailSentWebhookService"
  );
  const {
    deliverCommissionEmailMessage,
  } = await import(
    "../lib/email/commissionEmailDeliveryService"
  );

  const commissionIds: string[] =
    [];

  async function createCommissionFixture(
    prefix: string,
  ): Promise<{
    commissionId: string;
    reference: string;
  }> {
    const commissionId =
      randomUUID();
    const reference =
      `${prefix}-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 12)
        .toUpperCase()}`;

    await db
      .insert(commissions)
      .values({
        id: commissionId,
        submissionId:
          randomUUID(),
        reference,
        clientName:
          "Webhook Verification",
        clientEmail:
          "webhook-verification@example.com",
        initialMessage:
          "Temporary fixture created by verifyCommissionEmailSentWebhook.",
      });

    commissionIds.push(
      commissionId,
    );

    return {
      commissionId,
      reference,
    };
  }

  try {
    const rootFixture =
      await createCommissionFixture(
        "WHROOT",
      );

    const threadResult =
      await createCommissionEmailThreadIfMissing({
        commissionId:
          rootFixture.commissionId,
        subject:
          `Fefierys Art — Your project — ${rootFixture.reference}`,
      });

    const rootMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          rootFixture.commissionId,
        threadId:
          threadResult.thread.id,
        quoteId: null,
        scope:
          "client_thread",
        kind:
          "inquiry_confirmation",
        actor:
          "system",
        senderEmail:
          "contact@example.com",
        recipientEmail:
          "client@example.com",
        replyToEmail:
          "artist@example.com",
        subject:
          threadResult.thread.subject,
        messageText:
          "Root webhook verification message.",
        inReplyToMessageId:
          null,
        referencesHeader:
          null,
        createdByAdminUserId:
          null,
      });

    const claimedRoot =
      await claimCommissionEmailMessageForSending(
        rootMessage.id,
      );

    ok(claimedRoot);
    equal(
      claimedRoot.deliveryStatus,
      "sending",
    );

    const rootProviderEmailId =
      `resend-${randomUUID()}`;
    const rootProviderMessageId =
      `<${randomUUID()}@email.fefierys.test>`;
    const sentAt =
      new Date();

    const rootResult =
      await processCommissionEmailSentEvent({
        messageId:
          rootMessage.id,
        providerEmailId:
          rootProviderEmailId,
        providerMessageId:
          rootProviderMessageId,
        sentAt,
      });

    equal(
      rootResult.outcome,
      "processed",
    );

    const persistedRootMessage =
      await getCommissionEmailMessageById(
        rootMessage.id,
      );

    ok(persistedRootMessage);
    equal(
      persistedRootMessage.deliveryStatus,
      "sent",
    );
    equal(
      persistedRootMessage.providerEmailId,
      rootProviderEmailId,
    );
    equal(
      persistedRootMessage.providerMessageId,
      rootProviderMessageId,
    );

    const persistedRootThread =
      await getCommissionEmailThreadById(
        threadResult.thread.id,
      );

    ok(persistedRootThread);
    equal(
      persistedRootThread.rootProviderEmailId,
      rootProviderEmailId,
    );
    equal(
      persistedRootThread.rootMessageId,
      rootProviderMessageId,
    );

    console.log(
      "[OK] email.sent reconciles a sending root message and completes the client thread root",
    );

    const duplicateResult =
      await processCommissionEmailSentEvent({
        messageId:
          rootMessage.id,
        providerEmailId:
          rootProviderEmailId,
        providerMessageId:
          rootProviderMessageId,
        sentAt,
      });

    equal(
      duplicateResult.outcome,
      "already_processed",
    );

    console.log(
      "[OK] Replayed email.sent event is idempotent",
    );

    const conflictingResult =
      await processCommissionEmailSentEvent({
        messageId:
          rootMessage.id,
        providerEmailId:
          rootProviderEmailId,
        providerMessageId:
          `<${randomUUID()}@email.fefierys.test>`,
        sentAt,
      });

    equal(
      conflictingResult.outcome,
      "conflict",
    );

    const threadAfterConflict =
      await getCommissionEmailThreadById(
        threadResult.thread.id,
      );

    ok(threadAfterConflict);
    equal(
      threadAfterConflict.rootMessageId,
      rootProviderMessageId,
    );

    console.log(
      "[OK] Conflicting webhook Message-ID cannot overwrite persisted provider identity",
    );

    const laterMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          rootFixture.commissionId,
        threadId:
          threadResult.thread.id,
        quoteId: null,
        scope:
          "client_thread",
        kind:
          "general_message",
        actor:
          "artist",
        senderEmail:
          "contact@example.com",
        recipientEmail:
          "client@example.com",
        replyToEmail:
          "artist@example.com",
        subject:
          threadResult.thread.subject,
        messageText:
          "Later webhook verification message.",
        inReplyToMessageId:
          null,
        referencesHeader:
          null,
        createdByAdminUserId:
          null,
      });

    const claimedLater =
      await claimCommissionEmailMessageForSending(
        laterMessage.id,
      );

    ok(claimedLater);
    equal(
      claimedLater.inReplyToMessageId,
      rootProviderMessageId,
    );
    equal(
      claimedLater.referencesHeader,
      rootProviderMessageId,
    );

    const laterProviderEmailId =
      `resend-${randomUUID()}`;
    const laterProviderMessageId =
      `<${randomUUID()}@email.fefierys.test>`;

    const laterResult =
      await processCommissionEmailSentEvent({
        messageId:
          laterMessage.id,
        providerEmailId:
          laterProviderEmailId,
        providerMessageId:
          laterProviderMessageId,
        sentAt:
          new Date(),
      });

    equal(
      laterResult.outcome,
      "processed",
    );

    const threadAfterLater =
      await getCommissionEmailThreadById(
        threadResult.thread.id,
      );

    ok(threadAfterLater);
    equal(
      threadAfterLater.rootProviderEmailId,
      rootProviderEmailId,
    );
    equal(
      threadAfterLater.rootMessageId,
      rootProviderMessageId,
    );

    const persistedLater =
      await getCommissionEmailMessageById(
        laterMessage.id,
      );

    ok(persistedLater);
    equal(
      persistedLater.providerEmailId,
      laterProviderEmailId,
    );
    equal(
      persistedLater.providerMessageId,
      laterProviderMessageId,
    );

    console.log(
      "[OK] Later client email stores its provider Message-ID without replacing the immutable thread root",
    );

    const raceFixture =
      await createCommissionFixture(
        "WHRACE",
      );

    const raceThread =
      await createCommissionEmailThreadIfMissing({
        commissionId:
          raceFixture.commissionId,
        subject:
          `Fefierys Art — Your project — ${raceFixture.reference}`,
      });

    const raceMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          raceFixture.commissionId,
        threadId:
          raceThread.thread.id,
        quoteId: null,
        scope:
          "client_thread",
        kind:
          "inquiry_confirmation",
        actor:
          "system",
        senderEmail:
          "contact@example.com",
        recipientEmail:
          "client@example.com",
        replyToEmail:
          "artist@example.com",
        subject:
          raceThread.thread.subject,
        messageText:
          "Webhook-before-send-response race verification.",
        inReplyToMessageId:
          null,
        referencesHeader:
          null,
        createdByAdminUserId:
          null,
      });

    const raceProviderEmailId =
      `resend-${randomUUID()}`;
    const raceProviderMessageId =
      `<${randomUUID()}@email.fefierys.test>`;

    const raceDelivery =
      await deliverCommissionEmailMessage(
        {
          messageId:
            raceMessage.id,
          body: {
            text:
              "Webhook-before-send-response race verification.",
          },
        },
        {
          async send(input) {
            equal(
              input.trackingMessageId,
              raceMessage.id,
            );

            const webhookResult =
              await processCommissionEmailSentEvent({
                messageId:
                  raceMessage.id,
                providerEmailId:
                  raceProviderEmailId,
                providerMessageId:
                  raceProviderMessageId,
                sentAt:
                  new Date(),
              });

            equal(
              webhookResult.outcome,
              "processed",
            );

            /*
             * This mirrors the real send-only Resend adapter: the POST send
             * response has the provider email ID, while RFC Message-ID comes
             * from email.sent.
             */
            return {
              outcome: "sent" as const,
              providerEmailId:
                raceProviderEmailId,
              providerMessageId:
                null,
            };
          },
        },
      );

    equal(
      raceDelivery.outcome,
      "sent",
    );

    const persistedRaceMessage =
      await getCommissionEmailMessageById(
        raceMessage.id,
      );

    ok(persistedRaceMessage);
    equal(
      persistedRaceMessage.deliveryStatus,
      "sent",
    );
    equal(
      persistedRaceMessage.providerEmailId,
      raceProviderEmailId,
    );
    equal(
      persistedRaceMessage.providerMessageId,
      raceProviderMessageId,
    );

    const persistedRaceThread =
      await getCommissionEmailThreadById(
        raceThread.thread.id,
      );

    ok(persistedRaceThread);
    equal(
      persistedRaceThread.rootProviderEmailId,
      raceProviderEmailId,
    );
    equal(
      persistedRaceThread.rootMessageId,
      raceProviderMessageId,
    );

    console.log(
      "[OK] email.sent may complete before send() returns without breaking delivery finalization",
    );

    const internalFixture =
      await createCommissionFixture(
        "WHINT",
      );

    const internalMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          internalFixture.commissionId,
        threadId: null,
        quoteId: null,
        scope:
          "internal_notification",
        kind:
          "internal_inquiry_notification",
        actor:
          "system",
        senderEmail:
          "contact@example.com",
        recipientEmail:
          "artist@example.com",
        replyToEmail:
          null,
        subject:
          `Fefierys Admin — New project inquiry — ${internalFixture.reference}`,
        messageText:
          "Internal webhook verification message.",
        inReplyToMessageId:
          null,
        referencesHeader:
          null,
        createdByAdminUserId:
          null,
      });

    const claimedInternal =
      await claimCommissionEmailMessageForSending(
        internalMessage.id,
      );

    ok(claimedInternal);

    const internalProviderEmailId =
      `resend-${randomUUID()}`;
    const internalProviderMessageId =
      `<${randomUUID()}@email.fefierys.test>`;

    const internalResult =
      await processCommissionEmailSentEvent({
        messageId:
          internalMessage.id,
        providerEmailId:
          internalProviderEmailId,
        providerMessageId:
          internalProviderMessageId,
        sentAt:
          new Date(),
      });

    equal(
      internalResult.outcome,
      "processed",
    );

    const persistedInternal =
      await getCommissionEmailMessageById(
        internalMessage.id,
      );

    ok(persistedInternal);
    equal(
      persistedInternal.deliveryStatus,
      "sent",
    );
    equal(
      persistedInternal.providerMessageId,
      internalProviderMessageId,
    );
    equal(
      persistedInternal.threadId,
      null,
    );

    console.log(
      "[OK] Internal notification reconciles without creating or mutating a client thread",
    );

    const missingResult =
      await processCommissionEmailSentEvent({
        messageId:
          randomUUID(),
        providerEmailId:
          `resend-${randomUUID()}`,
        providerMessageId:
          `<${randomUUID()}@email.fefierys.test>`,
        sentAt:
          new Date(),
      });

    equal(
      missingResult.outcome,
      "not_found",
    );

    console.log(
      "[OK] Unknown tracked message is ignored by the reconciliation layer",
    );

    console.log(
      "[OK] Commission email.sent webhook verification passed",
    );
  } finally {
    if (
      commissionIds.length > 0
    ) {
      await db
        .delete(
          commissionEmailMessages,
        )
        .where(
          inArray(
            commissionEmailMessages.commissionId,
            commissionIds,
          ),
        );

      await db
        .delete(
          commissionEmailThreads,
        )
        .where(
          inArray(
            commissionEmailThreads.commissionId,
            commissionIds,
          ),
        );

      await db
        .delete(
          commissions,
        )
        .where(
          inArray(
            commissions.id,
            commissionIds,
          ),
        );
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "[ERROR] Commission email.sent webhook verification failed",
      error,
    );
    process.exitCode = 1;
  },
);
