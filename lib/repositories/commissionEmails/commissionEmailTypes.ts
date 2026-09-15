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