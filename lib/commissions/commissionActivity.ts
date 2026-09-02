import {
  isTerminalCommissionStatus,
  type CommissionActor,
} from "@/lib/commissions/commissionWorkflow";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

export const COMMISSION_MANUAL_ACTORS = [
  "client",
  "artist",
] as const satisfies readonly CommissionActor[];

export type CommissionManualActor = (typeof COMMISSION_MANUAL_ACTORS)[number];

export type CommissionHoldAction = "pause" | "resume";

export const MAX_COMMISSION_ACTIVITY_TEXT_LENGTH = 5000;

export type CommissionActivityValidation =
  | {
      valid: true;
      description: string | null;
    }
  | {
      valid: false;
      code:
        | "commission_closed"
        | "already_on_hold"
        | "not_on_hold"
        | "description_required"
        | "description_too_long";
      message: string;
    };

export function isCommissionManualActor(
  value: string,
): value is CommissionManualActor {
  return (COMMISSION_MANUAL_ACTORS as readonly string[]).includes(value);
}

export function validateCommissionHoldAction(input: {
  action: CommissionHoldAction;
  status: CommissionStatus;
  isOnHold: boolean;
  description?: string | null;
}): CommissionActivityValidation {
  const description = input.description?.trim() || null;

  if (isTerminalCommissionStatus(input.status)) {
    return {
      valid: false,
      code: "commission_closed",
      message: "Closed commissions cannot be paused or resumed.",
    };
  }

  if (input.action === "pause" && input.isOnHold) {
    return {
      valid: false,
      code: "already_on_hold",
      message: "This commission is already on hold.",
    };
  }

  if (input.action === "resume" && !input.isOnHold) {
    return {
      valid: false,
      code: "not_on_hold",
      message: "This commission is not currently on hold.",
    };
  }

  if (input.action === "pause" && !description) {
    return {
      valid: false,
      code: "description_required",
      message: "A reason is required to pause the commission.",
    };
  }

  if (description && description.length > MAX_COMMISSION_ACTIVITY_TEXT_LENGTH) {
    return {
      valid: false,
      code: "description_too_long",
      message: `The description cannot exceed ${MAX_COMMISSION_ACTIVITY_TEXT_LENGTH} characters.`,
    };
  }

  return {
    valid: true,
    description,
  };
}

export function validateCommissionNote(
  description: string,
): CommissionActivityValidation {
  const normalizedDescription = description.trim();

  if (!normalizedDescription) {
    return {
      valid: false,
      code: "description_required",
      message: "The note cannot be empty.",
    };
  }

  if (normalizedDescription.length > MAX_COMMISSION_ACTIVITY_TEXT_LENGTH) {
    return {
      valid: false,
      code: "description_too_long",
      message: `The note cannot exceed ${MAX_COMMISSION_ACTIVITY_TEXT_LENGTH} characters.`,
    };
  }

  return {
    valid: true,
    description: normalizedDescription,
  };
}
