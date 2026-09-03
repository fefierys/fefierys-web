import { equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

import type { CommissionQuoteItem } from "../lib/repositories/commissionQuoteRepository";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  const { and, asc, eq, inArray } = await import("drizzle-orm");

  const { db } = await import("../lib/db");

  const {
    commissionEvents,
    commissionQuoteItems,
    commissionQuotes,
    commissions,
    commissionStatusHistory,
  } = await import("../lib/db/schema/commissions");

  const { createCommission } =
    await import("../lib/repositories/commissionRepository");

  const {
    acceptCommissionQuote,
    createCommissionQuoteDraft,
    declineCommissionQuote,
    expireCommissionQuote,
    getCommissionQuoteById,
    getCommissionQuotes,
    sendCommissionQuote,
    supersedeCommissionQuote,
    updateCommissionQuoteDraft,
  } = await import("../lib/repositories/commissionQuoteRepository");

  const { transitionCommissionStatus } =
    await import("../lib/repositories/commissionWorkflowRepository");

  const verificationId = randomUUID();
  const createdCommissionIds: string[] = [];

  async function createTemporaryCommission(label: string): Promise<string> {
    const commission = await createCommission({
      submissionId: randomUUID(),
      clientName: `Quote ${label} Verification`,
      clientEmail: `quote-${label.toLowerCase()}-${verificationId}@example.com`,
      initialMessage: `Temporary quote ${label} verification ${verificationId}`,
      termsVersion: "2026.1",
    });

    createdCommissionIds.push(commission.id);

    return commission.id;
  }

  async function moveCommissionToQuoting(commissionId: string): Promise<void> {
    const reviewResult = await transitionCommissionStatus({
      commissionId,
      fromStatus: "received",
      toStatus: "under_review",
      initiatedBy: "artist",
      changedByAdminUserId: "quote-verifier",
    });

    equal(reviewResult.outcome, "updated");

    const quotingResult = await transitionCommissionStatus({
      commissionId,
      fromStatus: "under_review",
      toStatus: "quoting",
      initiatedBy: "artist",
      changedByAdminUserId: "quote-verifier",
    });

    equal(quotingResult.outcome, "updated");
  }

  const draftInput = {
    currency: "usd",
    description: "Character illustration quote",
    notes: "Internal verification note",
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    items: [
      {
        label: "Full illustration",
        description: "Full render",
        quantity: 1,
        unitAmount: "450",
      },
      {
        label: "Additional character",
        quantity: 2,
        unitAmount: "80",
      },
      {
        label: "Indie author adjustment",
        quantity: 1,
        unitAmount: "-60",
      },
    ],
    createdByAdminUserId: "quote-verifier",
  } as const;

  try {
    const invalidCommissionId = await createTemporaryCommission("Invalid");

    const invalidDraft = await createCommissionQuoteDraft({
      commissionId: invalidCommissionId,
      currency: "US",
      items: [],
      createdByAdminUserId: "quote-verifier",
    });

    equal(invalidDraft.outcome, "invalid");

    console.log("[OK] Invalid quote draft was rejected");

    const wrongStatusDraft = await createCommissionQuoteDraft({
      commissionId: invalidCommissionId,
      ...draftInput,
    });

    equal(wrongStatusDraft.outcome, "wrong_status");

    if (wrongStatusDraft.outcome === "wrong_status") {
      equal(wrongStatusDraft.currentStatus, "received");
    }

    console.log("[OK] Quote draft requires the quoting commission status");

    const missingDraft = await createCommissionQuoteDraft({
      commissionId: randomUUID(),
      ...draftInput,
    });

    equal(missingDraft.outcome, "not_found");

    console.log("[OK] Missing commission quote draft returns not_found");

    const invalidUpdate = await updateCommissionQuoteDraft({
      quoteId: randomUUID(),
      expectedUpdatedAt: new Date(),
      currency: "US",
      description: "Invalid quote update",
      items: [],
      updatedByAdminUserId: "quote-verifier",
    });

    equal(invalidUpdate.outcome, "invalid");

    console.log("[OK] Invalid quote draft update was rejected");

    const missingUpdate = await updateCommissionQuoteDraft({
      quoteId: randomUUID(),
      expectedUpdatedAt: new Date(),
      currency: "USD",
      description: "Missing quote update",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Missing quote item",
          quantity: 1,
          unitAmount: "100",
        },
      ],
      updatedByAdminUserId: "quote-verifier",
    });

    equal(missingUpdate.outcome, "not_found");

    console.log("[OK] Missing quote draft update returns not_found");

    const primaryCommissionId = await createTemporaryCommission("Primary");

    await moveCommissionToQuoting(primaryCommissionId);

    const createdDraft = await createCommissionQuoteDraft({
      commissionId: primaryCommissionId,
      ...draftInput,
    });

    equal(createdDraft.outcome, "created");

    if (createdDraft.outcome !== "created") {
      throw new Error("Expected the primary quote draft to be created.");
    }

    equal(createdDraft.quote.commissionId, primaryCommissionId);
    equal(createdDraft.quote.version, 1);
    equal(createdDraft.quote.status, "draft");
    equal(createdDraft.quote.currency, "USD");
    equal(createdDraft.quote.totalAmount, "550.00");
    equal(createdDraft.quote.description, "Character illustration quote");
    equal(createdDraft.quote.notes, "Internal verification note");
    equal(createdDraft.items.length, 3);
    equal(createdDraft.event.type, "quote_created");
    equal(createdDraft.event.actor, "artist");
    equal(createdDraft.event.createdByAdminUserId, "quote-verifier");

    console.log("[OK] Quote draft, items, and event were created atomically");

    const storedQuote = await getCommissionQuoteById(createdDraft.quote.id);

    ok(storedQuote);
    equal(storedQuote.quote.version, 1);
    equal(storedQuote.items.length, 3);
    equal(storedQuote.items[0]?.sequence, 1);
    equal(storedQuote.items[0]?.label, "Full illustration");
    equal(storedQuote.items[0]?.unitAmount, "450.00");
    equal(storedQuote.items[1]?.sequence, 2);
    equal(storedQuote.items[1]?.quantity, 2);
    equal(storedQuote.items[2]?.sequence, 3);
    equal(storedQuote.items[2]?.unitAmount, "-60.00");

    const commissionQuotesWithItems =
      await getCommissionQuotes(primaryCommissionId);

    equal(commissionQuotesWithItems.length, 1);
    equal(commissionQuotesWithItems[0]?.quote.id, createdDraft.quote.id);
    equal(commissionQuotesWithItems[0]?.items.length, 3);

    console.log("[OK] Quote detail and commission quote history are ordered");

    const duplicateDraft = await createCommissionQuoteDraft({
      commissionId: primaryCommissionId,
      ...draftInput,
    });

    equal(duplicateDraft.outcome, "active_quote_exists");

    if (duplicateDraft.outcome === "active_quote_exists") {
      equal(duplicateDraft.activeQuote.id, createdDraft.quote.id);

      equal(duplicateDraft.activeQuote.version, 1);
      equal(duplicateDraft.activeQuote.status, "draft");
    }

    const primaryQuoteRows = await db
      .select({
        id: commissionQuotes.id,
      })
      .from(commissionQuotes)
      .where(eq(commissionQuotes.commissionId, primaryCommissionId));

    equal(primaryQuoteRows.length, 1);

    console.log("[OK] A second active quote draft was rejected");

    const updatedDraft = await updateCommissionQuoteDraft({
      quoteId: createdDraft.quote.id,
      expectedUpdatedAt: createdDraft.quote.updatedAt,
      currency: "usd",
      description: "Updated character illustration quote",
      notes: "Updated internal verification note",
      validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Updated full illustration",
          description: "Updated full render",
          quantity: 1,
          unitAmount: "650",
        },
        {
          label: "Additional character",
          quantity: 1,
          unitAmount: "80",
        },
      ],
      updatedByAdminUserId: "quote-update-verifier",
    });

    equal(updatedDraft.outcome, "updated");

    if (updatedDraft.outcome !== "updated") {
      throw new Error("Expected the quote draft to be updated.");
    }

    equal(updatedDraft.quote.id, createdDraft.quote.id);
    equal(updatedDraft.quote.commissionId, primaryCommissionId);
    equal(updatedDraft.quote.version, 1);
    equal(updatedDraft.quote.status, "draft");
    equal(updatedDraft.quote.currency, "USD");
    equal(updatedDraft.quote.totalAmount, "730.00");

    equal(
      updatedDraft.quote.description,
      "Updated character illustration quote",
    );

    equal(updatedDraft.quote.notes, "Updated internal verification note");

    ok(
      updatedDraft.quote.updatedAt.getTime() >
        createdDraft.quote.updatedAt.getTime(),
    );

    equal(updatedDraft.items.length, 2);

    equal(updatedDraft.items[0]?.id, storedQuote.items[0]?.id);

    equal(updatedDraft.items[0]?.sequence, 1);
    equal(updatedDraft.items[0]?.label, "Updated full illustration");
    equal(updatedDraft.items[0]?.description, "Updated full render");
    equal(updatedDraft.items[0]?.quantity, 1);
    equal(updatedDraft.items[0]?.unitAmount, "650.00");

    equal(updatedDraft.items[1]?.id, storedQuote.items[1]?.id);

    equal(updatedDraft.items[1]?.sequence, 2);
    equal(updatedDraft.items[1]?.label, "Additional character");
    equal(updatedDraft.items[1]?.quantity, 1);
    equal(updatedDraft.items[1]?.unitAmount, "80.00");

    equal(updatedDraft.event.type, "quote_updated");
    equal(updatedDraft.event.actor, "artist");

    equal(updatedDraft.event.createdByAdminUserId, "quote-update-verifier");

    const removedItemRows = await db
      .select({
        id: commissionQuoteItems.id,
      })
      .from(commissionQuoteItems)
      .where(eq(commissionQuoteItems.id, storedQuote.items[2]!.id));

    equal(removedItemRows.length, 0);

    console.log("[OK] Quote draft fields and items were updated atomically");

    const staleUpdate = await updateCommissionQuoteDraft({
      quoteId: createdDraft.quote.id,

      /*
       * This is intentionally the timestamp from before the
       * successful update.
       */
      expectedUpdatedAt: createdDraft.quote.updatedAt,

      currency: "EUR",
      description: "This stale update must not be persisted",
      notes: "This stale note must not be persisted",
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Stale item",
          quantity: 1,
          unitAmount: "999",
        },
      ],
      updatedByAdminUserId: "stale-quote-verifier",
    });

    equal(staleUpdate.outcome, "conflict");

    if (staleUpdate.outcome === "conflict") {
      equal(
        staleUpdate.currentUpdatedAt.getTime(),
        updatedDraft.quote.updatedAt.getTime(),
      );
    }

    const quoteAfterStaleUpdate = await getCommissionQuoteById(
      createdDraft.quote.id,
    );

    ok(quoteAfterStaleUpdate);

    equal(quoteAfterStaleUpdate.quote.currency, "USD");
    equal(quoteAfterStaleUpdate.quote.totalAmount, "730.00");

    equal(
      quoteAfterStaleUpdate.quote.description,
      "Updated character illustration quote",
    );

    equal(
      quoteAfterStaleUpdate.quote.notes,
      "Updated internal verification note",
    );

    equal(quoteAfterStaleUpdate.items.length, 2);
    equal(quoteAfterStaleUpdate.items[0]?.label, "Updated full illustration");
    equal(quoteAfterStaleUpdate.items[0]?.unitAmount, "650.00");
    equal(quoteAfterStaleUpdate.items[1]?.label, "Additional character");
    equal(quoteAfterStaleUpdate.items[1]?.unitAmount, "80.00");

    const primaryQuoteUpdatedEvents = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, primaryCommissionId),
          eq(commissionEvents.type, "quote_updated"),
        ),
      );

    equal(primaryQuoteUpdatedEvents.length, 1);
    equal(primaryQuoteUpdatedEvents[0]?.id, updatedDraft.event.id);

    console.log("[OK] Stale quote update was rejected without partial writes");

    const concurrentUpdateResults = await Promise.all([
      updateCommissionQuoteDraft({
        quoteId: createdDraft.quote.id,
        expectedUpdatedAt: updatedDraft.quote.updatedAt,
        currency: "USD",
        description: "Concurrent draft update A",
        notes: "Concurrent note A",
        validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        items: [
          {
            label: "Concurrent service A",
            quantity: 1,
            unitAmount: "700",
          },
          {
            label: "Concurrent addition A",
            quantity: 2,
            unitAmount: "50",
          },
          {
            label: "Concurrent adjustment A",
            quantity: 1,
            unitAmount: "-25",
          },
        ],
        updatedByAdminUserId: "concurrent-update-verifier-a",
      }),

      updateCommissionQuoteDraft({
        quoteId: createdDraft.quote.id,
        expectedUpdatedAt: updatedDraft.quote.updatedAt,
        currency: "EUR",
        description: "Concurrent draft update B",
        notes: "Concurrent note B",
        validUntil: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        items: [
          {
            label: "Concurrent service B",
            quantity: 1,
            unitAmount: "800",
          },
          {
            label: "Concurrent addition B",
            quantity: 1,
            unitAmount: "75",
          },
          {
            label: "Concurrent adjustment B",
            quantity: 1,
            unitAmount: "-50",
          },
        ],
        updatedByAdminUserId: "concurrent-update-verifier-b",
      }),
    ]);

    equal(
      concurrentUpdateResults.filter((result) => result.outcome === "updated")
        .length,
      1,
    );

    equal(
      concurrentUpdateResults.filter((result) => result.outcome === "conflict")
        .length,
      1,
    );

    const successfulConcurrentUpdate = concurrentUpdateResults.find(
      (result) => result.outcome === "updated",
    );

    ok(successfulConcurrentUpdate);

    if (successfulConcurrentUpdate.outcome !== "updated") {
      throw new Error("Expected one concurrent quote update to succeed.");
    }

    const quoteAfterConcurrentUpdate = await getCommissionQuoteById(
      createdDraft.quote.id,
    );

    ok(quoteAfterConcurrentUpdate);
    equal(quoteAfterConcurrentUpdate.items.length, 3);

    if (
      successfulConcurrentUpdate.quote.description ===
      "Concurrent draft update A"
    ) {
      equal(quoteAfterConcurrentUpdate.quote.currency, "USD");
      equal(quoteAfterConcurrentUpdate.quote.totalAmount, "775.00");
      equal(quoteAfterConcurrentUpdate.quote.notes, "Concurrent note A");

      equal(quoteAfterConcurrentUpdate.items[0]?.label, "Concurrent service A");

      equal(quoteAfterConcurrentUpdate.items[0]?.unitAmount, "700.00");

      equal(
        quoteAfterConcurrentUpdate.items[1]?.label,
        "Concurrent addition A",
      );

      equal(quoteAfterConcurrentUpdate.items[1]?.quantity, 2);

      equal(
        quoteAfterConcurrentUpdate.items[2]?.label,
        "Concurrent adjustment A",
      );

      equal(quoteAfterConcurrentUpdate.items[2]?.unitAmount, "-25.00");
    } else {
      equal(
        successfulConcurrentUpdate.quote.description,
        "Concurrent draft update B",
      );

      equal(quoteAfterConcurrentUpdate.quote.currency, "EUR");
      equal(quoteAfterConcurrentUpdate.quote.totalAmount, "825.00");
      equal(quoteAfterConcurrentUpdate.quote.notes, "Concurrent note B");

      equal(quoteAfterConcurrentUpdate.items[0]?.label, "Concurrent service B");

      equal(quoteAfterConcurrentUpdate.items[0]?.unitAmount, "800.00");

      equal(
        quoteAfterConcurrentUpdate.items[1]?.label,
        "Concurrent addition B",
      );

      equal(quoteAfterConcurrentUpdate.items[1]?.quantity, 1);

      equal(
        quoteAfterConcurrentUpdate.items[2]?.label,
        "Concurrent adjustment B",
      );

      equal(quoteAfterConcurrentUpdate.items[2]?.unitAmount, "-50.00");
    }

    const quoteUpdatedEventsAfterConcurrency = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, primaryCommissionId),
          eq(commissionEvents.type, "quote_updated"),
        ),
      );

    /*
     * One event belongs to the first successful update and one
     * belongs to the winner of the concurrent updates.
     */
    equal(quoteUpdatedEventsAfterConcurrency.length, 2);

    console.log(
      "[OK] Concurrent quote update produced one update and one conflict",
    );

    const concurrentCommissionId =
      await createTemporaryCommission("Concurrent");

    await moveCommissionToQuoting(concurrentCommissionId);

    const concurrentResults = await Promise.all([
      createCommissionQuoteDraft({
        commissionId: concurrentCommissionId,
        ...draftInput,
        description: "Concurrent quote A",
      }),

      createCommissionQuoteDraft({
        commissionId: concurrentCommissionId,
        ...draftInput,
        description: "Concurrent quote B",
      }),
    ]);

    equal(
      concurrentResults.filter((result) => result.outcome === "created").length,
      1,
    );

    equal(
      concurrentResults.filter(
        (result) =>
          result.outcome === "active_quote_exists" ||
          result.outcome === "conflict",
      ).length,
      1,
    );

    const concurrentQuoteRows = await db
      .select()
      .from(commissionQuotes)
      .where(eq(commissionQuotes.commissionId, concurrentCommissionId));

    equal(concurrentQuoteRows.length, 1);

    const concurrentQuoteId = concurrentQuoteRows[0]?.id;

    ok(concurrentQuoteId);

    const concurrentItemRows = await db
      .select()
      .from(commissionQuoteItems)
      .where(eq(commissionQuoteItems.quoteId, concurrentQuoteId))
      .orderBy(asc(commissionQuoteItems.sequence));

    equal(concurrentItemRows.length, 3);

    const concurrentEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentCommissionId),
          eq(commissionEvents.type, "quote_created"),
        ),
      );

    equal(concurrentEventRows.length, 1);

    console.log("[OK] Concurrent draft creation produced no duplicates");

    const concurrentStoredQuote =
      await getCommissionQuoteById(concurrentQuoteId);

    ok(concurrentStoredQuote);

    const sentAt = new Date();

    await db
      .update(commissionQuotes)
      .set({
        status: "sent",
        sentAt,
        updatedAt: sentAt,
      })
      .where(eq(commissionQuotes.id, concurrentQuoteId));

    const sentQuoteUpdate = await updateCommissionQuoteDraft({
      quoteId: concurrentQuoteId,
      expectedUpdatedAt: concurrentStoredQuote.quote.updatedAt,
      currency: "USD",
      description: "Sent quote must not be editable",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Forbidden sent quote update",
          quantity: 1,
          unitAmount: "100",
        },
      ],
      updatedByAdminUserId: "quote-verifier",
    });

    equal(sentQuoteUpdate.outcome, "not_draft");

    if (sentQuoteUpdate.outcome === "not_draft") {
      equal(sentQuoteUpdate.currentStatus, "sent");
    }

    const sentQuoteAfterUpdateAttempt =
      await getCommissionQuoteById(concurrentQuoteId);

    ok(sentQuoteAfterUpdateAttempt);
    equal(sentQuoteAfterUpdateAttempt.quote.status, "sent");
    equal(sentQuoteAfterUpdateAttempt.items.length, 3);

    equal(
      sentQuoteAfterUpdateAttempt.quote.description === "Concurrent quote A" ||
        sentQuoteAfterUpdateAttempt.quote.description === "Concurrent quote B",
      true,
    );

    console.log("[OK] Sent quote draft update was rejected");

    const leaveQuotingResult = await transitionCommissionStatus({
      commissionId: primaryCommissionId,
      fromStatus: "quoting",
      toStatus: "awaiting_quote_response",
      initiatedBy: "artist",
      changedByAdminUserId: "quote-verifier",
    });

    equal(leaveQuotingResult.outcome, "updated");

    const wrongCommissionStatusUpdate = await updateCommissionQuoteDraft({
      quoteId: createdDraft.quote.id,

      expectedUpdatedAt: successfulConcurrentUpdate.quote.updatedAt,

      currency: successfulConcurrentUpdate.quote.currency,

      description: successfulConcurrentUpdate.quote.description,

      notes: successfulConcurrentUpdate.quote.notes,

      validUntil: successfulConcurrentUpdate.quote.validUntil,

      items: successfulConcurrentUpdate.items.map((item) => ({
        label: item.label,
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
      })),

      updatedByAdminUserId: "quote-verifier",
    });

    equal(wrongCommissionStatusUpdate.outcome, "wrong_commission_status");

    if (wrongCommissionStatusUpdate.outcome === "wrong_commission_status") {
      equal(
        wrongCommissionStatusUpdate.currentStatus,
        "awaiting_quote_response",
      );
    }

    const primaryQuoteAfterWrongStatus = await getCommissionQuoteById(
      createdDraft.quote.id,
    );

    ok(primaryQuoteAfterWrongStatus);

    equal(
      primaryQuoteAfterWrongStatus.quote.updatedAt.getTime(),
      successfulConcurrentUpdate.quote.updatedAt.getTime(),
    );

    const primaryUpdateEventsAfterWrongStatus = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, primaryCommissionId),
          eq(commissionEvents.type, "quote_updated"),
        ),
      );

    equal(primaryUpdateEventsAfterWrongStatus.length, 2);

    console.log("[OK] Quote update requires the quoting commission status");

    const sendCommissionId = await createTemporaryCommission("Send");

    await moveCommissionToQuoting(sendCommissionId);

    const draftToSend = await createCommissionQuoteDraft({
      commissionId: sendCommissionId,
      currency: "USD",
      description: "Quote ready to send",
      notes: "Send verification note",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Front cover",
          description: "Commercial book cover illustration",
          quantity: 1,
          unitAmount: "450",
        },
        {
          label: "Additional character",
          quantity: 1,
          unitAmount: "80",
        },
        {
          label: "Indie author adjustment",
          quantity: 1,
          unitAmount: "-30",
        },
      ],
      createdByAdminUserId: "quote-send-verifier",
    });

    equal(draftToSend.outcome, "created");

    if (draftToSend.outcome !== "created") {
      throw new Error("Expected the send quote draft to be created.");
    }

    const sentResult = await sendCommissionQuote({
      quoteId: draftToSend.quote.id,
      expectedUpdatedAt: draftToSend.quote.updatedAt,
      sentByAdminUserId: "quote-send-verifier",
    });

    equal(sentResult.outcome, "sent");

    if (sentResult.outcome !== "sent") {
      throw new Error("Expected the quote to be sent.");
    }

    equal(sentResult.quote.id, draftToSend.quote.id);
    equal(sentResult.quote.commissionId, sendCommissionId);
    equal(sentResult.quote.version, 1);
    equal(sentResult.quote.status, "sent");
    equal(sentResult.quote.currency, "USD");
    equal(sentResult.quote.totalAmount, "500.00");
    ok(sentResult.quote.sentAt instanceof Date);
    equal(sentResult.quote.acceptedAt, null);
    equal(sentResult.quote.declinedAt, null);
    equal(sentResult.quote.expiredAt, null);

    ok(
      sentResult.quote.updatedAt.getTime() >
        draftToSend.quote.updatedAt.getTime(),
    );

    equal(sentResult.items.length, 3);

    equal(sentResult.items[0]?.id, draftToSend.items[0]?.id);
    equal(sentResult.items[1]?.id, draftToSend.items[1]?.id);
    equal(sentResult.items[2]?.id, draftToSend.items[2]?.id);

    equal(sentResult.transition.commissionId, sendCommissionId);
    equal(sentResult.transition.fromStatus, "quoting");

    equal(sentResult.transition.toStatus, "awaiting_quote_response");

    equal(sentResult.transition.initiatedBy, "artist");
    equal(sentResult.transition.reason, "quote_sent");

    equal(sentResult.transition.changedByAdminUserId, "quote-send-verifier");

    equal(sentResult.event.commissionId, sendCommissionId);
    equal(sentResult.event.type, "quote_sent");
    equal(sentResult.event.actor, "artist");
    equal(sentResult.event.title, "Quote v1 sent");

    equal(sentResult.event.createdByAdminUserId, "quote-send-verifier");

    const sentCommissionRows = await db
      .select({
        status: commissions.status,
        updatedAt: commissions.updatedAt,
      })
      .from(commissions)
      .where(eq(commissions.id, sendCommissionId))
      .limit(1);

    const sentCommission = sentCommissionRows[0];

    ok(sentCommission);

    equal(sentCommission.status, "awaiting_quote_response");

    equal(
      sentCommission.updatedAt.getTime(),
      sentResult.quote.sentAt.getTime(),
    );

    const storedSentQuote = await getCommissionQuoteById(draftToSend.quote.id);

    ok(storedSentQuote);
    equal(storedSentQuote.quote.status, "sent");
    equal(storedSentQuote.items.length, 3);

    const sendTransitionRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(
        and(
          eq(commissionStatusHistory.commissionId, sendCommissionId),
          eq(commissionStatusHistory.fromStatus, "quoting"),
          eq(commissionStatusHistory.toStatus, "awaiting_quote_response"),
        ),
      );

    equal(sendTransitionRows.length, 1);
    equal(sendTransitionRows[0]?.id, sentResult.transition.id);

    const quoteSentEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, sendCommissionId),
          eq(commissionEvents.type, "quote_sent"),
        ),
      );

    equal(quoteSentEventRows.length, 1);
    equal(quoteSentEventRows[0]?.id, sentResult.event.id);

    console.log(
      "[OK] Quote send updated quote, commission, history, and event atomically",
    );

    const missingSend = await sendCommissionQuote({
      quoteId: randomUUID(),
      expectedUpdatedAt: new Date(),
      sentByAdminUserId: "quote-send-verifier",
    });

    equal(missingSend.outcome, "not_found");

    console.log("[OK] Missing quote send returns not_found");

    const repeatedSend = await sendCommissionQuote({
      quoteId: sentResult.quote.id,
      expectedUpdatedAt: sentResult.quote.updatedAt,
      sentByAdminUserId: "quote-send-verifier",
    });

    equal(repeatedSend.outcome, "not_draft");

    if (repeatedSend.outcome === "not_draft") {
      equal(repeatedSend.currentStatus, "sent");
    }

    const repeatedSendEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, sendCommissionId),
          eq(commissionEvents.type, "quote_sent"),
        ),
      );

    equal(repeatedSendEventRows.length, 1);

    console.log("[OK] Sent quote cannot be sent again");

    const wrongStatusSend = await sendCommissionQuote({
      quoteId: createdDraft.quote.id,
      expectedUpdatedAt: successfulConcurrentUpdate.quote.updatedAt,
      sentByAdminUserId: "quote-send-verifier",
    });

    equal(wrongStatusSend.outcome, "wrong_commission_status");

    if (wrongStatusSend.outcome === "wrong_commission_status") {
      equal(wrongStatusSend.currentStatus, "awaiting_quote_response");
    }

    const primaryQuoteAfterWrongSend = await getCommissionQuoteById(
      createdDraft.quote.id,
    );

    ok(primaryQuoteAfterWrongSend);
    equal(primaryQuoteAfterWrongSend.quote.status, "draft");
    equal(primaryQuoteAfterWrongSend.quote.sentAt, null);

    const wrongStatusSentEvents = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, primaryCommissionId),
          eq(commissionEvents.type, "quote_sent"),
        ),
      );

    equal(wrongStatusSentEvents.length, 0);

    console.log("[OK] Quote send requires the quoting commission status");

    const invalidSendCommissionId =
      await createTemporaryCommission("Invalid Send");

    await moveCommissionToQuoting(invalidSendCommissionId);

    const invalidSendDraft = await createCommissionQuoteDraft({
      commissionId: invalidSendCommissionId,
      currency: "USD",
      description: "Quote without expiration date",
      validUntil: null,
      items: [
        {
          label: "Illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: "quote-send-verifier",
    });

    equal(invalidSendDraft.outcome, "created");

    if (invalidSendDraft.outcome !== "created") {
      throw new Error("Expected the invalid-send fixture draft to be created.");
    }

    const invalidSendResult = await sendCommissionQuote({
      quoteId: invalidSendDraft.quote.id,
      expectedUpdatedAt: invalidSendDraft.quote.updatedAt,
      sentByAdminUserId: "quote-send-verifier",
    });

    equal(invalidSendResult.outcome, "invalid");

    const invalidSendStoredQuote = await getCommissionQuoteById(
      invalidSendDraft.quote.id,
    );

    ok(invalidSendStoredQuote);
    equal(invalidSendStoredQuote.quote.status, "draft");
    equal(invalidSendStoredQuote.quote.sentAt, null);

    const invalidSendCommissionRows = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, invalidSendCommissionId))
      .limit(1);

    equal(invalidSendCommissionRows[0]?.status, "quoting");

    const invalidSendEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, invalidSendCommissionId),
          eq(commissionEvents.type, "quote_sent"),
        ),
      );

    equal(invalidSendEventRows.length, 0);

    console.log("[OK] Quote without a valid expiration date cannot be sent");

    const staleSendCommissionId = await createTemporaryCommission("Stale Send");

    await moveCommissionToQuoting(staleSendCommissionId);

    const staleSendDraft = await createCommissionQuoteDraft({
      commissionId: staleSendCommissionId,
      currency: "USD",
      description: "Original stale-send quote",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Original illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: "quote-send-verifier",
    });

    equal(staleSendDraft.outcome, "created");

    if (staleSendDraft.outcome !== "created") {
      throw new Error("Expected the stale-send fixture draft to be created.");
    }

    const editedBeforeSend = await updateCommissionQuoteDraft({
      quoteId: staleSendDraft.quote.id,
      expectedUpdatedAt: staleSendDraft.quote.updatedAt,
      currency: "USD",
      description: "Edited before sending",
      validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Edited illustration",
          quantity: 1,
          unitAmount: "500",
        },
      ],
      updatedByAdminUserId: "quote-send-verifier",
    });

    equal(editedBeforeSend.outcome, "updated");

    if (editedBeforeSend.outcome !== "updated") {
      throw new Error("Expected the stale-send fixture draft to be updated.");
    }

    const staleSendResult = await sendCommissionQuote({
      quoteId: staleSendDraft.quote.id,

      /*
       * Intentionally use the timestamp from before the edit.
       */
      expectedUpdatedAt: staleSendDraft.quote.updatedAt,

      sentByAdminUserId: "quote-send-verifier",
    });

    equal(staleSendResult.outcome, "conflict");

    if (staleSendResult.outcome === "conflict") {
      equal(
        staleSendResult.currentUpdatedAt.getTime(),
        editedBeforeSend.quote.updatedAt.getTime(),
      );
    }

    const quoteAfterStaleSend = await getCommissionQuoteById(
      staleSendDraft.quote.id,
    );

    ok(quoteAfterStaleSend);
    equal(quoteAfterStaleSend.quote.status, "draft");
    equal(quoteAfterStaleSend.quote.sentAt, null);
    equal(quoteAfterStaleSend.quote.totalAmount, "500.00");
    equal(quoteAfterStaleSend.items[0]?.label, "Edited illustration");

    const staleSendCommissionRows = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, staleSendCommissionId))
      .limit(1);

    equal(staleSendCommissionRows[0]?.status, "quoting");

    console.log("[OK] Stale quote send was rejected without partial writes");

    const heldSendCommissionId = await createTemporaryCommission("Held Send");

    await moveCommissionToQuoting(heldSendCommissionId);

    const heldSendDraft = await createCommissionQuoteDraft({
      commissionId: heldSendCommissionId,
      currency: "USD",
      description: "Quote blocked by commission hold",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Held illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: "quote-send-verifier",
    });

    equal(heldSendDraft.outcome, "created");

    if (heldSendDraft.outcome !== "created") {
      throw new Error("Expected the held-send fixture draft to be created.");
    }

    const holdStartedAt = new Date();

    await db
      .update(commissions)
      .set({
        isOnHold: true,
        holdReason: "Client requested a temporary pause.",
        holdStartedAt,
        updatedAt: holdStartedAt,
      })
      .where(eq(commissions.id, heldSendCommissionId));

    const heldSendResult = await sendCommissionQuote({
      quoteId: heldSendDraft.quote.id,
      expectedUpdatedAt: heldSendDraft.quote.updatedAt,
      sentByAdminUserId: "quote-send-verifier",
    });

    equal(heldSendResult.outcome, "on_hold");

    const quoteAfterHeldSend = await getCommissionQuoteById(
      heldSendDraft.quote.id,
    );

    ok(quoteAfterHeldSend);
    equal(quoteAfterHeldSend.quote.status, "draft");
    equal(quoteAfterHeldSend.quote.sentAt, null);

    const heldCommissionRows = await db
      .select({
        status: commissions.status,
        isOnHold: commissions.isOnHold,
      })
      .from(commissions)
      .where(eq(commissions.id, heldSendCommissionId))
      .limit(1);

    equal(heldCommissionRows[0]?.status, "quoting");
    equal(heldCommissionRows[0]?.isOnHold, true);

    const heldSendEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, heldSendCommissionId),
          eq(commissionEvents.type, "quote_sent"),
        ),
      );

    equal(heldSendEventRows.length, 0);

    console.log("[OK] Held commission rejected quote send");

    const concurrentSendCommissionId =
      await createTemporaryCommission("Concurrent Send");

    await moveCommissionToQuoting(concurrentSendCommissionId);

    const concurrentSendDraft = await createCommissionQuoteDraft({
      commissionId: concurrentSendCommissionId,
      currency: "USD",
      description: "Concurrent send verification quote",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Concurrent cover",
          quantity: 1,
          unitAmount: "450",
        },
        {
          label: "Concurrent character",
          quantity: 1,
          unitAmount: "80",
        },
      ],
      createdByAdminUserId: "quote-send-verifier",
    });

    equal(concurrentSendDraft.outcome, "created");

    if (concurrentSendDraft.outcome !== "created") {
      throw new Error(
        "Expected the concurrent-send fixture draft to be created.",
      );
    }

    const concurrentSendResults = await Promise.all([
      sendCommissionQuote({
        quoteId: concurrentSendDraft.quote.id,
        expectedUpdatedAt: concurrentSendDraft.quote.updatedAt,
        sentByAdminUserId: "quote-send-verifier-a",
      }),

      sendCommissionQuote({
        quoteId: concurrentSendDraft.quote.id,
        expectedUpdatedAt: concurrentSendDraft.quote.updatedAt,
        sentByAdminUserId: "quote-send-verifier-b",
      }),
    ]);

    equal(
      concurrentSendResults.filter((result) => result.outcome === "sent")
        .length,
      1,
    );

    equal(
      concurrentSendResults.filter((result) => result.outcome === "not_draft")
        .length,
      1,
    );

    const storedConcurrentSentQuote = await getCommissionQuoteById(
      concurrentSendDraft.quote.id,
    );

    ok(storedConcurrentSentQuote);
    equal(storedConcurrentSentQuote.quote.status, "sent");
    ok(storedConcurrentSentQuote.quote.sentAt instanceof Date);
    equal(storedConcurrentSentQuote.items.length, 2);

    const concurrentSentCommissionRows = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, concurrentSendCommissionId))
      .limit(1);

    equal(concurrentSentCommissionRows[0]?.status, "awaiting_quote_response");

    const concurrentSendTransitionRows = await db
      .select({
        id: commissionStatusHistory.id,
      })
      .from(commissionStatusHistory)
      .where(
        and(
          eq(commissionStatusHistory.commissionId, concurrentSendCommissionId),
          eq(commissionStatusHistory.fromStatus, "quoting"),
          eq(commissionStatusHistory.toStatus, "awaiting_quote_response"),
        ),
      );

    equal(concurrentSendTransitionRows.length, 1);

    const concurrentSendEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentSendCommissionId),
          eq(commissionEvents.type, "quote_sent"),
        ),
      );

    equal(concurrentSendEventRows.length, 1);

    console.log(
      "[OK] Concurrent quote send produced one send without duplicates",
    );

    const acceptedResult = await acceptCommissionQuote({
      quoteId: sentResult.quote.id,
      expectedUpdatedAt: sentResult.quote.updatedAt,
      acceptedByAdminUserId: "quote-accept-verifier",
    });

    equal(acceptedResult.outcome, "accepted");

    if (acceptedResult.outcome !== "accepted") {
      throw new Error("Expected the sent quote to be accepted.");
    }

    equal(acceptedResult.quote.id, sentResult.quote.id);
    equal(acceptedResult.quote.commissionId, sendCommissionId);
    equal(acceptedResult.quote.version, 1);
    equal(acceptedResult.quote.status, "accepted");
    equal(acceptedResult.quote.currency, "USD");
    equal(acceptedResult.quote.totalAmount, "500.00");

    ok(acceptedResult.quote.sentAt instanceof Date);
    ok(acceptedResult.quote.acceptedAt instanceof Date);

    equal(acceptedResult.quote.declinedAt, null);
    equal(acceptedResult.quote.expiredAt, null);

    equal(
      acceptedResult.quote.sentAt.getTime(),
      sentResult.quote.sentAt?.getTime(),
    );

    ok(
      acceptedResult.quote.updatedAt.getTime() >
        sentResult.quote.updatedAt.getTime(),
    );

    equal(acceptedResult.items.length, 3);
    equal(acceptedResult.items[0]?.id, sentResult.items[0]?.id);
    equal(acceptedResult.items[1]?.id, sentResult.items[1]?.id);
    equal(acceptedResult.items[2]?.id, sentResult.items[2]?.id);

    equal(acceptedResult.transition.commissionId, sendCommissionId);

    equal(acceptedResult.transition.fromStatus, "awaiting_quote_response");

    equal(acceptedResult.transition.toStatus, "awaiting_payment");

    equal(acceptedResult.transition.initiatedBy, "client");

    equal(acceptedResult.transition.reason, "quote_accepted");

    equal(
      acceptedResult.transition.changedByAdminUserId,
      "quote-accept-verifier",
    );

    equal(acceptedResult.event.commissionId, sendCommissionId);
    equal(acceptedResult.event.type, "quote_accepted");
    equal(acceptedResult.event.actor, "client");
    equal(acceptedResult.event.title, "Quote v1 accepted");

    equal(acceptedResult.event.createdByAdminUserId, "quote-accept-verifier");

    const acceptedCommissionRows = await db
      .select({
        status: commissions.status,
        updatedAt: commissions.updatedAt,
      })
      .from(commissions)
      .where(eq(commissions.id, sendCommissionId))
      .limit(1);

    const acceptedCommission = acceptedCommissionRows[0];

    ok(acceptedCommission);
    equal(acceptedCommission.status, "awaiting_payment");

    equal(
      acceptedCommission.updatedAt.getTime(),
      acceptedResult.quote.acceptedAt.getTime(),
    );

    const storedAcceptedQuote = await getCommissionQuoteById(
      acceptedResult.quote.id,
    );

    ok(storedAcceptedQuote);
    equal(storedAcceptedQuote.quote.status, "accepted");

    equal(
      storedAcceptedQuote.quote.acceptedAt?.getTime(),
      acceptedResult.quote.acceptedAt.getTime(),
    );

    equal(storedAcceptedQuote.items.length, 3);

    const acceptanceTransitionRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(
        and(
          eq(commissionStatusHistory.commissionId, sendCommissionId),
          eq(commissionStatusHistory.fromStatus, "awaiting_quote_response"),
          eq(commissionStatusHistory.toStatus, "awaiting_payment"),
        ),
      );

    equal(acceptanceTransitionRows.length, 1);

    equal(acceptanceTransitionRows[0]?.id, acceptedResult.transition.id);

    const quoteAcceptedEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, sendCommissionId),
          eq(commissionEvents.type, "quote_accepted"),
        ),
      );

    equal(quoteAcceptedEventRows.length, 1);

    equal(quoteAcceptedEventRows[0]?.id, acceptedResult.event.id);

    console.log(
      "[OK] Quote acceptance updated quote, commission, history, and event atomically",
    );

    const missingAcceptance = await acceptCommissionQuote({
      quoteId: randomUUID(),
      expectedUpdatedAt: new Date(),
      acceptedByAdminUserId: "quote-accept-verifier",
    });

    equal(missingAcceptance.outcome, "not_found");

    console.log("[OK] Missing quote acceptance returns not_found");

    const repeatedAcceptance = await acceptCommissionQuote({
      quoteId: acceptedResult.quote.id,
      expectedUpdatedAt: acceptedResult.quote.updatedAt,
      acceptedByAdminUserId: "quote-accept-verifier",
    });

    equal(repeatedAcceptance.outcome, "not_sent");

    if (repeatedAcceptance.outcome === "not_sent") {
      equal(repeatedAcceptance.currentStatus, "accepted");
    }

    const repeatedAcceptanceEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, sendCommissionId),
          eq(commissionEvents.type, "quote_accepted"),
        ),
      );

    equal(repeatedAcceptanceEventRows.length, 1);

    console.log("[OK] Accepted quote cannot be accepted again");

    const heldAcceptanceStartedAt = new Date();

    await db
      .update(commissions)
      .set({
        isOnHold: true,
        holdReason: "Client requested time before confirming.",
        holdStartedAt: heldAcceptanceStartedAt,
        updatedAt: heldAcceptanceStartedAt,
      })
      .where(eq(commissions.id, concurrentSendCommissionId));

    const heldAcceptance = await acceptCommissionQuote({
      quoteId: concurrentSendDraft.quote.id,
      expectedUpdatedAt: storedConcurrentSentQuote.quote.updatedAt,
      acceptedByAdminUserId: "quote-accept-verifier",
    });

    equal(heldAcceptance.outcome, "on_hold");

    const quoteAfterHeldAcceptance = await getCommissionQuoteById(
      concurrentSendDraft.quote.id,
    );

    ok(quoteAfterHeldAcceptance);
    equal(quoteAfterHeldAcceptance.quote.status, "sent");
    equal(quoteAfterHeldAcceptance.quote.acceptedAt, null);

    const heldAcceptanceEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentSendCommissionId),
          eq(commissionEvents.type, "quote_accepted"),
        ),
      );

    equal(heldAcceptanceEventRows.length, 0);

    console.log("[OK] Held commission rejected quote acceptance");

    const resumedAt = new Date();

    await db
      .update(commissions)
      .set({
        isOnHold: false,
        holdReason: null,
        holdStartedAt: null,
        updatedAt: resumedAt,
      })
      .where(eq(commissions.id, concurrentSendCommissionId));

    const returnToQuotingResult = await transitionCommissionStatus({
      commissionId: concurrentSendCommissionId,
      fromStatus: "awaiting_quote_response",
      toStatus: "quoting",
      initiatedBy: "artist",
      changedByAdminUserId: "quote-accept-verifier",
      reason: "quote_revision_required",
    });

    equal(returnToQuotingResult.outcome, "updated");

    const wrongStatusAcceptance = await acceptCommissionQuote({
      quoteId: concurrentSendDraft.quote.id,
      expectedUpdatedAt: storedConcurrentSentQuote.quote.updatedAt,
      acceptedByAdminUserId: "quote-accept-verifier",
    });

    equal(wrongStatusAcceptance.outcome, "wrong_commission_status");

    if (wrongStatusAcceptance.outcome === "wrong_commission_status") {
      equal(wrongStatusAcceptance.currentStatus, "quoting");
    }

    const quoteAfterWrongStatusAcceptance = await getCommissionQuoteById(
      concurrentSendDraft.quote.id,
    );

    ok(quoteAfterWrongStatusAcceptance);
    equal(quoteAfterWrongStatusAcceptance.quote.status, "sent");

    equal(quoteAfterWrongStatusAcceptance.quote.acceptedAt, null);

    const wrongStatusAcceptanceEvents = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentSendCommissionId),
          eq(commissionEvents.type, "quote_accepted"),
        ),
      );

    equal(wrongStatusAcceptanceEvents.length, 0);

    console.log("[OK] Quote acceptance requires awaiting_quote_response");

    const expiredAcceptanceCommissionId =
      await createTemporaryCommission("Expired Acceptance");

    await moveCommissionToQuoting(expiredAcceptanceCommissionId);

    const expiredAcceptanceDraft = await createCommissionQuoteDraft({
      commissionId: expiredAcceptanceCommissionId,
      currency: "USD",
      description: "Expiration acceptance fixture",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Expiration illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: "quote-accept-verifier",
    });

    equal(expiredAcceptanceDraft.outcome, "created");

    if (expiredAcceptanceDraft.outcome !== "created") {
      throw new Error("Expected the expiration fixture draft to be created.");
    }

    const expiredAcceptanceSent = await sendCommissionQuote({
      quoteId: expiredAcceptanceDraft.quote.id,
      expectedUpdatedAt: expiredAcceptanceDraft.quote.updatedAt,
      sentByAdminUserId: "quote-accept-verifier",
    });

    equal(expiredAcceptanceSent.outcome, "sent");

    if (expiredAcceptanceSent.outcome !== "sent") {
      throw new Error("Expected the expiration fixture quote to be sent.");
    }

    const expirationMutationAt = new Date();

    await db
      .update(commissionQuotes)
      .set({
        validUntil: new Date(Date.now() - 60 * 1000),
        updatedAt: expirationMutationAt,
      })
      .where(eq(commissionQuotes.id, expiredAcceptanceSent.quote.id));

    const expiredAcceptance = await acceptCommissionQuote({
      quoteId: expiredAcceptanceSent.quote.id,
      expectedUpdatedAt: expirationMutationAt,
      acceptedByAdminUserId: "quote-accept-verifier",
    });

    equal(expiredAcceptance.outcome, "invalid");

    const quoteAfterExpiredAcceptance = await getCommissionQuoteById(
      expiredAcceptanceSent.quote.id,
    );

    ok(quoteAfterExpiredAcceptance);
    equal(quoteAfterExpiredAcceptance.quote.status, "sent");

    equal(quoteAfterExpiredAcceptance.quote.acceptedAt, null);

    const expiredAcceptanceCommissionRows = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, expiredAcceptanceCommissionId))
      .limit(1);

    equal(
      expiredAcceptanceCommissionRows[0]?.status,
      "awaiting_quote_response",
    );

    console.log("[OK] Expired quote cannot be accepted");

    const declineHoldStartedAt = new Date();

    await db
      .update(commissions)
      .set({
        isOnHold: true,
        holdReason: "Client was deciding whether to continue.",
        holdStartedAt: declineHoldStartedAt,
        updatedAt: declineHoldStartedAt,
      })
      .where(eq(commissions.id, expiredAcceptanceCommissionId));

    const declinedResult = await declineCommissionQuote({
      quoteId: expiredAcceptanceSent.quote.id,
      expectedUpdatedAt: expirationMutationAt,
      declinedByAdminUserId: "quote-decline-verifier",
      closeReasonNote: "Client declined the quote by email.",
    });

    equal(declinedResult.outcome, "declined");

    if (declinedResult.outcome !== "declined") {
      throw new Error("Expected the sent quote to be declined.");
    }

    equal(declinedResult.quote.id, expiredAcceptanceSent.quote.id);

    equal(declinedResult.quote.commissionId, expiredAcceptanceCommissionId);

    equal(declinedResult.quote.version, 1);
    equal(declinedResult.quote.status, "declined");
    ok(declinedResult.quote.sentAt instanceof Date);
    ok(declinedResult.quote.declinedAt instanceof Date);
    equal(declinedResult.quote.acceptedAt, null);
    equal(declinedResult.quote.expiredAt, null);

    ok(
      declinedResult.quote.updatedAt.getTime() > expirationMutationAt.getTime(),
    );

    equal(declinedResult.items.length, 1);

    equal(declinedResult.items[0]?.id, expiredAcceptanceSent.items[0]?.id);

    equal(
      declinedResult.transition.commissionId,
      expiredAcceptanceCommissionId,
    );

    equal(declinedResult.transition.fromStatus, "awaiting_quote_response");

    equal(declinedResult.transition.toStatus, "declined");

    equal(declinedResult.transition.initiatedBy, "client");

    equal(declinedResult.transition.reason, "client_declined_quote");

    equal(
      declinedResult.transition.note,
      "Client declined the quote by email.",
    );

    equal(
      declinedResult.transition.changedByAdminUserId,
      "quote-decline-verifier",
    );

    equal(declinedResult.event.commissionId, expiredAcceptanceCommissionId);

    equal(declinedResult.event.type, "quote_declined");
    equal(declinedResult.event.actor, "client");
    equal(declinedResult.event.title, "Quote v1 declined");

    equal(
      declinedResult.event.description,
      "Client declined the quote by email.",
    );

    equal(declinedResult.event.createdByAdminUserId, "quote-decline-verifier");

    const declinedCommissionRows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, expiredAcceptanceCommissionId))
      .limit(1);

    const declinedCommission = declinedCommissionRows[0];

    ok(declinedCommission);
    equal(declinedCommission.status, "declined");

    equal(declinedCommission.closeReason, "client_declined_quote");

    equal(
      declinedCommission.closeReasonNote,
      "Client declined the quote by email.",
    );

    equal(declinedCommission.closedBy, "client");
    ok(declinedCommission.closedAt instanceof Date);

    equal(
      declinedCommission.closedAt.getTime(),
      declinedResult.quote.declinedAt.getTime(),
    );

    equal(declinedCommission.isOnHold, false);
    equal(declinedCommission.holdReason, null);
    equal(declinedCommission.holdStartedAt, null);

    const storedDeclinedQuote = await getCommissionQuoteById(
      declinedResult.quote.id,
    );

    ok(storedDeclinedQuote);
    equal(storedDeclinedQuote.quote.status, "declined");
    equal(storedDeclinedQuote.items.length, 1);

    const declineTransitionRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(
        and(
          eq(
            commissionStatusHistory.commissionId,
            expiredAcceptanceCommissionId,
          ),
          eq(commissionStatusHistory.fromStatus, "awaiting_quote_response"),
          eq(commissionStatusHistory.toStatus, "declined"),
        ),
      );

    equal(declineTransitionRows.length, 1);

    equal(declineTransitionRows[0]?.id, declinedResult.transition.id);

    const quoteDeclinedEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, expiredAcceptanceCommissionId),
          eq(commissionEvents.type, "quote_declined"),
        ),
      );

    equal(quoteDeclinedEventRows.length, 1);

    equal(quoteDeclinedEventRows[0]?.id, declinedResult.event.id);

    console.log("[OK] Quote decline closed the held commission atomically");

    const missingDecline = await declineCommissionQuote({
      quoteId: randomUUID(),
      expectedUpdatedAt: new Date(),
      declinedByAdminUserId: "quote-decline-verifier",
      closeReasonNote: "Missing quote decline.",
    });

    equal(missingDecline.outcome, "not_found");

    console.log("[OK] Missing quote decline returns not_found");

    const repeatedDecline = await declineCommissionQuote({
      quoteId: declinedResult.quote.id,
      expectedUpdatedAt: declinedResult.quote.updatedAt,
      declinedByAdminUserId: "quote-decline-verifier",
      closeReasonNote: "This repeated decline must not be persisted.",
    });

    equal(repeatedDecline.outcome, "not_sent");

    if (repeatedDecline.outcome === "not_sent") {
      equal(repeatedDecline.currentStatus, "declined");
    }

    const repeatedDeclineEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, expiredAcceptanceCommissionId),
          eq(commissionEvents.type, "quote_declined"),
        ),
      );

    equal(repeatedDeclineEventRows.length, 1);

    console.log("[OK] Declined quote cannot be declined again");

    /*
     * This quote remains sent, but its commission was moved
     * back to quoting in the acceptance rejection test.
     */
    const wrongStatusDecline = await declineCommissionQuote({
      quoteId: concurrentSendDraft.quote.id,
      expectedUpdatedAt: storedConcurrentSentQuote.quote.updatedAt,
      declinedByAdminUserId: "quote-decline-verifier",
      closeReasonNote: "This decline must not be persisted.",
    });

    equal(wrongStatusDecline.outcome, "wrong_commission_status");

    if (wrongStatusDecline.outcome === "wrong_commission_status") {
      equal(wrongStatusDecline.currentStatus, "quoting");
    }

    const quoteAfterWrongStatusDecline = await getCommissionQuoteById(
      concurrentSendDraft.quote.id,
    );

    ok(quoteAfterWrongStatusDecline);

    equal(quoteAfterWrongStatusDecline.quote.status, "sent");

    equal(quoteAfterWrongStatusDecline.quote.declinedAt, null);

    const wrongStatusDeclineEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentSendCommissionId),
          eq(commissionEvents.type, "quote_declined"),
        ),
      );

    equal(wrongStatusDeclineEventRows.length, 0);

    console.log("[OK] Quote decline requires awaiting_quote_response");

    const staleAcceptanceCommissionId =
      await createTemporaryCommission("Stale Acceptance");

    await moveCommissionToQuoting(staleAcceptanceCommissionId);

    const staleAcceptanceDraft = await createCommissionQuoteDraft({
      commissionId: staleAcceptanceCommissionId,
      currency: "USD",
      description: "Stale acceptance fixture",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Stale acceptance illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: "quote-accept-verifier",
    });

    equal(staleAcceptanceDraft.outcome, "created");

    if (staleAcceptanceDraft.outcome !== "created") {
      throw new Error("Expected the stale acceptance draft to be created.");
    }

    const staleAcceptanceSent = await sendCommissionQuote({
      quoteId: staleAcceptanceDraft.quote.id,
      expectedUpdatedAt: staleAcceptanceDraft.quote.updatedAt,
      sentByAdminUserId: "quote-accept-verifier",
    });

    equal(staleAcceptanceSent.outcome, "sent");

    if (staleAcceptanceSent.outcome !== "sent") {
      throw new Error("Expected the stale acceptance quote to be sent.");
    }

    const externalUpdateAt = new Date(
      staleAcceptanceSent.quote.updatedAt.getTime() + 1000,
    );

    await db
      .update(commissionQuotes)
      .set({
        notes: "Externally updated before acceptance.",
        updatedAt: externalUpdateAt,
      })
      .where(eq(commissionQuotes.id, staleAcceptanceSent.quote.id));

    const staleAcceptanceResult = await acceptCommissionQuote({
      quoteId: staleAcceptanceSent.quote.id,

      /*
       * Intentionally use the timestamp from before the
       * simulated external update.
       */
      expectedUpdatedAt: staleAcceptanceSent.quote.updatedAt,

      acceptedByAdminUserId: "quote-accept-verifier",
    });

    equal(staleAcceptanceResult.outcome, "conflict");

    if (staleAcceptanceResult.outcome === "conflict") {
      equal(
        staleAcceptanceResult.currentUpdatedAt.getTime(),
        externalUpdateAt.getTime(),
      );
    }

    const quoteAfterStaleAcceptance = await getCommissionQuoteById(
      staleAcceptanceSent.quote.id,
    );

    ok(quoteAfterStaleAcceptance);
    equal(quoteAfterStaleAcceptance.quote.status, "sent");

    equal(quoteAfterStaleAcceptance.quote.acceptedAt, null);

    equal(
      quoteAfterStaleAcceptance.quote.notes,
      "Externally updated before acceptance.",
    );

    console.log(
      "[OK] Stale quote acceptance was rejected without partial writes",
    );

    const staleDeclineResult = await declineCommissionQuote({
      quoteId: staleAcceptanceSent.quote.id,

      /*
       * This timestamp predates the simulated external
       * modification made in the acceptance test.
       */
      expectedUpdatedAt: staleAcceptanceSent.quote.updatedAt,

      declinedByAdminUserId: "quote-decline-verifier",
      closeReasonNote: "This stale decline must not be persisted.",
    });

    equal(staleDeclineResult.outcome, "conflict");

    if (staleDeclineResult.outcome === "conflict") {
      equal(
        staleDeclineResult.currentUpdatedAt.getTime(),
        externalUpdateAt.getTime(),
      );
    }

    const quoteAfterStaleDecline = await getCommissionQuoteById(
      staleAcceptanceSent.quote.id,
    );

    ok(quoteAfterStaleDecline);
    equal(quoteAfterStaleDecline.quote.status, "sent");
    equal(quoteAfterStaleDecline.quote.declinedAt, null);

    equal(
      quoteAfterStaleDecline.quote.notes,
      "Externally updated before acceptance.",
    );

    const staleDeclineCommissionRows = await db
      .select({
        status: commissions.status,
        closedAt: commissions.closedAt,
      })
      .from(commissions)
      .where(eq(commissions.id, staleAcceptanceCommissionId))
      .limit(1);

    equal(staleDeclineCommissionRows[0]?.status, "awaiting_quote_response");

    equal(staleDeclineCommissionRows[0]?.closedAt, null);

    const staleDeclineEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, staleAcceptanceCommissionId),
          eq(commissionEvents.type, "quote_declined"),
        ),
      );

    equal(staleDeclineEventRows.length, 0);

    console.log("[OK] Stale quote decline was rejected without partial writes");

    const expirationPreparedAt = new Date();

    await db
      .update(commissionQuotes)
      .set({
        validUntil: new Date(Date.now() - 60 * 1000),
        updatedAt: expirationPreparedAt,
      })
      .where(eq(commissionQuotes.id, staleAcceptanceSent.quote.id));

    const expirationHoldStartedAt = new Date();

    await db
      .update(commissions)
      .set({
        isOnHold: true,
        holdReason: "Waiting while the quote validity period ended.",
        holdStartedAt: expirationHoldStartedAt,
        updatedAt: expirationHoldStartedAt,
      })
      .where(eq(commissions.id, staleAcceptanceCommissionId));

    const expiredResult = await expireCommissionQuote({
      quoteId: staleAcceptanceSent.quote.id,
      expectedUpdatedAt: expirationPreparedAt,

      /*
       * No recordedByAdminUserId is provided because this
       * simulates an automatic system expiration.
       */
      note: "Quote validity period ended automatically.",
    });

    equal(expiredResult.outcome, "expired");

    if (expiredResult.outcome !== "expired") {
      throw new Error("Expected the sent quote to expire.");
    }

    equal(expiredResult.quote.id, staleAcceptanceSent.quote.id);

    equal(expiredResult.quote.commissionId, staleAcceptanceCommissionId);

    equal(expiredResult.quote.version, 1);
    equal(expiredResult.quote.status, "expired");
    ok(expiredResult.quote.sentAt instanceof Date);
    ok(expiredResult.quote.expiredAt instanceof Date);
    equal(expiredResult.quote.acceptedAt, null);
    equal(expiredResult.quote.declinedAt, null);

    ok(
      expiredResult.quote.updatedAt.getTime() > expirationPreparedAt.getTime(),
    );

    equal(expiredResult.items.length, 1);

    equal(expiredResult.items[0]?.id, staleAcceptanceSent.items[0]?.id);

    equal(expiredResult.transition.commissionId, staleAcceptanceCommissionId);

    equal(expiredResult.transition.fromStatus, "awaiting_quote_response");

    equal(expiredResult.transition.toStatus, "expired");

    equal(expiredResult.transition.initiatedBy, "system");

    equal(expiredResult.transition.reason, "quote_expired");

    equal(
      expiredResult.transition.note,
      "Quote validity period ended automatically.",
    );

    equal(expiredResult.transition.changedByAdminUserId, null);

    equal(expiredResult.event.commissionId, staleAcceptanceCommissionId);

    equal(expiredResult.event.type, "quote_expired");
    equal(expiredResult.event.actor, "system");
    equal(expiredResult.event.title, "Quote v1 expired");

    equal(
      expiredResult.event.description,
      "Quote validity period ended automatically.",
    );

    equal(expiredResult.event.createdByAdminUserId, null);

    const expiredCommissionRows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, staleAcceptanceCommissionId))
      .limit(1);

    const expiredCommission = expiredCommissionRows[0];

    ok(expiredCommission);
    equal(expiredCommission.status, "expired");
    equal(expiredCommission.closeReason, "quote_expired");

    equal(
      expiredCommission.closeReasonNote,
      "Quote validity period ended automatically.",
    );

    equal(expiredCommission.closedBy, "system");
    ok(expiredCommission.closedAt instanceof Date);

    equal(
      expiredCommission.closedAt.getTime(),
      expiredResult.quote.expiredAt.getTime(),
    );

    equal(expiredCommission.isOnHold, false);
    equal(expiredCommission.holdReason, null);
    equal(expiredCommission.holdStartedAt, null);

    const storedExpiredQuote = await getCommissionQuoteById(
      expiredResult.quote.id,
    );

    ok(storedExpiredQuote);
    equal(storedExpiredQuote.quote.status, "expired");
    equal(storedExpiredQuote.items.length, 1);

    const expirationTransitionRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(
        and(
          eq(commissionStatusHistory.commissionId, staleAcceptanceCommissionId),
          eq(commissionStatusHistory.fromStatus, "awaiting_quote_response"),
          eq(commissionStatusHistory.toStatus, "expired"),
        ),
      );

    equal(expirationTransitionRows.length, 1);

    equal(expirationTransitionRows[0]?.id, expiredResult.transition.id);

    const quoteExpiredEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, staleAcceptanceCommissionId),
          eq(commissionEvents.type, "quote_expired"),
        ),
      );

    equal(quoteExpiredEventRows.length, 1);

    equal(quoteExpiredEventRows[0]?.id, expiredResult.event.id);

    console.log("[OK] Quote expiration closed the held commission atomically");

    const missingExpiration = await expireCommissionQuote({
      quoteId: randomUUID(),
      expectedUpdatedAt: new Date(),
      note: "Missing quote expiration.",
    });

    equal(missingExpiration.outcome, "not_found");

    console.log("[OK] Missing quote expiration returns not_found");

    const repeatedExpiration = await expireCommissionQuote({
      quoteId: expiredResult.quote.id,
      expectedUpdatedAt: expiredResult.quote.updatedAt,
      note: "Repeated expiration must not persist.",
    });

    equal(repeatedExpiration.outcome, "not_sent");

    if (repeatedExpiration.outcome === "not_sent") {
      equal(repeatedExpiration.currentStatus, "expired");
    }

    const repeatedExpirationEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, staleAcceptanceCommissionId),
          eq(commissionEvents.type, "quote_expired"),
        ),
      );

    equal(repeatedExpirationEventRows.length, 1);

    console.log("[OK] Expired quote cannot be expired again");

    /*
     * This quote remains sent, but its commission is currently
     * back in quoting.
     */
    const wrongStatusExpiration = await expireCommissionQuote({
      quoteId: concurrentSendDraft.quote.id,
      expectedUpdatedAt: storedConcurrentSentQuote.quote.updatedAt,
      recordedByAdminUserId: "quote-expiration-verifier",
      note: "Wrong status expiration must not persist.",
    });

    equal(wrongStatusExpiration.outcome, "wrong_commission_status");

    if (wrongStatusExpiration.outcome === "wrong_commission_status") {
      equal(wrongStatusExpiration.currentStatus, "quoting");
    }

    const quoteAfterWrongStatusExpiration = await getCommissionQuoteById(
      concurrentSendDraft.quote.id,
    );

    ok(quoteAfterWrongStatusExpiration);

    equal(quoteAfterWrongStatusExpiration.quote.status, "sent");

    equal(quoteAfterWrongStatusExpiration.quote.expiredAt, null);

    console.log("[OK] Quote expiration requires awaiting_quote_response");

    const earlyExpirationCommissionId =
      await createTemporaryCommission("Early Expiration");

    await moveCommissionToQuoting(earlyExpirationCommissionId);

    const earlyExpirationDraft = await createCommissionQuoteDraft({
      commissionId: earlyExpirationCommissionId,
      currency: "USD",
      description: "Early expiration fixture",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Early expiration illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: "quote-expiration-verifier",
    });

    equal(earlyExpirationDraft.outcome, "created");

    if (earlyExpirationDraft.outcome !== "created") {
      throw new Error("Expected the early expiration draft to be created.");
    }

    const earlyExpirationSent = await sendCommissionQuote({
      quoteId: earlyExpirationDraft.quote.id,
      expectedUpdatedAt: earlyExpirationDraft.quote.updatedAt,
      sentByAdminUserId: "quote-expiration-verifier",
    });

    equal(earlyExpirationSent.outcome, "sent");

    if (earlyExpirationSent.outcome !== "sent") {
      throw new Error("Expected the early expiration quote to be sent.");
    }

    const earlyExpirationResult = await expireCommissionQuote({
      quoteId: earlyExpirationSent.quote.id,
      expectedUpdatedAt: earlyExpirationSent.quote.updatedAt,
      recordedByAdminUserId: "quote-expiration-verifier",
      note: "This active quote must not expire early.",
    });

    equal(earlyExpirationResult.outcome, "invalid");

    if (earlyExpirationResult.outcome === "invalid") {
      equal(earlyExpirationResult.validation.code, "quote_not_expired");
    }

    const quoteAfterEarlyExpiration = await getCommissionQuoteById(
      earlyExpirationSent.quote.id,
    );

    ok(quoteAfterEarlyExpiration);

    equal(quoteAfterEarlyExpiration.quote.status, "sent");

    equal(quoteAfterEarlyExpiration.quote.expiredAt, null);

    const earlyExpirationCommissionRows = await db
      .select({
        status: commissions.status,
        closedAt: commissions.closedAt,
      })
      .from(commissions)
      .where(eq(commissions.id, earlyExpirationCommissionId))
      .limit(1);

    equal(earlyExpirationCommissionRows[0]?.status, "awaiting_quote_response");

    equal(earlyExpirationCommissionRows[0]?.closedAt, null);

    const earlyExpirationEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, earlyExpirationCommissionId),
          eq(commissionEvents.type, "quote_expired"),
        ),
      );

    equal(earlyExpirationEventRows.length, 0);

    console.log("[OK] Active quote cannot expire before its validity date");

    const expirationExternalUpdateAt = new Date();

    await db
      .update(commissionQuotes)
      .set({
        notes: "Externally updated before expiration.",
        updatedAt: expirationExternalUpdateAt,
      })
      .where(eq(commissionQuotes.id, earlyExpirationSent.quote.id));

    const staleExpirationResult = await expireCommissionQuote({
      quoteId: earlyExpirationSent.quote.id,

      /*
       * Intentionally use the timestamp from before the
       * simulated external update.
       */
      expectedUpdatedAt: earlyExpirationSent.quote.updatedAt,

      recordedByAdminUserId: "quote-expiration-verifier",

      note: "This stale expiration must not be persisted.",
    });

    equal(staleExpirationResult.outcome, "conflict");

    if (staleExpirationResult.outcome === "conflict") {
      equal(
        staleExpirationResult.currentUpdatedAt.getTime(),
        expirationExternalUpdateAt.getTime(),
      );
    }

    const quoteAfterStaleExpiration = await getCommissionQuoteById(
      earlyExpirationSent.quote.id,
    );

    ok(quoteAfterStaleExpiration);

    equal(quoteAfterStaleExpiration.quote.status, "sent");

    equal(quoteAfterStaleExpiration.quote.expiredAt, null);

    equal(
      quoteAfterStaleExpiration.quote.notes,
      "Externally updated before expiration.",
    );

    const staleExpirationEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, earlyExpirationCommissionId),
          eq(commissionEvents.type, "quote_expired"),
        ),
      );

    equal(staleExpirationEventRows.length, 0);

    console.log(
      "[OK] Stale quote expiration was rejected without partial writes",
    );

    const concurrentExpirationPreparedAt = new Date();

    await db
      .update(commissionQuotes)
      .set({
        validUntil: new Date(Date.now() - 60 * 1000),
        updatedAt: concurrentExpirationPreparedAt,
      })
      .where(eq(commissionQuotes.id, earlyExpirationSent.quote.id));

    const concurrentExpirationResults = await Promise.all([
      expireCommissionQuote({
        quoteId: earlyExpirationSent.quote.id,
        expectedUpdatedAt: concurrentExpirationPreparedAt,
        recordedByAdminUserId: "quote-expiration-verifier-a",
        note: "Quote expired through process A.",
      }),

      expireCommissionQuote({
        quoteId: earlyExpirationSent.quote.id,
        expectedUpdatedAt: concurrentExpirationPreparedAt,
        recordedByAdminUserId: "quote-expiration-verifier-b",
        note: "Quote expired through process B.",
      }),
    ]);

    equal(
      concurrentExpirationResults.filter(
        (result) => result.outcome === "expired",
      ).length,
      1,
    );

    equal(
      concurrentExpirationResults.filter(
        (result) => result.outcome === "not_sent",
      ).length,
      1,
    );

    const successfulConcurrentExpiration = concurrentExpirationResults.find(
      (result) => result.outcome === "expired",
    );

    ok(successfulConcurrentExpiration);

    if (successfulConcurrentExpiration.outcome !== "expired") {
      throw new Error("Expected one concurrent expiration to succeed.");
    }

    const storedConcurrentExpiredQuote = await getCommissionQuoteById(
      earlyExpirationSent.quote.id,
    );

    ok(storedConcurrentExpiredQuote);

    equal(storedConcurrentExpiredQuote.quote.status, "expired");

    ok(storedConcurrentExpiredQuote.quote.expiredAt instanceof Date);

    const concurrentExpiredCommissionRows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, earlyExpirationCommissionId))
      .limit(1);

    const concurrentExpiredCommission = concurrentExpiredCommissionRows[0];

    ok(concurrentExpiredCommission);

    equal(concurrentExpiredCommission.status, "expired");

    equal(concurrentExpiredCommission.closeReason, "quote_expired");

    equal(
      concurrentExpiredCommission.closeReasonNote,
      successfulConcurrentExpiration.transition.note,
    );

    equal(concurrentExpiredCommission.closedBy, "system");

    ok(concurrentExpiredCommission.closedAt instanceof Date);

    const concurrentExpirationTransitionRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(
        and(
          eq(commissionStatusHistory.commissionId, earlyExpirationCommissionId),
          eq(commissionStatusHistory.fromStatus, "awaiting_quote_response"),
          eq(commissionStatusHistory.toStatus, "expired"),
        ),
      );

    equal(concurrentExpirationTransitionRows.length, 1);

    equal(
      concurrentExpirationTransitionRows[0]?.id,
      successfulConcurrentExpiration.transition.id,
    );

    const concurrentExpirationEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, earlyExpirationCommissionId),
          eq(commissionEvents.type, "quote_expired"),
        ),
      );

    equal(concurrentExpirationEventRows.length, 1);

    equal(
      concurrentExpirationEventRows[0]?.id,
      successfulConcurrentExpiration.event.id,
    );

    equal(
      concurrentExpirationEventRows[0]?.description,
      successfulConcurrentExpiration.transition.note,
    );

    console.log(
      "[OK] Concurrent quote expiration produced one closure without duplicates",
    );

    const revisionCommissionId = await createTemporaryCommission("Revision");

    await moveCommissionToQuoting(revisionCommissionId);

    const revisionDraft = await createCommissionQuoteDraft({
      commissionId: revisionCommissionId,
      currency: "USD",
      description: "Original revision quote",
      notes: "Original internal revision note",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Front cover",
          description: "Original cover concept",
          quantity: 1,
          unitAmount: "450",
        },
        {
          label: "Additional character",
          quantity: 2,
          unitAmount: "80",
        },
        {
          label: "Indie author adjustment",
          quantity: 1,
          unitAmount: "-60",
        },
      ],
      createdByAdminUserId: "quote-revision-verifier",
    });

    equal(revisionDraft.outcome, "created");

    if (revisionDraft.outcome !== "created") {
      throw new Error("Expected the revision fixture draft to be created.");
    }

    const revisionSent = await sendCommissionQuote({
      quoteId: revisionDraft.quote.id,
      expectedUpdatedAt: revisionDraft.quote.updatedAt,
      sentByAdminUserId: "quote-revision-verifier",
    });

    equal(revisionSent.outcome, "sent");

    if (revisionSent.outcome !== "sent") {
      throw new Error("Expected the revision fixture quote to be sent.");
    }

    const supersededResult = await supersedeCommissionQuote({
      quoteId: revisionSent.quote.id,
      expectedUpdatedAt: revisionSent.quote.updatedAt,
      initiatedBy: "client",
      supersededByAdminUserId: "quote-revision-verifier",
      note: "Client requested an adjusted quote by email.",
    });

    equal(supersededResult.outcome, "superseded");

    if (supersededResult.outcome !== "superseded") {
      throw new Error("Expected the sent quote to be superseded.");
    }

    equal(supersededResult.supersededQuote.id, revisionSent.quote.id);

    equal(supersededResult.supersededQuote.status, "superseded");

    equal(supersededResult.supersededQuote.version, 1);

    ok(supersededResult.supersededQuote.sentAt instanceof Date);

    equal(supersededResult.supersededQuote.acceptedAt, null);

    equal(supersededResult.supersededQuote.declinedAt, null);

    equal(supersededResult.supersededQuote.expiredAt, null);

    equal(supersededResult.draft.quote.commissionId, revisionCommissionId);

    equal(supersededResult.draft.quote.version, 2);
    equal(supersededResult.draft.quote.status, "draft");
    equal(supersededResult.draft.quote.currency, "USD");

    equal(supersededResult.draft.quote.totalAmount, "550.00");

    equal(supersededResult.draft.quote.description, "Original revision quote");

    equal(
      supersededResult.draft.quote.notes,
      "Original internal revision note",
    );

    equal(supersededResult.draft.quote.validUntil, null);

    equal(supersededResult.draft.quote.sentAt, null);
    equal(supersededResult.draft.quote.acceptedAt, null);
    equal(supersededResult.draft.quote.declinedAt, null);
    equal(supersededResult.draft.quote.expiredAt, null);

    equal(supersededResult.draft.items.length, 3);

    for (let index = 0; index < revisionSent.items.length; index += 1) {
      const originalItem: CommissionQuoteItem | undefined =
        revisionSent.items[index];

      const copiedItem: CommissionQuoteItem | undefined =
        supersededResult.draft.items[index];

      ok(originalItem);
      ok(copiedItem);

      equal(copiedItem.sequence, originalItem.sequence);
      equal(copiedItem.label, originalItem.label);

      equal(copiedItem.description, originalItem.description);

      equal(copiedItem.quantity, originalItem.quantity);

      equal(copiedItem.unitAmount, originalItem.unitAmount);

      /*
       * A revision copies the business data but creates
       * independent item records.
       */
      equal(copiedItem.id === originalItem.id, false);
      equal(copiedItem.quoteId, supersededResult.draft.quote.id);
    }

    equal(supersededResult.transition.commissionId, revisionCommissionId);

    equal(supersededResult.transition.fromStatus, "awaiting_quote_response");

    equal(supersededResult.transition.toStatus, "quoting");

    equal(supersededResult.transition.initiatedBy, "client");

    equal(supersededResult.transition.reason, "quote_revision_requested");

    equal(
      supersededResult.transition.note,
      "Client requested an adjusted quote by email.",
    );

    equal(
      supersededResult.transition.changedByAdminUserId,
      "quote-revision-verifier",
    );

    equal(supersededResult.supersededEvent.type, "quote_superseded");

    equal(supersededResult.supersededEvent.actor, "client");

    equal(supersededResult.supersededEvent.title, "Quote v1 superseded");

    equal(supersededResult.createdEvent.type, "quote_created");

    equal(supersededResult.createdEvent.actor, "client");

    equal(supersededResult.createdEvent.title, "Quote v2 created");

    const revisionCommissionRows = await db
      .select({
        status: commissions.status,
        isOnHold: commissions.isOnHold,
      })
      .from(commissions)
      .where(eq(commissions.id, revisionCommissionId))
      .limit(1);

    equal(revisionCommissionRows[0]?.status, "quoting");
    equal(revisionCommissionRows[0]?.isOnHold, false);

    const storedRevisionQuotes =
      await getCommissionQuotes(revisionCommissionId);

    equal(storedRevisionQuotes.length, 2);
    equal(storedRevisionQuotes[0]?.quote.version, 2);
    equal(storedRevisionQuotes[0]?.quote.status, "draft");
    equal(storedRevisionQuotes[0]?.items.length, 3);

    equal(storedRevisionQuotes[1]?.quote.version, 1);

    equal(storedRevisionQuotes[1]?.quote.status, "superseded");

    equal(storedRevisionQuotes[1]?.items.length, 3);

    const revisionActiveQuoteRows = await db
      .select({
        id: commissionQuotes.id,
        version: commissionQuotes.version,
        status: commissionQuotes.status,
      })
      .from(commissionQuotes)
      .where(
        and(
          eq(commissionQuotes.commissionId, revisionCommissionId),
          inArray(commissionQuotes.status, ["draft", "sent"]),
        ),
      );

    equal(revisionActiveQuoteRows.length, 1);

    equal(revisionActiveQuoteRows[0]?.id, supersededResult.draft.quote.id);

    const revisionTransitionRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(
        and(
          eq(commissionStatusHistory.commissionId, revisionCommissionId),
          eq(commissionStatusHistory.fromStatus, "awaiting_quote_response"),
          eq(commissionStatusHistory.toStatus, "quoting"),
        ),
      );

    equal(revisionTransitionRows.length, 1);

    equal(revisionTransitionRows[0]?.id, supersededResult.transition.id);

    const revisionSupersededEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, revisionCommissionId),
          eq(commissionEvents.type, "quote_superseded"),
        ),
      );

    equal(revisionSupersededEventRows.length, 1);

    equal(
      revisionSupersededEventRows[0]?.id,
      supersededResult.supersededEvent.id,
    );

    const revisionCreatedEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, revisionCommissionId),
          eq(commissionEvents.type, "quote_created"),
        ),
      );

    /*
     * One event belongs to v1 and the second to copied draft v2.
     */
    equal(revisionCreatedEventRows.length, 2);

    console.log(
      "[OK] Quote revision superseded the sent version and copied a new draft atomically",
    );

    const missingSupersede = await supersedeCommissionQuote({
      quoteId: randomUUID(),
      expectedUpdatedAt: new Date(),
      initiatedBy: "artist",
      supersededByAdminUserId: "quote-revision-verifier",
      note: "Missing quote revision.",
    });

    equal(missingSupersede.outcome, "not_found");

    console.log("[OK] Missing quote revision returns not_found");

    const repeatedSupersede = await supersedeCommissionQuote({
      quoteId: supersededResult.supersededQuote.id,
      expectedUpdatedAt: supersededResult.supersededQuote.updatedAt,
      initiatedBy: "client",
      supersededByAdminUserId: "quote-revision-verifier",
      note: "This repeated revision must not be persisted.",
    });

    equal(repeatedSupersede.outcome, "not_sent");

    if (repeatedSupersede.outcome === "not_sent") {
      equal(repeatedSupersede.currentStatus, "superseded");
    }

    const revisionQuotesAfterRepeatedAttempt =
      await getCommissionQuotes(revisionCommissionId);

    equal(revisionQuotesAfterRepeatedAttempt.length, 2);

    const supersededEventsAfterRepeatedAttempt = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, revisionCommissionId),
          eq(commissionEvents.type, "quote_superseded"),
        ),
      );

    equal(supersededEventsAfterRepeatedAttempt.length, 1);

    console.log("[OK] Superseded quote cannot create another revision");

    /*
     * This quote remains sent, but its commission was moved
     * back to quoting by an earlier rejection test.
     */
    const wrongStatusSupersede = await supersedeCommissionQuote({
      quoteId: concurrentSendDraft.quote.id,
      expectedUpdatedAt: storedConcurrentSentQuote.quote.updatedAt,
      initiatedBy: "artist",
      supersededByAdminUserId: "quote-revision-verifier",
      note: "Wrong status revision must not be persisted.",
    });

    equal(wrongStatusSupersede.outcome, "wrong_commission_status");

    if (wrongStatusSupersede.outcome === "wrong_commission_status") {
      equal(wrongStatusSupersede.currentStatus, "quoting");
    }

    const wrongStatusRevisionQuotes = await getCommissionQuotes(
      concurrentSendCommissionId,
    );

    equal(wrongStatusRevisionQuotes.length, 1);
    equal(wrongStatusRevisionQuotes[0]?.quote.status, "sent");

    const wrongStatusSupersededEvents = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentSendCommissionId),
          eq(commissionEvents.type, "quote_superseded"),
        ),
      );

    equal(wrongStatusSupersededEvents.length, 0);

    console.log("[OK] Quote revision requires awaiting_quote_response");

    const concurrentRevisionCommissionId = await createTemporaryCommission(
      "Concurrent Revision",
    );

    await moveCommissionToQuoting(concurrentRevisionCommissionId);

    const concurrentRevisionDraft = await createCommissionQuoteDraft({
      commissionId: concurrentRevisionCommissionId,
      currency: "USD",
      description: "Concurrent revision fixture",
      notes: "Original concurrent revision note",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Concurrent revision cover",
          quantity: 1,
          unitAmount: "450",
        },
        {
          label: "Concurrent revision character",
          quantity: 1,
          unitAmount: "80",
        },
      ],
      createdByAdminUserId: "quote-revision-verifier",
    });

    equal(concurrentRevisionDraft.outcome, "created");

    if (concurrentRevisionDraft.outcome !== "created") {
      throw new Error("Expected the concurrent revision draft to be created.");
    }

    const concurrentRevisionSent = await sendCommissionQuote({
      quoteId: concurrentRevisionDraft.quote.id,
      expectedUpdatedAt: concurrentRevisionDraft.quote.updatedAt,
      sentByAdminUserId: "quote-revision-verifier",
    });

    equal(concurrentRevisionSent.outcome, "sent");

    if (concurrentRevisionSent.outcome !== "sent") {
      throw new Error("Expected the concurrent revision quote to be sent.");
    }

    const revisionHoldStartedAt = new Date();

    await db
      .update(commissions)
      .set({
        isOnHold: true,
        holdReason: "Revision is paused while waiting for client details.",
        holdStartedAt: revisionHoldStartedAt,
        updatedAt: revisionHoldStartedAt,
      })
      .where(eq(commissions.id, concurrentRevisionCommissionId));

    const heldRevisionResult = await supersedeCommissionQuote({
      quoteId: concurrentRevisionSent.quote.id,
      expectedUpdatedAt: concurrentRevisionSent.quote.updatedAt,
      initiatedBy: "client",
      supersededByAdminUserId: "quote-revision-verifier",
      note: "This held revision must not be created.",
    });

    equal(heldRevisionResult.outcome, "on_hold");

    const quotesAfterHeldRevision = await getCommissionQuotes(
      concurrentRevisionCommissionId,
    );

    equal(quotesAfterHeldRevision.length, 1);
    equal(quotesAfterHeldRevision[0]?.quote.status, "sent");

    console.log("[OK] Held commission rejected quote revision");

    const revisionResumedAt = new Date();

    await db
      .update(commissions)
      .set({
        isOnHold: false,
        holdReason: null,
        holdStartedAt: null,
        updatedAt: revisionResumedAt,
      })
      .where(eq(commissions.id, concurrentRevisionCommissionId));

    const revisionExternalUpdateAt = new Date();

    await db
      .update(commissionQuotes)
      .set({
        notes: "Externally updated before creating the revision.",
        updatedAt: revisionExternalUpdateAt,
      })
      .where(eq(commissionQuotes.id, concurrentRevisionSent.quote.id));

    const staleRevisionResult = await supersedeCommissionQuote({
      quoteId: concurrentRevisionSent.quote.id,

      /*
       * Intentionally use the timestamp from before the
       * simulated external update.
       */
      expectedUpdatedAt: concurrentRevisionSent.quote.updatedAt,

      initiatedBy: "artist",
      supersededByAdminUserId: "quote-revision-verifier",
      note: "This stale revision must not be created.",
    });

    equal(staleRevisionResult.outcome, "conflict");

    if (staleRevisionResult.outcome === "conflict") {
      equal(
        staleRevisionResult.currentUpdatedAt.getTime(),
        revisionExternalUpdateAt.getTime(),
      );
    }

    const quotesAfterStaleRevision = await getCommissionQuotes(
      concurrentRevisionCommissionId,
    );

    equal(quotesAfterStaleRevision.length, 1);
    equal(quotesAfterStaleRevision[0]?.quote.status, "sent");

    equal(
      quotesAfterStaleRevision[0]?.quote.notes,
      "Externally updated before creating the revision.",
    );

    console.log(
      "[OK] Stale quote revision was rejected without partial writes",
    );

    const concurrentRevisionResults = await Promise.all([
      supersedeCommissionQuote({
        quoteId: concurrentRevisionSent.quote.id,
        expectedUpdatedAt: revisionExternalUpdateAt,
        initiatedBy: "client",
        supersededByAdminUserId: "quote-revision-verifier-a",
        note: "Client requested concurrent revision A.",
      }),

      supersedeCommissionQuote({
        quoteId: concurrentRevisionSent.quote.id,
        expectedUpdatedAt: revisionExternalUpdateAt,
        initiatedBy: "artist",
        supersededByAdminUserId: "quote-revision-verifier-b",
        note: "Artist requested concurrent revision B.",
      }),
    ]);

    equal(
      concurrentRevisionResults.filter(
        (result) => result.outcome === "superseded",
      ).length,
      1,
    );

    equal(
      concurrentRevisionResults.filter(
        (result) => result.outcome === "not_sent",
      ).length,
      1,
    );

    const successfulConcurrentRevision = concurrentRevisionResults.find(
      (result) => result.outcome === "superseded",
    );

    ok(successfulConcurrentRevision);

    if (successfulConcurrentRevision.outcome !== "superseded") {
      throw new Error("Expected one concurrent revision to succeed.");
    }

    const storedConcurrentRevisionQuotes = await getCommissionQuotes(
      concurrentRevisionCommissionId,
    );

    equal(storedConcurrentRevisionQuotes.length, 2);

    const storedConcurrentRevisionDraft = storedConcurrentRevisionQuotes[0];

    const storedConcurrentSupersededQuote = storedConcurrentRevisionQuotes[1];

    ok(storedConcurrentRevisionDraft);
    ok(storedConcurrentSupersededQuote);

    equal(storedConcurrentRevisionDraft.quote.version, 2);

    equal(storedConcurrentRevisionDraft.quote.status, "draft");

    equal(storedConcurrentRevisionDraft.quote.validUntil, null);

    equal(storedConcurrentRevisionDraft.items.length, 2);

    equal(storedConcurrentSupersededQuote.quote.version, 1);

    equal(storedConcurrentSupersededQuote.quote.status, "superseded");

    equal(storedConcurrentSupersededQuote.items.length, 2);

    for (
      let index = 0;
      index < storedConcurrentSupersededQuote.items.length;
      index += 1
    ) {
      const originalItem: CommissionQuoteItem | undefined =
        storedConcurrentSupersededQuote.items[index];

      const copiedItem: CommissionQuoteItem | undefined =
        storedConcurrentRevisionDraft.items[index];

      ok(originalItem);
      ok(copiedItem);

      equal(copiedItem.sequence, originalItem.sequence);
      equal(copiedItem.label, originalItem.label);
      equal(copiedItem.quantity, originalItem.quantity);

      equal(copiedItem.unitAmount, originalItem.unitAmount);

      equal(copiedItem.id === originalItem.id, false);
    }

    const concurrentRevisionCommissionRows = await db
      .select({
        status: commissions.status,
        isOnHold: commissions.isOnHold,
      })
      .from(commissions)
      .where(eq(commissions.id, concurrentRevisionCommissionId))
      .limit(1);

    equal(concurrentRevisionCommissionRows[0]?.status, "quoting");

    equal(concurrentRevisionCommissionRows[0]?.isOnHold, false);

    const concurrentRevisionTransitionRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(
        and(
          eq(
            commissionStatusHistory.commissionId,
            concurrentRevisionCommissionId,
          ),
          eq(commissionStatusHistory.fromStatus, "awaiting_quote_response"),
          eq(commissionStatusHistory.toStatus, "quoting"),
        ),
      );

    equal(concurrentRevisionTransitionRows.length, 1);

    equal(
      concurrentRevisionTransitionRows[0]?.id,
      successfulConcurrentRevision.transition.id,
    );

    equal(
      concurrentRevisionTransitionRows[0]?.initiatedBy,
      successfulConcurrentRevision.transition.initiatedBy,
    );

    equal(
      concurrentRevisionTransitionRows[0]?.note,
      successfulConcurrentRevision.transition.note,
    );

    const concurrentSupersededEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentRevisionCommissionId),
          eq(commissionEvents.type, "quote_superseded"),
        ),
      );

    equal(concurrentSupersededEventRows.length, 1);

    equal(
      concurrentSupersededEventRows[0]?.id,
      successfulConcurrentRevision.supersededEvent.id,
    );

    equal(
      concurrentSupersededEventRows[0]?.actor,
      successfulConcurrentRevision.transition.initiatedBy,
    );

    const concurrentRevisionCreatedEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentRevisionCommissionId),
          eq(commissionEvents.type, "quote_created"),
        ),
      );

    equal(concurrentRevisionCreatedEventRows.length, 2);

    const concurrentActiveQuoteRows = await db
      .select({
        id: commissionQuotes.id,
      })
      .from(commissionQuotes)
      .where(
        and(
          eq(commissionQuotes.commissionId, concurrentRevisionCommissionId),
          inArray(commissionQuotes.status, ["draft", "sent"]),
        ),
      );

    equal(concurrentActiveQuoteRows.length, 1);

    equal(
      concurrentActiveQuoteRows[0]?.id,
      successfulConcurrentRevision.draft.quote.id,
    );

    console.log(
      "[OK] Concurrent quote revision produced one copied draft without duplicates",
    );

    const concurrentDeclineCommissionId =
      await createTemporaryCommission("Concurrent Decline");

    await moveCommissionToQuoting(concurrentDeclineCommissionId);

    const concurrentDeclineDraft = await createCommissionQuoteDraft({
      commissionId: concurrentDeclineCommissionId,
      currency: "USD",
      description: "Concurrent decline fixture",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Concurrent decline illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: "quote-decline-verifier",
    });

    equal(concurrentDeclineDraft.outcome, "created");

    if (concurrentDeclineDraft.outcome !== "created") {
      throw new Error("Expected the concurrent decline draft to be created.");
    }

    const concurrentDeclineSent = await sendCommissionQuote({
      quoteId: concurrentDeclineDraft.quote.id,
      expectedUpdatedAt: concurrentDeclineDraft.quote.updatedAt,
      sentByAdminUserId: "quote-decline-verifier",
    });

    equal(concurrentDeclineSent.outcome, "sent");

    if (concurrentDeclineSent.outcome !== "sent") {
      throw new Error("Expected the concurrent decline quote to be sent.");
    }

    const concurrentDeclineResults = await Promise.all([
      declineCommissionQuote({
        quoteId: concurrentDeclineSent.quote.id,
        expectedUpdatedAt: concurrentDeclineSent.quote.updatedAt,
        declinedByAdminUserId: "quote-decline-verifier-a",
        closeReasonNote: "Client declined through channel A.",
      }),

      declineCommissionQuote({
        quoteId: concurrentDeclineSent.quote.id,
        expectedUpdatedAt: concurrentDeclineSent.quote.updatedAt,
        declinedByAdminUserId: "quote-decline-verifier-b",
        closeReasonNote: "Client declined through channel B.",
      }),
    ]);

    equal(
      concurrentDeclineResults.filter((result) => result.outcome === "declined")
        .length,
      1,
    );

    equal(
      concurrentDeclineResults.filter((result) => result.outcome === "not_sent")
        .length,
      1,
    );

    const successfulConcurrentDecline = concurrentDeclineResults.find(
      (result) => result.outcome === "declined",
    );

    ok(successfulConcurrentDecline);

    if (successfulConcurrentDecline.outcome !== "declined") {
      throw new Error("Expected one concurrent decline to succeed.");
    }

    const storedConcurrentDeclinedQuote = await getCommissionQuoteById(
      concurrentDeclineSent.quote.id,
    );

    ok(storedConcurrentDeclinedQuote);

    equal(storedConcurrentDeclinedQuote.quote.status, "declined");

    ok(storedConcurrentDeclinedQuote.quote.declinedAt instanceof Date);

    const concurrentDeclinedCommissionRows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, concurrentDeclineCommissionId))
      .limit(1);

    const concurrentDeclinedCommission = concurrentDeclinedCommissionRows[0];

    ok(concurrentDeclinedCommission);
    equal(concurrentDeclinedCommission.status, "declined");

    equal(concurrentDeclinedCommission.closeReason, "client_declined_quote");

    equal(
      concurrentDeclinedCommission.closeReasonNote,
      successfulConcurrentDecline.transition.note,
    );

    equal(concurrentDeclinedCommission.closedBy, "client");

    ok(concurrentDeclinedCommission.closedAt instanceof Date);

    const concurrentDeclineTransitionRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(
        and(
          eq(
            commissionStatusHistory.commissionId,
            concurrentDeclineCommissionId,
          ),
          eq(commissionStatusHistory.fromStatus, "awaiting_quote_response"),
          eq(commissionStatusHistory.toStatus, "declined"),
        ),
      );

    equal(concurrentDeclineTransitionRows.length, 1);

    equal(
      concurrentDeclineTransitionRows[0]?.id,
      successfulConcurrentDecline.transition.id,
    );

    const concurrentDeclineEventRows = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentDeclineCommissionId),
          eq(commissionEvents.type, "quote_declined"),
        ),
      );

    equal(concurrentDeclineEventRows.length, 1);

    equal(
      concurrentDeclineEventRows[0]?.id,
      successfulConcurrentDecline.event.id,
    );

    equal(
      concurrentDeclineEventRows[0]?.description,
      successfulConcurrentDecline.transition.note,
    );

    console.log(
      "[OK] Concurrent quote decline produced one closure without duplicates",
    );

    const concurrentAcceptanceCommissionId = await createTemporaryCommission(
      "Concurrent Acceptance",
    );

    await moveCommissionToQuoting(concurrentAcceptanceCommissionId);

    const concurrentAcceptanceDraft = await createCommissionQuoteDraft({
      commissionId: concurrentAcceptanceCommissionId,
      currency: "USD",
      description: "Concurrent acceptance fixture",
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      items: [
        {
          label: "Concurrent acceptance illustration",
          quantity: 1,
          unitAmount: "450",
        },
      ],
      createdByAdminUserId: "quote-accept-verifier",
    });

    equal(concurrentAcceptanceDraft.outcome, "created");

    if (concurrentAcceptanceDraft.outcome !== "created") {
      throw new Error(
        "Expected the concurrent acceptance draft to be created.",
      );
    }

    const concurrentAcceptanceSent = await sendCommissionQuote({
      quoteId: concurrentAcceptanceDraft.quote.id,
      expectedUpdatedAt: concurrentAcceptanceDraft.quote.updatedAt,
      sentByAdminUserId: "quote-accept-verifier",
    });

    equal(concurrentAcceptanceSent.outcome, "sent");

    if (concurrentAcceptanceSent.outcome !== "sent") {
      throw new Error("Expected the concurrent acceptance quote to be sent.");
    }

    const concurrentAcceptanceResults = await Promise.all([
      acceptCommissionQuote({
        quoteId: concurrentAcceptanceSent.quote.id,
        expectedUpdatedAt: concurrentAcceptanceSent.quote.updatedAt,
        acceptedByAdminUserId: "quote-accept-verifier-a",
      }),

      acceptCommissionQuote({
        quoteId: concurrentAcceptanceSent.quote.id,
        expectedUpdatedAt: concurrentAcceptanceSent.quote.updatedAt,
        acceptedByAdminUserId: "quote-accept-verifier-b",
      }),
    ]);

    equal(
      concurrentAcceptanceResults.filter(
        (result) => result.outcome === "accepted",
      ).length,
      1,
    );

    equal(
      concurrentAcceptanceResults.filter(
        (result) => result.outcome === "not_sent",
      ).length,
      1,
    );

    const storedConcurrentAcceptedQuote = await getCommissionQuoteById(
      concurrentAcceptanceSent.quote.id,
    );

    ok(storedConcurrentAcceptedQuote);

    equal(storedConcurrentAcceptedQuote.quote.status, "accepted");

    ok(storedConcurrentAcceptedQuote.quote.acceptedAt instanceof Date);

    const concurrentAcceptanceCommissionRows = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, concurrentAcceptanceCommissionId))
      .limit(1);

    equal(concurrentAcceptanceCommissionRows[0]?.status, "awaiting_payment");

    const concurrentAcceptanceTransitionRows = await db
      .select({
        id: commissionStatusHistory.id,
      })
      .from(commissionStatusHistory)
      .where(
        and(
          eq(
            commissionStatusHistory.commissionId,
            concurrentAcceptanceCommissionId,
          ),
          eq(commissionStatusHistory.fromStatus, "awaiting_quote_response"),
          eq(commissionStatusHistory.toStatus, "awaiting_payment"),
        ),
      );

    equal(concurrentAcceptanceTransitionRows.length, 1);

    const concurrentAcceptanceEventRows = await db
      .select({
        id: commissionEvents.id,
      })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, concurrentAcceptanceCommissionId),
          eq(commissionEvents.type, "quote_accepted"),
        ),
      );

    equal(concurrentAcceptanceEventRows.length, 1);

    console.log(
      "[OK] Concurrent quote acceptance produced one acceptance without duplicates",
    );

    const primaryCommissionRows = await db
      .select({
        updatedAt: commissions.updatedAt,
      })
      .from(commissions)
      .where(eq(commissions.id, primaryCommissionId))
      .limit(1);

    ok(primaryCommissionRows[0]?.updatedAt instanceof Date);

    console.log("[OK] Quote creation updated commission activity time");

    console.log("[OK] Commission quote repository verification passed");
  } finally {
    if (createdCommissionIds.length > 0) {
      const quoteRows = await db
        .select({
          id: commissionQuotes.id,
        })
        .from(commissionQuotes)
        .where(inArray(commissionQuotes.commissionId, createdCommissionIds));

      const quoteIds = quoteRows.map((quote) => quote.id);

      if (quoteIds.length > 0) {
        await db.batch([
          db
            .delete(commissionQuoteItems)
            .where(inArray(commissionQuoteItems.quoteId, quoteIds)),

          db
            .delete(commissionQuotes)
            .where(inArray(commissionQuotes.id, quoteIds)),
        ]);
      }

      await db.batch([
        db
          .delete(commissionEvents)
          .where(inArray(commissionEvents.commissionId, createdCommissionIds)),

        db
          .delete(commissionStatusHistory)
          .where(
            inArray(commissionStatusHistory.commissionId, createdCommissionIds),
          ),

        db
          .delete(commissions)
          .where(inArray(commissions.id, createdCommissionIds)),
      ]);

      const remainingCommissionRows = await db
        .select({
          id: commissions.id,
        })
        .from(commissions)
        .where(inArray(commissions.id, createdCommissionIds));

      equal(remainingCommissionRows.length, 0);

      console.log("[OK] Temporary quote data was removed");
    }
  }
}

main().catch((error: unknown) => {
  console.error("Commission quote repository verification failed:", error);

  process.exitCode = 1;
});
