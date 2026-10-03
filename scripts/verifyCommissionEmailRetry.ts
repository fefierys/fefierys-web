import {
  deepEqual,
  equal,
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
    commissionEvents,
    commissionQuoteItems,
    commissionQuotes,
    commissions,
    commissionStatusHistory,
  } = await import(
    "../lib/db/schema/commissions"
  );

  const {
    createCommission,
    getCommissionById,
  } = await import(
    "../lib/repositories/commissionRepository"
  );

  const {
    createCommissionEmailThreadIfMissing,
    createQueuedCommissionEmailMessage,
    getCommissionEmailMessageById,
    getCommissionEmailThreadById,
    setCommissionEmailThreadRootMessageId,
    setCommissionEmailThreadRootProvider,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
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
    createAndDeliverClientInquiryConfirmation,
  } = await import(
    "../lib/email/commissionInquiryCommunicationService"
  );

  const {
    sendCommissionClientMessage,
  } = await import(
    "../lib/email/commissionClientMessageService"
  );

  const {
    requestCommissionClientDetails,
  } = await import(
    "../lib/email/commissionClientDetailsRequestService"
  );

  const {
    sendCommissionQuoteToClient,
  } = await import(
    "../lib/email/commissionQuoteSendService"
  );

  const {
    retryCommissionEmailMessage,
  } = await import(
    "../lib/email/commissionEmailRetryService"
  );

  const {
    deliverCommissionEmailMessage,
    getCommissionEmailIdempotencyKey,
  } = await import(
    "../lib/email/commissionEmailDeliveryService"
  );

  const {
    buildClientProjectSubject,
  } = await import(
    "../lib/email/emailLayout"
  );

  const createdCommissionIds:
    string[] = [];

  interface CommissionFixture {
    commissionId: string;
    clientEmail: string;
    clientName: string;
    reference: string;
  }

  interface RootedFixture
    extends CommissionFixture {
    rootMessageId: string;
    subject: string;
    threadId: string;
  }

  async function createFixture(
    label: string,
  ): Promise<CommissionFixture> {
    const marker =
      randomUUID();

    const clientName =
      `${label} Retry Verification`;

    const clientEmail =
      `retry-${label.toLowerCase()}-${marker}@example.com`;

    const created =
      await createCommission({
        submissionId:
          randomUUID(),

        clientName,

        clientEmail,

        styleSnapshot:
          "Stylized",

        collectionSnapshot:
          "Character Art",

        categorySnapshot:
          "Character Illustration",

        optionSnapshot:
          "Full Body",

        initialMessage:
          `Temporary ${label} retry verification request.`,

        termsVersion:
          "2026.1",

        agreementVersion:
          null,
      });

    createdCommissionIds.push(
      created.id,
    );

    return {
      commissionId:
        created.id,

      clientEmail,

      clientName,

      reference:
        created.reference,
    };
  }

  async function createRootedFixture(
    label: string,
  ): Promise<RootedFixture> {
    const fixture =
      await createFixture(
        label,
      );

    const subject =
      buildClientProjectSubject(
        fixture.reference,
      );

    const threadResult =
      await createCommissionEmailThreadIfMissing({
        commissionId:
          fixture.commissionId,

        subject,
      });

    const rootProviderEmailId =
      `retry-root-provider-${randomUUID()}`;

    const rootMessageId =
      `<retry-root-${randomUUID()}@email.fefierys.test>`;

    const providerRoot =
      await setCommissionEmailThreadRootProvider({
        threadId:
          threadResult.thread.id,

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
        threadId:
          threadResult.thread.id,

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

    return {
      ...fixture,

      rootMessageId,

      subject,

      threadId:
        threadResult.thread.id,
    };
  }

  function createFailingProvider(
    attempts:
      CommissionEmailProviderSendInput[],
    failureMessage: string,
  ): CommissionEmailProvider {
    return {
      async send(input) {
        attempts.push(
          input,
        );

        return {
          outcome:
            "failed",

          failureMessage,
        };
      },
    };
  }

  function createSuccessfulProvider(
    attempts:
      CommissionEmailProviderSendInput[],
    label: string,
  ): CommissionEmailProvider {
    return {
      async send(input) {
        attempts.push(
          input,
        );

        return {
          outcome:
            "sent",

          providerEmailId:
            `${label}-${randomUUID()}`,

          providerMessageId:
            `<${label}-${randomUUID()}@email.fefierys.test>`,
        };
      },
    };
  }

  function assertSameRetryIdentity(
    messageId: string,
    failedAttempt:
      CommissionEmailProviderSendInput,
    retryAttempt:
      CommissionEmailProviderSendInput,
  ): void {
    equal(
      retryAttempt.trackingMessageId,
      messageId,
    );

    equal(
      failedAttempt.trackingMessageId,
      messageId,
    );

    equal(
      retryAttempt.idempotencyKey,
      failedAttempt.idempotencyKey,
    );

    equal(
      retryAttempt.idempotencyKey,
      getCommissionEmailIdempotencyKey(
        messageId,
      ),
    );

    equal(
      retryAttempt.subject,
      failedAttempt.subject,
    );

    equal(
      retryAttempt.recipientEmail,
      failedAttempt.recipientEmail,
    );

    equal(
      retryAttempt.inReplyToMessageId,
      failedAttempt.inReplyToMessageId,
    );

    equal(
      retryAttempt.referencesHeader,
      failedAttempt.referencesHeader,
    );

    deepEqual(
      retryAttempt.body,
      failedAttempt.body,
    );
  }

  try {
    /*
     * ============================================================
     * INQUIRY CONFIRMATION
     * ============================================================
     */

    const inquiryFixture =
      await createFixture(
        "Inquiry",
      );

    const inquiryFailureAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const inquiryCreation =
      await createAndDeliverClientInquiryConfirmation(
        {
          commissionId:
            inquiryFixture.commissionId,

          emailData: {
            reference:
              inquiryFixture.reference,

            name:
              inquiryFixture.clientName,

            email:
              inquiryFixture.clientEmail,

            message:
              "Temporary Inquiry retry verification request.",

            style:
              "Stylized",

            collection:
              "Character Art",

            category:
              "Character Illustration",

            option:
              "Full Body",
          },
        },

        createFailingProvider(
          inquiryFailureAttempts,
          "Synthetic inquiry failure.",
        ),
      );

    equal(
      inquiryCreation.delivery.outcome,
      "failed",
    );

    equal(
      inquiryFailureAttempts.length,
      1,
    );

    const inquiryFailedMessage =
      await getCommissionEmailMessageById(
        inquiryCreation.messageId,
      );

    ok(
      inquiryFailedMessage,
    );

    equal(
      inquiryFailedMessage.kind,
      "inquiry_confirmation",
    );

    equal(
      inquiryFailedMessage.deliveryStatus,
      "failed",
    );

    equal(
      inquiryFailedMessage.attemptCount,
      1,
    );

    const inquiryRetryAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const inquiryRetry =
      await retryCommissionEmailMessage(
        {
          commissionId:
            inquiryFixture.commissionId,

          messageId:
            inquiryCreation.messageId,
        },

        createSuccessfulProvider(
          inquiryRetryAttempts,
          "retry-inquiry",
        ),
      );

    equal(
      inquiryRetry.outcome,
      "sent",
    );

    equal(
      inquiryRetryAttempts.length,
      1,
    );

    const firstInquiryAttempt =
      inquiryFailureAttempts[0];

    const secondInquiryAttempt =
      inquiryRetryAttempts[0];

    ok(
      firstInquiryAttempt,
    );

    ok(
      secondInquiryAttempt,
    );

    assertSameRetryIdentity(
      inquiryCreation.messageId,
      firstInquiryAttempt,
      secondInquiryAttempt,
    );

    equal(
      secondInquiryAttempt.inReplyToMessageId,
      null,
    );

    equal(
      secondInquiryAttempt.referencesHeader,
      null,
    );

    const inquiryAfterRetry =
      await getCommissionEmailMessageById(
        inquiryCreation.messageId,
      );

    ok(
      inquiryAfterRetry,
    );

    equal(
      inquiryAfterRetry.deliveryStatus,
      "sent",
    );

    equal(
      inquiryAfterRetry.attemptCount,
      2,
    );

    const inquiryThreadAfterRetry =
      await getCommissionEmailThreadById(
        inquiryCreation.threadId,
      );

    ok(
      inquiryThreadAfterRetry,
    );

    equal(
      inquiryThreadAfterRetry.rootMessageId,
      inquiryRetry.outcome ===
        "sent"
        ? inquiryRetry.providerMessageId
        : null,
    );

    console.log(
      "[OK] Failed inquiry confirmation retries the same logical root message and establishes the thread root",
    );

    /*
     * ============================================================
     * GENERAL MESSAGE
     * ============================================================
     */

    const generalFixture =
      await createRootedFixture(
        "General",
      );

    const generalText =
      "This is a temporary generic message that should fail once and retry safely.";

    const generalFailureAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const generalFailure =
      await sendCommissionClientMessage(
        {
          commissionId:
            generalFixture.commissionId,

          messageText:
            generalText,

          createdByAdminUserId:
            "retry-verifier",
        },

        createFailingProvider(
          generalFailureAttempts,
          "Synthetic general message failure.",
        ),
      );

    equal(
      generalFailure.outcome,
      "delivery_failed",
    );

    if (
      generalFailure.outcome !==
      "delivery_failed"
    ) {
      throw new Error(
        "General message fixture did not produce delivery_failed.",
      );
    }

    const foreignFixture =
      await createRootedFixture(
        "Foreign",
      );

    let foreignProviderCalls =
      0;

    const foreignRetry =
      await retryCommissionEmailMessage(
        {
          commissionId:
            foreignFixture.commissionId,

          messageId:
            generalFailure.messageId,
        },

        {
          async send() {
            foreignProviderCalls +=
              1;

            return {
              outcome:
                "sent",

              providerEmailId:
                "should-not-send",

              providerMessageId:
                "<should-not-send@example.test>",
            };
          },
        },
      );

    equal(
      foreignRetry.outcome,
      "not_found",
    );

    equal(
      foreignProviderCalls,
      0,
    );

    console.log(
      "[OK] Retry cannot use a message ID belonging to another commission",
    );

    const generalRetryAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const generalRetry =
      await retryCommissionEmailMessage(
        {
          commissionId:
            generalFixture.commissionId,

          messageId:
            generalFailure.messageId,
        },

        createSuccessfulProvider(
          generalRetryAttempts,
          "retry-general",
        ),
      );

    equal(
      generalRetry.outcome,
      "sent",
    );

    equal(
      generalFailureAttempts.length,
      1,
    );

    equal(
      generalRetryAttempts.length,
      1,
    );

    const generalFailedAttempt =
      generalFailureAttempts[0];

    const generalRetriedAttempt =
      generalRetryAttempts[0];

    ok(
      generalFailedAttempt,
    );

    ok(
      generalRetriedAttempt,
    );

    assertSameRetryIdentity(
      generalFailure.messageId,
      generalFailedAttempt,
      generalRetriedAttempt,
    );

    equal(
      generalRetriedAttempt.inReplyToMessageId,
      generalFixture.rootMessageId,
    );

    equal(
      generalRetriedAttempt.referencesHeader,
      generalFixture.rootMessageId,
    );

    const generalAfterRetry =
      await getCommissionEmailMessageById(
        generalFailure.messageId,
      );

    ok(
      generalAfterRetry,
    );

    equal(
      generalAfterRetry.deliveryStatus,
      "sent",
    );

    equal(
      generalAfterRetry.attemptCount,
      2,
    );

    equal(
      generalAfterRetry.messageText,
      generalText,
    );

    console.log(
      "[OK] Generic client message retry reuses message ID, body, thread root, and idempotency key",
    );

    let duplicateGeneralCalls =
      0;

    const duplicateGeneralRetry =
      await retryCommissionEmailMessage(
        {
          commissionId:
            generalFixture.commissionId,

          messageId:
            generalFailure.messageId,
        },

        {
          async send() {
            duplicateGeneralCalls +=
              1;

            return {
              outcome:
                "sent",

              providerEmailId:
                "duplicate",

              providerMessageId:
                "<duplicate@example.test>",
            };
          },
        },
      );

    equal(
      duplicateGeneralRetry.outcome,
      "not_retryable",
    );

    if (
      duplicateGeneralRetry.outcome ===
      "not_retryable"
    ) {
      equal(
        duplicateGeneralRetry.currentStatus,
        "sent",
      );
    }

    equal(
      duplicateGeneralCalls,
      0,
    );

    console.log(
      "[OK] A successfully retried message cannot be retried again",
    );

    /*
     * ============================================================
     * CLIENT DETAILS REQUEST
     * ============================================================
     */

    const detailsFixture =
      await createRootedFixture(
        "Details",
      );

    const detailsReview =
      await transitionCommissionStatus({
        commissionId:
          detailsFixture.commissionId,

        fromStatus:
          "received",

        toStatus:
          "under_review",

        initiatedBy:
          "artist",

        changedByAdminUserId:
          "retry-verifier",
      });

    equal(
      detailsReview.outcome,
      "updated",
    );

    const detailsText =
      "Please confirm the final canvas dimensions and character outfit.";

    const detailsFailureAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const detailsFailure =
      await requestCommissionClientDetails(
        {
          commissionId:
            detailsFixture.commissionId,

          messageText:
            detailsText,

          requestedByAdminUserId:
            "retry-verifier",
        },

        createFailingProvider(
          detailsFailureAttempts,
          "Synthetic client details failure.",
        ),
      );

    equal(
      detailsFailure.outcome,
      "delivery_failed",
    );

    if (
      detailsFailure.outcome !==
      "delivery_failed"
    ) {
      throw new Error(
        "Client details fixture did not produce delivery_failed.",
      );
    }

    const detailsCommissionBeforeRetry =
      await getCommissionById(
        detailsFixture.commissionId,
      );

    ok(
      detailsCommissionBeforeRetry,
    );

    equal(
      detailsCommissionBeforeRetry.status,
      "awaiting_client_details",
    );

    const detailsRetryAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const detailsRetry =
      await retryCommissionEmailMessage(
        {
          commissionId:
            detailsFixture.commissionId,

          messageId:
            detailsFailure.messageId,
        },

        createSuccessfulProvider(
          detailsRetryAttempts,
          "retry-details",
        ),
      );

    equal(
      detailsRetry.outcome,
      "sent",
    );

    const detailsFailedAttempt =
      detailsFailureAttempts[0];

    const detailsRetriedAttempt =
      detailsRetryAttempts[0];

    ok(
      detailsFailedAttempt,
    );

    ok(
      detailsRetriedAttempt,
    );

    assertSameRetryIdentity(
      detailsFailure.messageId,
      detailsFailedAttempt,
      detailsRetriedAttempt,
    );

    equal(
      detailsRetriedAttempt.inReplyToMessageId,
      detailsFixture.rootMessageId,
    );

    equal(
      detailsRetriedAttempt.referencesHeader,
      detailsFixture.rootMessageId,
    );

    const detailsCommissionAfterRetry =
      await getCommissionById(
        detailsFixture.commissionId,
      );

    ok(
      detailsCommissionAfterRetry,
    );

    equal(
      detailsCommissionAfterRetry.status,
      "awaiting_client_details",
    );

    const detailsMessageAfterRetry =
      await getCommissionEmailMessageById(
        detailsFailure.messageId,
      );

    ok(
      detailsMessageAfterRetry,
    );

    equal(
      detailsMessageAfterRetry.deliveryStatus,
      "sent",
    );

    equal(
      detailsMessageAfterRetry.attemptCount,
      2,
    );

    equal(
      detailsMessageAfterRetry.messageText,
      detailsText,
    );

    console.log(
      "[OK] Client details retry reconstructs the original email without repeating workflow transitions",
    );

    /*
     * ============================================================
     * QUOTE READY
     * ============================================================
     */

    const quoteFixture =
      await createRootedFixture(
        "Quote",
      );

    const quoteReview =
      await transitionCommissionStatus({
        commissionId:
          quoteFixture.commissionId,

        fromStatus:
          "received",

        toStatus:
          "under_review",

        initiatedBy:
          "artist",

        changedByAdminUserId:
          "retry-verifier",
      });

    equal(
      quoteReview.outcome,
      "updated",
    );

    const quoteQuoting =
      await transitionCommissionStatus({
        commissionId:
          quoteFixture.commissionId,

        fromStatus:
          "under_review",

        toStatus:
          "quoting",

        initiatedBy:
          "artist",

        changedByAdminUserId:
          "retry-verifier",
      });

    equal(
      quoteQuoting.outcome,
      "updated",
    );

    const quoteDraft =
      await createCommissionQuoteDraft({
        commissionId:
          quoteFixture.commissionId,

        currency:
          "USD",

        description:
          "Retry verification quote",

        notes:
          "Temporary retry verification.",

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
              "Retry verification item",

            quantity:
              1,

            unitAmount:
              "325",
          },
        ],

        createdByAdminUserId:
          "retry-verifier",
      });

    equal(
      quoteDraft.outcome,
      "created",
    );

    if (
      quoteDraft.outcome !==
      "created"
    ) {
      throw new Error(
        "Quote retry fixture could not create its draft.",
      );
    }

    const quoteFailureAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const quoteFailure =
      await sendCommissionQuoteToClient(
        {
          quoteId:
            quoteDraft.quote.id,

          expectedUpdatedAt:
            quoteDraft.quote.updatedAt,

          sentByAdminUserId:
            "retry-verifier",
        },

        createFailingProvider(
          quoteFailureAttempts,
          "Synthetic quote retry failure.",
        ),
      );

    equal(
      quoteFailure.outcome,
      "delivery_failed",
    );

    if (
      quoteFailure.outcome !==
      "delivery_failed"
    ) {
      throw new Error(
        "Quote fixture did not produce delivery_failed.",
      );
    }

    const storedFailedQuote =
      await getCommissionQuoteById(
        quoteDraft.quote.id,
      );

    ok(
      storedFailedQuote,
    );

    equal(
      storedFailedQuote.quote.status,
      "sent",
    );

    const quoteCommissionBeforeRetry =
      await getCommissionById(
        quoteFixture.commissionId,
      );

    ok(
      quoteCommissionBeforeRetry,
    );

    equal(
      quoteCommissionBeforeRetry.status,
      "awaiting_quote_response",
    );

    const quoteRetryAttempts:
      CommissionEmailProviderSendInput[] =
      [];

    const quoteRetry =
      await retryCommissionEmailMessage(
        {
          commissionId:
            quoteFixture.commissionId,

          messageId:
            quoteFailure.messageId,
        },

        createSuccessfulProvider(
          quoteRetryAttempts,
          "retry-quote",
        ),
      );

    equal(
      quoteRetry.outcome,
      "sent",
    );

    const quoteFailedAttempt =
      quoteFailureAttempts[0];

    const quoteRetriedAttempt =
      quoteRetryAttempts[0];

    ok(
      quoteFailedAttempt,
    );

    ok(
      quoteRetriedAttempt,
    );

    assertSameRetryIdentity(
      quoteFailure.messageId,
      quoteFailedAttempt,
      quoteRetriedAttempt,
    );

    equal(
      quoteRetriedAttempt.inReplyToMessageId,
      quoteFixture.rootMessageId,
    );

    equal(
      quoteRetriedAttempt.referencesHeader,
      quoteFixture.rootMessageId,
    );

    const quoteMessageAfterRetry =
      await getCommissionEmailMessageById(
        quoteFailure.messageId,
      );

    ok(
      quoteMessageAfterRetry,
    );

    equal(
      quoteMessageAfterRetry.deliveryStatus,
      "sent",
    );

    equal(
      quoteMessageAfterRetry.attemptCount,
      2,
    );

    const quoteCommissionAfterRetry =
      await getCommissionById(
        quoteFixture.commissionId,
      );

    ok(
      quoteCommissionAfterRetry,
    );

    equal(
      quoteCommissionAfterRetry.status,
      "awaiting_quote_response",
    );

    const quoteAfterRetry =
      await getCommissionQuoteById(
        quoteDraft.quote.id,
      );

    ok(
      quoteAfterRetry,
    );

    equal(
      quoteAfterRetry.quote.status,
      "sent",
    );

    console.log(
      "[OK] Quote email retry regenerates the deterministic quote link and does not repeat quote workflow transitions",
    );

    /*
     * ============================================================
     * UNSUPPORTED FUTURE EMAIL KIND
     * ============================================================
     */

    const unsupportedFixture =
      await createRootedFixture(
        "Unsupported",
      );

    const unsupportedMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          unsupportedFixture.commissionId,

        threadId:
          unsupportedFixture.threadId,

        quoteId:
          null,

        scope:
          "client_thread",

        kind:
          "payment_request",

        actor:
          "artist",

        senderEmail:
          process.env.SENDER_EMAIL?.trim() ||
          "contact@fefierys.com",

        recipientEmail:
          unsupportedFixture.clientEmail,

        replyToEmail:
          process.env.OWNER_EMAIL?.trim() ||
          "artist@example.com",

        subject:
          unsupportedFixture.subject,

        messageText:
          "Temporary unsupported retry email.",

        createdByAdminUserId:
          "retry-verifier",
      });

    const unsupportedFailure =
      await deliverCommissionEmailMessage(
        {
          messageId:
            unsupportedMessage.id,

          body: {
            text:
              "Temporary unsupported retry email.",
          },
        },

        createFailingProvider(
          [],
          "Synthetic unsupported email failure.",
        ),
      );

    equal(
      unsupportedFailure.outcome,
      "failed",
    );

    let unsupportedRetryProviderCalls =
      0;

    const unsupportedRetry =
      await retryCommissionEmailMessage(
        {
          commissionId:
            unsupportedFixture.commissionId,

          messageId:
            unsupportedMessage.id,
        },

        {
          async send() {
            unsupportedRetryProviderCalls +=
              1;

            return {
              outcome:
                "sent",

              providerEmailId:
                "unsupported-should-not-send",

              providerMessageId:
                "<unsupported-should-not-send@example.test>",
            };
          },
        },
      );

    equal(
      unsupportedRetry.outcome,
      "unsupported_kind",
    );

    if (
      unsupportedRetry.outcome ===
      "unsupported_kind"
    ) {
      equal(
        unsupportedRetry.kind,
        "payment_request",
      );
    }

    equal(
      unsupportedRetryProviderCalls,
      0,
    );

    console.log(
      "[OK] Email kinds without a safe body rebuilder are refused instead of guessed",
    );

    console.log(
      "[OK] Commission email retry verification passed",
    );
  } finally {
    if (
      createdCommissionIds.length >
      0
    ) {
      /*
       * Messages may reference quotes and threads, so remove
       * them before either parent table.
       */
      await db
        .delete(
          commissionEmailMessages,
        )
        .where(
          inArray(
            commissionEmailMessages.commissionId,
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
              commissionQuotes.commissionId,
              createdCommissionIds,
            ),
          );

      const quoteIds =
        quoteRows.map(
          (quote) =>
            quote.id,
        );

      if (
        quoteIds.length >
        0
      ) {
        await db
          .delete(
            commissionQuoteItems,
          )
          .where(
            inArray(
              commissionQuoteItems.quoteId,
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
          commissionEmailThreads,
        )
        .where(
          inArray(
            commissionEmailThreads.commissionId,
            createdCommissionIds,
          ),
        );

      await db.batch([
        db
          .delete(
            commissionEvents,
          )
          .where(
            inArray(
              commissionEvents.commissionId,
              createdCommissionIds,
            ),
          ),

        db
          .delete(
            commissionStatusHistory,
          )
          .where(
            inArray(
              commissionStatusHistory.commissionId,
              createdCommissionIds,
            ),
          ),

        db
          .delete(
            commissions,
          )
          .where(
            inArray(
              commissions.id,
              createdCommissionIds,
            ),
          ),
      ]);

      const remaining =
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
              createdCommissionIds,
            ),
          );

      equal(
        remaining.length,
        0,
      );

      console.log(
        "[OK] Temporary email retry verification data was removed",
      );
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "Commission email retry verification failed:",
      error,
    );

    process.exitCode = 1;
  },
);