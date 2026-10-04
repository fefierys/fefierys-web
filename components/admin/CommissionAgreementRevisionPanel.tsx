"use client";

import {
  useActionState,
  useCallback,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  createCommissionAgreementRevisionAction,
  type CommissionAgreementRevisionActionState,
} from "@/app/admin/(protected)/commissions/actions";

import CommissionAdminModal from "./CommissionAdminModal";

interface CommissionAgreementRevisionPanelProps {
  agreementId: string;
  commissionId: string;
  currentVersion: number;
  expectedAgreementUpdatedAt: string;
  isOnHold: boolean;
}

const INITIAL_STATE: CommissionAgreementRevisionActionState = {
  outcome: "idle",
  message: null,
};

export default function CommissionAgreementRevisionPanel({
  agreementId,
  commissionId,
  currentVersion,
  expectedAgreementUpdatedAt,
  isOnHold,
}: CommissionAgreementRevisionPanelProps) {
  const router =
    useRouter();

  const [
    open,
    setOpen,
  ] =
    useState(false);

  const closeModal =
    useCallback(() => {
      setOpen(false);
    }, []);

  const runCreateRevisionAction =
    useCallback(
      async (
        previousState: CommissionAgreementRevisionActionState,
        formData: FormData,
      ): Promise<CommissionAgreementRevisionActionState> => {
        const result =
          await createCommissionAgreementRevisionAction(
            previousState,
            formData,
          );

        if (
          result.outcome ===
          "success"
        ) {
          setOpen(false);
          router.refresh();
        }

        return result;
      },
      [
        router,
      ],
    );

  const [
    state,
    formAction,
    pending,
  ] =
    useActionState(
      runCreateRevisionAction,
      INITIAL_STATE,
    );

  const nextVersion =
    currentVersion +
    1;

  return (
    <>
      <button
        className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isOnHold}
        onClick={() =>
          setOpen(true)
        }
        type="button"
      >
        Create revision
      </button>

      {isOnHold && (
        <p className="mt-3 text-xs text-amber-100/80">
          Remove the commission hold before creating an Agreement revision.
        </p>
      )}

      <CommissionAdminModal
        description={`Create Agreement revision ${nextVersion} from the currently presented revision ${currentVersion}.`}
        onClose={closeModal}
        open={open}
        title="Create Agreement revision"
      >
        <form
          action={formAction}
          className="space-y-6"
        >
          <input
            name="commissionId"
            type="hidden"
            value={commissionId}
          />

          <input
            name="agreementId"
            type="hidden"
            value={agreementId}
          />

          <input
            name="expectedAgreementUpdatedAt"
            type="hidden"
            value={expectedAgreementUpdatedAt}
          />

          <div className="space-y-4 text-sm leading-relaxed text-white/70">
            <p>
              Revision {currentVersion} will remain stored as immutable
              contractual history, but it will be marked as superseded.
            </p>

            <p>
              Its public Agreement link will be revoked immediately, so the
              client will no longer be able to accept that revision.
            </p>

            <p>
              Revision {nextVersion} will be created as a new editable draft
              using the same accepted Quote, Agreement data, template version
              and Terms of Service version.
            </p>

            <p className="text-amber-100">
              This action cannot restore revision {currentVersion} as the
              active Agreement. Continue only if a new revision is actually
              required.
            </p>
          </div>

          {state.outcome ===
            "error" ||
          state.outcome ===
            "conflict" ? (
            <p
              className="text-sm text-rose-200"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
            <button
              className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={pending}
              onClick={closeModal}
              type="button"
            >
              Cancel
            </button>

            <button
              className="rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-sm transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
              disabled={
                pending ||
                isOnHold
              }
              type="submit"
            >
              {pending
                ? "Creating revision..."
                : `Create revision ${nextVersion}`}
            </button>
          </div>
        </form>
      </CommissionAdminModal>
    </>
  );
}
