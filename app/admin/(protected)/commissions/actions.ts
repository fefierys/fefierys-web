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
import {
  MAX_COMMISSION_QUOTE_ITEM_QUANTITY,
  type CommissionQuoteItemInput,
} from "@/lib/commissions/commissionQuote";
import type {
  CommissionQuoteCustomItemSelection,
  CommissionQuoteIllustrationSelection,
  CommissionQuoteSelectedAdjustment,
} from "@/lib/commissions/commissionQuotePricing";
import { transitionCommissionStatus } from "@/lib/repositories/commissionWorkflowRepository";
import { saveCommissionAgreementDraftData } from "@/lib/repositories/commissionAgreements/commissionAgreementDataRepository";

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
import { sendCommissionClientMessage } from "@/lib/email/commissionClientMessageService";
import { sendCommissionQuoteToClient } from "@/lib/email/commissionQuoteSendService";
import { retryCommissionEmailMessage } from "@/lib/email/commissionEmailRetryService";

import { CURRENT_COMMISSION_TERMS_VERSION } from "@/lib/legal/commissionTerms";
import { CURRENT_COMMISSION_AGREEMENT_VERSION } from "@/lib/legal/commissionAgreement";

import { createCommissionAgreementDraft } from "@/lib/repositories/commissionAgreements/commissionAgreementDraftRepository";
import { getCommissionQuotes } from "@/lib/repositories/commissionQuoteRepository";
import {
  createCommissionGroupedPaymentPlan,
  createCommissionPaymentPlan,
  updateCommissionGroupedPaymentPlan,
  updateCommissionPaymentPlan,
  type UpdateCommissionPaymentStageInput,
} from "@/lib/repositories/commissionPayments/commissionPaymentPlanRepository";

import type { CommissionPaymentStageInput } from "@/lib/commissions/commissionPaymentPlan";
import type {
  CommissionGroupedPaymentPlanEditInput,
  CommissionGroupedPaymentPlanInput,
} from "@/lib/commissions/commissionGroupedPaymentPlan";

export interface CommissionStatusActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
}

export interface CommissionClientDetailsRequestActionState {
  outcome: "idle" | "success" | "warning" | "error" | "conflict";
  message: string | null;
}

export interface CommissionClientMessageActionState {
  outcome: "idle" | "success" | "warning" | "error" | "conflict";

  message: string | null;
}

export interface CommissionEmailRetryActionState {
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

export interface CommissionAgreementDraftActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
  agreementUpdatedAt?: string;
}

export interface CommissionAgreementCreateActionState {
  outcome: "idle" | "success" | "error" | "conflict";
  message: string | null;
}

export interface CommissionPaymentPlanActionState {
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

    const baseQuantity = record.baseQuantity;

    if (
      typeof baseQuantity !== "number" ||
      !Number.isInteger(baseQuantity) ||
      baseQuantity < 1 ||
      baseQuantity > MAX_COMMISSION_QUOTE_ITEM_QUANTITY ||
      !selectedAdjustments
    ) {
      return "invalid";
    }

    // Formato actual: una cantidad base y una lista compartida de ajustes.
    if (
      record.illustrations === undefined &&
      record.globalAdjustments === undefined
    ) {
      return {
        baseQuantity,
        customItems,
        mode: "catalog",
        selectedAdjustments,
      };
    }

    // Formato nuevo: ajustes individuales y descuento global.
    const illustrations = parseQuoteIllustrations(record.illustrations);

    const globalAdjustments = parseQuoteSelectedAdjustments(
      record.globalAdjustments,
    );

    if (
      !illustrations ||
      !globalAdjustments ||
      illustrations.length !== baseQuantity ||
      selectedAdjustments.length !== 0
    ) {
      return "invalid";
    }

    return {
      baseQuantity,
      customItems,
      globalAdjustments,
      illustrations,
      mode: "catalog",
      selectedAdjustments: [],
    };
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
      (record.fixedAmount !== undefined &&
        record.fixedAmount !== null &&
        typeof record.fixedAmount !== "string") ||
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
      fixedAmount:
        typeof record.fixedAmount === "string" ? record.fixedAmount : null,
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

function parseQuoteIllustrations(
  value: unknown,
): CommissionQuoteIllustrationSelection[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > MAX_COMMISSION_QUOTE_ITEM_QUANTITY
  ) {
    return null;
  }

  const illustrations: CommissionQuoteIllustrationSelection[] = [];
  const illustrationIds = new Set<string>();

  for (const illustration of value) {
    if (
      !illustration ||
      typeof illustration !== "object" ||
      Array.isArray(illustration)
    ) {
      return null;
    }

    const record = illustration as Record<string, unknown>;

    if (
      typeof record.id !== "string" ||
      !UUID_PATTERN.test(record.id) ||
      illustrationIds.has(record.id) ||
      (record.pricingOptionId !== undefined &&
        (typeof record.pricingOptionId !== "string" ||
          !UUID_PATTERN.test(record.pricingOptionId)))
    ) {
      return null;
    }

    const selectedAdjustments = parseQuoteSelectedAdjustments(
      record.selectedAdjustments,
    );

    if (!selectedAdjustments) {
      return null;
    }

    illustrationIds.add(record.id);

    illustrations.push({
      id: record.id,
      pricingOptionId:
        typeof record.pricingOptionId === "string"
          ? record.pricingOptionId
          : undefined,
      selectedAdjustments,
    });
  }

  return illustrations;
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

export async function sendCommissionClientMessageAction(
  _previousState: CommissionClientMessageActionState,
  formData: FormData,
): Promise<CommissionClientMessageActionState> {
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
      message: `The message must contain between 1 and ${MAX_NOTE_LENGTH} characters.`,
    };
  }

  try {
    const result = await sendCommissionClientMessage({
      commissionId,

      messageText,

      createdByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "sent":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Message sent successfully.",
        };

      case "delivery_failed":
        console.error("Commission client message email delivery failed:", {
          messageId: result.messageId,

          failureMessage: result.failureMessage,
        });

        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "warning",
          message:
            "The message was saved, but the email could not be delivered. The failed message has been preserved for retry.",
        };

      case "delivery_pending":
        revalidateCommissionActivityPaths(commissionId);

        if (result.currentStatus === "sent") {
          return {
            outcome: "success",
            message: "Message sent successfully.",
          };
        }

        if (result.currentStatus === "failed") {
          return {
            outcome: "warning",
            message:
              "The message was saved, but email delivery is currently failed. The message remains available for retry.",
          };
        }

        return {
          outcome: "warning",
          message:
            "The message was saved and email delivery is still being finalized.",
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
            "The client conversation changed before the message was saved. Refresh the page and try again.",
        };
    }
  } catch (error) {
    console.error("Failed to send commission client message:", error);

    return {
      outcome: "error",
      message:
        "The client message could not be saved or delivered. Please try again.",
    };
  }
}

export async function retryCommissionEmailMessageAction(
  _previousState: CommissionEmailRetryActionState,
  formData: FormData,
): Promise<CommissionEmailRetryActionState> {
  await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");

  const messageId = getFormValue(formData, "messageId");

  if (!UUID_PATTERN.test(commissionId)) {
    return {
      outcome: "error",
      message: "The commission identifier is invalid.",
    };
  }

  if (!UUID_PATTERN.test(messageId)) {
    return {
      outcome: "error",
      message: "The email message identifier is invalid.",
    };
  }

  try {
    const result = await retryCommissionEmailMessage({
      commissionId,
      messageId,
    });

    switch (result.outcome) {
      case "sent":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Email sent successfully.",
        };

      case "delivery_failed":
        console.error("Commission email retry delivery failed:", {
          messageId: result.messageId,

          failureMessage: result.failureMessage,
        });

        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "warning",
          message:
            "The email could not be delivered. The same message remains available for another retry.",
        };

      case "delivery_pending":
        revalidateCommissionActivityPaths(commissionId);

        if (result.currentStatus === "sent") {
          return {
            outcome: "success",
            message: "Email sent successfully.",
          };
        }

        if (result.currentStatus === "failed") {
          return {
            outcome: "warning",
            message: "Email delivery is still failed. You can try again.",
          };
        }

        return {
          outcome: "warning",
          message: "Email delivery is still being finalized.",
        };

      case "not_found":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "error",
          message: "The email message could not be found.",
        };

      case "not_retryable":
        revalidateCommissionActivityPaths(commissionId);

        if (result.currentStatus === "sent") {
          return {
            outcome: "success",
            message: "This email has already been sent.",
          };
        }

        return {
          outcome: "conflict",
          message: `This email cannot be retried while its delivery status is ${result.currentStatus}.`,
        };

      case "unsupported_kind":
        return {
          outcome: "error",
          message: "Retry is not available for this email type yet.",
        };

      case "retry_unavailable":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "error",
          message: result.message,
        };
    }
  } catch (error) {
    console.error("Failed to retry commission email:", error);

    return {
      outcome: "error",
      message: "The email could not be retried. Please try again.",
    };
  }
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
      message:
        "The client details request could not be saved. Please try again.",
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
        : classification === "bulk"
          ? {
              classification,
              commissionId,
              expectedUpdatedAt,
              note: note || null,
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
              : classification === "bulk"
                ? "Commission classified as bulk."
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
    const result = await sendCommissionQuoteToClient({
      quoteId,
      expectedUpdatedAt,
      sentByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "sent": {
        /*
         * The persisted quote relationship is the
         * source of truth rather than the browser
         * supplied commission ID.
         */
        revalidateCommissionActivityPaths(result.commissionId);

        return {
          outcome: "success",
          message: "Quote sent and emailed successfully.",
        };
      }

      case "delivery_failed": {
        /*
         * The quote/workflow transition and logical
         * email already exist atomically at this point.
         * The failed message remains persisted for retry.
         */
        console.error("Commission quote email delivery failed:", {
          messageId: result.messageId,

          failureMessage: result.failureMessage,
        });

        revalidateCommissionActivityPaths(result.commissionId);

        return quoteError(
          "The quote was marked as sent, but the email could not be delivered. The failed email has been preserved for retry.",
        );
      }

      case "delivery_pending": {
        revalidateCommissionActivityPaths(result.commissionId);

        return quoteError(
          "The quote was marked as sent, but email delivery is still pending. Refresh the page before taking further action.",
        );
      }

      case "invalid":
        return quoteError(result.validation.message);

      case "not_found":
        return quoteError("The quote no longer exists.");

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

      case "thread_not_found":
        return quoteConflict(
          commissionId,
          "The client email thread is not available for this commission.",
        );

      case "thread_not_ready":
        return quoteConflict(
          commissionId,
          "The client email thread is not ready yet. Its root email identity must be completed before sending the quote.",
        );

      case "thread_blocked":
        return quoteConflict(
          commissionId,
          "A previous client email is still queued, sending, or failed. Resolve that message before sending the quote.",
        );

      case "conflict":
        return quoteConflict(commissionId);
    }
  } catch (error) {
    /*
     * Do not include request payloads, public quote
     * tokens or generated secure URLs in this log.
     */
    console.error("Failed to send commission quote:", error);

    return quoteError("The quote could not be sent. Please try again.");
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

export async function saveCommissionAgreementDraftDataAction(
  _previousState: CommissionAgreementDraftActionState,
  formData: FormData,
): Promise<CommissionAgreementDraftActionState> {
  await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const quoteId = getFormValue(formData, "quoteId");
  const agreementId = getFormValue(formData, "agreementId");

  const expectedAgreementUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedAgreementUpdatedAt"),
  );

  if (
    !UUID_PATTERN.test(commissionId) ||
    !UUID_PATTERN.test(quoteId) ||
    !UUID_PATTERN.test(agreementId)
  ) {
    return {
      outcome: "error",
      message: "The commission, quote, or Agreement identifier is invalid.",
    };
  }

  if (!expectedAgreementUpdatedAt) {
    return {
      outcome: "error",
      message: "The Agreement version timestamp is invalid.",
    };
  }

  const rawAgreementData = getFormValue(formData, "agreementData");

  if (!rawAgreementData || rawAgreementData.length > 100_000) {
    return {
      outcome: "error",
      message: "The Agreement draft data is missing or too large.",
    };
  }

  let agreementData: unknown;

  try {
    agreementData = JSON.parse(rawAgreementData);
  } catch {
    return {
      outcome: "error",
      message: "The Agreement draft data is not valid JSON.",
    };
  }

  try {
    const result = await saveCommissionAgreementDraftData({
      commissionId,
      quoteId,
      agreementId,
      expectedAgreementUpdatedAt,
      agreementData,
    });

    switch (result.outcome) {
      case "saved":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Agreement draft saved successfully.",
          agreementUpdatedAt: result.agreement.updatedAt.toISOString(),
        };

      case "invalid":
        return {
          outcome: "error",
          message: `The Agreement field "${result.field}" is invalid.`,
        };

      case "not_found":
        return {
          outcome: "error",
          message: "The Commission or Agreement could not be found.",
        };

      case "wrong_status":
        return {
          outcome: "conflict",
          message: `The Agreement cannot be edited while the commission is ${result.currentStatus}.`,
        };

      case "on_hold":
        return {
          outcome: "conflict",
          message:
            "The Agreement cannot be edited while the commission is on hold.",
        };

      case "quote_not_accepted":
        return {
          outcome: "conflict",
          message: "The Agreement requires an accepted Quote.",
        };

      case "agreement_not_draft":
        return {
          outcome: "conflict",
          message: "This Agreement is no longer a draft and cannot be edited.",
        };

      case "conflict":
        return {
          outcome: "conflict",
          message:
            "The Agreement has changed since you opened it. Refresh the page before saving again.",
        };
    }
  } catch (error) {
    console.error("Failed to save Commission Agreement draft:", error);

    return {
      outcome: "error",
      message: "The Agreement draft could not be saved. Please try again.",
    };
  }
}

export async function createCommissionAgreementDraftAction(
  _previousState: CommissionAgreementCreateActionState,
  formData: FormData,
): Promise<CommissionAgreementCreateActionState> {
  const session = await requireAdmin();
  const commissionId = getFormValue(formData, "commissionId");

  if (!UUID_PATTERN.test(commissionId)) {
    return {
      outcome: "error",
      message: "The commission identifier is invalid.",
    };
  }

  try {
    const quotes = await getCommissionQuotes(commissionId);

    const acceptedQuotes = quotes.filter(
      ({ quote }) => quote.status === "accepted",
    );

    if (acceptedQuotes.length !== 1) {
      return {
        outcome: "conflict",
        message:
          acceptedQuotes.length === 0
            ? "An accepted Quote is required before creating the Agreement."
            : "More than one accepted Quote was found. Review the Quote history before creating the Agreement.",
      };
    }

    const acceptedQuote = acceptedQuotes[0];

    const result = await createCommissionAgreementDraft({
      commissionId,
      quoteId: acceptedQuote.quote.id,
      termsVersion: CURRENT_COMMISSION_TERMS_VERSION,
      agreementVersion: CURRENT_COMMISSION_AGREEMENT_VERSION,
      createdByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "created":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Agreement draft created successfully.",
        };

      case "invalid":
        return {
          outcome: "error",
          message: `The ${result.field} is invalid.`,
        };

      case "not_found":
        return {
          outcome: "error",
          message: "The commission could not be found.",
        };

      case "wrong_status":
        return {
          outcome: "conflict",
          message: `The Agreement cannot be created while the commission is ${result.currentStatus}.`,
        };

      case "on_hold":
        return {
          outcome: "conflict",
          message:
            "The Agreement cannot be created while the commission is on hold.",
        };

      case "quote_not_accepted":
        return {
          outcome: "conflict",
          message:
            "The selected Quote is no longer accepted. Refresh the page.",
        };

      case "active_agreement_exists":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "An active Agreement already exists. Refresh the page to view it.",
        };

      case "conflict":
        return {
          outcome: "conflict",
          message:
            "The commission changed while creating the Agreement. Refresh the page and try again.",
        };
    }
  } catch (error) {
    console.error("Failed to create Commission Agreement draft:", error);

    return {
      outcome: "error",
      message: "The Agreement draft could not be created. Please try again.",
    };
  }
}

function parseCommissionPaymentStages(
  value: string,
): CommissionPaymentStageInput[] | null {
  if (!value || value.length > 100_000) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 50) {
      return null;
    }

    const stages: CommissionPaymentStageInput[] = [];

    for (const stage of parsed) {
      if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
        return null;
      }

      const record = stage as Record<string, unknown>;

      if (
        typeof record.label !== "string" ||
        typeof record.amount !== "string" ||
        typeof record.trigger !== "string" ||
        (record.customTriggerNote !== undefined &&
          record.customTriggerNote !== null &&
          typeof record.customTriggerNote !== "string")
      ) {
        return null;
      }

      stages.push({
        label: record.label,
        amount: record.amount,
        trigger: record.trigger,
        customTriggerNote:
          typeof record.customTriggerNote === "string"
            ? record.customTriggerNote
            : null,
      });
    }

    return stages;
  } catch {
    return null;
  }
}

function parseCommissionGroupedPaymentPlan(
  value: string,
): CommissionGroupedPaymentPlanInput | null {
  if (!value || value.length > 100_000) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (
      !Array.isArray(record.projectStages) ||
      !Array.isArray(record.deliverables) ||
      record.deliverables.length > 100
    ) {
      return null;
    }

    let totalStageCount = record.projectStages.length;

    if (totalStageCount > 50) {
      return null;
    }

    /*
     * The existing parser requires at least one stage.
     * An empty projectStages array is valid when payments
     * belong exclusively to individual deliverables.
     */
    const projectStages =
      record.projectStages.length === 0
        ? []
        : parseCommissionPaymentStages(JSON.stringify(record.projectStages));

    if (!projectStages) {
      return null;
    }

    const deliverables: CommissionGroupedPaymentPlanInput["deliverables"][number][] =
      [];

    for (const item of record.deliverables) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const deliverable = item as Record<string, unknown>;

      if (
        typeof deliverable.title !== "string" ||
        (deliverable.description !== undefined &&
          deliverable.description !== null &&
          typeof deliverable.description !== "string") ||
        typeof deliverable.quantity !== "number" ||
        !Array.isArray(deliverable.stages)
      ) {
        return null;
      }

      totalStageCount += deliverable.stages.length;

      if (totalStageCount > 50) {
        return null;
      }

      /*
       * A deliverable may have no individual payments when
       * its cost is covered by project-wide payment stages.
       */
      const stages =
        deliverable.stages.length === 0
          ? []
          : parseCommissionPaymentStages(JSON.stringify(deliverable.stages));

      if (!stages) {
        return null;
      }

      deliverables.push({
        title: deliverable.title,
        description:
          typeof deliverable.description === "string"
            ? deliverable.description
            : null,
        quantity: deliverable.quantity,
        stages,
      });
    }

    if (totalStageCount === 0) {
      return null;
    }

    return {
      projectStages,
      deliverables,
    };
  } catch {
    return null;
  }
}

export async function createCommissionGroupedPaymentPlanAction(
  _previousState: CommissionPaymentPlanActionState,
  formData: FormData,
): Promise<CommissionPaymentPlanActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const agreementId = getFormValue(formData, "agreementId");

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(agreementId)) {
    return {
      outcome: "error",
      message: "The commission or Agreement identifier is invalid.",
    };
  }

  const plan = parseCommissionGroupedPaymentPlan(
    getFormValue(formData, "plan"),
  );

  if (!plan) {
    return {
      outcome: "error",
      message: "The grouped payment plan has an invalid structure.",
    };
  }

  try {
    /*
     * Resolve the accepted Quote on the server.
     * Never trust a quoteId supplied by the browser.
     */
    const quotes = await getCommissionQuotes(commissionId);

    const acceptedQuotes = quotes.filter(
      ({ quote }) => quote.status === "accepted",
    );

    if (acceptedQuotes.length !== 1) {
      return {
        outcome: "conflict",
        message:
          acceptedQuotes.length === 0
            ? "An accepted Quote is required before creating a payment plan."
            : "More than one accepted Quote was found. Review the Quote history.",
      };
    }

    const result = await createCommissionGroupedPaymentPlan({
      commissionId,
      quoteId: acceptedQuotes[0].quote.id,
      agreementId,
      plan,
      createdByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "created":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Grouped payment plan created successfully.",
        };

      case "invalid":
        return {
          outcome: "error",
          message: result.validation.message,
        };

      case "not_found":
        return {
          outcome: "error",
          message: "The commission could not be found.",
        };

      case "wrong_status":
        return {
          outcome: "conflict",
          message: `The payment plan cannot be created while the commission is ${result.currentStatus}.`,
        };

      case "on_hold":
        return {
          outcome: "conflict",
          message:
            "The payment plan cannot be created while the commission is on hold.",
        };

      case "quote_not_accepted":
        return {
          outcome: "conflict",
          message:
            "The selected Quote is no longer accepted. Refresh the page.",
        };

      case "agreement_not_draft":
        return {
          outcome: "conflict",
          message: "The Agreement is no longer a draft.",
        };

      case "plan_already_exists":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "A payment plan already exists. Refresh the page to view it.",
        };

      case "conflict":
        return {
          outcome: "conflict",
          message:
            "The commission changed while creating the payment plan. Refresh the page and try again.",
        };
    }
  } catch (error) {
    console.error("Failed to create grouped Commission payment plan:", error);

    return {
      outcome: "error",
      message:
        "The grouped payment plan could not be created. Please try again.",
    };
  }
}

export async function createCommissionPaymentPlanAction(
  _previousState: CommissionPaymentPlanActionState,
  formData: FormData,
): Promise<CommissionPaymentPlanActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const agreementId = getFormValue(formData, "agreementId");

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(agreementId)) {
    return {
      outcome: "error",
      message: "The commission or Agreement identifier is invalid.",
    };
  }

  const stages = parseCommissionPaymentStages(getFormValue(formData, "stages"));

  if (!stages) {
    return {
      outcome: "error",
      message: "The payment stages have an invalid structure.",
    };
  }

  try {
    /*
     * Resolve the accepted Quote on the server instead
     * of trusting a quoteId supplied by the browser.
     */
    const quotes = await getCommissionQuotes(commissionId);

    const acceptedQuotes = quotes.filter(
      ({ quote }) => quote.status === "accepted",
    );

    if (acceptedQuotes.length !== 1) {
      return {
        outcome: "conflict",
        message:
          acceptedQuotes.length === 0
            ? "An accepted Quote is required before creating a payment plan."
            : "More than one accepted Quote was found. Review the Quote history.",
      };
    }

    const result = await createCommissionPaymentPlan({
      commissionId,
      quoteId: acceptedQuotes[0].quote.id,
      agreementId,
      stages,
      createdByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "created":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Payment plan created successfully.",
        };

      case "invalid":
        return {
          outcome: "error",
          message: result.validation.message,
        };

      case "not_found":
        return {
          outcome: "error",
          message: "The commission could not be found.",
        };

      case "wrong_status":
        return {
          outcome: "conflict",
          message: `The payment plan cannot be created while the commission is ${result.currentStatus}.`,
        };

      case "on_hold":
        return {
          outcome: "conflict",
          message:
            "The payment plan cannot be created while the commission is on hold.",
        };

      case "quote_not_accepted":
        return {
          outcome: "conflict",
          message:
            "The selected Quote is no longer accepted. Refresh the page.",
        };

      case "agreement_not_draft":
        return {
          outcome: "conflict",
          message: "The Agreement is no longer a draft.",
        };

      case "plan_already_exists":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "conflict",
          message:
            "A payment plan already exists. Refresh the page to view it.",
        };

      case "conflict":
        return {
          outcome: "conflict",
          message:
            "The commission changed while creating the payment plan. Refresh the page and try again.",
        };
    }
  } catch (error) {
    console.error("Failed to create Commission payment plan:", error);

    return {
      outcome: "error",
      message: "The payment plan could not be created. Please try again.",
    };
  }
}

function parseCommissionPaymentStagesForUpdate(
  value: string,
): UpdateCommissionPaymentStageInput[] | null {
  if (!value || value.length > 100_000) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 50) {
      return null;
    }

    const stages: UpdateCommissionPaymentStageInput[] = [];

    for (const stage of parsed) {
      if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
        return null;
      }

      const record = stage as Record<string, unknown>;

      if (
        typeof record.label !== "string" ||
        typeof record.amount !== "string" ||
        typeof record.trigger !== "string" ||
        (record.id !== undefined &&
          (typeof record.id !== "string" || !UUID_PATTERN.test(record.id))) ||
        (record.customTriggerNote !== undefined &&
          record.customTriggerNote !== null &&
          typeof record.customTriggerNote !== "string")
      ) {
        return null;
      }

      stages.push({
        id: typeof record.id === "string" ? record.id : undefined,
        label: record.label,
        amount: record.amount,
        trigger: record.trigger,
        customTriggerNote:
          typeof record.customTriggerNote === "string"
            ? record.customTriggerNote
            : null,
      });
    }

    return stages;
  } catch {
    return null;
  }
}

export async function updateCommissionPaymentPlanAction(
  _previousState: CommissionPaymentPlanActionState,
  formData: FormData,
): Promise<CommissionPaymentPlanActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const agreementId = getFormValue(formData, "agreementId");

  const expectedAgreementUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedAgreementUpdatedAt"),
  );

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(agreementId)) {
    return {
      outcome: "error",
      message: "The commission or Agreement identifier is invalid.",
    };
  }

  if (!expectedAgreementUpdatedAt) {
    return {
      outcome: "error",
      message: "The Agreement version timestamp is invalid.",
    };
  }

  const stages = parseCommissionPaymentStagesForUpdate(
    getFormValue(formData, "stages"),
  );

  if (!stages) {
    return {
      outcome: "error",
      message: "The payment stages have an invalid structure.",
    };
  }

  try {
    /*
     * Resolve the accepted Quote on the server.
     * The repository will also verify that every existing
     * stage ID belongs to this Commission and Quote.
     */
    const quotes = await getCommissionQuotes(commissionId);

    const acceptedQuotes = quotes.filter(
      ({ quote }) => quote.status === "accepted",
    );

    if (acceptedQuotes.length !== 1) {
      return {
        outcome: "conflict",
        message:
          acceptedQuotes.length === 0
            ? "An accepted Quote is required before editing the payment plan."
            : "More than one accepted Quote was found. Review the Quote history.",
      };
    }

    const result = await updateCommissionPaymentPlan({
      commissionId,
      quoteId: acceptedQuotes[0].quote.id,
      agreementId,
      expectedAgreementUpdatedAt,
      stages,
      updatedByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "updated":
        revalidateCommissionActivityPaths(commissionId);

        return {
          outcome: "success",
          message: "Payment plan updated successfully.",
        };

      case "invalid":
        return {
          outcome: "error",
          message: result.validation.message,
        };

      case "not_found":
        return {
          outcome: "error",
          message: "The Commission or payment plan could not be found.",
        };

      case "wrong_status":
        return {
          outcome: "conflict",
          message: `The payment plan cannot be edited while the commission is ${result.currentStatus}.`,
        };

      case "on_hold":
        return {
          outcome: "conflict",
          message:
            "The payment plan cannot be edited while the commission is on hold.",
        };

      case "quote_not_accepted":
        return {
          outcome: "conflict",
          message: "The Quote is no longer accepted. Refresh the page.",
        };

      case "agreement_not_draft":
        return {
          outcome: "conflict",
          message: "The Agreement is no longer a draft.",
        };

      case "plan_not_found":
        return {
          outcome: "conflict",
          message: "No payment plan exists. Refresh the page.",
        };

      case "plan_locked":
        return {
          outcome: "conflict",
          message:
            "This payment plan can no longer be edited because a payment is linked to it or one of its stages is no longer pending.",
        };

      case "conflict":
        return {
          outcome: "conflict",
          message:
            "The Agreement or payment plan has changed. Refresh the page before saving again.",
        };
    }
  } catch (error) {
    console.error("Failed to update Commission payment plan:", error);

    return {
      outcome: "error",
      message: "The payment plan could not be updated. Please try again.",
    };
  }
}

/**
 * Reuse the creation parser for common structural limits and field types,
 * while retaining optional database IDs on existing deliverables and stages.
 * Ownership, order and lock checks remain authoritative in the repository.
 */
function parseCommissionGroupedPaymentPlanForUpdate(
  value: string,
): CommissionGroupedPaymentPlanEditInput | null {
  const validatedPlan = parseCommissionGroupedPaymentPlan(value);

  if (!validatedPlan) {
    return null;
  }

  try {
    const submittedPlan = JSON.parse(value) as {
      projectStages: Array<{ id?: unknown }>;
      deliverables: Array<{
        id?: unknown;
        stages: Array<{ id?: unknown }>;
      }>;
    };

    const isValidOptionalId = (id: unknown): boolean =>
      id === undefined || (typeof id === "string" && UUID_PATTERN.test(id));

    if (
      submittedPlan.projectStages.some(
        (stage) => !isValidOptionalId(stage.id),
      ) ||
      submittedPlan.deliverables.some(
        (deliverable) =>
          !isValidOptionalId(deliverable.id) ||
          deliverable.stages.some((stage) => !isValidOptionalId(stage.id)),
      )
    ) {
      return null;
    }

    return {
      projectStages: validatedPlan.projectStages.map((stage, index) => ({
        ...stage,
        id: submittedPlan.projectStages[index].id as string | undefined,
      })),
      deliverables: validatedPlan.deliverables.map((deliverable, index) => ({
        ...deliverable,
        id: submittedPlan.deliverables[index].id as string | undefined,
        stages: deliverable.stages.map((stage, stageIndex) => ({
          ...stage,
          id: submittedPlan.deliverables[index].stages[stageIndex].id as
            string | undefined,
        })),
      })),
    };
  } catch {
    return null;
  }
}

export async function updateCommissionGroupedPaymentPlanAction(
  _previousState: CommissionPaymentPlanActionState,
  formData: FormData,
): Promise<CommissionPaymentPlanActionState> {
  const session = await requireAdmin();

  const commissionId = getFormValue(formData, "commissionId");
  const agreementId = getFormValue(formData, "agreementId");
  const expectedAgreementUpdatedAt = parseRequiredDate(
    getFormValue(formData, "expectedAgreementUpdatedAt"),
  );

  if (!UUID_PATTERN.test(commissionId) || !UUID_PATTERN.test(agreementId)) {
    return {
      outcome: "error",
      message: "The commission or Agreement identifier is invalid.",
    };
  }

  if (!expectedAgreementUpdatedAt) {
    return {
      outcome: "error",
      message: "The Agreement version timestamp is invalid.",
    };
  }

  const plan = parseCommissionGroupedPaymentPlanForUpdate(
    getFormValue(formData, "plan"),
  );

  if (!plan) {
    return {
      outcome: "error",
      message:
        "The grouped payment plan has an invalid structure or identifier.",
    };
  }

  try {
    // Resolve the accepted Quote on the server, not from browser input.
    const quotes = await getCommissionQuotes(commissionId);
    const acceptedQuotes = quotes.filter(
      ({ quote }) => quote.status === "accepted",
    );

    if (acceptedQuotes.length !== 1) {
      return {
        outcome: "conflict",
        message:
          acceptedQuotes.length === 0
            ? "An accepted Quote is required before editing the payment plan."
            : "More than one accepted Quote was found. Review the Quote history.",
      };
    }

    const result = await updateCommissionGroupedPaymentPlan({
      commissionId,
      quoteId: acceptedQuotes[0].quote.id,
      agreementId,
      expectedAgreementUpdatedAt,
      plan,
      updatedByAdminUserId: session.user.id,
    });

    switch (result.outcome) {
      case "updated":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "success",
          message: "Grouped payment plan updated successfully.",
        };

      case "invalid":
        return { outcome: "error", message: result.validation.message };

      case "not_found":
        return {
          outcome: "error",
          message: "The Commission or payment plan could not be found.",
        };

      case "wrong_status":
        return {
          outcome: "conflict",
          message: `The payment plan cannot be edited while the commission is ${result.currentStatus}.`,
        };

      case "on_hold":
        return {
          outcome: "conflict",
          message:
            "The payment plan cannot be edited while the commission is on hold.",
        };

      case "quote_not_accepted":
        return {
          outcome: "conflict",
          message: "The Quote is no longer accepted. Refresh the page.",
        };

      case "agreement_not_draft":
        return {
          outcome: "conflict",
          message: "The Agreement is no longer a draft.",
        };

      case "plan_not_found":
        return {
          outcome: "conflict",
          message: "No payment plan exists. Refresh the page.",
        };

      case "plan_locked":
        return {
          outcome: "conflict",
          message:
            "This payment plan can no longer be edited because a payment is linked to it or one of its stages is no longer pending.",
        };

      case "conflict":
        revalidateCommissionActivityPaths(commissionId);
        return {
          outcome: "conflict",
          message:
            "The Agreement or payment plan has changed. Refresh the page before saving again.",
        };
    }
  } catch (error) {
    console.error("Failed to update grouped Commission payment plan:", error);
    return {
      outcome: "error",
      message:
        "The grouped payment plan could not be updated. Please try again.",
    };
  }
}
