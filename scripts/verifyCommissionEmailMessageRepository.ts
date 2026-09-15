import {
  equal,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
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
  } = await import("../lib/db/schema/commissions");
  const {
    claimCommissionEmailMessageForSending,
    createCommissionEmailThreadIfMissing,
    createQueuedCommissionEmailMessage,
    getCommissionEmailMessageById,
    markCommissionEmailMessageFailed,
    markCommissionEmailMessageSent,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );

  const commissionIds: string[] = [];

  function createReference(): string {
    return `EMAIL-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 12)
      .toUpperCase()}`;
  }

  async function createFixtureCommission(): Promise<{
    commissionId: string;
    reference: string;
  }> {
    const commissionId = randomUUID();
    const reference = createReference();

    await db.insert(commissions).values({
      id: commissionId,
      submissionId: randomUUID(),
      reference,
      clientName: "Email Message Verification",
      clientEmail:
        "email-message-verification@example.com",
      initialMessage:
        "Temporary fixture created by verifyCommissionEmailMessageRepository.",
    });

    commissionIds.push(commissionId);

    return {
      commissionId,
      reference,
    };
  }

  try {
    const {
      commissionId,
      reference,
    } = await createFixtureCommission();

    const subject =
      `Fefierys Art — Your project — ${reference}`;

    const threadResult =
      await createCommissionEmailThreadIfMissing({
        commissionId,
        subject,
      });

    const queuedMessage =
      await createQueuedCommissionEmailMessage({
        commissionId,
        threadId: threadResult.thread.id,
        quoteId: null,
        scope: "client_thread",
        kind: "general_message",
        actor: "artist",
        senderEmail: "contact@fefierys.com",
        recipientEmail:
          "email-message-verification@example.com",
        replyToEmail: "artist@example.com",
        subject,
        messageText:
          "Temporary message used to verify delivery state transitions.",
        inReplyToMessageId: null,
        referencesHeader: null,
        createdByAdminUserId:
          "verify-email-message-repository",
      });

    equal(queuedMessage.deliveryStatus, "queued");
    equal(queuedMessage.attemptCount, 0);
    equal(queuedMessage.lastAttemptAt, null);
    equal(queuedMessage.sentAt, null);
    equal(queuedMessage.failedAt, null);
    equal(queuedMessage.failureMessage, null);

    console.log(
      "[OK] Queued message is persisted with zero delivery attempts",
    );

    const fetchedQueuedMessage =
      await getCommissionEmailMessageById(
        queuedMessage.id,
      );

    ok(fetchedQueuedMessage);
    equal(
      fetchedQueuedMessage.id,
      queuedMessage.id,
    );
    equal(
      fetchedQueuedMessage.threadId,
      threadResult.thread.id,
    );

    console.log(
      "[OK] Message can be fetched by id",
    );

    const concurrentClaims = await Promise.all(
      Array.from(
        { length: 8 },
        () =>
          claimCommissionEmailMessageForSending(
            queuedMessage.id,
          ),
      ),
    );

    const successfulClaims =
      concurrentClaims.filter(
        (message) => message !== null,
      );

    equal(successfulClaims.length, 1);

    const firstClaim = successfulClaims[0];

    ok(firstClaim);
    equal(firstClaim.deliveryStatus, "sending");
    equal(firstClaim.attemptCount, 1);
    ok(firstClaim.lastAttemptAt);
    equal(firstClaim.failedAt, null);
    equal(firstClaim.sentAt, null);

    console.log(
      "[OK] Concurrent claim allows exactly one sender",
    );

    const claimWhileSending =
      await claimCommissionEmailMessageForSending(
        queuedMessage.id,
      );

    equal(claimWhileSending, null);

    console.log(
      "[OK] A sending message cannot be claimed twice",
    );

    const failedMessage =
      await markCommissionEmailMessageFailed(
        queuedMessage.id,
        "Temporary safe delivery failure for repository verification.",
      );

    ok(failedMessage);
    equal(failedMessage.deliveryStatus, "failed");
    equal(failedMessage.attemptCount, 1);
    ok(failedMessage.failedAt);
    equal(failedMessage.sentAt, null);
    equal(
      failedMessage.failureMessage,
      "Temporary safe delivery failure for repository verification.",
    );

    console.log(
      "[OK] Sending message can transition to failed",
    );

    const retryClaim =
      await claimCommissionEmailMessageForSending(
        queuedMessage.id,
      );

    ok(retryClaim);
    equal(retryClaim.deliveryStatus, "sending");
    equal(retryClaim.attemptCount, 2);
    ok(retryClaim.lastAttemptAt);
    equal(retryClaim.failedAt, null);
    equal(retryClaim.failureMessage, null);

    console.log(
      "[OK] Failed message can be claimed again and increments attempt count",
    );

    const sentMessage =
      await markCommissionEmailMessageSent({
        messageId: queuedMessage.id,
        providerEmailId:
          `resend-${randomUUID()}`,
        providerMessageId:
          `<${randomUUID()}@email.fefierys.test>`,
      });

    ok(sentMessage);
    equal(sentMessage.deliveryStatus, "sent");
    equal(sentMessage.attemptCount, 2);
    ok(sentMessage.sentAt);
    equal(sentMessage.failedAt, null);
    equal(sentMessage.failureMessage, null);
    ok(sentMessage.providerEmailId);
    ok(sentMessage.providerMessageId);

    console.log(
      "[OK] Retried message can transition to sent",
    );

    const claimAfterSent =
      await claimCommissionEmailMessageForSending(
        queuedMessage.id,
      );

    equal(claimAfterSent, null);

    console.log(
      "[OK] Sent message cannot be claimed again",
    );

    const persistedRows = await db
      .select()
      .from(commissionEmailMessages)
      .where(
        eq(
          commissionEmailMessages.id,
          queuedMessage.id,
        ),
      );

    equal(persistedRows.length, 1);
    equal(
      persistedRows[0]?.deliveryStatus,
      "sent",
    );
    equal(
      persistedRows[0]?.attemptCount,
      2,
    );

    console.log(
      "[OK] Final delivery state is persisted exactly once",
    );

    console.log(
      "[OK] Commission email message repository verification passed",
    );
  } finally {
    if (commissionIds.length > 0) {
      await db
        .delete(commissionEmailMessages)
        .where(
          inArray(
            commissionEmailMessages.commissionId,
            commissionIds,
          ),
        );

      await db
        .delete(commissionEmailThreads)
        .where(
          inArray(
            commissionEmailThreads.commissionId,
            commissionIds,
          ),
        );

      await db
        .delete(commissions)
        .where(
          inArray(
            commissions.id,
            commissionIds,
          ),
        );
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    "[ERROR] Commission email message repository verification failed",
    error,
  );
  process.exitCode = 1;
});
