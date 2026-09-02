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

import {
  isCommissionManualActor,
  type CommissionHoldAction,
} from "@/lib/commissions/commissionActivity";

import {
  addCommissionNote,
  changeCommissionHold,
} from "@/lib/repositories/commissionActivityRepository";

export interface CommissionStatusActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
}

export interface CommissionActivityActionState {
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
        revalidatePath("/admin/commissions/kanban");
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

      case "on_hold":
        revalidatePath("/admin/commissions");
        revalidatePath("/admin/commissions/kanban");
        revalidatePath(`/admin/commissions/${commissionId}`);

        return {
          outcome: "conflict",
          message:
            "This commission is on hold. Resume it before applying a non-terminal status change.",
        };

      case "conflict":
        revalidatePath("/admin/commissions");
        revalidatePath("/admin/commissions/kanban");
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

function revalidateCommissionActivityPaths(commissionId: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/commissions");
  revalidatePath("/admin/commissions/kanban");
  revalidatePath(`/admin/commissions/${commissionId}`);
}

export async function changeCommissionHoldAction(
  _previousState: CommissionActivityActionState,
  formData: FormData,
): Promise<CommissionActivityActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const expectedStatusValue = getFormValue(formData, "expectedStatus");
  const holdActionValue = getFormValue(formData, "holdAction");
  const actorValue = getFormValue(formData, "actor");
  const description = getFormValue(formData, "description");

  if (!UUID_PATTERN.test(commissionId)) {
    return {
      outcome: "error",
      message: "The commission identifier is invalid.",
    };
  }

  if (!isCommissionStatus(expectedStatusValue)) {
    return {
      outcome: "error",
      message: "The current commission status is invalid.",
    };
  }

  if (holdActionValue !== "pause" && holdActionValue !== "resume") {
    return {
      outcome: "error",
      message: "The selected hold action is invalid.",
    };
  }

  if (!isCommissionManualActor(actorValue)) {
    return {
      outcome: "error",
      message: "The selected actor is invalid.",
    };
  }

  try {
    const result = await changeCommissionHold({
      commissionId,
      expectedStatus: expectedStatusValue,
      action: holdActionValue as CommissionHoldAction,
      actor: actorValue,
      description,
      createdByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "updated":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message:
            holdActionValue === "pause"
              ? "Commission paused successfully."
              : "Commission resumed successfully.",
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
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "The commission changed before this action was applied. Refresh the page and try again.",
        };
    }
  } catch (error) {
    console.error("Failed to change commission hold state:", error);

    return {
      outcome: "error",
      message:
        "The commission hold state could not be updated. Please try again.",
    };
  }
}

export async function addCommissionNoteAction(
  _previousState: CommissionActivityActionState,
  formData: FormData,
): Promise<CommissionActivityActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const actorValue = getFormValue(formData, "actor");
  const description = getFormValue(formData, "description");

  if (!UUID_PATTERN.test(commissionId)) {
    return {
      outcome: "error",
      message: "The commission identifier is invalid.",
    };
  }

  if (!isCommissionManualActor(actorValue)) {
    return {
      outcome: "error",
      message: "The selected actor is invalid.",
    };
  }

  try {
    const result = await addCommissionNote({
      commissionId,
      actor: actorValue,
      description,
      createdByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "added":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Commission note added successfully.",
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
    }
  } catch (error) {
    console.error("Failed to add commission note:", error);

    return {
      outcome: "error",
      message: "The commission note could not be added. Please try again.",
    };
  }
}
