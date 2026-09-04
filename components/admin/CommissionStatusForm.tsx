"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  updateCommissionStatusAction,
  type CommissionStatusActionState,
} from "@/app/admin/(protected)/commissions/actions";
import {
  COMMISSION_ACTORS,
  getAllowedCommissionActors,
  getAllowedCommissionCloseReasons,
  getAllowedCommissionTransitions,
  isCommissionActor,
  isCommissionCloseReason,
  isTerminalCommissionStatus,
  type CommissionActor,
  type CommissionCloseReason,
} from "@/lib/commissions/commissionWorkflow";
import {
  COMMISSION_STATUS_LABELS,
  isCommissionStatus,
} from "@/lib/commissions/commissionStatus";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

import CommissionTransitionConfirmDialog from "@/components/admin/CommissionTransitionConfirmDialog";
import CommissionSelect from "./CommissionSelect";

interface CommissionStatusFormProps {
  commissionId: string;
  currentStatus: CommissionStatus;
  isOnHold?: boolean;
  availableStatuses?: readonly CommissionStatus[];
  initialStatus?: CommissionStatus;
  onSuccess?: () => void;
  variant?: "panel" | "dialog";
  confirmationVariant?: "dialog" | "inline";
}

const initialState: CommissionStatusActionState = {
  outcome: "idle",
  message: null,
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CommissionStatusForm({
  commissionId,
  currentStatus,
  isOnHold = false,
  availableStatuses,
  initialStatus,
  onSuccess,
  variant = "panel",
  confirmationVariant = "dialog",
}: CommissionStatusFormProps) {
  const workflowTransitions = getAllowedCommissionTransitions(currentStatus);

  const holdFilteredTransitions = isOnHold
    ? workflowTransitions.filter(isTerminalCommissionStatus)
    : workflowTransitions;

  const allowedTransitions = availableStatuses
    ? holdFilteredTransitions.filter((status) =>
        availableStatuses.includes(status),
      )
    : holdFilteredTransitions;

  const initialToStatus =
    initialStatus && allowedTransitions.includes(initialStatus)
      ? initialStatus
      : (allowedTransitions[0] ?? currentStatus);

  const initialCloseReasons = getAllowedCommissionCloseReasons(
    currentStatus,
    initialToStatus,
  );

  const initialCloseReason = initialCloseReasons[0] ?? "";

  const initialActors = getAllowedCommissionActors(initialCloseReason || null);

  const [toStatus, setToStatus] = useState<CommissionStatus>(initialToStatus);

  const [closeReason, setCloseReason] = useState<CommissionCloseReason | "">(
    initialCloseReason,
  );

  const [initiatedBy, setInitiatedBy] = useState<CommissionActor>(
    initialActors.includes("artist")
      ? "artist"
      : (initialActors[0] ?? "artist"),
  );

  const formRef = useRef<HTMLFormElement>(null);
  const terminalTransitionConfirmed = useRef(false);
  const submissionStarted = useRef(false);
  const wasPending = useRef(false);
  const onSuccessRef = useRef(onSuccess);

  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  const [state, formAction, pending] = useActionState(
    updateCommissionStatusAction,
    initialState,
  );

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }

    if (wasPending.current) {
      wasPending.current = false;
      submissionStarted.current = false;
      setSubmissionLocked(false);
    }
  }, [pending]);

  useEffect(() => {
    if (state.outcome === "success") {
      onSuccessRef.current?.();
    }
  }, [state.outcome]);

  if (allowedTransitions.length === 0) {
    return (
      <p className="mt-6 border-t border-white/10 pt-5 text-sm text-white/55">
        {isOnHold
          ? "This commission is on hold. Resume it before changing its workflow status."
          : "This commission is closed and has no available transitions."}
      </p>
    );
  }

  const closeReasons = getAllowedCommissionCloseReasons(
    currentStatus,
    toStatus,
  );

  const availableActors = getAllowedCommissionActors(closeReason || null);

  function handleStatusChange(value: string): void {
    if (!isCommissionStatus(value) || !allowedTransitions.includes(value)) {
      return;
    }

    setToStatus(value);

    const nextReasons = getAllowedCommissionCloseReasons(currentStatus, value);

    const nextReason = nextReasons[0] ?? "";

    setCloseReason(nextReason);

    const nextActors = getAllowedCommissionActors(nextReason || null);

    setInitiatedBy(
      nextActors.includes("artist") ? "artist" : (nextActors[0] ?? "artist"),
    );
  }

  function handleCloseReasonChange(value: string): void {
    if (!value) {
      setCloseReason("");
      setInitiatedBy("artist");
      return;
    }

    if (!isCommissionCloseReason(value) || !closeReasons.includes(value)) {
      return;
    }

    setCloseReason(value);

    const nextActors = getAllowedCommissionActors(value);

    setInitiatedBy(
      nextActors.includes("artist") ? "artist" : (nextActors[0] ?? "artist"),
    );
  }

  function handleActorChange(value: string): void {
    if (isCommissionActor(value) && availableActors.includes(value)) {
      setInitiatedBy(value);
    }
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
    if (submissionStarted.current) {
      event.preventDefault();
      return;
    }

    if (
      isTerminalCommissionStatus(toStatus) &&
      !terminalTransitionConfirmed.current
    ) {
      event.preventDefault();
      setConfirmationOpen(true);
      return;
    }

    submissionStarted.current = true;
    setSubmissionLocked(true);
    terminalTransitionConfirmed.current = false;
  }

  function handleConfirmTransition(): void {
    if (submissionStarted.current) {
      return;
    }

    terminalTransitionConfirmed.current = true;
    setConfirmationOpen(false);
    formRef.current?.requestSubmit();
  }

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className={`${variant === "panel" ? "mt-6 border-t border-white/10 pt-6" : ""} ${
          confirmationOpen && confirmationVariant === "inline" ? "hidden" : ""
        }`}
        onSubmit={handleSubmit}
      >
        <input name="commissionId" type="hidden" value={commissionId} />
        <input name="fromStatus" type="hidden" value={currentStatus} />

        {variant === "panel" && (
          <div className="mb-5">
            <h3 className="font-medium text-white">Update Status</h3>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              Change the current status of the commission.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-white/70">Move to</span>
            <CommissionSelect
              disabled={pending || submissionLocked}
              name="toStatus"
              onChange={handleStatusChange}
              options={allowedTransitions.map((status) => ({
                label: COMMISSION_STATUS_LABELS[status],
                value: status,
              }))}
              value={toStatus}
            />
          </div>

          {closeReasons.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-white/70">Close reason</span>
              <CommissionSelect
                disabled={pending || submissionLocked}
                name="closeReason"
                onChange={handleCloseReasonChange}
                options={closeReasons.map((reason) => ({
                  label: humanize(reason),
                  value: reason,
                }))}
                value={closeReason}
              />
            </div>
          )}

          {closeReasons.length === 0 && (
            <input name="closeReason" type="hidden" value="" />
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm text-white/70">Initiated by</span>
            <CommissionSelect
              disabled={pending || submissionLocked}
              name="initiatedBy"
              onChange={handleActorChange}
              options={COMMISSION_ACTORS.filter((actor) =>
                availableActors.includes(actor),
              ).map((actor) => ({
                label: humanize(actor),
                value: actor,
              }))}
              value={initiatedBy}
            />
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-white/70">
              Note
              {closeReason === "other" ? " (required)" : " (optional)"}
            </span>
            <textarea
              className="min-h-28 resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none"
              maxLength={5000}
              name="note"
              required={closeReason === "other"}
            />
          </label>
        </div>

        {state.message && (
          <p
            aria-live="polite"
            className={`mt-4 text-sm ${
              state.outcome === "success"
                ? "text-emerald-300"
                : state.outcome === "conflict"
                  ? "text-amber-300"
                  : "text-red-300"
            }`}
          >
            {state.message}
          </p>
        )}

        <button
          className="mt-5 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || submissionLocked}
          type="submit"
        >
          {pending || submissionLocked ? "Updating..." : "Update status"}
        </button>
      </form>

      {confirmationOpen && confirmationVariant === "inline" && (
        <div className="rounded-2xl border border-amber-100/20 bg-amber-100/[0.08] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10 text-lg text-amber-100">
            !
          </div>
          <h3 className="mt-4 text-xl font-light">Confirm status change</h3>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            This commission will move to{" "}
            <strong className="font-medium text-white">
              {COMMISSION_STATUS_LABELS[toStatus]}
            </strong>
            . Terminal transitions cannot be reversed from the dashboard.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm transition hover:bg-white/10"
              disabled={pending || submissionLocked}
              onClick={() => setConfirmationOpen(false)}
              type="button"
            >
              Go back
            </button>
            <button
              className="rounded-xl border border-rose-200/20 bg-rose-200/15 px-5 py-3 text-sm text-rose-50 transition hover:bg-rose-200/25 disabled:opacity-50"
              disabled={pending || submissionLocked}
              onClick={handleConfirmTransition}
              type="button"
            >
              {pending || submissionLocked
                ? "Updating..."
                : "Confirm transition"}
            </button>
          </div>
        </div>
      )}

      <CommissionTransitionConfirmDialog
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={handleConfirmTransition}
        open={confirmationOpen && confirmationVariant === "dialog"}
        pending={pending || submissionLocked}
        status={toStatus}
      />
    </>
  );
}
