import {
  equal,
  ok,
} from "node:assert/strict";
import {
  randomUUID,
} from "node:crypto";

import {
  and,
  eq,
  inArray,
} from "drizzle-orm";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Run this script with .env.local loaded.",
    );
  }

  const { db } = await import("../lib/db");
  const {
    commissionEmailMessages,
    commissionEmailThreads,
    commissions,
    commissionStatusHistory,
  } = await import("../lib/db/schema/commissions");
  const {
    createCommissionClientDetailsRequest,
  } = await import(
    "../lib/repositories/commissionClientDetailsRequestRepository"
  );
  const {
    createQueuedCommissionEmailMessage,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );
  const {
    requestCommissionClientDetails,
  } = await import(
    "../lib/email/commissionClientDetailsRequestService"
  );

  const commissionIds: string[] = [];

  async function createFixture(input?: {
    isOnHold?: boolean;
    rootReady?: boolean;
    status?: "under_review" | "received";
  }): Promise<{
    commissionId: string;
    reference: string;
    rootMessageId: string | null;
    threadId: string;
  }> {
    const commissionId = randomUUID();
    const reference = `DETAILS-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 10)
      .toUpperCase()}`;
    const rootReady = input?.rootReady ?? true;
    const rootProviderEmailId = rootReady
      ? `resend-${randomUUID()}`
      : null;
    const rootMessageId = rootReady
      ? `<${randomUUID()}@email.fefierys.test>`
      : null;

    await db.insert(commissions).values({
      id: commissionId,
      submissionId: randomUUID(),
      reference,
      clientName: "Client Details Verification",
      clientEmail: "client-details@example.com",
      initialMessage: "Temporary client details verification fixture.",
      status: input?.status ?? "under_review",
      isOnHold: input?.isOnHold ?? false,
      holdStartedAt: input?.isOnHold ? new Date() : null,
    });

    const threadRows = await db
      .insert(commissionEmailThreads)
      .values({
        commissionId,
        subject: `Fefierys Art — Your project — ${reference}`,
        rootProviderEmailId,
        rootMessageId,
      })
      .returning();

    const thread = threadRows[0];
    ok(thread);

    commissionIds.push(commissionId);

    return {
      commissionId,
      reference,
      rootMessageId,
      threadId: thread.id,
    };
  }

  try {
    const successFixture = await createFixture();
    const requestText = [
      "Could you send me the final trim size?",
      "Please also confirm whether the cover needs a spine.",
    ].join("\n");
    const providerEmailId = `resend-${randomUUID()}`;
    const providerMessageId = `<${randomUUID()}@email.fefierys.test>`;

    const successResult = await requestCommissionClientDetails(
      {
        commissionId: successFixture.commissionId,
        messageText: requestText,
        requestedByAdminUserId: "admin-verification-user",
      },
      {
        async send(input) {
          equal(input.recipientEmail, "client-details@example.com");
          equal(input.replyToEmail, process.env.OWNER_EMAIL?.trim());
          equal(
            input.subject,
            `Fefierys Art — Your project — ${successFixture.reference}`,
          );
          equal(input.inReplyToMessageId, successFixture.rootMessageId);
          equal(input.referencesHeader, successFixture.rootMessageId);

          return {
            outcome: "sent" as const,
            providerEmailId,
            providerMessageId,
          };
        },
      },
    );

    equal(successResult.outcome, "sent");

    const [commissionRows, historyRows, messageRows] = await Promise.all([
      db
        .select()
        .from(commissions)
        .where(eq(commissions.id, successFixture.commissionId))
        .limit(1),
      db
        .select()
        .from(commissionStatusHistory)
        .where(
          eq(
            commissionStatusHistory.commissionId,
            successFixture.commissionId,
          ),
        ),
      db
        .select()
        .from(commissionEmailMessages)
        .where(
          eq(
            commissionEmailMessages.commissionId,
            successFixture.commissionId,
          ),
        ),
    ]);

    const successCommission = commissionRows[0];
    ok(successCommission);
    equal(successCommission.status, "awaiting_client_details");

    equal(historyRows.length, 1);
    equal(historyRows[0]?.fromStatus, "under_review");
    equal(historyRows[0]?.toStatus, "awaiting_client_details");
    equal(historyRows[0]?.initiatedBy, "artist");
    equal(historyRows[0]?.reason, "client_details_requested");

    equal(messageRows.length, 1);
    const successMessage = messageRows[0];
    ok(successMessage);
    equal(successMessage.kind, "client_details_request");
    equal(successMessage.scope, "client_thread");
    equal(successMessage.actor, "artist");
    equal(successMessage.deliveryStatus, "sent");
    equal(successMessage.messageText, requestText);
    equal(successMessage.providerEmailId, providerEmailId);
    equal(successMessage.providerMessageId, providerMessageId);
    equal(successMessage.inReplyToMessageId, successFixture.rootMessageId);
    equal(successMessage.referencesHeader, successFixture.rootMessageId);

    console.log(
      "[OK] Request client details atomically changes status, records history, and creates one threaded logical email",
    );

    const heldFixture = await createFixture({ isOnHold: true });
    const heldResult = await createCommissionClientDetailsRequest({
      commissionId: heldFixture.commissionId,
      messageText: "Please send another reference image.",
      requestedByAdminUserId: "admin-verification-user",
      senderEmail: process.env.SENDER_EMAIL?.trim() ?? "sender@example.com",
      replyToEmail: process.env.OWNER_EMAIL?.trim() ?? "artist@example.com",
    });

    equal(heldResult.outcome, "on_hold");

    const heldMessageRows = await db
      .select()
      .from(commissionEmailMessages)
      .where(eq(commissionEmailMessages.commissionId, heldFixture.commissionId));

    equal(heldMessageRows.length, 0);

    console.log(
      "[OK] Held commission cannot enter awaiting_client_details or create a client message",
    );

    const rootPendingFixture = await createFixture({ rootReady: false });
    const rootPendingResult = await createCommissionClientDetailsRequest({
      commissionId: rootPendingFixture.commissionId,
      messageText: "Please confirm the final dimensions.",
      requestedByAdminUserId: "admin-verification-user",
      senderEmail: process.env.SENDER_EMAIL?.trim() ?? "sender@example.com",
      replyToEmail: process.env.OWNER_EMAIL?.trim() ?? "artist@example.com",
    });

    equal(rootPendingResult.outcome, "thread_not_ready");

    console.log(
      "[OK] Request waits until the client thread has a verified RFC root Message-ID",
    );

    const blockedFixture = await createFixture();

    await createQueuedCommissionEmailMessage({
      commissionId: blockedFixture.commissionId,
      threadId: blockedFixture.threadId,
      quoteId: null,
      scope: "client_thread",
      kind: "general_message",
      actor: "artist",
      senderEmail: process.env.SENDER_EMAIL?.trim() ?? "sender@example.com",
      recipientEmail: "client-details@example.com",
      replyToEmail: process.env.OWNER_EMAIL?.trim() ?? "artist@example.com",
      subject: `Fefierys Art — Your project — ${blockedFixture.reference}`,
      messageText: "Earlier unsent message.",
      createdByAdminUserId: "admin-verification-user",
    });

    const blockedResult = await createCommissionClientDetailsRequest({
      commissionId: blockedFixture.commissionId,
      messageText: "Please confirm the final dimensions.",
      requestedByAdminUserId: "admin-verification-user",
      senderEmail: process.env.SENDER_EMAIL?.trim() ?? "sender@example.com",
      replyToEmail: process.env.OWNER_EMAIL?.trim() ?? "artist@example.com",
    });

    equal(blockedResult.outcome, "thread_blocked");

    console.log(
      "[OK] Existing unsent client-thread message blocks a new client details request",
    );

    const wrongStatusFixture = await createFixture({ status: "received" });
    const wrongStatusResult = await createCommissionClientDetailsRequest({
      commissionId: wrongStatusFixture.commissionId,
      messageText: "Please send more details.",
      requestedByAdminUserId: "admin-verification-user",
      senderEmail: process.env.SENDER_EMAIL?.trim() ?? "sender@example.com",
      replyToEmail: process.env.OWNER_EMAIL?.trim() ?? "artist@example.com",
    });

    equal(wrongStatusResult.outcome, "wrong_status");

    console.log(
      "[OK] Request client details is restricted to commissions under review",
    );

    const deliveryFailureFixture = await createFixture();
    const deliveryFailureResult = await requestCommissionClientDetails(
      {
        commissionId: deliveryFailureFixture.commissionId,
        messageText: "Please send the missing manuscript dimensions.",
        requestedByAdminUserId: "admin-verification-user",
      },
      {
        async send() {
          return {
            outcome: "failed" as const,
            failureMessage: "Synthetic provider failure.",
          };
        },
      },
    );

    equal(deliveryFailureResult.outcome, "delivery_failed");

    const [failedCommissionRows, failedMessageRows] = await Promise.all([
      db
        .select()
        .from(commissions)
        .where(eq(commissions.id, deliveryFailureFixture.commissionId))
        .limit(1),
      db
        .select()
        .from(commissionEmailMessages)
        .where(
          and(
            eq(
              commissionEmailMessages.commissionId,
              deliveryFailureFixture.commissionId,
            ),
            eq(commissionEmailMessages.kind, "client_details_request"),
          ),
        ),
    ]);

    equal(failedCommissionRows[0]?.status, "awaiting_client_details");
    equal(failedMessageRows.length, 1);
    equal(failedMessageRows[0]?.deliveryStatus, "failed");

    console.log(
      "[OK] Provider failure preserves awaiting_client_details and the failed logical message for retry",
    );

    const concurrentFixture = await createFixture();
    const concurrentInput = {
      commissionId: concurrentFixture.commissionId,
      messageText: "Please confirm whether you need print and ebook versions.",
      requestedByAdminUserId: "admin-verification-user",
      senderEmail: process.env.SENDER_EMAIL?.trim() ?? "sender@example.com",
      replyToEmail: process.env.OWNER_EMAIL?.trim() ?? "artist@example.com",
    };

    const concurrentResults = await Promise.all([
      createCommissionClientDetailsRequest(concurrentInput),
      createCommissionClientDetailsRequest(concurrentInput),
    ]);

    equal(
      concurrentResults.filter((result) => result.outcome === "created").length,
      1,
    );

    const concurrentMessages = await db
      .select()
      .from(commissionEmailMessages)
      .where(
        and(
          eq(
            commissionEmailMessages.commissionId,
            concurrentFixture.commissionId,
          ),
          eq(commissionEmailMessages.kind, "client_details_request"),
        ),
      );

    equal(concurrentMessages.length, 1);

    console.log(
      "[OK] Concurrent requests create exactly one status transition and one logical client email",
    );

    console.log(
      "[OK] Commission client details request verification passed",
    );
  } finally {
    if (commissionIds.length > 0) {
      await db
        .delete(commissionEmailMessages)
        .where(inArray(commissionEmailMessages.commissionId, commissionIds));

      await db
        .delete(commissionEmailThreads)
        .where(inArray(commissionEmailThreads.commissionId, commissionIds));

      await db
        .delete(commissionStatusHistory)
        .where(inArray(commissionStatusHistory.commissionId, commissionIds));

      await db
        .delete(commissions)
        .where(inArray(commissions.id, commissionIds));
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    "[ERROR] Commission client details request verification failed",
    error,
  );
  process.exitCode = 1;
});
