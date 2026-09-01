"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import {
  isCommissionActor,
  isCommissionCloseReason,
  type CommissionCloseReason,
} from "@/lib/commissions/commissionWorkflow";
import { isCommissionStatus } from "@/lib/commissions/commissionStatus";
import { transitionCommissionStatus } from "@/lib/repositories/commissionWorkflowRepository";

export interface CommissionStatusActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_NOTE_LENGTH = 5000;

function getFormValue(formData: FormData, name: string): string {
  return formData.get(name)?.toString().trim() ?? "";
}

export async function updateCommissionStatusAction(
  _previousState: CommissionStatusActionState,
  formData: FormData,
): Promise<CommissionStatusActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const fromStatusValue = getFormValue(formData, "fromStatus");
  const toStatusValue = getFormValue(formData, "toStatus");
  const initiatedByValue = getFormValue(formData, "initiatedBy");
  const closeReasonValue = getFormValue(formData, "closeReason");
  const note = getFormValue(formData, "note");

  if (!UUID_PATTERN.test(commissionId)) {
    return {
      outcome: "error",
      message: "The commission identifier is invalid.",
    };
  }

  if (
    !isCommissionStatus(fromStatusValue) ||
    !isCommissionStatus(toStatusValue)
  ) {
    return {
      outcome: "error",
      message: "The selected status is invalid.",
    };
  }

  if (!isCommissionActor(initiatedByValue)) {
    return {
      outcome: "error",
      message: "The selected actor is invalid.",
    };
  }

  let closeReason: CommissionCloseReason | null = null;

  if (closeReasonValue) {
    if (!isCommissionCloseReason(closeReasonValue)) {
      return {
        outcome: "error",
        message: "The selected close reason is invalid.",
      };
    }

    closeReason = closeReasonValue;
  }

  if (note.length > MAX_NOTE_LENGTH) {
    return {
      outcome: "error",
      message: `The note cannot exceed ${MAX_NOTE_LENGTH} characters.`,
    };
  }

  try {
    const result = await transitionCommissionStatus({
      commissionId,
      fromStatus: fromStatusValue,
      toStatus: toStatusValue,
      initiatedBy: initiatedByValue,
      changedByAdminUserId: session.user.id,
      closeReason,
      closeReasonNote: closeReason ? note || null : null,
      reason: closeReason ? null : "admin_status_update",
      note: closeReason ? null : note || null,
    });

    switch (result.outcome) {
      case "updated":
        revalidatePath("/admin");
        revalidatePath("/admin/commissions");
        revalidatePath(`/admin/commissions/${commissionId}`);

        return {
          outcome: "success",
          message: "Commission status updated successfully.",
        };

      case "invalid":
        return {
          outcome: "error",
          message: result.validation.message,
        };

      case "not_found":
        return {
          outcome: "error",
          message: "The commission no longer exists.",
        };

      case "conflict":
        revalidatePath(`/admin/commissions/${commissionId}`);

        return {
          outcome: "conflict",
          message:
            "The commission changed before this update was applied. Refresh the page and try again.",
        };
    }
  } catch (error) {
    console.error("Failed to update commission status:", error);

    return {
      outcome: "error",
      message: "The commission status could not be updated. Please try again.",
    };
  }
}
