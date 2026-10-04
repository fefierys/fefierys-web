"use client";

import {
  useActionState,
} from "react";

import {
  COMMISSION_AGREEMENT_ACCEPTANCE_STATEMENT,
  COMMISSION_AGREEMENT_ACCEPTANCE_STATEMENT_VERSION,
} from "@/lib/legal/commissionAgreementAcceptance";

import {
  acceptPublicAgreementAction,
  type PublicAgreementActionState,
} from "./actions";

interface AgreementAcceptanceFormProps {
  token: string;
  termsVersion: string;
}

const initialActionState:
  PublicAgreementActionState = {
    outcome:
      "idle",

    message:
      null,

    field:
      null,

    acceptedByName:
      "",
  };

export default function AgreementAcceptanceForm({
  token,
  termsVersion,
}: AgreementAcceptanceFormProps) {
  const boundAction =
    acceptPublicAgreementAction.bind(
      null,
      token,
    );

  const [
    state,
    formAction,
    pending,
  ] =
    useActionState(
      boundAction,
      initialActionState,
    );

  const nameError =
    state.outcome ===
      "error" &&
    state.field ===
      "acceptedByName"
      ? state.message
      : null;

  const confirmationError =
    state.outcome ===
      "error" &&
    state.field ===
      "acceptanceConfirmed"
      ? state.message
      : null;

  const generalError =
    state.outcome ===
      "error" &&
    state.field ===
      null
      ? state.message
      : null;

  return (
    <section className="glass-card p-5 sm:p-7">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.12em] text-white/40">
          Electronic acceptance
        </p>

        <h2 className="mt-2 text-xl font-medium text-white">
          Accept your Commission Agreement
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Review the complete Agreement PDF before continuing.
          If anything needs to be corrected or clarified, reply
          to the project email before accepting.
        </p>
      </div>

      {generalError && (
        <p
          className="mt-5 rounded-xl border border-red-200/20 bg-red-200/10 px-4 py-3 text-sm leading-relaxed text-red-100"
          role="alert"
        >
          {generalError}
        </p>
      )}

      <form
        action={
          formAction
        }
        className="mt-6 space-y-6"
      >
        <div>
          <label
            className="block text-sm font-medium text-white"
            htmlFor="agreement-accepted-by-name"
          >
            Full name
          </label>

          <p
            className="mt-1 text-xs leading-relaxed text-white/45"
            id="agreement-name-help"
          >
            Enter your full name. This name will be recorded as
            your electronic signature.
          </p>

          <input
            aria-describedby={
              nameError
                ? "agreement-name-help agreement-name-error"
                : "agreement-name-help"
            }
            aria-invalid={
              nameError
                ? true
                : undefined
            }
            autoComplete="name"
            className="mt-3 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/30 focus:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            defaultValue={
              state.acceptedByName
            }
            disabled={
              pending
            }
            id="agreement-accepted-by-name"
            maxLength={
              200
            }
            name="acceptedByName"
            placeholder="Your full name"
            required
            type="text"
          />

          {nameError && (
            <p
              className="mt-2 text-sm text-red-100"
              id="agreement-name-error"
              role="alert"
            >
              {nameError}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs uppercase tracking-[0.12em] text-white/40">
              Acceptance statement
            </p>

            <p className="text-xs text-white/35">
              Statement v
              {
                COMMISSION_AGREEMENT_ACCEPTANCE_STATEMENT_VERSION
              }
            </p>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-white/70">
            {
              COMMISSION_AGREEMENT_ACCEPTANCE_STATEMENT
            }
          </p>

          <p className="mt-4 text-xs leading-relaxed text-white/40">
            Applicable Terms of Service version:{" "}
            <span className="text-white/60">
              {
                termsVersion
              }
            </span>
          </p>
        </div>

        <div>
          <label
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]"
            htmlFor="agreement-acceptance-confirmed"
          >
            <input
              aria-describedby={
                confirmationError
                  ? "agreement-confirmation-error"
                  : undefined
              }
              aria-invalid={
                confirmationError
                  ? true
                  : undefined
              }
              className="mt-0.5 h-4 w-4 shrink-0 accent-white"
              disabled={
                pending
              }
              id="agreement-acceptance-confirmed"
              name="acceptanceConfirmed"
              required
              type="checkbox"
            />

            <span className="text-sm leading-relaxed text-white/70">
              I confirm the acceptance statement above and
              electronically accept this Commission Agreement
              and the applicable Fefierys Terms of Service.
            </span>
          </label>

          {confirmationError && (
            <p
              className="mt-2 text-sm text-red-100"
              id="agreement-confirmation-error"
              role="alert"
            >
              {
                confirmationError
              }
            </p>
          )}
        </div>

        <div className="border-t border-white/10 pt-5">
          <button
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            disabled={
              pending
            }
            type="submit"
          >
            {
              pending
                ? "Recording acceptance..."
                : "Accept Agreement"
            }
          </button>

          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-white/35">
            After acceptance, your name, the Client email
            associated with this commission, the acceptance
            timestamp and the acceptance statement version will
            be recorded with the executed Agreement.
          </p>
        </div>
      </form>
    </section>
  );
}