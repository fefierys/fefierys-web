import {
  generatePublicAgreementToken,
  hashPublicAgreementToken,
} from "../commissions/commissionAgreementAccessToken";

import {
  generatePublicQuoteToken,
  hashPublicQuoteToken,
} from "../commissions/commissionQuoteAccessToken";

import {
  getCommissionEmailMessageById,
} from "../repositories/commissionEmailRepository";

import type {
  CommissionEmailMessage,
} from "../repositories/commissionEmails/commissionEmailTypes";

import {
  getCommissionById,
  type Commission,
} from "../repositories/commissionRepository";

import {
  getActiveCommissionAgreement,
} from "../repositories/commissionAgreements/commissionAgreementDataRepository";

import {
  getCommissionQuoteById,
} from "../repositories/commissionQuoteRepository";

import {
  buildCommissionAgreementEmail,
} from "./commissionAgreementEmail";

import {
  buildCommissionClientDetailsRequestEmail,
} from "./commissionClientDetailsRequestEmail";

import {
  buildCommissionClientMessageEmail,
} from "./commissionClientMessageEmail";

import {
  deliverCommissionEmailMessage,
} from "./commissionEmailDeliveryService";

import type {
  CommissionEmailBody,
  CommissionEmailProvider,
} from "./commissionEmailProvider";

import {
  buildCommissionQuoteEmail,
} from "./commissionQuoteEmail";

import {
  buildClientInquiryConfirmationEmail,
} from "./contactEmail";

export interface RetryCommissionEmailMessageInput {
  commissionId: string;
  messageId: string;
}

export type RetryCommissionEmailMessageResult =
  | {
      outcome: "sent";
      messageId: string;
      providerEmailId: string;
      providerMessageId:
        | string
        | null;
    }
  | {
      outcome:
        "delivery_failed";
      messageId: string;
      failureMessage: string;
    }
  | {
      outcome:
        "delivery_pending";
      messageId: string;
      currentStatus:
        CommissionEmailMessage["deliveryStatus"];
    }
  | {
      outcome:
        "not_found";
    }
  | {
      outcome:
        "not_retryable";
      currentStatus:
        CommissionEmailMessage["deliveryStatus"];
    }
  | {
      outcome:
        "unsupported_kind";
      kind:
        CommissionEmailMessage["kind"];
    }
  | {
      outcome:
        "retry_unavailable";
      message: string;
    };

type RetryBodyResult =
  | {
      outcome: "ready";
      body: CommissionEmailBody;
    }
  | {
      outcome:
        "unsupported_kind";
      kind:
        CommissionEmailMessage["kind"];
    }
  | {
      outcome:
        "retry_unavailable";
      message: string;
    };

function normalizeRequiredId(
  value: string,
  fieldName: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

function normalizeInquiryValue(
  value: string | null,
): string {
  const normalized =
    value?.trim();

  return (
    normalized ||
    "Not specified"
  );
}

function getRequiredMessageText(
  message: CommissionEmailMessage,
): string | null {
  const value =
    message.messageText?.trim();

  return value || null;
}

function buildInquiryRetryBody(
  commission: Commission,
): CommissionEmailBody {
  const content =
    buildClientInquiryConfirmationEmail({
      reference:
        commission.reference,

      name:
        commission.clientName,

      email:
        commission.clientEmail,

      message:
        commission.initialMessage,

      style:
        normalizeInquiryValue(
          commission.styleSnapshot,
        ),

      collection:
        normalizeInquiryValue(
          commission.collectionSnapshot,
        ),

      category:
        normalizeInquiryValue(
          commission.categorySnapshot,
        ),

      option:
        normalizeInquiryValue(
          commission.optionSnapshot,
        ),
    });

  return {
    text:
      content.text,

    html:
      content.html,
  };
}

function buildClientDetailsRetryBody(
  message: CommissionEmailMessage,
  commission: Commission,
): RetryBodyResult {
  const messageText =
    getRequiredMessageText(
      message,
    );

  if (!messageText) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "The original client details request does not contain enough persisted content to rebuild the email safely.",
    };
  }

  return {
    outcome: "ready",

    body:
      buildCommissionClientDetailsRequestEmail({
        clientName:
          commission.clientName,

        message:
          messageText,

        reference:
          commission.reference,
      }),
  };
}

function buildGeneralMessageRetryBody(
  message: CommissionEmailMessage,
  commission: Commission,
): RetryBodyResult {
  const messageText =
    getRequiredMessageText(
      message,
    );

  if (!messageText) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "The original client message does not contain enough persisted content to rebuild the email safely.",
    };
  }

  return {
    outcome: "ready",

    body:
      buildCommissionClientMessageEmail({
        clientName:
          commission.clientName,

        message:
          messageText,

        reference:
          commission.reference,
      }),
  };
}

async function buildQuoteRetryBody(
  message: CommissionEmailMessage,
  commission: Commission,
): Promise<RetryBodyResult> {
  if (!message.quoteId) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "The failed quote email is not linked to a quote and cannot be regenerated safely.",
    };
  }

  const storedQuote =
    await getCommissionQuoteById(
      message.quoteId,
    );

  if (
    !storedQuote ||
    storedQuote.quote.commissionId !==
      commission.id
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "The quote linked to this failed email could not be found.",
    };
  }

  /*
   * Retrying delivery must not revive a quote that
   * has since been accepted, declined, expired, or
   * superseded.
   */
  if (
    storedQuote.quote.status !==
    "sent"
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "This quote is no longer awaiting a client response, so its email cannot be retried.",
    };
  }

  if (
    !storedQuote.quote.validUntil
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "The quote does not have a validity date and its email cannot be regenerated safely.",
    };
  }

  const publicToken =
    generatePublicQuoteToken(
      storedQuote.quote.id,
    );

  const expectedTokenHash =
    hashPublicQuoteToken(
      publicToken,
    );

  /*
   * Older random-token quote links cannot be reconstructed
   * from quoteId. Refuse the retry rather than generating
   * a different client URL under the same logical message.
   */
  if (
    !storedQuote.quote.publicTokenHash ||
    storedQuote.quote.publicTokenHash !==
      expectedTokenHash
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "This quote uses a historical access token that cannot be regenerated safely. Create a revised quote instead.",
    };
  }

  const content =
    buildCommissionQuoteEmail({
      clientName:
        commission.clientName,

      currency:
        storedQuote.quote.currency,

      publicToken,

      reference:
        commission.reference,

      totalAmount:
        storedQuote.quote.totalAmount,

      validUntil:
        storedQuote.quote.validUntil,

      version:
        storedQuote.quote.version,
    });

  return {
    outcome: "ready",

    body: {
      text:
        content.text,

      html:
        content.html,
    },
  };
}

async function buildAgreementRetryBody(
  message: CommissionEmailMessage,
  commission: Commission,
): Promise<RetryBodyResult> {
  /*
   * agreement_ready is linked to the accepted Quote used by
   * the Agreement.
   *
   * This relationship lets us verify that the failed logical
   * message still belongs to the exact active Agreement.
   */
  if (!message.quoteId) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "The failed Agreement email is not linked to its Quote and cannot be regenerated safely.",
    };
  }

  /*
   * getActiveCommissionAgreement intentionally returns only
   * draft / sent Agreements.
   *
   * Therefore an Agreement that has already been accepted,
   * superseded or voided cannot accidentally have its original
   * review email revived by Retry.
   */
  const agreement =
    await getActiveCommissionAgreement(
      commission.id,
    );

  if (!agreement) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "This Agreement is no longer awaiting client acceptance, so its email cannot be retried.",
    };
  }

  if (
    agreement.commissionId !==
      commission.id ||
    agreement.quoteId !==
      message.quoteId
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "The Agreement linked to this failed email could not be matched safely.",
    };
  }

  /*
   * A draft Agreement has never been presented and therefore
   * must never receive an agreement_ready retry.
   */
  if (
    agreement.status !==
    "sent"
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "This Agreement is not currently awaiting client acceptance, so its email cannot be retried.",
    };
  }

  /*
   * The commission itself must still be in the workflow state
   * associated with Agreement review.
   *
   * Do not send stale review links after cancellation, payment
   * progression, acceptance, or while the project is on hold.
   */
  if (
    commission.status !==
      "awaiting_agreement" ||
    commission.isOnHold
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "This commission is no longer available for Agreement review, so the email cannot be retried.",
    };
  }

  if (
    !agreement.publicTokenHash ||
    !agreement.publicTokenCreatedAt ||
    agreement.publicTokenRevokedAt
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "The Agreement does not have an active public access token and its email cannot be regenerated safely.",
    };
  }

  /*
   * Agreement public tokens are deterministic.
   *
   * Reconstruct the same bearer that was used at presentation
   * time, then prove it hashes to the value already persisted.
   *
   * Never persist or log the plaintext token.
   */
  const publicToken =
    generatePublicAgreementToken(
      agreement.id,
    );

  const expectedTokenHash =
    hashPublicAgreementToken(
      publicToken,
    );

  if (
    agreement.publicTokenHash !==
    expectedTokenHash
  ) {
    return {
      outcome:
        "retry_unavailable",

      message:
        "This Agreement uses a public access token that cannot be regenerated safely.",
    };
  }

  /*
   * Reuse the exact same builder used by the original Present
   * operation.
   *
   * This produces the same Agreement URL and the same email
   * content from persisted business data.
   */
  const body =
    buildCommissionAgreementEmail({
      clientName:
        commission.clientName,

      publicToken,

      reference:
        commission.reference,

      revision:
        agreement.version,

      termsVersion:
        agreement.termsVersion,
    });

  return {
    outcome:
      "ready",

    body,
  };
}

async function buildRetryBody(
  message: CommissionEmailMessage,
  commission: Commission,
): Promise<RetryBodyResult> {
  switch (
    message.kind
  ) {
    case "inquiry_confirmation":
      return {
        outcome: "ready",

        body:
          buildInquiryRetryBody(
            commission,
          ),
      };

    case "client_details_request":
      return buildClientDetailsRetryBody(
        message,
        commission,
      );

    case "general_message":
      return buildGeneralMessageRetryBody(
        message,
        commission,
      );

    case "quote_ready":
      return buildQuoteRetryBody(
        message,
        commission,
      );

    case "agreement_ready":
      return buildAgreementRetryBody(
        message,
        commission,
      );

    default:
      return {
        outcome:
          "unsupported_kind",

        kind:
          message.kind,
      };
  }
}

export async function retryCommissionEmailMessage(
  input: RetryCommissionEmailMessageInput,
  provider?: CommissionEmailProvider,
): Promise<RetryCommissionEmailMessageResult> {
  const commissionId =
    normalizeRequiredId(
      input.commissionId,
      "commissionId",
    );

  const messageId =
    normalizeRequiredId(
      input.messageId,
      "messageId",
    );

  const [
    message,
    commission,
  ] =
    await Promise.all([
      getCommissionEmailMessageById(
        messageId,
      ),

      getCommissionById(
        commissionId,
      ),
    ]);

  /*
   * Treat cross-commission message IDs exactly like missing
   * messages. An Admin action must never be able to retry
   * another commission's email by changing a hidden field.
   */
  if (
    !message ||
    !commission ||
    message.commissionId !==
      commission.id
  ) {
    return {
      outcome:
        "not_found",
    };
  }

  if (
    message.scope !==
      "client_thread" ||
    message.direction !==
      "outbound"
  ) {
    return {
      outcome:
        "unsupported_kind",

      kind:
        message.kind,
    };
  }

  if (
    message.deliveryStatus !==
    "failed"
  ) {
    return {
      outcome:
        "not_retryable",

      currentStatus:
        message.deliveryStatus,
    };
  }

  const bodyResult =
    await buildRetryBody(
      message,
      commission,
    );

  if (
    bodyResult.outcome !==
    "ready"
  ) {
    return bodyResult;
  }

  /*
   * The original logical message ID is intentionally reused.
   * deliverCommissionEmailMessage therefore also reuses the
   * original provider idempotency key and thread identity.
   */
  const delivery =
    provider
      ? await deliverCommissionEmailMessage(
          {
            messageId:
              message.id,

            body:
              bodyResult.body,
          },
          provider,
        )
      : await deliverCommissionEmailMessage({
          messageId:
            message.id,

          body:
            bodyResult.body,
        });

  switch (
    delivery.outcome
  ) {
    case "sent":
      return {
        outcome:
          "sent",

        messageId:
          delivery.messageId,

        providerEmailId:
          delivery.providerEmailId,

        providerMessageId:
          delivery.providerMessageId,
      };

    case "failed":
      return {
        outcome:
          "delivery_failed",

        messageId:
          delivery.messageId,

        failureMessage:
          delivery.failureMessage,
      };

    case "not_claimed":
      return {
        outcome:
          "delivery_pending",

        messageId:
          delivery.messageId,

        currentStatus:
          delivery.currentStatus,
      };

    case "not_found":
      return {
        outcome:
          "not_found",
      };
  }
}