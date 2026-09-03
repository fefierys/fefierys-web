import type {
  CommissionQuoteDraftInput,
  CommissionQuoteDraftValidation,
  CommissionQuoteTransitionValidation,
} from "../../commissions/commissionQuote";
import type { CommissionManualActor } from "../../commissions/commissionActivity";
import type { CommissionTransitionValidation } from "../../commissions/commissionWorkflow";
import type {
  commissionEvents,
  commissionQuoteItems,
  commissionQuotes,
  commissionStatusHistory,
} from "../../db/schema/commissions";
import type { CommissionStatus } from "../commissionAdminRepository";

export type CommissionQuote = typeof commissionQuotes.$inferSelect;

export type CommissionQuoteItem = typeof commissionQuoteItems.$inferSelect;

export type CommissionQuoteEvent = typeof commissionEvents.$inferSelect;

export interface CommissionQuoteWithItems {
  quote: CommissionQuote;
  items: CommissionQuoteItem[];
}

type InvalidQuoteDraftValidation = Extract<
  CommissionQuoteDraftValidation,
  { valid: false }
>;

type InvalidQuoteTransitionValidation = Extract<
  CommissionQuoteTransitionValidation,
  { valid: false }
>;

type InvalidCommissionTransitionValidation = Extract<
  CommissionTransitionValidation,
  { valid: false }
>;

export type CommissionStatusHistoryEntry =
  typeof commissionStatusHistory.$inferSelect;

export interface CreateCommissionQuoteDraftInput extends CommissionQuoteDraftInput {
  commissionId: string;
  createdByAdminUserId: string;
}

export type CreateCommissionQuoteDraftResult =
  | {
      outcome: "created";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidQuoteDraftValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "wrong_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "active_quote_exists";
      activeQuote: Pick<CommissionQuote, "id" | "version" | "status">;
    }
  | {
      outcome: "conflict";
    };

export interface UpdateCommissionQuoteDraftInput extends CommissionQuoteDraftInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  updatedByAdminUserId: string;
}

export type UpdateCommissionQuoteDraftResult =
  | {
      outcome: "updated";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidQuoteDraftValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_draft";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface SendCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  sentByAdminUserId: string;
}

export type SendCommissionQuoteResult =
  | {
      outcome: "sent";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      transition: CommissionStatusHistoryEntry;
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidQuoteTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_draft";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface AcceptCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  acceptedByAdminUserId: string;
}

export type AcceptCommissionQuoteResult =
  | {
      outcome: "accepted";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      transition: CommissionStatusHistoryEntry;
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidQuoteTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface DeclineCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  declinedByAdminUserId: string;
  closeReasonNote?: string | null;
}

export type DeclineCommissionQuoteResult =
  | {
      outcome: "declined";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      transition: CommissionStatusHistoryEntry;
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation:
        | InvalidQuoteTransitionValidation
        | InvalidCommissionTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface ExpireCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  recordedByAdminUserId?: string | null;
  note?: string | null;
}

export type ExpireCommissionQuoteResult =
  | {
      outcome: "expired";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      transition: CommissionStatusHistoryEntry;
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation:
        | InvalidQuoteTransitionValidation
        | InvalidCommissionTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface SupersedeCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  initiatedBy: CommissionManualActor;
  supersededByAdminUserId: string;
  note?: string | null;
}

export type SupersedeCommissionQuoteResult =
  | {
      outcome: "superseded";
      supersededQuote: CommissionQuote;
      draft: CommissionQuoteWithItems;
      transition: CommissionStatusHistoryEntry;
      supersededEvent: CommissionQuoteEvent;
      createdEvent: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation:
        | InvalidQuoteTransitionValidation
        | InvalidCommissionTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };
