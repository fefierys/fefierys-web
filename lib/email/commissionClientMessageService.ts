import {
  createCommissionClientMessage,
  type CreateCommissionClientMessageResult,
} from "../repositories/commissionClientMessageRepository";
import {
  buildCommissionClientMessageEmail,
} from "./commissionClientMessageEmail";
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

export interface SendCommissionClientMessageInput {
  commissionId: string;
  messageText: string;
  createdByAdminUserId: string;
}

type ClientMessageCreationFailure =
  Exclude<
    CreateCommissionClientMessageResult,
    {
      outcome: "created";
    }
  >;

export type SendCommissionClientMessageResult =
  | ClientMessageCreationFailure
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
        | "queued"
        | "sending"
        | "sent"
        | "failed";
    };

export async function sendCommissionClientMessage(
  input: SendCommissionClientMessageInput,
  provider?: CommissionEmailProvider,
): Promise<SendCommissionClientMessageResult> {
  const creation =
    await createCommissionClientMessage({
      commissionId:
        input.commissionId,

      messageText:
        input.messageText,

      createdByAdminUserId:
        input.createdByAdminUserId,

      senderEmail,

      replyToEmail:
        ownerEmail,
    });

  if (
    creation.outcome !==
    "created"
  ) {
    return creation;
  }

  const logicalMessage =
    creation.clientMessage.message;

  const body =
    buildCommissionClientMessageEmail({
      clientName:
        creation.clientMessage.clientName,

      message:
        logicalMessage.messageText ??
        input.messageText.trim(),

      reference:
        creation.clientMessage.reference,
    });

  const delivery =
    provider
      ? await deliverCommissionEmailMessage(
          {
            messageId:
              logicalMessage.id,
            body,
          },
          provider,
        )
      : await deliverCommissionEmailMessage({
          messageId:
            logicalMessage.id,
          body,
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
      throw new Error(
        "Client message created a logical email message that could not be found for delivery.",
      );
  }
}