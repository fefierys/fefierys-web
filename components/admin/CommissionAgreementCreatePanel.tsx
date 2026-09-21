"use client";

import { useActionState, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  createCommissionAgreementDraftAction,
  type CommissionAgreementCreateActionState,
} from "@/app/admin/(protected)/commissions/actions";

interface CommissionAgreementCreatePanelProps {
  commissionId: string;
  isOnHold: boolean;
}

const INITIAL_STATE: CommissionAgreementCreateActionState = {
  outcome: "idle",
  message: null,
};

export default function CommissionAgreementCreatePanel({
  commissionId,
  isOnHold,
}: CommissionAgreementCreatePanelProps) {
  const router = useRouter();

  const runCreateAction = useCallback(
    async (
      previousState: CommissionAgreementCreateActionState,
      formData: FormData,
    ): Promise<CommissionAgreementCreateActionState> => {
      const result = await createCommissionAgreementDraftAction(
        previousState,
        formData,
      );

      if (result.outcome === "success") {
        router.refresh();
      }

      return result;
    },
    [router],
  );

  const [state, formAction, pending] = useActionState(
    runCreateAction,
    INITIAL_STATE,
  );

  return (
    <section className="glass-card p-6">
      <h2 className="text-xl font-light">Commission Agreement</h2>

      <p className="mt-4 text-sm leading-relaxed text-white/60">
        Create an Agreement draft using the accepted Quote.
        You can complete the project details and payment plan
        before presenting the Agreement to the client.
      </p>

      <form action={formAction} className="mt-5">
        <input
          name="commissionId"
          type="hidden"
          value={commissionId}
        />

        <button
          className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending || isOnHold}
          type="submit"
        >
          {pending ? "Creating..." : "Create Agreement draft"}
        </button>
      </form>

      {isOnHold && (
        <p className="mt-3 text-xs text-amber-100/80">
          Remove the commission hold before creating an Agreement.
        </p>
      )}

      {state.outcome !== "idle" && (
        <p
          className={`mt-3 text-sm ${
            state.outcome === "success"
              ? "text-emerald-100"
              : "text-rose-200"
          }`}
          role={state.outcome === "success" ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
    </section>
  );
}