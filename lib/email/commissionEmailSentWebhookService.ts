import {
  getCommissionEmailThreadById,
  reconcileCommissionEmailMessageSentFromProvider,
  setCommissionEmailThreadRootMessageId,
  setCommissionEmailThreadRootProvider,
} from "../repositories/commissionEmailRepository";
import type {
  CommissionEmailMessage,
} from "../repositories/commissionEmails/commissionEmailTypes";

export interface ProcessCommissionEmailSentEventInput {
  messageId: string;
  providerEmailId: string;
  providerMessageId: string;
  sentAt: Date;
}

export type ProcessCommissionEmailSentEventResult =
  | {
      outcome: "processed";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "already_processed";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "conflict";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "invalid_state";
      message: CommissionEmailMessage;
    };

async function completeClientThreadRootFromSentEvent(
  message: CommissionEmailMessage,
  providerEmailId: string,
  providerMessageId: string,
): Promise<void> {
  if (
    message.scope !== "client_thread" ||
    !message.threadId
  ) {
    return;
  }

  const thread =
    await getCommissionEmailThreadById(
      message.threadId,
    );

  if (!thread) {
    throw new Error(
      "Sent client email references a missing commission email thread.",
    );
  }

  if (thread.rootMessageId !== null) {
    if (
      thread.rootProviderEmailId ===
        providerEmailId &&
      thread.rootMessageId !==
        providerMessageId
    ) {
      throw new Error(
        "Commission email thread root provider has a conflicting RFC Message-ID.",
      );
    }

    /*
     * A different provider ID with a completed root simply belongs to a
     * later message in the same client conversation.
     */
    return;
  }

  let rootProviderEmailId =
    thread.rootProviderEmailId;

  if (rootProviderEmailId === null) {
    /*
     * FIFO delivery guarantees that, while no RFC root exists, only the
     * first outbound client message can have reached the provider.
     */
    const providerRootResult =
      await setCommissionEmailThreadRootProvider({
        threadId:
          message.threadId,
        providerEmailId,
      });

    if (
      providerRootResult.outcome ===
      "not_found"
    ) {
      throw new Error(
        "Commission email thread disappeared while establishing its webhook root provider identity.",
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
    throw new Error(
      "Commission email thread has an incomplete root owned by a different provider email.",
    );
  }

  const messageRootResult =
    await setCommissionEmailThreadRootMessageId({
      threadId:
        message.threadId,
      providerEmailId,
      rootMessageId:
        providerMessageId,
    });

  if (
    messageRootResult.outcome ===
    "not_found"
  ) {
    throw new Error(
      "Commission email thread disappeared while completing its webhook RFC root identity.",
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

export async function processCommissionEmailSentEvent(
  input: ProcessCommissionEmailSentEventInput,
): Promise<ProcessCommissionEmailSentEventResult> {
  const reconciliation =
    await reconcileCommissionEmailMessageSentFromProvider(
      input,
    );

  if (
    reconciliation.outcome ===
    "not_found"
  ) {
    return {
      outcome: "not_found",
    };
  }

  if (
    reconciliation.outcome ===
    "conflict"
  ) {
    return {
      outcome: "conflict",
      message:
        reconciliation.message,
    };
  }

  if (
    reconciliation.outcome ===
    "invalid_state"
  ) {
    return {
      outcome: "invalid_state",
      message:
        reconciliation.message,
    };
  }

  await completeClientThreadRootFromSentEvent(
    reconciliation.message,
    input.providerEmailId,
    input.providerMessageId,
  );

  return {
    outcome:
      reconciliation.outcome ===
      "already_reconciled"
        ? "already_processed"
        : "processed",
    message:
      reconciliation.message,
  };
}
