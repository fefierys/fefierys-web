"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  expireCommissionQuoteAction,
  type CommissionQuoteActionState,
} from "@/app/admin/(protected)/commissions/actions";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import type { CommissionQuoteWithItems } from "@/lib/repositories/commissionQuoteRepository";

interface CommissionQuoteExpireConfirmProps {
  commissionId: string;
  onBack: () => void;
  onSuccess: (message: string) => void;
  quote: CommissionQuoteWithItems;
}

const initialActionState: CommissionQuoteActionState = {
  message: null,
  outcome: "idle",
};

export default function CommissionQuoteExpireConfirm({
  commissionId,
  onBack,
  onSuccess,
  quote,
}: CommissionQuoteExpireConfirmProps) {
  const [footerRoot, setFooterRoot] = useState<HTMLElement | null>(null);
  const [state, formAction, pending] = useActionState(
    expireCommissionQuoteAction,
    initialActionState,
  );

  const formId = `commission-quote-expire-form-${quote.quote.id}`;
  const validUntil = quote.quote.validUntil;
  const [canExpire, setCanExpire] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFooterRoot(
        document.getElementById("commission-admin-modal-footer-root"),
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
        const isPastDue =
        validUntil instanceof Date &&
        !Number.isNaN(validUntil.getTime()) &&
        validUntil.getTime() <= Date.now();

        setCanExpire(isPastDue);
  });

    return () => {
        window.cancelAnimationFrame(frame);
    };
    }, [validUntil]);

  useEffect(() => {
    if (state.outcome === "success" && state.message) {
      onSuccess(state.message);
    }
  }, [onSuccess, state.message, state.outcome]);

  const error = state.outcome === "success" ? null : state.message;

  return (
    <form action={formAction} className="min-w-0" id={formId}>
      <input name="commissionId" type="hidden" value={commissionId} />
      <input name="quoteId" type="hidden" value={quote.quote.id} />
      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={quote.quote.updatedAt.toISOString()}
      />

      {error && (
        <p className="mb-5 rounded-xl border border-red-200/20 bg-red-200/10 px-3 py-2.5 text-sm text-red-100">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <p className="text-xs uppercase tracking-[0.12em] text-white/45">
          Quote expiration
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">
              Quote v{quote.quote.version}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              This action records that the client did not accept the quote
              within its validity period.
            </p>
          </div>

          <p className="shrink-0 text-xl font-medium text-white">
            {quote.quote.totalAmount} {quote.quote.currency}
          </p>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-white/10 pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
              Current status
            </dt>
            <dd className="mt-1 text-white/75">Sent</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
              Valid until
            </dt>
            <dd className="mt-1 text-white/75">
              {formatCommissionDate(validUntil)}
            </dd>
          </div>
        </dl>
      </section>

      {!canExpire && (
        <section className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/[0.08] p-4">
          <h4 className="text-sm font-medium text-amber-50">
            This quote is still valid
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-amber-50/75">
            Expiration can only be recorded after the quote&apos;s validity
            date has passed. The backend enforces the same rule.
          </p>
        </section>
      )}

      {canExpire && (
        <section className="mt-5 rounded-2xl border border-red-200/15 bg-red-200/[0.07] p-4">
          <h4 className="text-sm font-medium text-red-50">
            What will happen?
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-red-50/75">
            Quote v{quote.quote.version} will be marked as expired and the
            commission will be closed as Expired. This is a terminal workflow
            outcome for this commission.
          </p>
        </section>
      )}

      <label className="mt-5 block text-sm text-white/70">
        Expiration note (optional)
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
          disabled={pending || !canExpire}
          maxLength={5000}
          name="note"
          placeholder="Example: Quote validity period ended without client acceptance."
        />
      </label>

      {footerRoot
        ? createPortal(
            <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-[#7880b2] px-5 py-4 sm:flex-row sm:justify-end sm:px-7 sm:py-5">
              <button
                className="rounded-xl border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                disabled={pending}
                onClick={onBack}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-xl border border-red-200/25 bg-red-200/10 px-5 py-3 text-sm text-red-50 transition hover:bg-red-200/15 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={pending || !canExpire}
                form={formId}
                type="submit"
              >
                {pending ? "Expiring quote..." : "Expire quote"}
              </button>
            </div>,
            footerRoot,
          )
        : null}
    </form>
  );
}
