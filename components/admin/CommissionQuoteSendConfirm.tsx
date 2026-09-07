"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  sendCommissionQuoteAction,
  type CommissionQuoteActionState,
} from "@/app/admin/(protected)/commissions/actions";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import type { CommissionQuoteWithItems } from "@/lib/repositories/commissionQuoteRepository";

interface CommissionQuoteSendConfirmProps {
  commissionId: string;
  onBack: () => void;
  onSuccess: (message: string) => void;
  quote: CommissionQuoteWithItems;
}

const initialActionState: CommissionQuoteActionState = {
  message: null,
  outcome: "idle",
};

export default function CommissionQuoteSendConfirm({
  commissionId,
  onBack,
  onSuccess,
  quote,
}: CommissionQuoteSendConfirmProps) {
  const [footerRoot, setFooterRoot] = useState<HTMLElement | null>(null);
  const [state, formAction, pending] = useActionState(
    sendCommissionQuoteAction,
    initialActionState,
  );
  const formId = `commission-quote-send-form-${quote.quote.id}`;

  useEffect(() => {
    setFooterRoot(document.getElementById("commission-admin-modal-footer-root"));
  }, []);

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-white/45">
              Quote to send
            </p>
            <h3 className="mt-1 text-lg font-medium text-white">
              Quote v{quote.quote.version}
            </h3>
            <p className="mt-1 text-sm text-white/55">
              Valid until {formatCommissionDate(quote.quote.validUntil)}
            </p>
          </div>

          <p className="text-2xl font-medium text-white">
            {quote.quote.totalAmount} {quote.quote.currency}
          </p>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="text-xs uppercase tracking-[0.12em] text-white/45">
            Included items
          </p>
          <div className="mt-3 space-y-2">
            {quote.items.map((item) => (
              <div
                className="flex min-w-0 items-start justify-between gap-4 text-sm"
                key={item.id}
              >
                <div className="min-w-0">
                  <p className="break-words text-white/80">{item.label}</p>
                  <p className="mt-0.5 text-xs text-white/40">
                    {item.quantity} × {item.unitAmount} {quote.quote.currency}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-200/[0.07] p-4 text-sm leading-relaxed text-amber-50/85">
        <p className="font-medium text-amber-50">What happens next?</p>
        <p className="mt-1.5">
          This will mark the quote as sent and move the commission to
          <strong className="font-medium"> Awaiting quote response</strong>.
          Client email delivery is not connected yet, so this step currently
          updates the Fefierys workflow only.
        </p>
      </div>

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
                className="rounded-xl border border-sky-200/25 bg-sky-200/15 px-5 py-3 text-sm text-sky-50 transition hover:bg-sky-200/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending}
                form={formId}
                type="submit"
              >
                {pending ? "Sending..." : "Send quote"}
              </button>
            </div>,
            footerRoot,
          )
        : null}
    </form>
  );
}
