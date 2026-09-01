import Link from "next/link";

import CommissionStatusBadge from "@/components/admin/CommissionStatusBadge";
import { requireAdmin } from "@/lib/auth/admin";
import {
  decodeAdminCommissionCursor,
  encodeAdminCommissionCursor,
} from "@/lib/commissions/adminCursor";
import {
  COMMISSION_STATUSES,
  COMMISSION_STATUS_LABELS,
  isCommissionStatus,
} from "@/lib/commissions/commissionStatus";
import {
  getAdminCommissionPage,
  getCommissionStatusCounts,
} from "@/lib/repositories/commissionAdminRepository";

export const dynamic = "force-dynamic";

interface CommissionsPageProps {
  searchParams: Promise<{
    status?: string | string[];
    cursor?: string | string[];
  }>;
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export default async function CommissionsPage({
  searchParams,
}: CommissionsPageProps) {
  await requireAdmin();

  const query = await searchParams;
  const rawStatus = singleValue(query.status);
  const status =
    rawStatus && isCommissionStatus(rawStatus) ? rawStatus : undefined;
  const cursor = decodeAdminCommissionCursor(singleValue(query.cursor));

  const [counts, page] = await Promise.all([
    getCommissionStatusCounts(),
    getAdminCommissionPage({
      status,
      cursor: cursor ?? undefined,
      limit: 20,
    }),
  ]);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const active =
    counts.in_progress +
    counts.sketch_review +
    counts.sketch_revision +
    counts.final_preview +
    counts.final_review +
    counts.final_revision;
  const awaiting =
    counts.awaiting_client_details +
    counts.awaiting_quote_response +
    counts.awaiting_payment;

  const nextSearchParams = new URLSearchParams();

  if (status) {
    nextSearchParams.set("status", status);
  }

  if (page.nextCursor) {
    nextSearchParams.set(
      "cursor",
      encodeAdminCommissionCursor(page.nextCursor),
    );
  }

  return (
    <main className="min-h-screen px-6 pb-28 pt-36 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              className="text-sm text-white/60 hover:text-white"
              href="/admin"
            >
              ← Admin home
            </Link>
            <h1 className="mt-3 text-4xl font-light">Commissions</h1>
            <p className="mt-2 text-white/60">
              Review incoming inquiries and monitor their current workflow
              state.
            </p>
          </div>

          <form className="flex gap-3" method="get">
            <label className="sr-only" htmlFor="commission-status">
              Filter by status
            </label>
            <select
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#5966A5]/80 px-4 py-3 outline-none md:flex-none"
              defaultValue={status ?? ""}
              id="commission-status"
              name="status"
            >
              <option value="">All statuses ({total})</option>
              {COMMISSION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {COMMISSION_STATUS_LABELS[value]} ({counts[value]})
                </option>
              ))}
            </select>
            <button
              className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 transition hover:bg-white/15"
              type="submit"
            >
              Apply
            </button>
          </form>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total", total],
            ["Received", counts.received],
            ["Active work", active],
            ["Awaiting action", awaiting],
          ].map(([label, value]) => (
            <article className="glass-card p-5" key={label}>
              <p className="text-sm text-white/60">{label}</p>
              <p className="mt-2 text-3xl font-light">{value}</p>
            </article>
          ))}
        </section>

        <section className="space-y-4">
          {page.items.length === 0 ? (
            <div className="glass-card px-6 py-16 text-center">
              <h2 className="text-xl font-light">No commissions found</h2>
              <p className="mt-2 text-sm text-white/60">
                New inquiries will appear here after they are submitted.
              </p>
            </div>
          ) : (
            page.items.map((commission) => (
              <Link
                className="glass-card block p-5 transition hover:border-white/20 hover:bg-white/10"
                href={`/admin/commissions/${commission.id}`}
                key={commission.id}
              >
                <article className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-medium">
                        {commission.clientName}
                      </h2>
                      <CommissionStatusBadge status={commission.status} />
                      {commission.isOnHold && (
                        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                          On hold
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-white/60">
                      {commission.reference} ·{" "}
                      {commission.styleSnapshot ?? "No style"} ·{" "}
                      {commission.categorySnapshot ?? "No category"}
                    </p>
                  </div>
                  <p className="text-sm text-white/60">
                    {formatDate(commission.submittedAt)} UTC
                  </p>
                </article>
              </Link>
            ))
          )}
        </section>

        {page.nextCursor && (
          <div className="mt-8 flex justify-end">
            <Link
              className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 transition hover:bg-white/15"
              href={`/admin/commissions?${nextSearchParams.toString()}`}
            >
              Next page →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
