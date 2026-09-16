"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { isCommissionServiceClassification } from "@/lib/commissions/commissionClassification";
import {
  isCommissionActor,
  isCommissionCloseReason,
  type CommissionCloseReason,
} from "@/lib/commissions/commissionWorkflow";
import { isCommissionStatus } from "@/lib/commissions/commissionStatus";
import type { CommissionQuoteItemInput } from "@/lib/commissions/commissionQuote";
import type {
  CommissionQuoteCustomItemSelection,
  CommissionQuoteSelectedAdjustment,
} from "@/lib/commissions/commissionQuotePricing";
import { transitionCommissionStatus } from "@/lib/repositories/commissionWorkflowRepository";

import {
  isCommissionManualActor,
  type CommissionHoldAction,
} from "@/lib/commissions/commissionActivity";

import {
  addCommissionNote,
  changeCommissionHold,
} from "@/lib/repositories/commissionActivityRepository";
import {
  acceptCommissionQuote,
  createCommissionQuoteDraft,
  declineCommissionQuote,
  expireCommissionQuote,
  sendCommissionQuote,
  supersedeCommissionQuote,
  updateCommissionQuoteDraft,
} from "@/lib/repositories/commissionQuoteRepository";
import { classifyCommission } from "@/lib/repositories/commissionClassificationRepository";
import {
  resolveCommissionQuotePricingForCreate,
  resolveCommissionQuotePricingForUpdate,
  type CommissionQuotePricingSelection,
  type ResolveCommissionQuotePricingResult,
} from "@/lib/repositories/commissionQuotePricingResolver";

import { requestCommissionClientDetails } from "@/lib/email/commissionClientDetailsRequestService";
import { sendCommissionQuoteEmail } from "@/lib/email/commissionQuoteEmail";
import { getAdminCommissionDetail } from "@/lib/repositories/commissionAdminRepository";

export interface CommissionStatusActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
}

export interface CommissionClientDetailsRequestActionState {
  outcome: "idle" | "success" | "warning" | "error" | "conflict";
  message: string | null;
}

export interface CommissionActivityActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
}

export interface CommissionQuoteActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
}

export interface CommissionClassificationActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_NOTE_LENGTH = 5000;

function getFormValue(formData: FormData, name: string): string {
  return formData.get(name)?.toString().trim() ?? "";
}

function parseRequiredDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOptionalDate(value: string): Date | null | "invalid" {
  if (!value) {
    return null;
  }

  return parseRequiredDate(value) ?? "invalid";
}

function parseCommissionQuoteItems(
  value: string,
): CommissionQuoteItemInput[] | null {
  if (!value || value.length > 100_000) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const items: CommissionQuoteItemInput[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;

      if (
        typeof record.label !== "string" ||
        (record.description !== undefined &&
          record.description !== null &&
          typeof record.description !== "string") ||
        typeof record.quantity !== "number" ||
        typeof record.unitAmount !== "string"
      ) {
        return null;
      }

      items.push({
        label: record.label,
        description:
          typeof record.description === "string" ? record.description : null,
        quantity: record.quantity,
        unitAmount: record.unitAmount,
      });
    }

    return items;
  } catch {
    return null;
  }
}

function parseCommissionQuotePricingSelection(
  value: string,
): CommissionQuotePricingSelection | null | "invalid" {
  if (!value) {
    return null;
  }

  if (value.length > 100_000) {
    return "invalid";
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "invalid";
    }

    const record = parsed as Record<string, unknown>;

    if (record.mode !== "catalog" && record.mode !== "custom") {
      return "invalid";
    }

    const customItems = parseQuoteCustomItems(record.customItems);

    if (!customItems) {
      return "invalid";
    }

    if (record.mode === "custom") {
      return {
        customItems,
        mode: "custom",
      };
    }

    const selectedAdjustments = parseQuoteSelectedAdjustments(
      record.selectedAdjustments,
    );

    return selectedAdjustments
      ? {
          customItems,
          mode: "catalog",
          selectedAdjustments,
        }
      : "invalid";
  } catch {
    return "invalid";
  }
}

function parseQuoteCustomItems(
  value: unknown,
): CommissionQuoteCustomItemSelection[] | null {
  if (!Array.isArray(value) || value.length > 50) {
    return null;
  }

  const items: CommissionQuoteCustomItemSelection[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }

    const record = item as Record<string, unknown>;

    if (
      typeof record.key !== "string" ||
      typeof record.label !== "string" ||
      (record.description !== undefined &&
        record.description !== null &&
        typeof record.description !== "string") ||
      typeof record.quantity !== "number" ||
      typeof record.unitAmount !== "string"
    ) {
      return null;
    }

    items.push({
      description:
        typeof record.description === "string" ? record.description : null,
      key: record.key,
      label: record.label,
      quantity: record.quantity,
      unitAmount: record.unitAmount,
    });
  }

  return items;
}

function parseQuoteSelectedAdjustments(
  value: unknown,
): CommissionQuoteSelectedAdjustment[] | null {
  if (!Array.isArray(value) || value.length > 50) {
    return null;
  }

  const adjustments: CommissionQuoteSelectedAdjustment[] = [];

  for (const adjustment of value) {
    if (
      !adjustment ||
      typeof adjustment !== "object" ||
      Array.isArray(adjustment)
    ) {
      return null;
    }

    const record = adjustment as Record<string, unknown>;

    if (
      typeof record.adjustmentId !== "string" ||
      !UUID_PATTERN.test(record.adjustmentId) ||
      typeof record.quantity !== "number" ||
      (record.internalNote !== undefined &&
        record.internalNote !== null &&
        typeof record.internalNote !== "string") ||
      (record.percentageRate !== undefined &&
        record.percentageRate !== null &&
        typeof record.percentageRate !== "string")
    ) {
      return null;
    }

    adjustments.push({
      adjustmentId: record.adjustmentId,
      internalNote:
        typeof record.internalNote === "string" ? record.internalNote : null,
      percentageRate:
        typeof record.percentageRate === "string"
          ? record.percentageRate
          : null,
      quantity: record.quantity,
    });
  }

  return adjustments;
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

  if (toStatusValue === "awaiting_client_details") {
    return {
      outcome: "error",
      message:
        "Use Request client details to move a commission to Awaiting client details.",
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

export async function requestCommissionClientDetailsAction(
  _previousState: CommissionClientDetailsRequestActionState,
  formData: FormData,
): Promise<CommissionClientDetailsRequestActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const messageText = getFormValue(formData, "messageText");

  if (!UUID_PATTERN.test(commissionId)) {
    return {
      outcome: "error",
      message: "The commission identifier is invalid.",
    };
  }

  if (!messageText || messageText.length > MAX_NOTE_LENGTH) {
    return {
      outcome: "error",
      message: `The request message must contain between 1 and ${MAX_NOTE_LENGTH} characters.`,
    };
  }

  try {
    const result = await requestCommissionClientDetails({
      commissionId,
      messageText,
      requestedByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "sent":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Client details request sent successfully.",
        };

      case "delivery_failed":
        console.error("Client details request email delivery failed:", {
          messageId: result.messageId,
          failureMessage: result.failureMessage,
        });

        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "warning",
          message:
            "The request was saved and the commission moved to Awaiting client details, but the email could not be delivered. The message is preserved for retry.",
        };

      case "delivery_pending":
        revalidateCommissionActivityPaths(commissionId);

        if (result.currentStatus === "sent") {
          return {
            outcome: "success",
            message: "Client details request sent successfully.",
          };
        }

        if (result.currentStatus === "failed") {
          return {
            outcome: "warning",
            message:
              "The request was saved and the commission moved to Awaiting client details, but the email is currently failed and remains available for retry.",
          };
        }

        return {
          outcome: "success",
          message:
            "The client details request was saved and email delivery is being finalized.",
        };

      case "invalid":
        return {
          outcome: "error",
          message: result.validation.message,
        };

      case "invalid_message":
        return {
          outcome: "error",
          message: result.message,
        };

      case "not_found":
        return {
          outcome: "error",
          message: "The commission no longer exists.",
        };

      case "wrong_status":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "This commission is no longer under review. Refresh the page before requesting client details.",
        };

      case "on_hold":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "This commission is on hold. Resume it before requesting client details.",
        };

      case "thread_not_found":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "error",
          message:
            "The client email conversation is unavailable for this commission.",
        };

      case "thread_not_ready":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "The client email conversation is not ready yet. Wait for the inquiry email to finish syncing, then try again.",
        };

      case "thread_blocked":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "An earlier client email is still queued, sending, or failed. Resolve or retry that message before sending another.",
        };

      case "conflict":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "The commission changed before the request was saved. Refresh the page and try again.",
        };
    }
  } catch (error) {
    console.error("Failed to request commission client details:", error);

    return {
      outcome: "error",
      message: "The client details request could not be saved. Please try again.",
    };
  }
}

export async function classifyCommissionAction(
  _previousState: CommissionClassificationActionState,
  formData: FormData,
): Promise<CommissionClassificationActionState> {
  const session = await requireAdmin();
  const commissionId = getFormValue(formData, "commissionId");
  const classification = getFormValue(formData, "classification");
  const pricingServiceId = getFormValue(formData, "pricingServiceId");
  const pricingOptionId = getFormValue(formData, "pricingOptionId");
  const note = getFormValue(formData, "note");
  const expectedUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedUpdatedAt"),
  );

  if (!UUID_PATTERN.test(commissionId)) {
    return {
      outcome: "error",
      message: "The commission identifier is invalid.",
    };
  }

  if (
    !isCommissionServiceClassification(classification) ||
    classification === "unclassified"
  ) {
    return {
      outcome: "error",
      message: "The service classification is invalid.",
    };
  }

  if (!expectedUpdatedAt) {
    return {
      outcome: "error",
      message: "The commission timestamp is invalid.",
    };
  }

  if (
    classification === "catalog" &&
    (!UUID_PATTERN.test(pricingServiceId) ||
      !UUID_PATTERN.test(pricingOptionId))
  ) {
    return {
      outcome: "error",
      message: "Select a valid catalog service and option.",
    };
  }

  try {
    const result = await classifyCommission(
      classification === "catalog"
        ? {
            classification,
            commissionId,
            expectedUpdatedAt,
            note: note || null,
            pricingOptionId,
            pricingServiceId,
            updatedByAdminUserId: session.user.id,
          }
        : {
            classification,
            commissionId,
            expectedUpdatedAt,
            note,
            updatedByAdminUserId: session.user.id,
          },
    );

    switch (result.outcome) {
      case "classified":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "success",
          message:
            classification === "catalog"
              ? "Commission classified from the pricing catalog."
              : "Commission classified as custom.",
        };
      case "invalid":
        return { outcome: "error", message: result.validation.message };
      case "not_found":
        return {
          outcome: "error",
          message: "The commission no longer exists.",
        };
      case "catalog_option_not_found":
        return {
          outcome: "error",
          message: "The selected pricing option is no longer available.",
        };
      case "option_service_mismatch":
        return {
          outcome: "error",
          message: "The selected option does not belong to that service.",
        };
      case "quote_exists":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "conflict",
          message:
            "The service cannot be reclassified after a quote has been created.",
        };
      case "conflict":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "conflict",
          message:
            "The commission changed before the classification was saved. Refresh the page and try again.",
        };
    }
  } catch (error) {
    console.error("Failed to classify commission:", error);
    return {
      outcome: "error",
      message:
        "The commission classification could not be saved. Please try again.",
    };
  }
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

function quoteError(message: string): CommissionQuoteActionState {
  return {
    outcome: "error",
    message,
  };
}

function quotePricingResolutionError(
  result: Exclude<ResolveCommissionQuotePricingResult, { outcome: "resolved" }>,
): CommissionQuoteActionState {
  return quoteError(
    result.outcome === "invalid" ? result.validation.message : result.message,
  );
}

function quoteConflict(
  commissionId: string,
  message = "The quote changed before this action was applied. Refresh the page and try again.",
): CommissionQuoteActionState {
  revalidateCommissionActivityPaths(commissionId);

  return {
    outcome: "conflict",
    message,
  };
}

function parseQuoteDraftForm(formData: FormData):
  | {
      valid: true;
      currency: string;
      description: string | null;
      notes: string | null;
      pricingSelection: CommissionQuotePricingSelection | null;
      validUntil: Date | null;
      items: CommissionQuoteItemInput[];
    }
  | {
      valid: false;
      message: string;
    } {
  const validUntil = parseOptionalDate(getFormValue(formData, "validUntil"));

  if (validUntil === "invalid") {
    return {
      valid: false,
      message: "The quote validity date is invalid.",
    };
  }

  const pricingSelection = parseCommissionQuotePricingSelection(
    getFormValue(formData, "pricingSelection"),
  );

  if (pricingSelection === "invalid") {
    return {
      valid: false,
      message: "The selected quote pricing is invalid.",
    };
  }

  const items = pricingSelection
    ? []
    : parseCommissionQuoteItems(getFormValue(formData, "items"));

  if (!items) {
    return {
      valid: false,
      message: "The quote items are invalid.",
    };
  }

  return {
    valid: true,
    currency: getFormValue(formData, "currency"),
    description: getFormValue(formData, "description") || null,
    notes: getFormValue(formData, "notes") || null,
    pricingSelection,
    validUntil,
    items,
  };
}

export async function createCommissionQuoteDraftAction(
  _previousState: CommissionQuoteActionState,
  formData: FormData,
): Promise<CommissionQuoteActionState> {
  const session = await requireAdmin();
  const commissionId = getFormValue(formData, "commissionId");

  if (!UUID_PATTERN.test(commissionId)) {
    return quoteError("The commission identifier is invalid.");
  }

  const draft = parseQuoteDraftForm(formData);

  if (!draft.valid) {
    return quoteError(draft.message);
  }

  try {
    const pricingResult = draft.pricingSelection
      ? await resolveCommissionQuotePricingForCreate({
          commissionId,
          selection: draft.pricingSelection,
        })
      : null;

    if (pricingResult && pricingResult.outcome !== "resolved") {
      return quotePricingResolutionError(pricingResult);
    }

    const result =
      pricingResult?.outcome === "resolved"
        ? await createCommissionQuoteDraft({
            commissionId,
            createdByAdminUserId: session.user.id,
            description: draft.description,
            notes: draft.notes,
            pricingSnapshot: pricingResult.snapshot,
            validUntil: draft.validUntil,
          })
        : await createCommissionQuoteDraft({
            commissionId,
            createdByAdminUserId: session.user.id,
            currency: draft.currency,
            description: draft.description,
            notes: draft.notes,
            validUntil: draft.validUntil,
            items: draft.items,
          });

    switch (result.outcome) {
      case "created":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "success",
          message: `Quote version ${result.quote.version} created successfully.`,
        };
      case "invalid":
        return quoteError(result.validation.message);
      case "not_found":
        return quoteError("The commission no longer exists.");
      case "wrong_status":
        return quoteConflict(
          commissionId,
          `A quote draft cannot be created while the commission is ${result.currentStatus}.`,
        );
      case "active_quote_exists":
        return quoteConflict(
          commissionId,
          `Quote version ${result.activeQuote.version} is already active.`,
        );
      case "conflict":
        return quoteConflict(commissionId);
    }
  } catch (error) {
    console.error("Failed to create commission quote draft:", error);
    return quoteError(
      "The quote draft could not be created. Please try again.",
    );
  }
}

export async function updateCommissionQuoteDraftAction(
  _previousState: CommissionQuoteActionState,
  formData: FormData,
): Promise<CommissionQuoteActionState> {
  const session = await requireAdmin();
  const commissionId = getFormValue(formData, "commissionId");
  const quoteId = getFormValue(formData, "quoteId");
  const expectedUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedUpdatedAt"),
  );

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(quoteId)) {
    return quoteError("The commission or quote identifier is invalid.");
  }

  if (!expectedUpdatedAt) {
    return quoteError("The quote version timestamp is invalid.");
  }

  const draft = parseQuoteDraftForm(formData);

  if (!draft.valid) {
    return quoteError(draft.message);
  }

  try {
    const pricingResult = draft.pricingSelection
      ? await resolveCommissionQuotePricingForUpdate({
          quoteId,
          selection: draft.pricingSelection,
        })
      : null;

    if (pricingResult && pricingResult.outcome !== "resolved") {
      return quotePricingResolutionError(pricingResult);
    }

    const result =
      pricingResult?.outcome === "resolved"
        ? await updateCommissionQuoteDraft({
            quoteId,
            expectedUpdatedAt,
            updatedByAdminUserId: session.user.id,
            description: draft.description,
            notes: draft.notes,
            pricingSnapshot: pricingResult.snapshot,
            validUntil: draft.validUntil,
          })
        : await updateCommissionQuoteDraft({
            quoteId,
            expectedUpdatedAt,
            updatedByAdminUserId: session.user.id,
            currency: draft.currency,
            description: draft.description,
            notes: draft.notes,
            validUntil: draft.validUntil,
            items: draft.items,
          });

    switch (result.outcome) {
      case "updated":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "success",
          message: "Quote draft updated successfully.",
        };
      case "invalid":
        return quoteError(result.validation.message);
      case "not_found":
        return quoteError("The quote no longer exists.");
      case "not_draft":
        return quoteConflict(
          commissionId,
          `This quote can no longer be edited because it is ${result.currentStatus}.`,
        );
      case "wrong_commission_status":
        return quoteConflict(
          commissionId,
          `The quote cannot be edited while the commission is ${result.currentStatus}.`,
        );
      case "conflict":
        return quoteConflict(commissionId);
    }
  } catch (error) {
    console.error("Failed to update commission quote draft:", error);
    return quoteError(
      "The quote draft could not be updated. Please try again.",
    );
  }
}

export async function sendCommissionQuoteAction(
  _previousState: CommissionQuoteActionState,
  formData: FormData,
): Promise<CommissionQuoteActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(
    formData,
    "commissionId",
  );

  const quoteId = getFormValue(
    formData,
    "quoteId",
  );

  const expectedUpdatedAt = parseRequiredDate(
    getFormValue(
      formData,
      "expectedUpdatedAt",
    ),
  );

  if (
    !UUID_PATTERN.test(commissionId) ||
    !UUID_PATTERN.test(quoteId)
  ) {
    return quoteError(
      "The commission or quote identifier is invalid.",
    );
  }

  if (!expectedUpdatedAt) {
    return quoteError(
      "The quote version timestamp is invalid.",
    );
  }

  try {
    const result = await sendCommissionQuote({
      quoteId,
      expectedUpdatedAt,
      sentByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "sent": {
        /*
         * Never trust the commissionId submitted by the browser
         * for email delivery. The persisted quote is the source
         * of truth for the commission relationship.
         */
        const persistedCommissionId =
          result.quote.commissionId;

        const detail =
          await getAdminCommissionDetail(
            persistedCommissionId,
          );

        if (!detail) {
          revalidateCommissionActivityPaths(
            persistedCommissionId,
          );

          return quoteError(
            "The quote was marked as sent, but the client details could not be loaded for email delivery.",
          );
        }

        const validUntil =
          result.quote.validUntil;

        if (!validUntil) {
          revalidateCommissionActivityPaths(
            persistedCommissionId,
          );

          return quoteError(
            "The quote was marked as sent, but its expiration date is unavailable for email delivery.",
          );
        }

        const emailResult =
          await sendCommissionQuoteEmail({
            clientEmail:
              detail.commission.clientEmail,

            clientName:
              detail.commission.clientName,

            currency:
              result.quote.currency,

            publicToken:
              result.publicToken,

            reference:
              detail.commission.reference,

            totalAmount:
              result.quote.totalAmount,

            validUntil,

            version:
              result.quote.version,
          });

        if (emailResult.error) {
          /*
           * Never log the public token or the generated quote URL.
           */
          console.error(
            "Commission quote email delivery failed:",
            {
              name:
                emailResult.error.name,
              message:
                emailResult.error.message,
            },
          );

          revalidateCommissionActivityPaths(
            persistedCommissionId,
          );

          return quoteError(
            "The quote was marked as sent, but the email could not be delivered. Refresh the page before taking further action.",
          );
        }

        revalidateCommissionActivityPaths(
          persistedCommissionId,
        );

        return {
          outcome: "success",
          message:
            "Quote sent and emailed successfully.",
        };
      }

      case "invalid":
        return quoteError(
          result.validation.message,
        );

      case "not_found":
        return quoteError(
          "The quote no longer exists.",
        );

      case "not_draft":
        return quoteConflict(
          commissionId,
          `Only a draft quote can be sent. This quote is ${result.currentStatus}.`,
        );

      case "wrong_commission_status":
        return quoteConflict(
          commissionId,
          `The quote cannot be sent while the commission is ${result.currentStatus}.`,
        );

      case "on_hold":
        return quoteConflict(
          commissionId,
          "This commission is on hold. Resume it before sending the quote.",
        );

      case "conflict":
        return quoteConflict(
          commissionId,
        );
    }
  } catch (error) {
    /*
     * Do not include request payloads, tokens or quote URLs
     * in this log.
     */
    console.error(
      "Failed to send commission quote:",
      error,
    );

    return quoteError(
      "The quote could not be sent. Please try again.",
    );
  }
}

export async function acceptCommissionQuoteAction(
  _previousState: CommissionQuoteActionState,
  formData: FormData,
): Promise<CommissionQuoteActionState> {
  const session = await requireAdmin();
  const commissionId = getFormValue(formData, "commissionId");
  const quoteId = getFormValue(formData, "quoteId");
  const expectedUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedUpdatedAt"),
  );

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(quoteId)) {
    return quoteError("The commission or quote identifier is invalid.");
  }

  if (!expectedUpdatedAt) {
    return quoteError("The quote version timestamp is invalid.");
  }

  try {
    const result = await acceptCommissionQuote({
      quoteId,
      expectedUpdatedAt,
      acceptedByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "accepted":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "success",
          message: "Quote acceptance recorded successfully.",
        };
      case "invalid":
        return quoteError(result.validation.message);
      case "not_found":
        return quoteError("The quote no longer exists.");
      case "not_sent":
        return quoteConflict(
          commissionId,
          `Only a sent quote can be accepted. This quote is ${result.currentStatus}.`,
        );
      case "wrong_commission_status":
        return quoteConflict(
          commissionId,
          `Acceptance cannot be recorded while the commission is ${result.currentStatus}.`,
        );
      case "on_hold":
        return quoteConflict(
          commissionId,
          "This commission is on hold. Resume it before recording acceptance.",
        );
      case "conflict":
        return quoteConflict(commissionId);
    }
  } catch (error) {
    console.error("Failed to accept commission quote:", error);
    return quoteError(
      "Quote acceptance could not be recorded. Please try again.",
    );
  }
}

export async function declineCommissionQuoteAction(
  _previousState: CommissionQuoteActionState,
  formData: FormData,
): Promise<CommissionQuoteActionState> {
  const session = await requireAdmin();
  const commissionId = getFormValue(formData, "commissionId");
  const quoteId = getFormValue(formData, "quoteId");
  const expectedUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedUpdatedAt"),
  );

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(quoteId)) {
    return quoteError("The commission or quote identifier is invalid.");
  }

  if (!expectedUpdatedAt) {
    return quoteError("The quote version timestamp is invalid.");
  }

  try {
    const result = await declineCommissionQuote({
      quoteId,
      expectedUpdatedAt,
      declinedByAdminUserId: session.user.id,
      closeReasonNote: getFormValue(formData, "note") || null,
    });

    switch (result.outcome) {
      case "declined":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "success",
          message: "Quote decline recorded successfully.",
        };
      case "invalid":
        return quoteError(result.validation.message);
      case "not_found":
        return quoteError("The quote no longer exists.");
      case "not_sent":
        return quoteConflict(
          commissionId,
          `Only a sent quote can be declined. This quote is ${result.currentStatus}.`,
        );
      case "wrong_commission_status":
        return quoteConflict(
          commissionId,
          `The quote cannot be declined while the commission is ${result.currentStatus}.`,
        );
      case "conflict":
        return quoteConflict(commissionId);
    }
  } catch (error) {
    console.error("Failed to decline commission quote:", error);
    return quoteError(
      "The quote decline could not be recorded. Please try again.",
    );
  }
}

export async function expireCommissionQuoteAction(
  _previousState: CommissionQuoteActionState,
  formData: FormData,
): Promise<CommissionQuoteActionState> {
  const session = await requireAdmin();
  const commissionId = getFormValue(formData, "commissionId");
  const quoteId = getFormValue(formData, "quoteId");
  const expectedUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedUpdatedAt"),
  );

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(quoteId)) {
    return quoteError("The commission or quote identifier is invalid.");
  }

  if (!expectedUpdatedAt) {
    return quoteError("The quote version timestamp is invalid.");
  }

  try {
    const result = await expireCommissionQuote({
      quoteId,
      expectedUpdatedAt,
      recordedByAdminUserId: session.user.id,
      note: getFormValue(formData, "note") || null,
    });

    switch (result.outcome) {
      case "expired":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "success",
          message: "Quote expiration recorded successfully.",
        };
      case "invalid":
        return quoteError(result.validation.message);
      case "not_found":
        return quoteError("The quote no longer exists.");
      case "not_sent":
        return quoteConflict(
          commissionId,
          `Only a sent quote can expire. This quote is ${result.currentStatus}.`,
        );
      case "wrong_commission_status":
        return quoteConflict(
          commissionId,
          `The quote cannot expire while the commission is ${result.currentStatus}.`,
        );
      case "conflict":
        return quoteConflict(commissionId);
    }
  } catch (error) {
    console.error("Failed to expire commission quote:", error);
    return quoteError(
      "The quote expiration could not be recorded. Please try again.",
    );
  }
}

export async function supersedeCommissionQuoteAction(
  _previousState: CommissionQuoteActionState,
  formData: FormData,
): Promise<CommissionQuoteActionState> {
  const session = await requireAdmin();
  const commissionId = getFormValue(formData, "commissionId");
  const quoteId = getFormValue(formData, "quoteId");
  const expectedUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedUpdatedAt"),
  );
  const initiatedBy = getFormValue(formData, "initiatedBy");

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(quoteId)) {
    return quoteError("The commission or quote identifier is invalid.");
  }

  if (!expectedUpdatedAt) {
    return quoteError("The quote version timestamp is invalid.");
  }

  if (!isCommissionManualActor(initiatedBy)) {
    return quoteError("The selected actor is invalid.");
  }

  try {
    const result = await supersedeCommissionQuote({
      quoteId,
      expectedUpdatedAt,
      initiatedBy,
      supersededByAdminUserId: session.user.id,
      note: getFormValue(formData, "note") || null,
    });

    switch (result.outcome) {
      case "superseded":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "success",
          message: `Quote version ${result.supersededQuote.version} was superseded and draft version ${result.draft.quote.version} was created.`,
        };
      case "invalid":
        return quoteError(result.validation.message);
      case "not_found":
        return quoteError("The quote no longer exists.");
      case "not_sent":
        return quoteConflict(
          commissionId,
          `Only a sent quote can be revised. This quote is ${result.currentStatus}.`,
        );
      case "wrong_commission_status":
        return quoteConflict(
          commissionId,
          `A revision cannot be created while the commission is ${result.currentStatus}.`,
        );
      case "on_hold":
        return quoteConflict(
          commissionId,
          "This commission is on hold. Resume it before creating a quote revision.",
        );
      case "conflict":
        return quoteConflict(commissionId);
    }
  } catch (error) {
    console.error("Failed to supersede commission quote:", error);
    return quoteError(
      "The quote revision could not be created. Please try again.",
    );
  }
}
