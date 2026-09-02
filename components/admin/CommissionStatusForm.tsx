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

interface CommissionStatusFormProps {
  commissionId: string;
  currentStatus: CommissionStatus;
  availableStatuses?: readonly CommissionStatus[];
  initialStatus?: CommissionStatus;
  onSuccess?: () => void;
  variant?: "panel" | "dialog";
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
  availableStatuses,
  initialStatus,
  onSuccess,
  variant = "panel",
}: CommissionStatusFormProps) {
  const workflowTransitions = getAllowedCommissionTransitions(currentStatus);

  const allowedTransitions = availableStatuses
    ? workflowTransitions.filter((status) => availableStatuses.includes(status))
    : workflowTransitions;

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
        This commission is closed and has no available transitions.
      </p>
    );
  }

  const closeReasons = getAllowedCommissionCloseReasons(
    currentStatus,
    toStatus,
  );

  const availableActors = getAllowedCommissionActors(closeReason || null);

  function handleStatusChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void {
    const value = event.target.value;

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

  function handleCloseReasonChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void {
    const value = event.target.value;

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

  function handleActorChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ): void {
    const value = event.target.value;

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
        className={
          variant === "panel" ? "mt-6 border-t border-white/10 pt-6" : ""
        }
        onSubmit={handleSubmit}
      >
        <input name="commissionId" type="hidden" value={commissionId} />
        <input name="fromStatus" type="hidden" value={currentStatus} />

        <div className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-white/70">Move to</span>
            <select
              className="w-full rounded-xl border border-white/15 bg-[#5966A5]/80 px-4 py-3 text-sm text-white outline-none"
              name="toStatus"
              onChange={handleStatusChange}
              value={toStatus}
            >
              {allowedTransitions.map((status) => (
                <option key={status} value={status}>
                  {COMMISSION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          {closeReasons.length > 0 && (
            <label className="flex flex-col gap-2">
              <span className="text-sm text-white/70">Close reason</span>
              <select
                className="w-full rounded-xl border border-white/15 bg-[#5966A5]/80 px-4 py-3 text-sm text-white outline-none"
                name="closeReason"
                onChange={handleCloseReasonChange}
                required
                value={closeReason}
              >
                {closeReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {humanize(reason)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {closeReasons.length === 0 && (
            <input name="closeReason" type="hidden" value="" />
          )}

          <label className="flex flex-col gap-2">
            <span className="text-sm text-white/70">Initiated by</span>
            <select
              className="w-full rounded-xl border border-white/15 bg-[#5966A5]/80 px-4 py-3 text-sm text-white outline-none"
              name="initiatedBy"
              onChange={handleActorChange}
              value={initiatedBy}
            >
              {COMMISSION_ACTORS.filter((actor) =>
                availableActors.includes(actor),
              ).map((actor) => (
                <option key={actor} value={actor}>
                  {humanize(actor)}
                </option>
              ))}
            </select>
          </label>

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

      <CommissionTransitionConfirmDialog
        onCancel={() => setConfirmationOpen(false)}
        onConfirm={handleConfirmTransition}
        open={confirmationOpen}
        pending={pending || submissionLocked}
        status={toStatus}
      />
    </>
  );
}
