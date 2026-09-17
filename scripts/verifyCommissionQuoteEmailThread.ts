import {
  deepEqual,
  equal,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

import type {
  CommissionEmailProvider,
  CommissionEmailProviderSendInput,
} from "../lib/email/commissionEmailProvider";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Run this script with .env.local loaded.",
    );
  }

  const {
    eq,
    inArray,
  } = await import("drizzle-orm");

  const { db } =
    await import("../lib/db");

  const {
    commissionEmailMessages,
    commissionEmailThreads,
    commissionEvents,
    commissionQuoteItems,
    commissionQuotes,
    commissions,
    commissionStatusHistory,
  } = await import(
    "../lib/db/schema/commissions"
  );

  const {
    createCommissionQuoteDraft,
    getCommissionQuoteById,
  } = await import(
    "../lib/repositories/commissionQuoteRepository"
  );

  const {
    transitionCommissionStatus,
  } = await import(
    "../lib/repositories/commissionWorkflowRepository"
  );

  const {
    createCommissionEmailThreadIfMissing,
    setCommissionEmailThreadRootMessageId,
    setCommissionEmailThreadRootProvider,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );

  const {
    sendCommissionQuoteToClient,
  } = await import(
    "../lib/email/commissionQuoteSendService"
  );

  const {
    deliverCommissionEmailMessage,
    getCommissionEmailIdempotencyKey,
  } = await import(
    "../lib/email/commissionEmailDeliveryService"
  );

  const {
    buildCommissionQuoteEmail,
  } = await import(
    "../lib/email/commissionQuoteEmail"
  );

  const {
    buildClientProjectSubject,
  } = await import(
    "../lib/email/emailLayout"
  );

  const {
    generatePublicQuoteToken,
    hashPublicQuoteToken,
  } = await import(
    "../lib/commissions/commissionQuoteAccessToken"
  );

  const createdCommissionIds: string[] =
    [];

  interface QuoteEmailFixture {
    clientEmail: string;
    clientName: string;
    commissionId: string;
    reference: string;
    rootMessageId: string;
    subject: string;
    threadId: string;
  }

  async function createFixture(
    label: string,
  ): Promise<QuoteEmailFixture> {
    const commissionId =
      randomUUID();

    const reference =
      `QEMAIL-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 12)
        .toUpperCase()}`;

    const clientName =
      `Quote Email ${label} Verification`;

    const clientEmail =
      `quote-email-${label.toLowerCase()}-${commissionId}@example.com`;

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
          `Temporary quote email ${label} verification fixture.`,
      });

    createdCommissionIds.push(
      commissionId,
    );

    const subject =
      buildClientProjectSubject(
        reference,
      );

    const threadResult =
      await createCommissionEmailThreadIfMissing({
        commissionId,
        subject,
      });

    const threadId =
      threadResult.thread.id;

    const rootProviderEmailId =
      `quote-email-root-${commissionId}`;

    const rootMessageId =
      `<quote-email-root-${commissionId}@email.fefierys.test>`;

    const providerRoot =
      await setCommissionEmailThreadRootProvider({
        threadId,
        providerEmailId:
          rootProviderEmailId,
      });

    ok(
      providerRoot.outcome ===
        "set" ||
        providerRoot.outcome ===
          "already_set",
    );

    const messageRoot =
      await setCommissionEmailThreadRootMessageId({
        threadId,

        providerEmailId:
          rootProviderEmailId,

        rootMessageId,
      });

    ok(
      messageRoot.outcome ===
        "set" ||
        messageRoot.outcome ===
          "already_set",
    );

    const reviewResult =
      await transitionCommissionStatus({
        commissionId,

        fromStatus:
          "received",

        toStatus:
          "under_review",

        initiatedBy:
          "artist",

        changedByAdminUserId:
          "verify-quote-email-thread",
      });

    equal(
      reviewResult.outcome,
      "updated",
    );

    const quotingResult =
      await transitionCommissionStatus({
        commissionId,

        fromStatus:
          "under_review",

        toStatus:
          "quoting",

        initiatedBy:
          "artist",

        changedByAdminUserId:
          "verify-quote-email-thread",
      });

    equal(
      quotingResult.outcome,
      "updated",
    );

    return {
      clientEmail,
      clientName,
      commissionId,
      reference,
      rootMessageId,
      subject,
      threadId,
    };
  }

  async function createDraft(
    fixture: QuoteEmailFixture,
  ) {
    const draft =
      await createCommissionQuoteDraft({
        commissionId:
          fixture.commissionId,

        currency:
          "USD",

        description:
          "Quote email thread verification",

        notes:
          "Temporary verification quote.",

        validUntil:
          new Date(
            Date.now() +
              14 *
                24 *
                60 *
                60 *
                1000,
          ),

        items: [
          {
            label:
              "Illustration",

            description:
              "Quote email verification item",

            quantity:
              1,

            unitAmount:
              "450",
          },
        ],

        createdByAdminUserId:
          "verify-quote-email-thread",
      });

    equal(
      draft.outcome,
      "created",
    );

    if (
      draft.outcome !==
      "created"
    ) {
      throw new Error(
        "Expected the quote email verification draft to be created.",
      );
    }

    return draft;
  }

  function getBodyText(
    input:
      CommissionEmailProviderSendInput,
  ): string {
    return typeof input.body.text ===
      "string"
      ? input.body.text
      : "";
  }

  function getBodyHtml(
    input:
      CommissionEmailProviderSendInput,
  ): string {
    return typeof input.body.html ===
      "string"
      ? input.body.html
      : "";
  }

  try {
    /*
     * ========================================================
     * SUCCESSFUL DELIVERY
     * ========================================================
     */
    const successFixture =
      await createFixture(
        "Success",
      );

    const successDraft =
      await createDraft(
        successFixture,
      );

    const successAttempts:
      CommissionEmailProviderSendInput[] =
        [];

    const successProvider:
      CommissionEmailProvider = {
      async send(input) {
        successAttempts.push(
          input,
        );

        return {
          outcome:
            "sent",

          providerEmailId:
            `quote-email-success-${randomUUID()}`,

          providerMessageId:
            `<quote-email-success-${randomUUID()}@email.fefierys.test>`,
        };
      },
    };

    const successResult =
      await sendCommissionQuoteToClient(
        {
          quoteId:
            successDraft.quote.id,

          expectedUpdatedAt:
            successDraft.quote
              .updatedAt,

          sentByAdminUserId:
            "verify-quote-email-thread",
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
        "Expected successful quote email delivery.",
      );
    }

    equal(
      successResult.commissionId,
      successFixture.commissionId,
    );

    equal(
      successAttempts.length,
      1,
    );

    const successMessageRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages
              .commissionId,
            successFixture
              .commissionId,
          ),
        );

    equal(
      successMessageRows.length,
      1,
    );

    const successMessage =
      successMessageRows[0];

    ok(
      successMessage,
    );

    equal(
      successMessage.id,
      successResult.messageId,
    );

    equal(
      successMessage.threadId,
      successFixture.threadId,
    );

    equal(
      successMessage.quoteId,
      successDraft.quote.id,
    );

    equal(
      successMessage.scope,
      "client_thread",
    );

    equal(
      successMessage.direction,
      "outbound",
    );

    equal(
      successMessage.kind,
      "quote_ready",
    );

    equal(
      successMessage.actor,
      "artist",
    );

    equal(
      successMessage.deliveryStatus,
      "sent",
    );

    equal(
      successMessage.attemptCount,
      1,
    );

    equal(
      successMessage.subject,
      successFixture.subject,
    );

    equal(
      successMessage.recipientEmail,
      successFixture.clientEmail,
    );

    equal(
      successMessage.inReplyToMessageId,
      successFixture.rootMessageId,
    );

    equal(
      successMessage.referencesHeader,
      successFixture.rootMessageId,
    );

    const successToken =
      generatePublicQuoteToken(
        successDraft.quote.id,
      );

    const successAuditText =
      successMessage.messageText ??
      "";

    equal(
      successAuditText.includes(
        successToken,
      ),
      false,
    );

    equal(
      successAuditText.includes(
        "/quote/",
      ),
      false,
    );

    console.log(
      "[OK] quote_ready persists safe audit text without the bearer token or secure URL",
    );

    const successQuoteRows =
      await db
        .select({
          publicTokenHash:
            commissionQuotes
              .publicTokenHash,

          status:
            commissionQuotes.status,
        })
        .from(
          commissionQuotes,
        )
        .where(
          eq(
            commissionQuotes.id,
            successDraft.quote.id,
          ),
        )
        .limit(1);

    equal(
      successQuoteRows[0]?.status,
      "sent",
    );

    equal(
      successQuoteRows[0]
        ?.publicTokenHash,
      hashPublicQuoteToken(
        successToken,
      ),
    );

    console.log(
      "[OK] Quote stores only the deterministic token hash",
    );

    const successAttempt =
      successAttempts[0];

    ok(
      successAttempt,
    );

    equal(
      successAttempt.trackingMessageId,
      successMessage.id,
    );

    equal(
      successAttempt.idempotencyKey,
      getCommissionEmailIdempotencyKey(
        successMessage.id,
      ),
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

    ok(
      getBodyText(
        successAttempt,
      ).includes(
        `/quote/${successToken}`,
      ),
    );

    ok(
      getBodyHtml(
        successAttempt,
      ).includes(
        `/quote/${successToken}`,
      ),
    );

    console.log(
      "[OK] Provider receives the secure quote URL only in the in-memory email body",
    );

    console.log(
      "[OK] quote_ready delivery uses the immutable thread root for In-Reply-To and References",
    );

    const successThreadRows =
      await db
        .select()
        .from(
          commissionEmailThreads,
        )
        .where(
          eq(
            commissionEmailThreads.id,
            successFixture.threadId,
          ),
        )
        .limit(1);

    equal(
      successThreadRows[0]
        ?.rootMessageId,
      successFixture.rootMessageId,
    );

    console.log(
      "[OK] Sending the quote does not replace the established client thread root",
    );

    /*
     * ========================================================
     * FAILURE + RETRY
     * ========================================================
     */
    const retryFixture =
      await createFixture(
        "Retry",
      );

    const retryDraft =
      await createDraft(
        retryFixture,
      );

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
          outcome:
            "failed",

          failureMessage:
            "Synthetic quote email provider failure.",
        };
      },
    };

    const failedResult =
      await sendCommissionQuoteToClient(
        {
          quoteId:
            retryDraft.quote.id,

          expectedUpdatedAt:
            retryDraft.quote
              .updatedAt,

          sentByAdminUserId:
            "verify-quote-email-thread",
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
        "Expected synthetic quote email delivery failure.",
      );
    }

    equal(
      failedAttempts.length,
      1,
    );

    const failedMessageRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.id,
            failedResult.messageId,
          ),
        )
        .limit(1);

    const failedMessage =
      failedMessageRows[0];

    ok(
      failedMessage,
    );

    equal(
      failedMessage.quoteId,
      retryDraft.quote.id,
    );

    equal(
      failedMessage.threadId,
      retryFixture.threadId,
    );

    equal(
      failedMessage.kind,
      "quote_ready",
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
      failedMessage.inReplyToMessageId,
      retryFixture.rootMessageId,
    );

    equal(
      failedMessage.referencesHeader,
      retryFixture.rootMessageId,
    );

    equal(
      failedMessage.failureMessage,
      "Synthetic quote email provider failure.",
    );

    const failedQuoteRows =
      await db
        .select({
          publicTokenHash:
            commissionQuotes
              .publicTokenHash,

          status:
            commissionQuotes.status,
        })
        .from(
          commissionQuotes,
        )
        .where(
          eq(
            commissionQuotes.id,
            retryDraft.quote.id,
          ),
        )
        .limit(1);

    equal(
      failedQuoteRows[0]?.status,
      "sent",
    );

    const failedCommissionRows =
      await db
        .select({
          status:
            commissions.status,
        })
        .from(
          commissions,
        )
        .where(
          eq(
            commissions.id,
            retryFixture.commissionId,
          ),
        )
        .limit(1);

    equal(
      failedCommissionRows[0]
        ?.status,
      "awaiting_quote_response",
    );

    console.log(
      "[OK] Provider failure preserves the sent quote, workflow transition, and failed logical email",
    );

    const retryToken =
      generatePublicQuoteToken(
        retryDraft.quote.id,
      );

    equal(
      failedQuoteRows[0]
        ?.publicTokenHash,
      hashPublicQuoteToken(
        retryToken,
      ),
    );

    const failedAuditText =
      failedMessage.messageText ??
      "";

    equal(
      failedAuditText.includes(
        retryToken,
      ),
      false,
    );

    equal(
      failedAuditText.includes(
        "/quote/",
      ),
      false,
    );

    const storedRetryQuote =
      await getCommissionQuoteById(
        retryDraft.quote.id,
      );

    ok(
      storedRetryQuote,
    );

    ok(
      storedRetryQuote.quote
        .validUntil,
    );

    const retryContent =
      buildCommissionQuoteEmail({
        clientName:
          retryFixture.clientName,

        currency:
          storedRetryQuote.quote
            .currency,

        publicToken:
          retryToken,

        reference:
          retryFixture.reference,

        totalAmount:
          storedRetryQuote.quote
            .totalAmount,

        validUntil:
          storedRetryQuote.quote
            .validUntil!,

        version:
          storedRetryQuote.quote
            .version,
      });

    const retryBody = {
      text:
        retryContent.text,

      html:
        retryContent.html,
    };

    const firstFailedAttempt =
      failedAttempts[0];

    ok(
      firstFailedAttempt,
    );

    deepEqual(
      firstFailedAttempt.body,
      retryBody,
    );

    const retryAttempts:
      CommissionEmailProviderSendInput[] =
        [];

    const successfulRetryProvider:
      CommissionEmailProvider = {
      async send(input) {
        retryAttempts.push(
          input,
        );

        return {
          outcome:
            "sent",

          providerEmailId:
            `quote-email-retry-${randomUUID()}`,

          providerMessageId:
            `<quote-email-retry-${randomUUID()}@email.fefierys.test>`,
        };
      },
    };

    const retryDelivery =
      await deliverCommissionEmailMessage(
        {
          messageId:
            failedResult.messageId,

          body:
            retryBody,
        },
        successfulRetryProvider,
      );

    equal(
      retryDelivery.outcome,
      "sent",
    );

    equal(
      retryAttempts.length,
      1,
    );

    const successfulRetryAttempt =
      retryAttempts[0];

    ok(
      successfulRetryAttempt,
    );

    equal(
      successfulRetryAttempt
        .trackingMessageId,
      firstFailedAttempt
        .trackingMessageId,
    );

    equal(
      successfulRetryAttempt
        .trackingMessageId,
      failedResult.messageId,
    );

    equal(
      successfulRetryAttempt
        .idempotencyKey,
      firstFailedAttempt
        .idempotencyKey,
    );

    equal(
      successfulRetryAttempt
        .idempotencyKey,
      getCommissionEmailIdempotencyKey(
        failedResult.messageId,
      ),
    );

    equal(
      successfulRetryAttempt
        .inReplyToMessageId,
      retryFixture.rootMessageId,
    );

    equal(
      successfulRetryAttempt
        .referencesHeader,
      retryFixture.rootMessageId,
    );

    deepEqual(
      successfulRetryAttempt.body,
      firstFailedAttempt.body,
    );

    ok(
      getBodyText(
        successfulRetryAttempt,
      ).includes(
        `/quote/${retryToken}`,
      ),
    );

    console.log(
      "[OK] Retrying the same logical message reproduces the same secure quote body, thread headers, and idempotency key",
    );

    const retriedMessageRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.id,
            failedResult.messageId,
          ),
        )
        .limit(1);

    const retriedMessage =
      retriedMessageRows[0];

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

    ok(
      retriedMessage.sentAt instanceof
        Date,
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
      "[OK] Failed quote email retries transition the same message from failed to sent",
    );

    let afterSentProviderCalls =
      0;

    const shouldNotSendProvider:
      CommissionEmailProvider = {
      async send() {
        afterSentProviderCalls +=
          1;

        return {
          outcome:
            "sent",

          providerEmailId:
            "should-not-send",

          providerMessageId:
            "<should-not-send@email.fefierys.test>",
        };
      },
    };

    const afterSent =
      await deliverCommissionEmailMessage(
        {
          messageId:
            failedResult.messageId,

          body:
            retryBody,
        },
        shouldNotSendProvider,
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
      afterSentProviderCalls,
      0,
    );

    console.log(
      "[OK] A sent quote email cannot be delivered again",
    );

    const retryCommissionMessages =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages
              .commissionId,
            retryFixture.commissionId,
          ),
        );

    equal(
      retryCommissionMessages.length,
      1,
    );

    equal(
      retryCommissionMessages[0]
        ?.id,
      failedResult.messageId,
    );

    equal(
      retryCommissionMessages[0]
        ?.kind,
      "quote_ready",
    );

    console.log(
      "[OK] Failure and retry preserve one quote_ready logical message without duplicates",
    );

    console.log(
      "[OK] Commission quote email thread verification passed",
    );
  } finally {
    if (
      createdCommissionIds.length >
      0
    ) {
      await db
        .delete(
          commissionEmailMessages,
        )
        .where(
          inArray(
            commissionEmailMessages
              .commissionId,
            createdCommissionIds,
          ),
        );

      const quoteRows =
        await db
          .select({
            id:
              commissionQuotes.id,
          })
          .from(
            commissionQuotes,
          )
          .where(
            inArray(
              commissionQuotes
                .commissionId,
              createdCommissionIds,
            ),
          );

      const quoteIds =
        quoteRows.map(
          (quote) =>
            quote.id,
        );

      if (
        quoteIds.length > 0
      ) {
        await db
          .delete(
            commissionQuoteItems,
          )
          .where(
            inArray(
              commissionQuoteItems
                .quoteId,
              quoteIds,
            ),
          );

        await db
          .delete(
            commissionQuotes,
          )
          .where(
            inArray(
              commissionQuotes.id,
              quoteIds,
            ),
          );
      }

      await db
        .delete(
          commissionEvents,
        )
        .where(
          inArray(
            commissionEvents
              .commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(
          commissionStatusHistory,
        )
        .where(
          inArray(
            commissionStatusHistory
              .commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(
          commissionEmailThreads,
        )
        .where(
          inArray(
            commissionEmailThreads
              .commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(
          commissions,
        )
        .where(
          inArray(
            commissions.id,
            createdCommissionIds,
          ),
        );

      console.log(
        "[OK] Temporary quote email verification data was removed",
      );
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "[ERROR] Commission quote email thread verification failed",
      error,
    );

    process.exitCode = 1;
  },
);
