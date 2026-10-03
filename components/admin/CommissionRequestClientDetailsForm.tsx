"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  requestCommissionClientDetailsAction,
  type CommissionClientDetailsRequestActionState,
} from "@/app/admin/(protected)/commissions/actions";

interface CommissionRequestClientDetailsFormProps {
  commissionId: string;
  onComplete?: (message: string) => void;
}

const MAX_MESSAGE_LENGTH = 5000;

const initialState: CommissionClientDetailsRequestActionState = {
  outcome: "idle",
  message: null,
};

export default function CommissionRequestClientDetailsForm({
  commissionId,
  onComplete,
}: CommissionRequestClientDetailsFormProps) {
  const [messageText, setMessageText] = useState("");
  const submissionStarted = useRef(false);
  const wasPending = useRef(false);
  const onCompleteRef = useRef(onComplete);

  const [submissionLocked, setSubmissionLocked] = useState(false);

  const [state, formAction, pending] = useActionState(
    requestCommissionClientDetailsAction,
    initialState,
  );

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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
    if (
      (state.outcome === "success" || state.outcome === "warning") &&
      state.message
    ) {
      onCompleteRef.current?.(state.message);
    }
  }, [state.message, state.outcome]);

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
    if (submissionStarted.current) {
      event.preventDefault();
      return;
    }

    submissionStarted.current = true;
    setSubmissionLocked(true);
  }

  const disabled = pending || submissionLocked;

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <input name="commissionId" type="hidden" value={commissionId} />

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <p className="text-sm leading-relaxed text-white/70">
            This message will be sent in the client&apos;s existing project email
            thread. Sending it will move the commission to
            <span className="font-medium text-white"> Awaiting client details</span>.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-white/70">Message to client</span>
            <span className="text-xs text-white/40">
              {messageText.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>

          <textarea
            autoFocus
            className="min-h-44 resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-white/30 focus:border-white/30"
            disabled={disabled}
            maxLength={MAX_MESSAGE_LENGTH}
            name="messageText"
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="For example: Could you send me the final trim size, approximate page count, and any visual references you would like me to consider?"
            required
            value={messageText}
          />
        </label>
      </div>

      {state.message &&
        state.outcome !== "success" &&
        state.outcome !== "warning" && (
          <p
            aria-live="polite"
            className={`mt-4 text-sm ${
              state.outcome === "conflict"
                ? "text-amber-300"
                : "text-red-300"
            }`}
          >
            {state.message}
          </p>
        )}

      <button
        className="mt-5 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || !messageText.trim()}
        type="submit"
      >
        {disabled ? "Sending..." : "Send request"}
      </button>
    </form>
  );
}
