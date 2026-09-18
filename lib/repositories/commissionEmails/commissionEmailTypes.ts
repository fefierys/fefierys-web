import {
  commissionEmailMessages,
  commissionEmailThreads,
} from "../../db/schema/commissions";

export type CommissionEmailThread =
  typeof commissionEmailThreads.$inferSelect;

export type NewCommissionEmailThread =
  typeof commissionEmailThreads.$inferInsert;

export type CommissionEmailMessage =
  typeof commissionEmailMessages.$inferSelect;

export type NewCommissionEmailMessage =
  typeof commissionEmailMessages.$inferInsert;

export type CommissionEmailScope =
  CommissionEmailMessage["scope"];

export type CommissionEmailKind =
  CommissionEmailMessage["kind"];

export type CommissionEmailActor =
  CommissionEmailMessage["actor"];

export type CommissionEmailDeliveryStatus =
  CommissionEmailMessage["deliveryStatus"];

export interface CreateCommissionEmailThreadInput {
  commissionId: string;
  subject: string;
}

export interface CreateCommissionEmailThreadResult {
  created: boolean;
  thread: CommissionEmailThread;
}

export interface SetCommissionEmailThreadRootProviderInput {
  threadId: string;
  providerEmailId: string;
}

export type SetCommissionEmailThreadRootProviderResult =
  | {
      outcome: "set";
      thread: CommissionEmailThread;
    }
  | {
      outcome: "already_set";
      thread: CommissionEmailThread;
    }
  | {
      outcome: "conflict";
      thread: CommissionEmailThread;
    }
  | {
      outcome: "not_found";
    };

export interface SetCommissionEmailThreadRootMessageIdInput {
  threadId: string;
  providerEmailId: string;
  rootMessageId: string;
}

export type SetCommissionEmailThreadRootMessageIdResult =
  | {
      outcome: "set";
      thread: CommissionEmailThread;
    }
  | {
      outcome: "already_set";
      thread: CommissionEmailThread;
    }
  | {
      outcome: "conflict";
      thread: CommissionEmailThread;
    }
  | {
      outcome: "not_found";
    };

export interface CreateQueuedCommissionEmailMessageInput {
  commissionId: string;
  threadId: string | null;
  quoteId?: string | null;
  scope: CommissionEmailScope;
  kind: CommissionEmailKind;
  actor: CommissionEmailActor;
  senderEmail: string;
  recipientEmail: string;
  replyToEmail?: string | null;
  subject: string;
  messageText?: string | null;
  inReplyToMessageId?: string | null;
  referencesHeader?: string | null;
  createdByAdminUserId?: string | null;
}

export interface MarkCommissionEmailMessageSentInput {
  messageId: string;
  providerEmailId: string;
  providerMessageId?: string | null;
}


export interface ReconcileCommissionEmailMessageSentFromProviderInput {
  messageId: string;
  providerEmailId: string;
  providerMessageId: string;
  sentAt: Date;
}

export type ReconcileCommissionEmailMessageSentFromProviderResult =
  | {
      outcome: "reconciled";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "already_reconciled";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "conflict";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "invalid_state";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "not_found";
    };

export interface CreateReceivedCommissionEmailMessageInput {
  commissionId: string;
  threadId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  messageText: string;
  providerEmailId: string;
  providerMessageId: string;
  inReplyToMessageId?: string | null;
  referencesHeader?: string | null;
  receivedAt: Date;
}

export type CreateReceivedCommissionEmailMessageResult =
  | {
      outcome: "created";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "already_received";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "thread_not_found";
    }
  | {
      outcome: "thread_mismatch";
      thread: CommissionEmailThread;
    }
  | {
      outcome: "conflict";
      messages: CommissionEmailMessage[];
    };