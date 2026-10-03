"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  supersedeCommissionQuoteAction,
  type CommissionQuoteActionState,
} from "@/app/admin/(protected)/commissions/actions";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import type { CommissionQuoteWithItems } from "@/lib/repositories/commissionQuoteRepository";

interface CommissionQuoteRevisionConfirmProps {
  commissionId: string;
  onBack: () => void;
  onSuccess: (message: string) => void;
  quote: CommissionQuoteWithItems;
}

const initialActionState: CommissionQuoteActionState = {
  message: null,
  outcome: "idle",
};

export default function CommissionQuoteRevisionConfirm({
  commissionId,
  onBack,
  onSuccess,
  quote,
}: CommissionQuoteRevisionConfirmProps) {
  const [footerRoot, setFooterRoot] = useState<HTMLElement | null>(null);
  const [state, formAction, pending] = useActionState(
    supersedeCommissionQuoteAction,
    initialActionState,
  );
  const formId = `commission-quote-revision-form-${quote.quote.id}`;
  const nextVersion = quote.quote.version + 1;

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
          Revision
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">
              Quote v{quote.quote.version} → draft v{nextVersion}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              The current sent quote will remain in history as superseded.
            </p>
          </div>

          <p className="shrink-0 text-xl font-medium text-white">
            {quote.quote.totalAmount} {quote.quote.currency}
          </p>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-white/10 pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
              Current quote
            </dt>
            <dd className="mt-1 text-white/75">
              v{quote.quote.version} · Sent
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
              Valid until
            </dt>
            <dd className="mt-1 text-white/75">
              {formatCommissionDate(quote.quote.validUntil)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-5 rounded-2xl border border-violet-200/15 bg-violet-200/[0.07] p-4">
        <h4 className="text-sm font-medium text-violet-50">
          What will happen?
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-violet-50/75">
          Quote v{quote.quote.version} will become superseded, the commission
          will return to Quoting, and draft quote v{nextVersion} will be
          created from the current quote so you can edit the requested changes.
        </p>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-white/70">
          Revision requested by
          <select
            className="mt-2 w-full rounded-xl border border-white/15 bg-[#6f78aa] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/30"
            defaultValue="client"
            disabled={pending}
            name="initiatedBy"
          >
            <option value="client">Client</option>
            <option value="artist">Artist</option>
          </select>
        </label>

        <label className="text-sm text-white/70">
          Revision note (optional)
          <textarea
            className="mt-2 min-h-20 w-full resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
            disabled={pending}
            maxLength={5000}
            name="note"
            placeholder="Example: Client asked to remove the pet extra."
          />
        </label>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-white/45">
        Creating the revision does not send anything to the client. After
        editing draft v{nextVersion}, you will send that new version normally.
      </p>

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
                className="rounded-xl border border-violet-200/25 bg-violet-200/15 px-5 py-3 text-sm text-violet-50 transition hover:bg-violet-200/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending}
                form={formId}
                type="submit"
              >
                {pending ? "Creating revision..." : `Create draft v${nextVersion}`}
              </button>
            </div>,
            footerRoot,
          )
        : null}
    </form>
  );
}
