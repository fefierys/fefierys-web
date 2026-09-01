import type {
  commissionActorEnum,
  commissionCloseReasonEnum,
} from "@/lib/db/schema/commissions";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

export type CommissionActor = (typeof commissionActorEnum.enumValues)[number];

export type CommissionCloseReason =
  (typeof commissionCloseReasonEnum.enumValues)[number];

export const COMMISSION_ACTORS = [
  "client",
  "artist",
  "system",
] as const satisfies readonly CommissionActor[];

export const COMMISSION_CLOSE_REASONS = [
  "client_cancelled",
  "artist_cancelled",
  "mutual_cancellation",
  "artist_declined_request",
  "client_declined_quote",
  "quote_expired",
  "client_details_timeout",
  "payment_timeout",
  "other",
] as const satisfies readonly CommissionCloseReason[];

export function isCommissionActor(value: string): value is CommissionActor {
  return (COMMISSION_ACTORS as readonly string[]).includes(value);
}

export function isCommissionCloseReason(
  value: string,
): value is CommissionCloseReason {
  return (COMMISSION_CLOSE_REASONS as readonly string[]).includes(value);
}

export const TERMINAL_COMMISSION_STATUSES = [
  "completed",
  "cancelled",
  "declined",
  "expired",
] as const satisfies readonly CommissionStatus[];

export const COMMISSION_STATUS_TRANSITIONS = {
  received: ["under_review", "declined", "cancelled"],

  under_review: ["awaiting_client_details", "quoting", "declined", "cancelled"],

  awaiting_client_details: ["under_review", "expired", "declined", "cancelled"],

  quoting: ["awaiting_quote_response", "declined", "cancelled"],

  awaiting_quote_response: [
    "quoting",
    "awaiting_payment",
    "declined",
    "expired",
    "cancelled",
  ],

  awaiting_payment: ["in_progress", "final_review", "expired", "cancelled"],

  in_progress: ["sketch_review", "final_preview", "cancelled"],

  sketch_review: [
    "sketch_revision",
    "in_progress",
    "awaiting_payment",
    "cancelled",
  ],

  sketch_revision: ["sketch_review", "cancelled"],

  final_preview: [
    "final_revision",
    "awaiting_payment",
    "final_review",
    "cancelled",
  ],

  final_review: ["final_revision", "completed", "cancelled"],

  final_revision: ["final_preview", "final_review", "cancelled"],

  completed: [],
  cancelled: [],
  declined: [],
  expired: [],
} as const satisfies Record<CommissionStatus, readonly CommissionStatus[]>;

export const CLOSE_REASONS_BY_STATUS = {
  completed: [],
  cancelled: [
    "client_cancelled",
    "artist_cancelled",
    "mutual_cancellation",
    "other",
  ],
  declined: ["artist_declined_request", "client_declined_quote", "other"],
  expired: [
    "quote_expired",
    "client_details_timeout",
    "payment_timeout",
    "other",
  ],
} as const satisfies Record<
  (typeof TERMINAL_COMMISSION_STATUSES)[number],
  readonly CommissionCloseReason[]
>;

const ACTOR_BY_CLOSE_REASON = {
  client_cancelled: ["client"],
  artist_cancelled: ["artist"],
  mutual_cancellation: ["client", "artist"],
  artist_declined_request: ["artist"],
  client_declined_quote: ["client"],
  quote_expired: ["system"],
  client_details_timeout: ["system"],
  payment_timeout: ["system"],
  other: ["client", "artist", "system"],
} as const satisfies Record<CommissionCloseReason, readonly CommissionActor[]>;

const EXPIRATION_REASON_BY_SOURCE: Partial<
  Record<CommissionStatus, CommissionCloseReason>
> = {
  awaiting_client_details: "client_details_timeout",
  awaiting_quote_response: "quote_expired",
  awaiting_payment: "payment_timeout",
};

export interface CommissionTransitionInput {
  fromStatus: CommissionStatus;
  toStatus: CommissionStatus;
  initiatedBy: CommissionActor;
  closeReason?: CommissionCloseReason | null;
  closeReasonNote?: string | null;
}

export type CommissionTransitionErrorCode =
  | "same_status"
  | "transition_not_allowed"
  | "close_reason_required"
  | "close_reason_not_allowed"
  | "close_reason_forbidden"
  | "close_reason_note_required"
  | "actor_not_allowed";

export type CommissionTransitionValidation =
  | { valid: true }
  | {
      valid: false;
      code: CommissionTransitionErrorCode;
      message: string;
    };

export function isTerminalCommissionStatus(
  status: CommissionStatus,
): status is (typeof TERMINAL_COMMISSION_STATUSES)[number] {
  return (TERMINAL_COMMISSION_STATUSES as readonly CommissionStatus[]).includes(
    status,
  );
}

export function getAllowedCommissionTransitions(
  status: CommissionStatus,
): readonly CommissionStatus[] {
  return COMMISSION_STATUS_TRANSITIONS[status];
}

export function getAllowedCommissionCloseReasons(
  fromStatus: CommissionStatus,
  toStatus: CommissionStatus,
): readonly CommissionCloseReason[] {
  if (
    toStatus !== "cancelled" &&
    toStatus !== "declined" &&
    toStatus !== "expired"
  ) {
    return [];
  }

  if (toStatus === "cancelled") {
    return CLOSE_REASONS_BY_STATUS.cancelled;
  }

  if (toStatus === "declined") {
    return fromStatus === "awaiting_quote_response"
      ? CLOSE_REASONS_BY_STATUS.declined
      : ["artist_declined_request", "other"];
  }

  const expectedReason = EXPIRATION_REASON_BY_SOURCE[fromStatus];

  return expectedReason ? [expectedReason, "other"] : [];
}

export function getAllowedCommissionActors(
  closeReason: CommissionCloseReason | null,
): readonly CommissionActor[] {
  return closeReason ? ACTOR_BY_CLOSE_REASON[closeReason] : COMMISSION_ACTORS;
}

export function validateCommissionTransition(
  input: CommissionTransitionInput,
): CommissionTransitionValidation {
  const {
    fromStatus,
    toStatus,
    initiatedBy,
    closeReason = null,
    closeReasonNote = null,
  } = input;

  if (fromStatus === toStatus) {
    return {
      valid: false,
      code: "same_status",
      message: "The commission is already in the requested status.",
    };
  }

  if (!getAllowedCommissionTransitions(fromStatus).includes(toStatus)) {
    return {
      valid: false,
      code: "transition_not_allowed",
      message: `Transition from ${fromStatus} to ${toStatus} is not allowed.`,
    };
  }

  if (toStatus === "completed") {
    if (closeReason !== null) {
      return {
        valid: false,
        code: "close_reason_forbidden",
        message: "Completed commissions cannot have a close reason.",
      };
    }

    return { valid: true };
  }

  if (!isTerminalCommissionStatus(toStatus)) {
    if (closeReason !== null) {
      return {
        valid: false,
        code: "close_reason_forbidden",
        message: "Active commissions cannot have a close reason.",
      };
    }

    return { valid: true };
  }

  if (closeReason === null) {
    return {
      valid: false,
      code: "close_reason_required",
      message: `A close reason is required for status ${toStatus}.`,
    };
  }

  const allowedReasons = getAllowedCommissionCloseReasons(fromStatus, toStatus);

  if (!allowedReasons.includes(closeReason)) {
    return {
      valid: false,
      code: "close_reason_not_allowed",
      message: `Close reason ${closeReason} is not valid for status ${toStatus}.`,
    };
  }

  const allowedActors = ACTOR_BY_CLOSE_REASON[
    closeReason
  ] as readonly CommissionActor[];

  if (!allowedActors.includes(initiatedBy)) {
    return {
      valid: false,
      code: "actor_not_allowed",
      message: `Actor ${initiatedBy} cannot use close reason ${closeReason}.`,
    };
  }

  if (closeReason === "other" && !closeReasonNote?.trim()) {
    return {
      valid: false,
      code: "close_reason_note_required",
      message: "A note is required when the close reason is other.",
    };
  }

  return { valid: true };
}
