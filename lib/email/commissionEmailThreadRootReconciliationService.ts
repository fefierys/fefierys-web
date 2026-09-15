import {
  getCommissionEmailThreadById,
  setCommissionEmailThreadRootMessageId,
} from "../repositories/commissionEmailRepository";
import {
  resendCommissionEmailMessageLookupProvider,
  type CommissionEmailMessageLookupProvider,
} from "./commissionEmailProvider";

export type ReconcileCommissionEmailThreadRootResult =
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_ready";
      threadId: string;
    }
  | {
      outcome: "already_complete";
      threadId: string;
      providerEmailId: string;
      providerMessageId: string;
    }
  | {
      outcome: "pending";
      threadId: string;
      providerEmailId: string;
    }
  | {
      outcome: "provider_failed";
      threadId: string;
      providerEmailId: string;
      failureMessage: string;
    }
  | {
      outcome: "completed";
      threadId: string;
      providerEmailId: string;
      providerMessageId: string;
    };

function normalizeThreadId(
  threadId: string,
): string {
  const normalized =
    threadId.trim();

  if (!normalized) {
    throw new Error(
      "threadId is required.",
    );
  }

  return normalized;
}

export async function reconcileCommissionEmailThreadRoot(
  threadId: string,
  lookupProvider:
    CommissionEmailMessageLookupProvider =
      resendCommissionEmailMessageLookupProvider,
): Promise<ReconcileCommissionEmailThreadRootResult> {
  const normalizedThreadId =
    normalizeThreadId(threadId);

  const thread =
    await getCommissionEmailThreadById(
      normalizedThreadId,
    );

  if (!thread) {
    return {
      outcome: "not_found",
    };
  }

  if (
    thread.rootProviderEmailId &&
    thread.rootMessageId
  ) {
    return {
      outcome: "already_complete",
      threadId: thread.id,
      providerEmailId:
        thread.rootProviderEmailId,
      providerMessageId:
        thread.rootMessageId,
    };
  }

  if (!thread.rootProviderEmailId) {
    /*
     * Nothing has been accepted by the provider yet, so there is no provider
     * record from which an RFC Message-ID could be recovered.
     */
    return {
      outcome: "not_ready",
      threadId: thread.id,
    };
  }

  const providerEmailId =
    thread.rootProviderEmailId;

  const lookupResult =
    await lookupProvider.lookupMessageId(
      providerEmailId,
    );

  if (
    lookupResult.outcome ===
    "failed"
  ) {
    return {
      outcome: "provider_failed",
      threadId: thread.id,
      providerEmailId,
      failureMessage:
        lookupResult.failureMessage,
    };
  }

  if (
    lookupResult.outcome ===
    "pending"
  ) {
    return {
      outcome: "pending",
      threadId: thread.id,
      providerEmailId,
    };
  }

  const rootResult =
    await setCommissionEmailThreadRootMessageId({
      threadId: thread.id,
      providerEmailId,
      rootMessageId:
        lookupResult.providerMessageId,
    });

  if (
    rootResult.outcome ===
    "not_found"
  ) {
    return {
      outcome: "not_found",
    };
  }

  if (
    rootResult.outcome ===
    "conflict"
  ) {
    /*
     * The RFC Message-ID of one provider email is immutable. Receiving a
     * different value for an already completed root indicates an integrity
     * problem and must not be silently reconciled.
     */
    throw new Error(
      "Commission email thread root reconciliation detected a conflicting RFC Message-ID.",
    );
  }

  return {
    outcome: "completed",
    threadId:
      rootResult.thread.id,
    providerEmailId:
      rootResult.thread
        .rootProviderEmailId!,
    providerMessageId:
      rootResult.thread
        .rootMessageId!,
  };
}
