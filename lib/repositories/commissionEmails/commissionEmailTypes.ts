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

export interface CreateCommissionEmailThreadInput {
  commissionId: string;
  subject: string;
}

export interface CreateCommissionEmailThreadResult {
  created: boolean;
  thread: CommissionEmailThread;
}
