"use client";

import {
  useActionState,
  useState,
} from "react";

import {
  presentCommissionAgreementAction,
  type CommissionAgreementPresentActionState,
} from "@/app/admin/(protected)/commissions/actions";

import CommissionAdminModal from "./CommissionAdminModal";

interface CommissionAgreementPresentButtonProps {
  commissionId: string;
  agreementId: string;
  expectedUpdatedAt: string;
}

const INITIAL_STATE:
  CommissionAgreementPresentActionState = {
    outcome: "idle",
    message: null,
  };

export default function CommissionAgreementPresentButton({
  commissionId,
  agreementId,
  expectedUpdatedAt,
}: CommissionAgreementPresentButtonProps) {
  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    presentCommissionAgreementAction,
    INITIAL_STATE,
  );

  const hasError =
    state.outcome ===
      "error" ||
    state.outcome ===
      "conflict";

  return (
    <>
      <button
        className="w-full rounded-xl border border-white/20 bg-white/15 px-4 py-3 text-sm font-medium transition hover:bg-white/20"
        onClick={() =>
          setOpen(true)
        }
        type="button"
      >
        Present Agreement
      </button>

      <CommissionAdminModal
        description="This action freezes the current Agreement as an immutable PDF and presents it to the client by email. After presentation, this Agreement can no longer be edited."
        onClose={() =>
          setOpen(false)
        }
        open={open}
        title="Present Commission Agreement"
      >
        <form
          action={
            formAction
          }
          className="space-y-5"
        >
          <input
            name="commissionId"
            type="hidden"
            value={
              commissionId
            }
          />

          <input
            name="agreementId"
            type="hidden"
            value={
              agreementId
            }
          />

          <input
            name="expectedAgreementUpdatedAt"
            type="hidden"
            value={
              expectedUpdatedAt
            }
          />

          <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-4">
            <p className="text-sm leading-relaxed text-amber-50/80">
              Review the Agreement
              preview and draft PDF
              before continuing.
              Presenting it creates
              the immutable client
              version and disables
              further editing of this
              Agreement revision.
            </p>
          </div>

          {hasError &&
            state.message && (
              <p
                className="text-sm leading-relaxed text-rose-200"
                role="alert"
              >
                {state.message}
              </p>
            )}

          {state.outcome ===
            "warning" &&
            state.message && (
              <p
                className="text-sm leading-relaxed text-amber-100"
                role="status"
              >
                {state.message}
              </p>
            )}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
            <button
              className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              disabled={
                pending
              }
              onClick={() =>
                setOpen(false)
              }
              type="button"
            >
              Cancel
            </button>

            <button
              className="rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
              disabled={
                pending
              }
              type="submit"
            >
              {pending
                ? "Presenting..."
                : "Present Agreement"}
            </button>
          </div>
        </form>
      </CommissionAdminModal>
    </>
  );
}