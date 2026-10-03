import {
  equal,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  eq,
  inArray,
} from "drizzle-orm";

import type {
  CommissionEmailProvider,
  CommissionEmailProviderSendInput,
} from "../lib/email/commissionEmailProvider";

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
  } = await import(
    "../lib/db/schema/commissions"
  );
  const {
    createCommissionEmailThreadIfMissing,
    createQueuedCommissionEmailMessage,
    getCommissionEmailMessageById,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );
  const {
    deliverCommissionEmailMessage,
    getCommissionEmailIdempotencyKey,
  } = await import(
    "../lib/email/commissionEmailDeliveryService"
  );

  const commissionIds: string[] = [];

  function createReference(
    prefix: string,
  ): string {
    return `${prefix}-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 12)
      .toUpperCase()}`;
  }

  async function createFixture(): Promise<{
    commissionId: string;
    threadId: string;
    subject: string;
  }> {
    const commissionId = randomUUID();
    const reference =
      createReference("DELIVERY");
    const subject =
      `Fefierys Art — Your project — ${reference}`;

    await db.insert(commissions).values({
      id: commissionId,
      submissionId: randomUUID(),
      reference,
      clientName:
        "Email Delivery Verification",
      clientEmail:
        "email-delivery-verification@example.com",
      initialMessage:
        "Temporary fixture created by verifyCommissionEmailDeliveryService.",
    });

    commissionIds.push(
      commissionId,
    );

    const thread =
      await createCommissionEmailThreadIfMissing({
        commissionId,
        subject,
      });

    return {
      commissionId,
      threadId: thread.thread.id,
      subject,
    };
  }

  try {
    const firstFixture =
      await createFixture();

    const rootMessageId =
      `<root-${randomUUID()}@example.test>`;

    const firstMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          firstFixture.commissionId,
        threadId:
          firstFixture.threadId,
        quoteId: null,
        scope: "client_thread",
        kind: "general_message",
        actor: "artist",
        senderEmail:
          "contact@fefierys.com",
        recipientEmail:
          "email-delivery-verification@example.com",
        replyToEmail:
          "artist@example.com",
        subject:
          firstFixture.subject,
        messageText:
          "Temporary delivery verification message.",
        inReplyToMessageId:
          rootMessageId,
        referencesHeader:
          rootMessageId,
        createdByAdminUserId:
          "verify-email-delivery-service",
      });

    const capturedAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    let firstProviderCallCount = 0;

    const retryProvider:
      CommissionEmailProvider = {
        async send(input) {
          capturedAttempts.push(
            input,
          );
          firstProviderCallCount += 1;

          if (
            firstProviderCallCount === 1
          ) {
            return {
              outcome: "failed",
              failureMessage:
                "Synthetic provider failure.",
            };
          }

          return {
            outcome: "sent",
            providerEmailId:
              `resend-${randomUUID()}`,
            providerMessageId:
              `<${randomUUID()}@email.fefierys.test>`,
          };
        },
      };

    const body = {
      text:
        "Temporary delivery verification message.",
      html:
        "<p>Temporary delivery verification message.</p>",
    };

    const failedDelivery =
      await deliverCommissionEmailMessage(
        {
          messageId:
            firstMessage.id,
          body,
        },
        retryProvider,
      );

    equal(
      failedDelivery.outcome,
      "failed",
    );

    const failedRow =
      await getCommissionEmailMessageById(
        firstMessage.id,
      );

    ok(failedRow);
    equal(
      failedRow.deliveryStatus,
      "failed",
    );
    equal(
      failedRow.attemptCount,
      1,
    );

    console.log(
      "[OK] Provider failure transitions sending message to failed",
    );

    const successfulRetry =
      await deliverCommissionEmailMessage(
        {
          messageId:
            firstMessage.id,
          body,
        },
        retryProvider,
      );

    equal(
      successfulRetry.outcome,
      "sent",
    );

    const sentRow =
      await getCommissionEmailMessageById(
        firstMessage.id,
      );

    ok(sentRow);
    equal(
      sentRow.deliveryStatus,
      "sent",
    );
    equal(
      sentRow.attemptCount,
      2,
    );
    ok(
      sentRow.providerEmailId,
    );
    ok(
      sentRow.providerMessageId,
    );

    console.log(
      "[OK] Failed delivery can retry and transition to sent",
    );

    equal(
      capturedAttempts.length,
      2,
    );
    equal(
      capturedAttempts[0]?.idempotencyKey,
      capturedAttempts[1]?.idempotencyKey,
    );
    equal(
      capturedAttempts[0]?.idempotencyKey,
      getCommissionEmailIdempotencyKey(
        firstMessage.id,
      ),
    );

    console.log(
      "[OK] Retry reuses the same deterministic idempotency key",
    );

    equal(
      capturedAttempts[0]
        ?.inReplyToMessageId,
      rootMessageId,
    );
    equal(
      capturedAttempts[0]
        ?.referencesHeader,
      rootMessageId,
    );

    console.log(
      "[OK] Stored threading headers are forwarded to the provider",
    );

    const afterSent =
      await deliverCommissionEmailMessage(
        {
          messageId:
            firstMessage.id,
          body,
        },
        retryProvider,
      );

    equal(
      afterSent.outcome,
      "not_claimed",
    );

    if (
      afterSent.outcome ===
      "not_claimed"
    ) {
      equal(
        afterSent.currentStatus,
        "sent",
      );
    }

    equal(
      capturedAttempts.length,
      2,
    );

    console.log(
      "[OK] Sent message is not delivered again",
    );

    const concurrentFixture =
      await createFixture();

    const concurrentMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          concurrentFixture.commissionId,
        threadId:
          concurrentFixture.threadId,
        quoteId: null,
        scope: "client_thread",
        kind: "general_message",
        actor: "artist",
        senderEmail:
          "contact@fefierys.com",
        recipientEmail:
          "email-delivery-verification@example.com",
        replyToEmail:
          "artist@example.com",
        subject:
          concurrentFixture.subject,
        messageText:
          "Concurrent delivery verification.",
        inReplyToMessageId: null,
        referencesHeader: null,
        createdByAdminUserId:
          "verify-email-delivery-service",
      });

    let concurrentProviderCalls = 0;

    const slowSuccessProvider:
      CommissionEmailProvider = {
        async send() {
          concurrentProviderCalls += 1;

          await delay(75);

          return {
            outcome: "sent",
            providerEmailId:
              `resend-${randomUUID()}`,
            providerMessageId:
              `<${randomUUID()}@email.fefierys.test>`,
          };
        },
      };

    const concurrentResults =
      await Promise.all(
        Array.from(
          {
            length: 8,
          },
          () =>
            deliverCommissionEmailMessage(
              {
                messageId:
                  concurrentMessage.id,
                body: {
                  text:
                    "Concurrent delivery verification.",
                },
              },
              slowSuccessProvider,
            ),
        ),
      );

    equal(
      concurrentProviderCalls,
      1,
    );
    equal(
      concurrentResults.filter(
        (result) =>
          result.outcome ===
          "sent",
      ).length,
      1,
    );

    const concurrentRow =
      await getCommissionEmailMessageById(
        concurrentMessage.id,
      );

    ok(concurrentRow);
    equal(
      concurrentRow.deliveryStatus,
      "sent",
    );
    equal(
      concurrentRow.attemptCount,
      1,
    );

    console.log(
      "[OK] Concurrent delivery invokes the provider exactly once",
    );

    const persistedRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.id,
            concurrentMessage.id,
          ),
        );

    equal(
      persistedRows.length,
      1,
    );

    console.log(
      "[OK] Commission email delivery service verification passed",
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
      "[ERROR] Commission email delivery service verification failed",
      error,
    );
    process.exitCode = 1;
  },
);
