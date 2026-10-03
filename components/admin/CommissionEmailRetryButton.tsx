"use client";

import {
  useActionState,
} from "react";

import {
  retryCommissionEmailMessageAction,
  type CommissionEmailRetryActionState,
} from "@/app/admin/(protected)/commissions/actions";

interface CommissionEmailRetryButtonProps {
  commissionId: string;
  messageId: string;
}

const initialState: CommissionEmailRetryActionState = {
  outcome: "idle",
  message: null,
};

export default function CommissionEmailRetryButton({
  commissionId,
  messageId,
}: CommissionEmailRetryButtonProps) {
  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    retryCommissionEmailMessageAction,
    initialState,
  );

  const feedbackClasses =
    state.outcome ===
    "success"
      ? "text-emerald-200"
      : state.outcome ===
          "warning"
        ? "text-amber-200"
        : "text-red-200";

  return (
    <div className="mt-2 flex flex-col items-end gap-1.5">
      <form
        action={
          formAction
        }
      >
        <input
          name="commissionId"
          type="hidden"
          value={
            commissionId
          }
        />

        <input
          name="messageId"
          type="hidden"
          value={
            messageId
          }
        />

        <button
          className="rounded-lg border border-red-300/20 bg-red-300/[0.08] px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            pending
          }
          type="submit"
        >
          {pending
            ? "Retrying..."
            : "Retry email"}
        </button>
      </form>

      {state.outcome !==
        "idle" &&
        state.message && (
          <p
            className={`max-w-xs text-right text-[11px] leading-relaxed ${feedbackClasses}`}
          >
            {
              state.message
            }
          </p>
        )}
    </div>
  );
}