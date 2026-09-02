"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  addCommissionNoteAction,
  type CommissionActivityActionState,
} from "@/app/admin/(protected)/commissions/actions";
import {
  COMMISSION_MANUAL_ACTORS,
  MAX_COMMISSION_ACTIVITY_TEXT_LENGTH,
} from "@/lib/commissions/commissionActivity";

interface CommissionNoteFormProps {
  commissionId: string;
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

export default function CommissionNoteForm({
  commissionId,
}: CommissionNoteFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submissionStarted = useRef(false);
  const wasPending = useRef(false);

  const [submissionLocked, setSubmissionLocked] = useState(false);

  const [state, formAction, pending] = useActionState(
    addCommissionNoteAction,
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
  }, [state]);

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
    if (submissionStarted.current) {
      event.preventDefault();
      return;
    }

    submissionStarted.current = true;
    setSubmissionLocked(true);
  }

  const submitting = pending || submissionLocked;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
      onSubmit={handleSubmit}
    >
      <input name="commissionId" type="hidden" value={commissionId} />
      <h3 className="font-medium">Add note</h3>

      <p className="mt-1 text-xs leading-relaxed text-white/50">
        Notes are private administrative timeline entries.
      </p>

      <div className="mt-4 space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-white/70">Source</span>
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
          <span className="text-sm text-white/70">Note</span>
          <textarea
            className="min-h-28 resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none"
            maxLength={MAX_COMMISSION_ACTIVITY_TEXT_LENGTH}
            name="description"
            required
          />
        </label>
      </div>

      {state.message && (
        <p
          aria-live="polite"
          className={`mt-4 text-sm ${
            state.outcome === "success" ? "text-emerald-300" : "text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Adding..." : "Add note"}
      </button>
    </form>
  );
}
