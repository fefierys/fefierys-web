"use client";

import {
  useActionState,
  useEffect,
  useState,
} from "react";
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

const initialActionState:
  CommissionQuoteActionState = {
    message: null,
    outcome: "idle",
  };

export default function CommissionQuoteSendConfirm({
  commissionId,
  onBack,
  onSuccess,
  quote,
}: CommissionQuoteSendConfirmProps) {
  const [
    footerRoot,
    setFooterRoot,
  ] = useState<HTMLElement | null>(
    null,
  );

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    sendCommissionQuoteAction,
    initialActionState,
  );

  const formId =
    `commission-quote-send-form-${quote.quote.id}`;

  const success =
    state.outcome === "success";

  useEffect(() => {
    const frame =
      window.requestAnimationFrame(
        () => {
          setFooterRoot(
            document.getElementById(
              "commission-admin-modal-footer-root",
            ),
          );
        },
      );

    return () => {
      window.cancelAnimationFrame(
        frame,
      );
    };
  }, []);

  const error =
    success
      ? null
      : state.message;

  function handleCloseSuccess() {
    onSuccess(
      `Quote v${quote.quote.version} sent and emailed successfully.`,
    );
  }

  return (
    <form
      action={formAction}
      className="min-w-0"
      id={formId}
    >
      <input
        name="commissionId"
        type="hidden"
        value={commissionId}
      />

      <input
        name="quoteId"
        type="hidden"
        value={quote.quote.id}
      />

      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={
          quote.quote.updatedAt.toISOString()
        }
      />

      {success ? (
        <section className="rounded-2xl border border-emerald-200/15 bg-emerald-200/[0.06] p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-200/10 text-lg text-emerald-100">
              ✓
            </div>

            <div className="min-w-0">
              <h3 className="text-lg font-medium text-white">
                Quote sent successfully
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Quote v
                {quote.quote.version} was
                emailed to the client with a
                secure link to review and
                respond.
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-black/5 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
                Client notified
              </dt>

              <dd className="mt-1.5 font-medium text-white/80">
                Yes
              </dd>
            </div>

            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
                Commission status
              </dt>

              <dd className="mt-1.5 font-medium text-white/80">
                Awaiting quote response
              </dd>
            </div>

            <div>
              <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
                Quote
              </dt>

              <dd className="mt-1.5 font-medium text-white/80">
                v{quote.quote.version}
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <>
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
                  Quote v
                  {quote.quote.version}
                </h3>

                <p className="mt-1 text-sm text-white/55">
                  Valid until{" "}
                  {formatCommissionDate(
                    quote.quote.validUntil,
                  )}
                </p>
              </div>

              <p className="text-2xl font-medium text-white">
                {quote.quote.totalAmount}{" "}
                {quote.quote.currency}
              </p>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-xs uppercase tracking-[0.12em] text-white/45">
                Included items
              </p>

              <div className="mt-3 space-y-2">
                {quote.items.map(
                  (item) => (
                    <div
                      className="flex min-w-0 items-start justify-between gap-4 text-sm"
                      key={item.id}
                    >
                      <div className="min-w-0">
                        <p className="break-words text-white/80">
                          {item.label}
                        </p>

                        <p className="mt-0.5 text-xs text-white/40">
                          {item.quantity} ×{" "}
                          {item.unitAmount}{" "}
                          {
                            quote.quote
                              .currency
                          }
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>

          <div className="mt-5 rounded-2xl border border-sky-200/15 bg-sky-200/[0.07] p-4 text-sm leading-relaxed text-sky-50/85">
            <p className="font-medium text-sky-50">
              What happens next?
            </p>

            <p className="mt-1.5">
              The client will receive an
              email with a secure link to
              review and respond to this
              quote. Once sent, the
              commission will move to{" "}
              <strong className="font-medium">
                Awaiting quote response
              </strong>
              .
            </p>
          </div>
        </>
      )}

      {footerRoot
        ? createPortal(
            success ? (
              <div className="flex justify-end border-t border-white/10 bg-[#7880b2] px-5 py-4 sm:px-7 sm:py-5">
                <button
                  className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm text-white transition hover:bg-white/15"
                  onClick={
                    handleCloseSuccess
                  }
                  type="button"
                >
                  Close
                </button>
              </div>
            ) : (
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
                  {pending
                    ? "Sending..."
                    : "Send quote"}
                </button>
              </div>
            ),
            footerRoot,
          )
        : null}
    </form>
  );
}