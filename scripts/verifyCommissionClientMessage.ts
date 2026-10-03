import {
  deepEqual,
  equal,
  match,
  ok,
} from "node:assert/strict";
import {
  randomUUID,
} from "node:crypto";

import { config } from "dotenv";

import type {
  CommissionEmailProvider,
  CommissionEmailProviderSendInput,
} from "../lib/email/commissionEmailProvider";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  const {
    eq,
    inArray,
  } = await import(
    "drizzle-orm"
  );

  const {
    db,
  } = await import(
    "../lib/db"
  );

  const {
    commissionEmailMessages,
    commissionEmailThreads,
    commissions,
  } = await import(
    "../lib/db/schema/commissions"
  );

  const {
    buildCommissionClientMessageEmail,
  } = await import(
    "../lib/email/commissionClientMessageEmail"
  );

  const {
    deliverCommissionEmailMessage,
    getCommissionEmailIdempotencyKey,
  } = await import(
    "../lib/email/commissionEmailDeliveryService"
  );

  const {
    sendCommissionClientMessage,
  } = await import(
    "../lib/email/commissionClientMessageService"
  );

  const {
    createCommissionClientMessage,
  } = await import(
    "../lib/repositories/commissionClientMessageRepository"
  );

  const {
    createCommissionEmailThreadIfMissing,
    createQueuedCommissionEmailMessage,
    getCommissionEmailMessageById,
    setCommissionEmailThreadRootMessageId,
    setCommissionEmailThreadRootProvider,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
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

  async function createFixture(
    options: {
      isOnHold?: boolean;
      rootReady?: boolean;
    } = {},
  ) {
    const commissionId =
      randomUUID();

    const reference =
      createReference(
        "MSG",
      );

    const clientName =
      "Client Message Verification";

    const clientEmail =
      `client-message-${randomUUID()}@example.com`;

    const subject =
      `Fefierys Art — Your project — ${reference}`;

    const isOnHold =
        options.isOnHold ??
        false;

        const holdStartedAt =
        isOnHold
            ? new Date()
            : null;

        await db
        .insert(
            commissions,
        )
        .values({
            id:
            commissionId,

            submissionId:
            randomUUID(),

            reference,

            clientName,

            clientEmail,

            initialMessage:
            "Temporary commission created by verifyCommissionClientMessage.",

            status:
            "received",

            isOnHold,

            holdStartedAt,
        });

    commissionIds.push(
      commissionId,
    );

    const threadResult =
      await createCommissionEmailThreadIfMissing({
        commissionId,
        subject,
      });

    const rootProviderEmailId =
      `root-provider-${randomUUID()}`;

    const rootMessageId =
      `<root-${randomUUID()}@email.fefierys.test>`;

    if (
      options.rootReady !==
      false
    ) {
      const providerRootResult =
        await setCommissionEmailThreadRootProvider({
          threadId:
            threadResult.thread.id,

          providerEmailId:
            rootProviderEmailId,
        });

      ok(
        providerRootResult.outcome ===
          "set" ||
          providerRootResult.outcome ===
            "already_set",
      );

      const messageRootResult =
        await setCommissionEmailThreadRootMessageId({
          threadId:
            threadResult.thread.id,

          providerEmailId:
            rootProviderEmailId,

          rootMessageId,
        });

      ok(
        messageRootResult.outcome ===
          "set" ||
          messageRootResult.outcome ===
            "already_set",
      );
    }

    return {
      commissionId,
      clientEmail,
      clientName,
      reference,
      rootMessageId:
        options.rootReady ===
        false
          ? null
          : rootMessageId,
      subject,
      threadId:
        threadResult.thread.id,
    };
  }

  try {
    /*
     * ============================================================
     * SUCCESSFUL GENERIC MESSAGE
     * ============================================================
     */

    const successFixture =
      await createFixture();

    const beforeRows =
      await db
        .select()
        .from(
          commissions,
        )
        .where(
          eq(
            commissions.id,
            successFixture.commissionId,
          ),
        )
        .limit(1);

    const beforeCommission =
      beforeRows[0];

    ok(
      beforeCommission,
    );

    const messageText = [
      "Here is an update about your project.",
      "",
      "Please let me know if this works for you.",
      "",
      "HTML safety check: <script>alert('x')</script> & details.",
    ].join("\n");

    const capturedSuccess:
      CommissionEmailProviderSendInput[] =
      [];

    const successProvider:
      CommissionEmailProvider = {
        async send(input) {
          capturedSuccess.push(
            input,
          );

          return {
            outcome: "sent",
            providerEmailId:
              `provider-${randomUUID()}`,
            providerMessageId:
              `<message-${randomUUID()}@email.fefierys.test>`,
          };
        },
      };

    const successResult =
      await sendCommissionClientMessage(
        {
          commissionId:
            successFixture.commissionId,

          messageText,

          createdByAdminUserId:
            "client-message-verifier",
        },
        successProvider,
      );

    equal(
      successResult.outcome,
      "sent",
    );

    if (
      successResult.outcome !==
      "sent"
    ) {
      throw new Error(
        "Successful client message did not return sent.",
      );
    }

    equal(
      capturedSuccess.length,
      1,
    );

    const successAttempt =
      capturedSuccess[0];

    ok(
      successAttempt,
    );

    const persistedSuccess =
      await getCommissionEmailMessageById(
        successResult.messageId,
      );

    ok(
      persistedSuccess,
    );

    equal(
      persistedSuccess.commissionId,
      successFixture.commissionId,
    );

    equal(
      persistedSuccess.threadId,
      successFixture.threadId,
    );

    equal(
      persistedSuccess.scope,
      "client_thread",
    );

    equal(
      persistedSuccess.direction,
      "outbound",
    );

    equal(
      persistedSuccess.kind,
      "general_message",
    );

    equal(
      persistedSuccess.actor,
      "artist",
    );

    equal(
      persistedSuccess.deliveryStatus,
      "sent",
    );

    equal(
      persistedSuccess.messageText,
      messageText,
    );

    equal(
      persistedSuccess.subject,
      successFixture.subject,
    );

    equal(
      persistedSuccess.recipientEmail,
      successFixture.clientEmail,
    );

    equal(
      persistedSuccess.createdByAdminUserId,
      "client-message-verifier",
    );

    equal(
      persistedSuccess.attemptCount,
      1,
    );

    console.log(
      "[OK] Generic client message is persisted as one sent general_message",
    );

    equal(
      successAttempt.subject,
      successFixture.subject,
    );

    equal(
      successAttempt.recipientEmail,
      successFixture.clientEmail,
    );

    equal(
      successAttempt.inReplyToMessageId,
      successFixture.rootMessageId,
    );

    equal(
      successAttempt.referencesHeader,
      successFixture.rootMessageId,
    );

    equal(
      persistedSuccess.inReplyToMessageId,
      successFixture.rootMessageId,
    );

    equal(
      persistedSuccess.referencesHeader,
      successFixture.rootMessageId,
    );

    console.log(
      "[OK] Generic client message uses the immutable commission thread root",
    );

    const expectedBody =
      buildCommissionClientMessageEmail({
        clientName:
          successFixture.clientName,

        message:
          messageText,

        reference:
          successFixture.reference,
      });

    deepEqual(
      successAttempt.body,
      expectedBody,
    );

    match(
      successAttempt.body.text ??
        "",
      /Here is an update about your project\./,
    );

    equal(
      successAttempt.body.html?.includes(
        "<script>alert('x')</script>",
      ),
      false,
    );

    equal(
      successAttempt.body.html?.includes(
        "&lt;script&gt;",
      ),
      true,
    );

    console.log(
      "[OK] Generic client message body is reproducible and HTML-escaped",
    );

    const afterRows =
      await db
        .select()
        .from(
          commissions,
        )
        .where(
          eq(
            commissions.id,
            successFixture.commissionId,
          ),
        )
        .limit(1);

    const afterCommission =
      afterRows[0];

    ok(
      afterCommission,
    );

    equal(
      afterCommission.status,
      beforeCommission.status,
    );

    equal(
      afterCommission.isOnHold,
      beforeCommission.isOnHold,
    );

    equal(
      afterCommission.updatedAt.getTime(),
      beforeCommission.updatedAt.getTime(),
    );

    console.log(
      "[OK] Sending a generic client message does not mutate commission workflow state",
    );

    /*
     * ============================================================
     * ON-HOLD COMMISSION
     * ============================================================
     */

    const heldFixture =
      await createFixture({
        isOnHold: true,
      });

    let heldProviderCalls =
      0;

    const heldProvider:
      CommissionEmailProvider = {
        async send() {
          heldProviderCalls +=
            1;

          return {
            outcome: "sent",
            providerEmailId:
              `provider-${randomUUID()}`,
            providerMessageId:
              `<message-${randomUUID()}@email.fefierys.test>`,
          };
        },
      };

    const heldResult =
      await sendCommissionClientMessage(
        {
          commissionId:
            heldFixture.commissionId,

          messageText:
            "The project is currently paused, but I wanted to send you this update.",

          createdByAdminUserId:
            "client-message-verifier",
        },
        heldProvider,
      );

    equal(
      heldResult.outcome,
      "sent",
    );

    equal(
      heldProviderCalls,
      1,
    );

    const heldCommissionRows =
      await db
        .select({
          isOnHold:
            commissions.isOnHold,
          status:
            commissions.status,
        })
        .from(
          commissions,
        )
        .where(
          eq(
            commissions.id,
            heldFixture.commissionId,
          ),
        );

    equal(
      heldCommissionRows[0]
        ?.isOnHold,
      true,
    );

    equal(
      heldCommissionRows[0]
        ?.status,
      "received",
    );

    console.log(
      "[OK] Communication remains available while a commission is on hold",
    );

    /*
     * ============================================================
     * THREAD ROOT NOT READY
     * ============================================================
     */

    const rootPendingFixture =
      await createFixture({
        rootReady: false,
      });

    let rootPendingProviderCalls =
      0;

    const rootPendingResult =
      await sendCommissionClientMessage(
        {
          commissionId:
            rootPendingFixture.commissionId,

          messageText:
            "This message must wait for the root RFC Message-ID.",

          createdByAdminUserId:
            "client-message-verifier",
        },
        {
          async send() {
            rootPendingProviderCalls +=
              1;

            return {
              outcome: "sent",
              providerEmailId:
                `provider-${randomUUID()}`,
              providerMessageId:
                `<message-${randomUUID()}@email.fefierys.test>`,
            };
          },
        },
      );

    equal(
      rootPendingResult.outcome,
      "thread_not_ready",
    );

    equal(
      rootPendingProviderCalls,
      0,
    );

    const rootPendingMessages =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            rootPendingFixture.commissionId,
          ),
        );

    equal(
      rootPendingMessages.length,
      0,
    );

    console.log(
      "[OK] Generic message waits until the client thread has a verified RFC root",
    );

    /*
     * ============================================================
     * BLOCKING OUTBOUND MESSAGE
     * ============================================================
     */

    const blockedFixture =
      await createFixture();

    await createQueuedCommissionEmailMessage({
      commissionId:
        blockedFixture.commissionId,

      threadId:
        blockedFixture.threadId,

      quoteId:
        null,

      scope:
        "client_thread",

      kind:
        "general_message",

      actor:
        "artist",

      senderEmail:
        "contact@fefierys.com",

      recipientEmail:
        blockedFixture.clientEmail,

      replyToEmail:
        "artist@example.com",

      subject:
        blockedFixture.subject,

      messageText:
        "Earlier unsent message.",

      createdByAdminUserId:
        "client-message-verifier",
    });

    let blockedProviderCalls =
      0;

    const blockedResult =
      await sendCommissionClientMessage(
        {
          commissionId:
            blockedFixture.commissionId,

          messageText:
            "This later message must not overtake the previous one.",

          createdByAdminUserId:
            "client-message-verifier",
        },
        {
          async send() {
            blockedProviderCalls +=
              1;

            return {
              outcome: "sent",
              providerEmailId:
                `provider-${randomUUID()}`,
              providerMessageId:
                `<message-${randomUUID()}@email.fefierys.test>`,
            };
          },
        },
      );

    equal(
      blockedResult.outcome,
      "thread_blocked",
    );

    equal(
      blockedProviderCalls,
      0,
    );

    const blockedMessages =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            blockedFixture.commissionId,
          ),
        );

    equal(
      blockedMessages.length,
      1,
    );

    console.log(
      "[OK] Existing unsent outbound message blocks a later generic client message",
    );

    /*
     * ============================================================
     * PROVIDER FAILURE + RETRY OF SAME LOGICAL MESSAGE
     * ============================================================
     */

    const retryFixture =
      await createFixture();

    const retryMessageText =
      "This message will fail once and then be retried.";

    const failedAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const failingProvider:
      CommissionEmailProvider = {
        async send(input) {
          failedAttempts.push(
            input,
          );

          return {
            outcome: "failed",
            failureMessage:
              "Synthetic provider failure.",
          };
        },
      };

    const failedResult =
      await sendCommissionClientMessage(
        {
          commissionId:
            retryFixture.commissionId,

          messageText:
            retryMessageText,

          createdByAdminUserId:
            "client-message-verifier",
        },
        failingProvider,
      );

    equal(
      failedResult.outcome,
      "delivery_failed",
    );

    if (
      failedResult.outcome !==
      "delivery_failed"
    ) {
      throw new Error(
        "Failure fixture did not produce delivery_failed.",
      );
    }

    equal(
      failedAttempts.length,
      1,
    );

    const failedMessage =
      await getCommissionEmailMessageById(
        failedResult.messageId,
      );

    ok(
      failedMessage,
    );

    equal(
      failedMessage.deliveryStatus,
      "failed",
    );

    equal(
      failedMessage.attemptCount,
      1,
    );

    equal(
      failedMessage.messageText,
      retryMessageText,
    );

    equal(
      failedMessage.inReplyToMessageId,
      retryFixture.rootMessageId,
    );

    equal(
      failedMessage.referencesHeader,
      retryFixture.rootMessageId,
    );

    console.log(
      "[OK] Provider failure preserves the failed logical general_message for retry",
    );

    const retryBody =
      buildCommissionClientMessageEmail({
        clientName:
          retryFixture.clientName,

        message:
          failedMessage.messageText ??
          retryMessageText,

        reference:
          retryFixture.reference,
      });

    deepEqual(
      failedAttempts[0]?.body,
      retryBody,
    );

    const retryAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const retryProvider:
      CommissionEmailProvider = {
        async send(input) {
          retryAttempts.push(
            input,
          );

          return {
            outcome: "sent",
            providerEmailId:
              `provider-${randomUUID()}`,
            providerMessageId:
              `<message-${randomUUID()}@email.fefierys.test>`,
          };
        },
      };

    const retryResult =
      await deliverCommissionEmailMessage(
        {
          messageId:
            failedResult.messageId,

          body:
            retryBody,
        },
        retryProvider,
      );

    equal(
      retryResult.outcome,
      "sent",
    );

    equal(
      retryAttempts.length,
      1,
    );

    equal(
      retryAttempts[0]?.trackingMessageId,
      failedResult.messageId,
    );

    equal(
      retryAttempts[0]?.idempotencyKey,
      failedAttempts[0]?.idempotencyKey,
    );

    equal(
      retryAttempts[0]?.idempotencyKey,
      getCommissionEmailIdempotencyKey(
        failedResult.messageId,
      ),
    );

    equal(
      retryAttempts[0]?.inReplyToMessageId,
      retryFixture.rootMessageId,
    );

    equal(
      retryAttempts[0]?.referencesHeader,
      retryFixture.rootMessageId,
    );

    deepEqual(
      retryAttempts[0]?.body,
      failedAttempts[0]?.body,
    );

    console.log(
      "[OK] Retry reuses the same message ID, body, thread headers, and idempotency key",
    );

    const retriedMessage =
      await getCommissionEmailMessageById(
        failedResult.messageId,
      );

    ok(
      retriedMessage,
    );

    equal(
      retriedMessage.deliveryStatus,
      "sent",
    );

    equal(
      retriedMessage.attemptCount,
      2,
    );

    equal(
      retriedMessage.failedAt,
      null,
    );

    equal(
      retriedMessage.failureMessage,
      null,
    );

    console.log(
      "[OK] Failed generic message transitions from failed to sent on retry",
    );

    let duplicateProviderCalls =
      0;

    const duplicateResult =
      await deliverCommissionEmailMessage(
        {
          messageId:
            failedResult.messageId,

          body:
            retryBody,
        },
        {
          async send() {
            duplicateProviderCalls +=
              1;

            return {
              outcome: "sent",
              providerEmailId:
                `provider-${randomUUID()}`,
              providerMessageId:
                `<message-${randomUUID()}@email.fefierys.test>`,
            };
          },
        },
      );

    equal(
      duplicateResult.outcome,
      "not_claimed",
    );

    if (
      duplicateResult.outcome ===
      "not_claimed"
    ) {
      equal(
        duplicateResult.currentStatus,
        "sent",
      );
    }

    equal(
      duplicateProviderCalls,
      0,
    );

    const retryFixtureMessages =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            retryFixture.commissionId,
          ),
        );

    equal(
      retryFixtureMessages.length,
      1,
    );

    equal(
      retryFixtureMessages[0]?.id,
      failedResult.messageId,
    );

    console.log(
      "[OK] Retry keeps exactly one logical general_message and sent messages cannot be delivered again",
    );

    /*
     * ============================================================
     * REPOSITORY VALIDATION
     * ============================================================
     */

    const invalidFixture =
      await createFixture();

    const invalidResult =
      await createCommissionClientMessage({
        commissionId:
          invalidFixture.commissionId,

        messageText:
          "   ",

        createdByAdminUserId:
          "client-message-verifier",

        senderEmail:
          "contact@fefierys.com",

        replyToEmail:
          "artist@example.com",
      });

    equal(
      invalidResult.outcome,
      "invalid_message",
    );

    const invalidMessages =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            invalidFixture.commissionId,
          ),
        );

    equal(
      invalidMessages.length,
      0,
    );

    console.log(
      "[OK] Blank generic client messages are rejected without writes",
    );

    console.log(
      "[OK] Commission client message verification passed",
    );
  } finally {
    if (
      commissionIds.length >
      0
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

      const remainingRows =
        await db
          .select({
            id:
              commissions.id,
          })
          .from(
            commissions,
          )
          .where(
            inArray(
              commissions.id,
              commissionIds,
            ),
          );

      equal(
        remainingRows.length,
        0,
      );

      console.log(
        "[OK] Temporary client message verification data was removed",
      );
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "Commission client message verification failed:",
      error,
    );

    process.exitCode = 1;
  },
);