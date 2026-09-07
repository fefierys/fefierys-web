import Link from "next/link";
import { notFound } from "next/navigation";

import CommissionEventNoteButton from "@/components/admin/CommissionEventNoteButton";
import CommissionClassificationPanel from "@/components/admin/CommissionClassificationPanel";
import CommissionQuotePanel from "@/components/admin/CommissionQuotePanel";
import CommissionStatusBadge from "@/components/admin/CommissionStatusBadge";
import CommissionWorkflowActions from "@/components/admin/CommissionWorkflowActions";
import { requireAdmin } from "@/lib/auth/admin";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import { COMMISSION_STATUS_LABELS } from "@/lib/commissions/commissionStatus";
import type { CommissionQuotePricingEditorConfig } from "@/lib/commissions/commissionQuotePricingEditor";
import { getAdminCommissionDetail } from "@/lib/repositories/commissionAdminRepository";
import {
  getActiveCommissionPricingCatalog,
  getCommissionPricingCatalogByVersion,
} from "@/lib/repositories/commissionPricingRepository";
import { getCommissionQuotes } from "@/lib/repositories/commissionQuoteRepository";

export const dynamic = "force-dynamic";

interface CommissionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayValue(value: string | null): string {
  return value?.trim() || "Not provided";
}

function displayRequestedValue(value: string | null): string {
  const normalizedValue = value?.trim();

  return normalizedValue && normalizedValue.toLowerCase() !== "not specified"
    ? normalizedValue
    : "Not specified by client";
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-white/45">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
    </div>
  );
}

export default async function CommissionDetailPage({
  params,
}: CommissionDetailPageProps) {
  await requireAdmin();

  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const [detail, quotes, pricingCatalog] = await Promise.all([
    getAdminCommissionDetail(id),
    getCommissionQuotes(id),
    getActiveCommissionPricingCatalog({ audience: "admin" }),
  ]);

  if (!detail) {
    notFound();
  }

  const { commission, events, statusHistory } = detail;
  const editableDraft =
    quotes.find(({ quote }) => quote.status === "draft") ?? null;
  let quotePricingCatalog = pricingCatalog;

  if (
    editableDraft?.quote.pricingMode === "catalog" &&
    editableDraft.quote.pricingVersionId &&
    editableDraft.quote.pricingVersionId !== pricingCatalog?.version.id
  ) {
    quotePricingCatalog = await getCommissionPricingCatalogByVersion({
      at: editableDraft.quote.createdAt,
      audience: "admin",
      versionId: editableDraft.quote.pricingVersionId,
    });
  }

  const editorPricingMode = editableDraft
    ? editableDraft.quote.pricingMode
    : commission.serviceClassification;
  const editorPricingOptionId =
    editableDraft?.quote.pricingMode === "catalog"
      ? (editableDraft.items.find((item) => item.kind === "base")
          ?.pricingOptionId ?? null)
      : commission.pricingOptionId;
  const editorPricingOption = quotePricingCatalog?.services
    .flatMap((service) => service.options)
    .find(({ option }) => option.id === editorPricingOptionId);
  const pricingConfig: CommissionQuotePricingEditorConfig | null =
    editorPricingMode === "custom"
      ? { mode: "custom" }
      : editorPricingMode === "catalog" &&
          quotePricingCatalog &&
          editorPricingOption
        ? {
            adjustments: editorPricingOption.adjustments.map((adjustment) => ({
              calculationBasis: adjustment.calculationBasis,
              calculationType: adjustment.calculationType,
              description: adjustment.description,
              fixedAmount: adjustment.fixedAmount,
              id: adjustment.id,
              isValueEditable: adjustment.isValueEditable,
              kind: adjustment.kind,
              maximumPercentageRate: adjustment.maximumPercentageRate,
              maxQuantity: adjustment.maxQuantity,
              minimumPercentageRate: adjustment.minimumPercentageRate,
              name: adjustment.name,
              percentageRate: adjustment.percentageRate,
              requiresInternalNote: adjustment.requiresInternalNote,
              stackable: adjustment.stackable,
            })),
            mode: "catalog",
            option: {
              baseAmount: editorPricingOption.option.baseAmount,
              description: editorPricingOption.option.description,
              id: editorPricingOption.option.id,
              quoteLabel: editorPricingOption.option.quoteLabel,
            },
            pricingVersionId: quotePricingCatalog.version.id,
          }
        : null;

  return (
    <main className="min-h-screen px-6 pb-28 pt-36 md:py-28">
      <div className="mx-auto max-w-[96rem]">
        <Link
          className="text-sm text-white/60 transition hover:text-white"
          href="/admin/commissions"
        >
          ← All commissions
        </Link>

        <header className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-white/50">
              {commission.reference}
            </p>
            <h1 className="mt-2 text-4xl font-light">
              {commission.clientName}
            </h1>
            <p className="mt-2 text-white/60">
              Submitted {formatCommissionDate(commission.submittedAt)}
            </p>
            <p className="mt-1 text-xs text-white/45">
              All dates and times are shown in Chile local time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CommissionStatusBadge status={commission.status} />
            {commission.isOnHold && (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                On hold
              </span>
            )}
          </div>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] xl:grid-cols-[minmax(15rem,0.78fr)_minmax(0,1.45fr)_minmax(19rem,0.95fr)]">
          <div className="order-1 space-y-6 xl:order-2">
            <section className="glass-card p-6">
              <h2 className="text-xl font-light">Client</h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem label="Name" value={commission.clientName} />
                <DetailItem label="Email" value={commission.clientEmail} />
                <DetailItem
                  label="Company"
                  value={displayValue(commission.clientCompanyName)}
                />
                <DetailItem
                  label="Country"
                  value={displayValue(commission.clientCountry)}
                />
              </dl>
            </section>

            <section className="glass-card p-6">
              <h2 className="text-xl font-light">Original client request</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/50">
                Preserved exactly as submitted. The administrative selection is
                shown under Service classification.
              </p>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem
                  label="Style"
                  value={displayRequestedValue(commission.styleSnapshot)}
                />
                <DetailItem
                  label="Collection"
                  value={displayRequestedValue(commission.collectionSnapshot)}
                />
                <DetailItem
                  label="Category"
                  value={displayRequestedValue(commission.categorySnapshot)}
                />
                <DetailItem
                  label="Option"
                  value={displayRequestedValue(commission.optionSnapshot)}
                />
              </dl>

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="text-xs uppercase tracking-[0.12em] text-white/45">
                  Initial message
                </p>
                <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-white/85">
                  {commission.initialMessage}
                </p>
              </div>
            </section>

            <section className="glass-card p-6">
              <h2 className="text-xl font-light">Status history</h2>
              <div className="mt-5 max-h-[26rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
                {statusHistory.length === 0 ? (
                  <p className="text-sm text-white/60">
                    No status transitions recorded.
                  </p>
                ) : (
                  statusHistory.map((entry) => (
                    <article
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      key={entry.id}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <p className="font-medium">
                          {entry.fromStatus
                            ? COMMISSION_STATUS_LABELS[entry.fromStatus]
                            : "New inquiry"}{" "}
                          <span className="text-white/40">→</span>{" "}
                          {COMMISSION_STATUS_LABELS[entry.toStatus]}
                        </p>
                        <time className="text-xs text-white/50">
                          {formatCommissionDate(entry.createdAt)}
                        </time>
                      </div>
                      <p className="mt-2 text-sm text-white/60">
                        Initiated by {humanize(entry.initiatedBy)}
                        {entry.reason ? ` · ${humanize(entry.reason)}` : ""}
                      </p>
                      {entry.note && (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">
                          {entry.note}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="glass-card p-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-light">Events</h2>
                <CommissionEventNoteButton commissionId={commission.id} />
              </div>
              <div className="mt-5 max-h-[26rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
                {events.length === 0 ? (
                  <p className="text-sm text-white/60">No events recorded.</p>
                ) : (
                  events.map((event) => (
                    <article
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      key={event.id}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-medium">{event.title}</h3>
                          <p className="mt-1 text-sm text-white/55">
                            {humanize(event.type)} · {humanize(event.actor)}
                          </p>
                        </div>
                        <time className="text-xs text-white/50">
                          {formatCommissionDate(event.createdAt)}
                        </time>
                      </div>
                      {event.description && (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">
                          {event.description}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="order-2 space-y-6 xl:order-3">
            <section className="glass-card p-6">
              <h2 className="text-xl font-light">Workflow</h2>
              <dl className="mt-5 space-y-5">
                <DetailItem
                  label="Status"
                  value={COMMISSION_STATUS_LABELS[commission.status]}
                />
                <DetailItem
                  label="Hold reason"
                  value={displayValue(commission.holdReason)}
                />
                <DetailItem
                  label="Hold started"
                  value={formatCommissionDate(commission.holdStartedAt)}
                />
                <DetailItem
                  label="Close reason"
                  value={
                    commission.closeReason
                      ? humanize(commission.closeReason)
                      : "Not applicable"
                  }
                />
                <DetailItem
                  label="Close note"
                  value={displayValue(commission.closeReasonNote)}
                />
                <DetailItem
                  label="Closed by"
                  value={
                    commission.closedBy
                      ? humanize(commission.closedBy)
                      : "Not applicable"
                  }
                />
              </dl>

              <CommissionWorkflowActions
                commissionId={commission.id}
                currentStatus={commission.status}
                isOnHold={commission.isOnHold}
              />
            </section>

            <CommissionClassificationPanel
              classification={commission.serviceClassification}
              classificationNote={commission.classificationNote}
              commissionId={commission.id}
              expectedUpdatedAt={commission.updatedAt.toISOString()}
              hasQuotes={quotes.length > 0}
              pricingOptionId={commission.pricingOptionId}
              pricingServiceId={commission.pricingServiceId}
              requestSource={commission.requestSource}
              services={(pricingCatalog?.services ?? []).map((entry) => ({
                code: entry.service.code,
                id: entry.service.id,
                options: entry.options.map(({ option }) => ({
                  baseAmount: option.baseAmount,
                  id: option.id,
                  quoteLabel: option.quoteLabel,
                  title: option.title,
                })),
                title: entry.service.title,
              }))}
            />

            <CommissionQuotePanel
              commissionId={commission.id}
              commissionStatus={commission.status}
              pricingConfig={pricingConfig}
              quotes={quotes}
            />
          </aside>

          <aside className="order-3 flex flex-col gap-6 lg:col-span-2 lg:grid lg:grid-cols-3 xl:order-1 xl:col-span-1 xl:flex">
            <section className="glass-card p-6">
              <h2 className="text-xl font-light">Dates</h2>
              <dl className="mt-5 space-y-5">
                <DetailItem
                  label="Submitted"
                  value={formatCommissionDate(commission.submittedAt)}
                />
                <DetailItem
                  label="Started"
                  value={formatCommissionDate(commission.startedAt)}
                />
                <DetailItem
                  label="Final delivered"
                  value={formatCommissionDate(commission.finalDeliveredAt)}
                />
                <DetailItem
                  label="Completed"
                  value={formatCommissionDate(commission.completedAt)}
                />
                <DetailItem
                  label="Closed"
                  value={formatCommissionDate(commission.closedAt)}
                />
                <DetailItem
                  label="Last updated"
                  value={formatCommissionDate(commission.updatedAt)}
                />
              </dl>
            </section>

            <section className="glass-card p-6">
              <h2 className="text-xl font-light">Consent</h2>
              <dl className="mt-5 space-y-5">
                <DetailItem
                  label="Terms version"
                  value={displayValue(commission.termsVersion)}
                />
                <DetailItem
                  label="Agreement version"
                  value={displayValue(commission.agreementVersion)}
                />
              </dl>
            </section>

            <section className="glass-card p-6">
              <h2 className="text-xl font-light">Technical identifiers</h2>
              <dl className="mt-5 space-y-5">
                <DetailItem label="Commission ID" value={commission.id} />
                <DetailItem
                  label="Submission ID"
                  value={commission.submissionId}
                />
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
