import Link from "next/link";

import CommissionStatusBadge from "@/components/admin/CommissionStatusBadge";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import type { AdminCommissionKanbanCard } from "@/lib/repositories/commissionKanbanRepository";

interface CommissionKanbanCardProps {
  commission: AdminCommissionKanbanCard;
}

function displayService(commission: AdminCommissionKanbanCard): string {
  return (
    [
      commission.styleSnapshot,
      commission.categorySnapshot,
      commission.optionSnapshot,
    ]
      .filter(Boolean)
      .join(" · ") || "Service not specified"
  );
}

export default function CommissionKanbanCard({
  commission,
}: CommissionKanbanCardProps) {
  return (
    <Link
      className="block rounded-2xl border border-white/10 bg-white/[0.07] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      href={`/admin/commissions/${commission.id}`}
    >
      <article>
        <div className="flex flex-wrap items-center gap-2">
          <CommissionStatusBadge status={commission.status} />

          {commission.isOnHold && (
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[0.68rem] text-amber-100">
              On hold
            </span>
          )}
        </div>

        <h3 className="mt-4 break-words font-medium text-white">
          {commission.clientName}
        </h3>

        <p className="mt-1 break-all text-xs text-white/45">
          {commission.reference}
        </p>

        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/65">
          {displayService(commission)}
        </p>

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[0.7rem] uppercase tracking-[0.12em] text-white/35">
            Last updated
          </p>
          <time className="mt-1 block text-xs text-white/60">
            {formatCommissionDate(commission.updatedAt)}
          </time>
        </div>
      </article>
    </Link>
  );
}
