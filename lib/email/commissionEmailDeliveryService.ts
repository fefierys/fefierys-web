import {
  claimCommissionEmailMessageForSending,
  getCommissionEmailMessageById,
  markCommissionEmailMessageFailed,
  markCommissionEmailMessageSent,
} from "../repositories/commissionEmailRepository";
import {
  resendCommissionEmailProvider,
  type CommissionEmailBody,
  type CommissionEmailProvider,
} from "./commissionEmailProvider";

export interface DeliverCommissionEmailMessageInput {
  messageId: string;
  body: CommissionEmailBody;
}

export type DeliverCommissionEmailMessageResult =
  | {
      outcome: "sent";
      messageId: string;
      providerEmailId: string;
      providerMessageId: string | null;
    }
  | {
      outcome: "failed";
      messageId: string;
      failureMessage: string;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_claimed";
      messageId: string;
      currentStatus:
        | "queued"
        | "sending"
        | "sent"
        | "failed";
    };

export function getCommissionEmailIdempotencyKey(
  messageId: string,
): string {
  const normalizedMessageId =
    messageId.trim();

  if (!normalizedMessageId) {
    throw new Error(
      "messageId is required.",
    );
  }

  return `commission-email/${normalizedMessageId}`;
}

function validateBody(
  body: CommissionEmailBody,
): void {
  const hasHtml =
    typeof body.html === "string" &&
    body.html.length > 0;

  const hasText =
    typeof body.text === "string" &&
    body.text.length > 0;

  if (!hasHtml && !hasText) {
    throw new Error(
      "A non-empty HTML or text email body is required.",
    );
  }
}

export async function deliverCommissionEmailMessage(
  input: DeliverCommissionEmailMessageInput,
  provider: CommissionEmailProvider =
    resendCommissionEmailProvider,
): Promise<DeliverCommissionEmailMessageResult> {
  validateBody(input.body);

  const claimedMessage =
    await claimCommissionEmailMessageForSending(
      input.messageId,
    );

  if (!claimedMessage) {
    const currentMessage =
      await getCommissionEmailMessageById(
        input.messageId,
      );

    if (!currentMessage) {
      return {
        outcome: "not_found",
      };
    }

    return {
      outcome: "not_claimed",
      messageId: currentMessage.id,
      currentStatus:
        currentMessage.deliveryStatus,
    };
  }

  let providerResult;

  try {
    providerResult =
      await provider.send({
        idempotencyKey:
          getCommissionEmailIdempotencyKey(
            claimedMessage.id,
          ),
        senderEmail:
          claimedMessage.senderEmail,
        recipientEmail:
          claimedMessage.recipientEmail,
        replyToEmail:
          claimedMessage.replyToEmail,
        subject:
          claimedMessage.subject,
        body: input.body,
        inReplyToMessageId:
          claimedMessage.inReplyToMessageId,
        referencesHeader:
          claimedMessage.referencesHeader,
      });
  } catch {
    providerResult = {
      outcome: "failed" as const,
      failureMessage:
        "Email provider request failed unexpectedly.",
    };
  }

  if (providerResult.outcome === "failed") {
    const failedMessage =
      await markCommissionEmailMessageFailed(
        claimedMessage.id,
        providerResult.failureMessage,
      );

    if (!failedMessage) {
      throw new Error(
        "Commission email delivery failed but the message could not transition from sending to failed.",
      );
    }

    return {
      outcome: "failed",
      messageId: failedMessage.id,
      failureMessage:
        providerResult.failureMessage,
    };
  }

  const sentMessage =
    await markCommissionEmailMessageSent({
      messageId:
        claimedMessage.id,
      providerEmailId:
        providerResult.providerEmailId,
      providerMessageId:
        providerResult.providerMessageId,
    });

  if (!sentMessage) {
    throw new Error(
      "Commission email provider accepted the message but the database record could not transition from sending to sent.",
    );
  }

  return {
    outcome: "sent",
    messageId: sentMessage.id,
    providerEmailId:
      providerResult.providerEmailId,
    providerMessageId:
      providerResult.providerMessageId,
  };
}
