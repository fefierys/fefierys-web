import {
  generatePublicQuoteToken,
} from "../commissions/commissionQuoteAccessToken";
import {
  sendCommissionQuote,
} from "../repositories/commissionQuotes/commissionQuoteSendRepository";
import type {
  SendCommissionQuoteResult,
} from "../repositories/commissionQuotes/commissionQuoteTypes";
import {
  buildCommissionQuoteEmail,
} from "./commissionQuoteEmail";
import {
  deliverCommissionEmailMessage,
} from "./commissionEmailDeliveryService";
import type {
  CommissionEmailProvider,
} from "./commissionEmailProvider";
import {
  ownerEmail,
  senderEmail,
} from "./emailClient";

export interface SendCommissionQuoteToClientInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  sentByAdminUserId: string;
}

type QuoteSendFailure =
  Exclude<
    SendCommissionQuoteResult,
    {
      outcome: "sent";
    }
  >;

export type SendCommissionQuoteToClientResult =
  | QuoteSendFailure
  | {
      outcome: "sent";
      commissionId: string;
      messageId: string;
      providerEmailId: string;
      providerMessageId: string | null;
    }
  | {
      outcome: "delivery_failed";
      commissionId: string;
      messageId: string;
      failureMessage: string;
    }
  | {
      outcome: "delivery_pending";
      commissionId: string;
      messageId: string;
      currentStatus:
        | "queued"
        | "sending"
        | "sent"
        | "failed";
    };

export async function sendCommissionQuoteToClient(
  input: SendCommissionQuoteToClientInput,
  provider?: CommissionEmailProvider,
): Promise<SendCommissionQuoteToClientResult> {
  const creation =
    await sendCommissionQuote({
      quoteId:
        input.quoteId,

      expectedUpdatedAt:
        input.expectedUpdatedAt,

      sentByAdminUserId:
        input.sentByAdminUserId,

      senderEmail,

      replyToEmail:
        ownerEmail,
    });

  if (
    creation.outcome !==
    "sent"
  ) {
    return creation;
  }

  const validUntil =
    creation.quote.validUntil;

  if (!validUntil) {
    /*
     * A quote cannot transition from draft to sent without a
     * valid future expiration date. Reaching this branch after
     * a successful repository result would indicate corrupted
     * or inconsistent persisted state.
     */
    throw new Error(
      "Sent commission quote is missing its expiration date.",
    );
  }

  /*
   * The public quote bearer token is reconstructed only in
   * memory for email rendering.
   *
   * generatePublicQuoteToken() is deterministic for the same
   * quote ID and secret, so retries reproduce the same secure
   * URL without storing the plaintext token.
   */
  const publicToken =
    generatePublicQuoteToken(
      creation.quote.id,
    );

  const content =
    buildCommissionQuoteEmail({
      clientName:
        creation.clientName,

      currency:
        creation.quote.currency,

      publicToken,

      reference:
        creation.reference,

      totalAmount:
        creation.quote.totalAmount,

      validUntil,

      version:
        creation.quote.version,
    });

  /*
   * Subject, sender, recipient and threading headers come from
   * the persisted logical message. Only the rendered body is
   * supplied here.
   */
  const body = {
    text:
      content.text,

    html:
      content.html,
  };

  const delivery =
    provider
      ? await deliverCommissionEmailMessage(
          {
            messageId:
              creation.messageId,

            body,
          },
          provider,
        )
      : await deliverCommissionEmailMessage({
          messageId:
            creation.messageId,

          body,
        });

  switch (delivery.outcome) {
    case "sent":
      return {
        outcome: "sent",

        commissionId:
          creation.quote.commissionId,

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

        commissionId:
          creation.quote.commissionId,

        messageId:
          delivery.messageId,

        failureMessage:
          delivery.failureMessage,
      };

    case "not_claimed":
      return {
        outcome:
          "delivery_pending",

        commissionId:
          creation.quote.commissionId,

        messageId:
          delivery.messageId,

        currentStatus:
          delivery.currentStatus,
      };

    case "not_found":
      throw new Error(
        "Quote send created a logical email message that could not be found for delivery.",
      );
  }
}