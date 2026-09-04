"use client";

import { useCallback, useMemo, useState } from "react";

import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import {
  formatCommissionQuoteAmount,
  parseCommissionQuoteAmount,
} from "@/lib/commissions/commissionQuote";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";
import type { CommissionQuoteWithItems } from "@/lib/repositories/commissionQuoteRepository";

import CommissionAdminModal from "./CommissionAdminModal";
import CommissionAdminToast from "./CommissionAdminToast";
import CommissionQuoteEditor from "./CommissionQuoteEditor";

interface CommissionQuotePanelProps {
  commissionId: string;
  commissionStatus: CommissionStatus;
  quotes: CommissionQuoteWithItems[];
}

type ModalMode = "create" | "edit" | "view" | null;

const QUOTE_STATUS_STYLES = {
  draft: "border-sky-200/20 bg-sky-200/10 text-sky-100",
  sent: "border-amber-200/20 bg-amber-200/10 text-amber-100",
  accepted: "border-emerald-200/20 bg-emerald-200/10 text-emerald-100",
  declined: "border-red-200/20 bg-red-200/10 text-red-100",
  expired: "border-white/15 bg-white/5 text-white/65",
  superseded: "border-violet-200/20 bg-violet-200/10 text-violet-100",
} as const;

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLineAmount(quantity: number, unitAmount: string): string {
  const minorUnits = parseCommissionQuoteAmount(unitAmount);

  if (minorUnits === null) {
    return "—";
  }

  return formatCommissionQuoteAmount(minorUnits * BigInt(quantity));
}

function QuoteStatusBadge({
  status,
}: {
  status: CommissionQuoteWithItems["quote"]["status"];
}) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[0.7rem] ${QUOTE_STATUS_STYLES[status]}`}
    >
      {humanize(status)}
    </span>
  );
}

export default function CommissionQuotePanel({
  commissionId,
  commissionStatus,
  quotes,
}: CommissionQuotePanelProps) {
  const [mode, setMode] = useState<ModalMode>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const activeQuote =
    quotes.find(
      ({ quote }) => quote.status === "draft" || quote.status === "sent",
    ) ??
    quotes[0] ??
    null;

  const draft = quotes.find(({ quote }) => quote.status === "draft") ?? null;

  const selectedQuote = useMemo(
    () =>
      quotes.find(({ quote }) => quote.id === selectedQuoteId) ?? activeQuote,
    [activeQuote, quotes, selectedQuoteId],
  );

  const closeModal = useCallback(() => setMode(null), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const handleEditorSuccess = useCallback((message: string) => {
    setMode(null);
    setToast(message);
  }, []);

  function openQuote(quoteId: string): void {
    setSelectedQuoteId(quoteId);
    setMode("view");
  }

  function openEditor(): void {
    if (draft) {
      setSelectedQuoteId(draft.quote.id);
      setMode("edit");
      return;
    }

    setSelectedQuoteId(null);
    setMode("create");
  }

  const modalTitle =
    mode === "create"
      ? "Create quote draft"
      : mode === "edit"
        ? `Edit quote v${draft?.quote.version ?? ""}`
        : selectedQuote
          ? `Quote v${selectedQuote.quote.version}`
          : "Quote";

  return (
    <>
      <section className="glass-card min-w-0 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-light">Quotes</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/50">
              Estimates and client responses
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/55">
            {quotes.length}
          </span>
        </div>

        {activeQuote ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">
                Quote v{activeQuote.quote.version}
              </h3>
              <QuoteStatusBadge status={activeQuote.quote.status} />
            </div>
            <p className="mt-3 text-xl font-medium text-white">
              {activeQuote.quote.totalAmount} {activeQuote.quote.currency}
            </p>
            <p className="mt-2 text-xs text-white/50">
              Valid until {formatCommissionDate(activeQuote.quote.validUntil)}
            </p>
            <button
              className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm transition hover:bg-white/15"
              onClick={() => openQuote(activeQuote.quote.id)}
              type="button"
            >
              Open quote
            </button>
          </div>
        ) : commissionStatus === "quoting" ? (
          <button
            className="mt-5 w-full rounded-xl border border-sky-200/25 bg-sky-200/10 px-4 py-3 text-sm text-sky-50 transition hover:bg-sky-200/15"
            onClick={openEditor}
            type="button"
          >
            Create quote
          </button>
        ) : (
          <p className="mt-5 text-sm leading-relaxed text-white/55">
            Move the commission to Quoting to create its first quote.
          </p>
        )}

        {quotes.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="text-sm font-medium text-white/80">
              Version history
            </h3>
            <div className="mt-3 max-h-[15rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
              {quotes.map(({ quote }) => (
                <button
                  className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:bg-white/[0.08]"
                  key={quote.id}
                  onClick={() => openQuote(quote.id)}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/85">
                      Quote v{quote.version}
                    </span>
                    <span className="mt-1 block text-xs text-white/45">
                      {humanize(quote.status)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-white/65">
                    {quote.totalAmount}
                    <span className="ml-1 text-white/40">{quote.currency}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <CommissionAdminModal
        description={
          mode === "view"
            ? "Review this version and its recorded values."
            : "Add services, extras, discounts, validity, and internal notes."
        }
        onClose={closeModal}
        open={mode !== null}
        title={modalTitle}
      >
        {(mode === "create" || mode === "edit") && (
          <CommissionQuoteEditor
            commissionId={commissionId}
            draft={mode === "edit" ? draft : null}
            onCancel={closeModal}
            onSuccess={handleEditorSuccess}
          />
        )}

        {mode === "view" && selectedQuote && (
          <div className="min-w-0">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-medium">
                    Quote v{selectedQuote.quote.version}
                  </h3>
                  <QuoteStatusBadge status={selectedQuote.quote.status} />
                </div>
                <p className="mt-2 text-sm text-white/55">
                  Updated {formatCommissionDate(selectedQuote.quote.updatedAt)}
                </p>
              </div>
              <p className="text-2xl font-medium text-white">
                {selectedQuote.quote.totalAmount} {selectedQuote.quote.currency}
              </p>
            </div>

            {selectedQuote.quote.description && (
              <div className="mt-5">
                <h4 className="text-xs uppercase tracking-[0.12em] text-white/45">
                  Description
                </h4>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                  {selectedQuote.quote.description}
                </p>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {selectedQuote.items.map((item) => (
                <article
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  key={item.id}
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h4 className="break-words font-medium text-white/85">
                        {item.label}
                      </h4>
                      <p className="mt-1 text-xs text-white/45">
                        {item.quantity} × {item.unitAmount}{" "}
                        {selectedQuote.quote.currency}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm text-white/80">
                      {formatLineAmount(item.quantity, item.unitAmount)}{" "}
                      {selectedQuote.quote.currency}
                    </p>
                  </div>
                  {item.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-white/60">
                      {item.description}
                    </p>
                  )}
                </article>
              ))}
            </div>

            <dl className="mt-5 grid gap-4 rounded-2xl border border-white/10 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
                  Valid until
                </dt>
                <dd className="mt-1 text-white/70">
                  {formatCommissionDate(selectedQuote.quote.validUntil)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.1em] text-white/40">
                  Sent
                </dt>
                <dd className="mt-1 text-white/70">
                  {formatCommissionDate(selectedQuote.quote.sentAt)}
                </dd>
              </div>
            </dl>

            {selectedQuote.quote.notes && (
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <h4 className="text-xs uppercase tracking-[0.12em] text-white/40">
                  Internal notes
                </h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-white/65">
                  {selectedQuote.quote.notes}
                </p>
              </div>
            )}

            <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col-reverse gap-3 border-t border-white/10 bg-[#7880b2]/90 px-5 pb-1 pt-4 backdrop-blur-xl sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0">
              <button
                className="rounded-xl border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                onClick={closeModal}
                type="button"
              >
                Close
              </button>
              {selectedQuote.quote.status === "draft" && (
                <button
                  className="rounded-xl border border-sky-200/25 bg-sky-200/15 px-5 py-3 text-sm text-sky-50 transition hover:bg-sky-200/20"
                  onClick={() => {
                    setSelectedQuoteId(selectedQuote.quote.id);
                    setMode("edit");
                  }}
                  type="button"
                >
                  Edit draft
                </button>
              )}
            </div>
          </div>
        )}
      </CommissionAdminModal>

      <CommissionAdminToast message={toast} onDismiss={dismissToast} />
    </>
  );
}
