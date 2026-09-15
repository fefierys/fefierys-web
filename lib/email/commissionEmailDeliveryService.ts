import {
  claimCommissionEmailMessageForSending,
  getCommissionEmailMessageById,
  getCommissionEmailThreadById,
  markCommissionEmailMessageFailed,
  markCommissionEmailMessageSent,
  setCommissionEmailThreadRootMessageId,
  setCommissionEmailThreadRootProvider,
} from "../repositories/commissionEmailRepository";
import type {
  CommissionEmailMessage,
} from "../repositories/commissionEmails/commissionEmailTypes";
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

async function persistClientThreadRootAfterSend(
  sentMessage: CommissionEmailMessage,
  providerEmailId: string,
  providerMessageId: string | null,
): Promise<void> {
  if (
    sentMessage.scope !== "client_thread" ||
    !sentMessage.threadId
  ) {
    return;
  }

  const thread =
    await getCommissionEmailThreadById(
      sentMessage.threadId,
    );

  if (!thread) {
    throw new Error(
      "Sent client email references a missing commission email thread.",
    );
  }

  /*
   * A completed root belongs to the first sent message forever. Later
   * messages must never attempt to replace it with their provider IDs.
   */
  if (thread.rootMessageId !== null) {
    return;
  }

  let rootProviderEmailId =
    thread.rootProviderEmailId;

  if (rootProviderEmailId === null) {
    const providerRootResult =
      await setCommissionEmailThreadRootProvider({
        threadId: sentMessage.threadId,
        providerEmailId,
      });

    if (
      providerRootResult.outcome ===
      "not_found"
    ) {
      throw new Error(
        "Commission email thread disappeared while establishing its root provider identity.",
      );
    }

    if (
      providerRootResult.outcome ===
      "conflict"
    ) {
      throw new Error(
        "Commission email thread already has a different root provider identity.",
      );
    }

    rootProviderEmailId =
      providerRootResult.thread
        .rootProviderEmailId;
  }

  if (
    rootProviderEmailId !==
    providerEmailId
  ) {
    /*
     * With FIFO claiming, a thread whose RFC root is still incomplete can
     * only retry its original first message. A different provider ID here
     * therefore indicates an integrity problem rather than a normal later
     * message.
     */
    throw new Error(
      "Commission email thread root provider does not match the sent root message.",
    );
  }

  if (!providerMessageId) {
    /*
     * Provider identity is still useful even if the RFC Message-ID is not yet
     * available. Later client messages remain queued until reconciliation
     * completes rootMessageId.
     */
    return;
  }

  const messageRootResult =
    await setCommissionEmailThreadRootMessageId({
      threadId: sentMessage.threadId,
      providerEmailId:
        rootProviderEmailId,
      rootMessageId:
        providerMessageId,
    });

  if (
    messageRootResult.outcome ===
    "not_found"
  ) {
    throw new Error(
      "Commission email thread disappeared while completing its RFC root identity.",
    );
  }

  if (
    messageRootResult.outcome ===
    "conflict"
  ) {
    throw new Error(
      "Commission email thread already has a different RFC root Message-ID.",
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

  if (
    providerResult.outcome ===
    "failed"
  ) {
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

  /*
   * Record the delivery truth first. If root bookkeeping later fails, the
   * database still correctly says that the provider accepted this message.
   */
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

  await persistClientThreadRootAfterSend(
    sentMessage,
    providerResult.providerEmailId,
    providerResult.providerMessageId,
  );

  return {
    outcome: "sent",
    messageId: sentMessage.id,
    providerEmailId:
      providerResult.providerEmailId,
    providerMessageId:
      providerResult.providerMessageId,
  };
}
