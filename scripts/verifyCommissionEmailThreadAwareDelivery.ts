import {
  equal,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
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
    createCommissionEmailThreadIfMissing,
    createQueuedCommissionEmailMessage,
    getCommissionEmailMessageById,
    getCommissionEmailThreadById,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );
  const {
    deliverCommissionEmailMessage,
  } = await import(
    "../lib/email/commissionEmailDeliveryService"
  );

  const commissionIds: string[] = [];

  async function createFixture(): Promise<{
    commissionId: string;
    threadId: string;
    subject: string;
  }> {
    const commissionId = randomUUID();
    const reference =
      `FIFO-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 12)
        .toUpperCase()}`;
    const subject =
      `Fefierys Art — Your project — ${reference}`;

    await db
      .insert(commissions)
      .values({
        id: commissionId,
        submissionId: randomUUID(),
        reference,
        clientName:
          "Thread Aware Delivery Verification",
        clientEmail:
          "thread-aware-delivery@example.com",
        initialMessage:
          "Temporary fixture created by verifyCommissionEmailThreadAwareDelivery.",
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
      threadId:
        thread.thread.id,
      subject,
    };
  }

  async function createClientMessage(
    fixture: {
      commissionId: string;
      threadId: string;
      subject: string;
    },
    text: string,
  ) {
    return createQueuedCommissionEmailMessage({
      commissionId:
        fixture.commissionId,
      threadId:
        fixture.threadId,
      quoteId: null,
      scope: "client_thread",
      kind: "general_message",
      actor: "artist",
      senderEmail:
        "contact@fefierys.com",
      recipientEmail:
        "thread-aware-delivery@example.com",
      replyToEmail:
        "artist@example.com",
      subject:
        fixture.subject,
      messageText: text,
      inReplyToMessageId: null,
      referencesHeader: null,
      createdByAdminUserId:
        "verify-thread-aware-delivery",
    });
  }

  try {
    const fixture =
      await createFixture();

    const firstMessage =
      await createClientMessage(
        fixture,
        "First client-thread message",
      );

    /*
     * Guarantee deterministic FIFO ordering even on databases whose default
     * timestamp precision could make two inserts share a created_at value.
     */
    await delay(5);

    const secondMessage =
      await createClientMessage(
        fixture,
        "Second client-thread message",
      );

    let providerCalls = 0;
    const captured:
      CommissionEmailProviderSendInput[] = [];

    const rootProviderEmailId =
      `resend-${randomUUID()}`;
    const rootMessageId =
      `<${randomUUID()}@email.fefierys.test>`;

    const provider:
      CommissionEmailProvider = {
        async send(input) {
          providerCalls += 1;
          captured.push(input);

          if (providerCalls === 1) {
            return {
              outcome: "sent",
              providerEmailId:
                rootProviderEmailId,
              providerMessageId:
                rootMessageId,
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

    const secondBeforeRoot =
      await deliverCommissionEmailMessage(
        {
          messageId:
            secondMessage.id,
          body: {
            text:
              "Second client-thread message",
          },
        },
        provider,
      );

    equal(
      secondBeforeRoot.outcome,
      "not_claimed",
    );
    equal(providerCalls, 0);

    const stillQueuedSecond =
      await getCommissionEmailMessageById(
        secondMessage.id,
      );

    ok(stillQueuedSecond);
    equal(
      stillQueuedSecond.deliveryStatus,
      "queued",
    );

    console.log(
      "[OK] Later client message cannot pass the unsent thread root",
    );

    const firstDelivery =
      await deliverCommissionEmailMessage(
        {
          messageId:
            firstMessage.id,
          body: {
            text:
              "First client-thread message",
          },
        },
        provider,
      );

    equal(
      firstDelivery.outcome,
      "sent",
    );
    equal(providerCalls, 1);
    equal(
      captured[0]?.inReplyToMessageId,
      null,
    );
    equal(
      captured[0]?.referencesHeader,
      null,
    );

    const rootedThread =
      await getCommissionEmailThreadById(
        fixture.threadId,
      );

    ok(rootedThread);
    equal(
      rootedThread.rootProviderEmailId,
      rootProviderEmailId,
    );
    equal(
      rootedThread.rootMessageId,
      rootMessageId,
    );

    console.log(
      "[OK] First sent client message automatically establishes the immutable thread root",
    );

    const secondDelivery =
      await deliverCommissionEmailMessage(
        {
          messageId:
            secondMessage.id,
          body: {
            text:
              "Second client-thread message",
          },
        },
        provider,
      );

    equal(
      secondDelivery.outcome,
      "sent",
    );
    equal(providerCalls, 2);
    equal(
      captured[1]?.inReplyToMessageId,
      rootMessageId,
    );
    equal(
      captured[1]?.referencesHeader,
      rootMessageId,
    );

    const persistedSecond =
      await getCommissionEmailMessageById(
        secondMessage.id,
      );

    ok(persistedSecond);
    equal(
      persistedSecond.inReplyToMessageId,
      rootMessageId,
    );
    equal(
      persistedSecond.referencesHeader,
      rootMessageId,
    );

    console.log(
      "[OK] Later client message inherits and persists root threading headers before send",
    );

    const fifoFixture =
      await createFixture();
    const fifoFirst =
      await createClientMessage(
        fifoFixture,
        "FIFO first",
      );
    await delay(5);
    const fifoSecond =
      await createClientMessage(
        fifoFixture,
        "FIFO second",
      );

    let fifoProviderCalls = 0;

    const slowProvider:
      CommissionEmailProvider = {
        async send() {
          fifoProviderCalls += 1;
          await delay(100);

          return {
            outcome: "sent",
            providerEmailId:
              `resend-${randomUUID()}`,
            providerMessageId:
              `<${randomUUID()}@email.fefierys.test>`,
          };
        },
      };

    const firstPromise =
      deliverCommissionEmailMessage(
        {
          messageId:
            fifoFirst.id,
          body: {
            text: "FIFO first",
          },
        },
        slowProvider,
      );

    await delay(20);

    const concurrentSecond =
      await deliverCommissionEmailMessage(
        {
          messageId:
            fifoSecond.id,
          body: {
            text: "FIFO second",
          },
        },
        slowProvider,
      );

    equal(
      concurrentSecond.outcome,
      "not_claimed",
    );
    equal(fifoProviderCalls, 1);

    const finishedFirst =
      await firstPromise;

    equal(
      finishedFirst.outcome,
      "sent",
    );

    const finishedSecond =
      await deliverCommissionEmailMessage(
        {
          messageId:
            fifoSecond.id,
          body: {
            text: "FIFO second",
          },
        },
        slowProvider,
      );

    equal(
      finishedSecond.outcome,
      "sent",
    );
    equal(fifoProviderCalls, 2);

    console.log(
      "[OK] Different messages in the same client thread are delivered FIFO, not concurrently",
    );

    const pendingRootFixture =
      await createFixture();
    const pendingRootFirst =
      await createClientMessage(
        pendingRootFixture,
        "Root without RFC Message-ID",
      );
    await delay(5);
    const pendingRootSecond =
      await createClientMessage(
        pendingRootFixture,
        "Must wait for RFC root",
      );

    let pendingProviderCalls = 0;

    const providerWithoutMessageId:
      CommissionEmailProvider = {
        async send() {
          pendingProviderCalls += 1;

          return {
            outcome: "sent",
            providerEmailId:
              `resend-${randomUUID()}`,
            providerMessageId: null,
          };
        },
      };

    const rootWithoutRfc =
      await deliverCommissionEmailMessage(
        {
          messageId:
            pendingRootFirst.id,
          body: {
            text:
              "Root without RFC Message-ID",
          },
        },
        providerWithoutMessageId,
      );

    equal(
      rootWithoutRfc.outcome,
      "sent",
    );

    const pendingThread =
      await getCommissionEmailThreadById(
        pendingRootFixture.threadId,
      );

    ok(pendingThread);
    ok(
      pendingThread.rootProviderEmailId,
    );
    equal(
      pendingThread.rootMessageId,
      null,
    );

    const blockedUntilRfc =
      await deliverCommissionEmailMessage(
        {
          messageId:
            pendingRootSecond.id,
          body: {
            text:
              "Must wait for RFC root",
          },
        },
        providerWithoutMessageId,
      );

    equal(
      blockedUntilRfc.outcome,
      "not_claimed",
    );
    equal(
      pendingProviderCalls,
      1,
    );

    console.log(
      "[OK] Later messages wait while root provider exists but RFC Message-ID is unresolved",
    );

    console.log(
      "[OK] Commission email thread-aware delivery verification passed",
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
      "[ERROR] Commission email thread-aware delivery verification failed",
      error,
    );
    process.exitCode = 1;
  },
);
