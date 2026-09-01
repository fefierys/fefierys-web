import Link from "next/link";
import { notFound } from "next/navigation";

import CommissionStatusBadge from "@/components/admin/CommissionStatusBadge";
import { requireAdmin } from "@/lib/auth/admin";
import { COMMISSION_STATUS_LABELS } from "@/lib/commissions/commissionStatus";
import { getAdminCommissionDetail } from "@/lib/repositories/commissionAdminRepository";

export const dynamic = "force-dynamic";

interface CommissionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: Date | null): string {
  if (!value) {
    return "Not recorded";
  }

  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value)} UTC`;
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayValue(value: string | null): string {
  return value?.trim() || "Not provided";
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

  const detail = await getAdminCommissionDetail(id);

  if (!detail) {
    notFound();
  }

  const { commission, events, statusHistory } = detail;

  return (
    <main className="min-h-screen px-6 pb-28 pt-36 md:py-28">
      <div className="mx-auto max-w-7xl">
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
              Submitted {formatDate(commission.submittedAt)}
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <div className="space-y-6">
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
              <h2 className="text-xl font-light">Requested service</h2>
              <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                <DetailItem
                  label="Style"
                  value={displayValue(commission.styleSnapshot)}
                />
                <DetailItem
                  label="Collection"
                  value={displayValue(commission.collectionSnapshot)}
                />
                <DetailItem
                  label="Category"
                  value={displayValue(commission.categorySnapshot)}
                />
                <DetailItem
                  label="Option"
                  value={displayValue(commission.optionSnapshot)}
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
              <div className="mt-5 space-y-4">
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
                          {formatDate(entry.createdAt)}
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
              <h2 className="text-xl font-light">Events</h2>
              <div className="mt-5 space-y-4">
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
                          {formatDate(event.createdAt)}
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

          <aside className="space-y-6">
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
                  value={formatDate(commission.holdStartedAt)}
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
              <h2 className="text-xl font-light">Dates</h2>
              <dl className="mt-5 space-y-5">
                <DetailItem
                  label="Submitted"
                  value={formatDate(commission.submittedAt)}
                />
                <DetailItem
                  label="Started"
                  value={formatDate(commission.startedAt)}
                />
                <DetailItem
                  label="Final delivered"
                  value={formatDate(commission.finalDeliveredAt)}
                />
                <DetailItem
                  label="Completed"
                  value={formatDate(commission.completedAt)}
                />
                <DetailItem
                  label="Closed"
                  value={formatDate(commission.closedAt)}
                />
                <DetailItem
                  label="Last updated"
                  value={formatDate(commission.updatedAt)}
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
