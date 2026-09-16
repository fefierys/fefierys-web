import {
  createCommissionClientDetailsRequest,
  type CreateCommissionClientDetailsRequestResult,
} from "../repositories/commissionClientDetailsRequestRepository";
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
import {
  buildCommissionClientDetailsRequestEmail,
} from "./commissionClientDetailsRequestEmail";

export interface RequestCommissionClientDetailsInput {
  commissionId: string;
  messageText: string;
  requestedByAdminUserId: string;
}

type RequestCreationFailure = Exclude<
  CreateCommissionClientDetailsRequestResult,
  { outcome: "created" }
>;

export type RequestCommissionClientDetailsResult =
  | RequestCreationFailure
  | {
      outcome: "sent";
      messageId: string;
      providerEmailId: string;
      providerMessageId: string | null;
    }
  | {
      outcome: "delivery_failed";
      messageId: string;
      failureMessage: string;
    }
  | {
      outcome: "delivery_pending";
      messageId: string;
      currentStatus: "queued" | "sending" | "sent" | "failed";
    };

export async function requestCommissionClientDetails(
  input: RequestCommissionClientDetailsInput,
  provider?: CommissionEmailProvider,
): Promise<RequestCommissionClientDetailsResult> {
  const creation = await createCommissionClientDetailsRequest({
    commissionId: input.commissionId,
    messageText: input.messageText,
    requestedByAdminUserId: input.requestedByAdminUserId,
    senderEmail,
    replyToEmail: ownerEmail,
  });

  if (creation.outcome !== "created") {
    return creation;
  }

  const body = buildCommissionClientDetailsRequestEmail({
    clientName: creation.request.clientName,
    message: creation.request.message.messageText ?? input.messageText.trim(),
    reference: creation.request.reference,
  });

  const delivery = provider
    ? await deliverCommissionEmailMessage(
        {
          messageId: creation.request.message.id,
          body,
        },
        provider,
      )
    : await deliverCommissionEmailMessage({
        messageId: creation.request.message.id,
        body,
      });

  switch (delivery.outcome) {
    case "sent":
      return {
        outcome: "sent",
        messageId: delivery.messageId,
        providerEmailId: delivery.providerEmailId,
        providerMessageId: delivery.providerMessageId,
      };

    case "failed":
      return {
        outcome: "delivery_failed",
        messageId: delivery.messageId,
        failureMessage: delivery.failureMessage,
      };

    case "not_claimed":
      return {
        outcome: "delivery_pending",
        messageId: delivery.messageId,
        currentStatus: delivery.currentStatus,
      };

    case "not_found":
      throw new Error(
        "Client details request created a logical email message that could not be found for delivery.",
      );
  }
}
