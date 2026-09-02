"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  changeCommissionHoldAction,
  type CommissionActivityActionState,
} from "@/app/admin/(protected)/commissions/actions";
import {
  COMMISSION_MANUAL_ACTORS,
  MAX_COMMISSION_ACTIVITY_TEXT_LENGTH,
} from "@/lib/commissions/commissionActivity";
import { isTerminalCommissionStatus } from "@/lib/commissions/commissionWorkflow";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

interface CommissionHoldFormProps {
  commissionId: string;
  currentStatus: CommissionStatus;
  isOnHold: boolean;
}

const initialState: CommissionActivityActionState = {
  outcome: "idle",
  message: null,
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CommissionHoldForm({
  commissionId,
  currentStatus,
  isOnHold,
}: CommissionHoldFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submissionStarted = useRef(false);
  const wasPending = useRef(false);

  const [submissionLocked, setSubmissionLocked] = useState(false);

  const [state, formAction, pending] = useActionState(
    changeCommissionHoldAction,
    initialState,
  );

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
      formRef.current?.reset();
    }
  }, [state.outcome]);

  if (isTerminalCommissionStatus(currentStatus)) {
    return null;
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
    if (submissionStarted.current) {
      event.preventDefault();
      return;
    }

    submissionStarted.current = true;
    setSubmissionLocked(true);
  }

  const submitting = pending || submissionLocked;
  const actionLabel = isOnHold ? "Resume commission" : "Pause commission";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 border-t border-white/10 pt-6"
      onSubmit={handleSubmit}
    >
      <input name="commissionId" type="hidden" value={commissionId} />
      <input name="expectedStatus" type="hidden" value={currentStatus} />
      <input
        name="holdAction"
        type="hidden"
        value={isOnHold ? "resume" : "pause"}
      />

      <div className="mb-5">
        <h3 className="font-medium text-white">{actionLabel}</h3>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          {isOnHold
            ? "Resume this commission when work or client communication can continue."
            : "Temporarily stop workflow progress without changing the current status."}
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-white/70">Initiated by</span>
          <select
            className="w-full rounded-xl border border-white/15 bg-[#5966A5]/80 px-4 py-3 text-sm text-white outline-none"
            defaultValue="artist"
            name="actor"
          >
            {COMMISSION_MANUAL_ACTORS.map((actor) => (
              <option key={actor} value={actor}>
                {humanize(actor)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-white/70">
            {isOnHold ? "Resume note (optional)" : "Hold reason"}
          </span>
          <textarea
            className="min-h-24 resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none"
            maxLength={MAX_COMMISSION_ACTIVITY_TEXT_LENGTH}
            name="description"
            required={!isOnHold}
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
        className={`mt-5 w-full rounded-xl border px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
          isOnHold
            ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-50 hover:bg-emerald-200/15"
            : "border-amber-200/20 bg-amber-200/10 text-amber-50 hover:bg-amber-200/15"
        }`}
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Updating..." : actionLabel}
      </button>
    </form>
  );
}
