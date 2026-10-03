import {
  buildClientInquiryConfirmationEmail,
  type ContactEmailData,
} from "./contactEmail";
import {
  deliverCommissionEmailMessage,
  type DeliverCommissionEmailMessageResult,
} from "./commissionEmailDeliveryService";
import {
  ownerEmail,
  senderEmail,
} from "./emailClient";
import type {
  CommissionEmailProvider,
} from "./commissionEmailProvider";
import {
  createCommissionEmailThreadIfMissing,
  createQueuedCommissionEmailMessage,
} from "../repositories/commissionEmailRepository";

export interface CreateAndDeliverClientInquiryConfirmationInput {
  commissionId: string;
  emailData: ContactEmailData;
}

export interface CreateAndDeliverClientInquiryConfirmationResult {
  threadId: string;
  messageId: string;
  delivery: DeliverCommissionEmailMessageResult;
}

export async function createAndDeliverClientInquiryConfirmation(
  input: CreateAndDeliverClientInquiryConfirmationInput,
  provider?: CommissionEmailProvider,
): Promise<CreateAndDeliverClientInquiryConfirmationResult> {
  const content =
    buildClientInquiryConfirmationEmail(
      input.emailData,
    );

  const threadResult =
    await createCommissionEmailThreadIfMissing({
      commissionId:
        input.commissionId,
      subject:
        content.subject,
    });

  const queuedMessage =
    await createQueuedCommissionEmailMessage({
      commissionId:
        input.commissionId,
      threadId:
        threadResult.thread.id,
      quoteId: null,
      scope: "client_thread",
      kind: "inquiry_confirmation",
      actor: "system",
      senderEmail,
      recipientEmail:
        input.emailData.email,
      replyToEmail:
        ownerEmail,
      subject:
        content.subject,
      messageText:
        content.text,
      inReplyToMessageId: null,
      referencesHeader: null,
      createdByAdminUserId: null,
    });

  const delivery = provider
    ? await deliverCommissionEmailMessage(
        {
          messageId:
            queuedMessage.id,
          body: {
            text:
              content.text,
            html:
              content.html,
          },
        },
        provider,
      )
    : await deliverCommissionEmailMessage({
        messageId:
          queuedMessage.id,
        body: {
          text:
            content.text,
          html:
            content.html,
        },
      });

  return {
    threadId:
      threadResult.thread.id,
    messageId:
      queuedMessage.id,
    delivery,
  };
}
