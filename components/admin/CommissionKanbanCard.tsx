import Link from "next/link";
import type { RefCallback } from "react";

import CommissionStatusBadge from "@/components/admin/CommissionStatusBadge";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import type { AdminCommissionKanbanCard } from "@/lib/repositories/commissionKanbanRepository";

interface CommissionKanbanCardProps {
  commission: AdminCommissionKanbanCard;
  dragHandleRef?: RefCallback<HTMLButtonElement>;
  dragging?: boolean;
  onChangeStatus?: () => void;
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
  dragHandleRef,
  dragging = false,
  onChangeStatus,
}: CommissionKanbanCardProps) {
  return (
    <article
      className={`rounded-2xl border bg-white/[0.07] p-4 transition ${
        dragging
          ? "border-white/30 opacity-55 shadow-[0_18px_45px_rgba(25,30,70,0.3)]"
          : "border-white/10 hover:border-white/20 hover:bg-white/10 hover:shadow-[0_12px_30px_rgba(30,35,80,0.18)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CommissionStatusBadge status={commission.status} />

          {commission.isOnHold && (
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[0.68rem] text-amber-100">
              On hold
            </span>
          )}
        </div>

        {dragHandleRef && (
          <button
            ref={dragHandleRef}
            aria-label={`Move commission ${commission.reference}`}
            className="hidden h-9 w-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm tracking-[-0.18em] text-white/55 transition hover:bg-white/10 hover:text-white active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:flex"
            title="Drag to another workflow stage"
            type="button"
          >
            ⠿
          </button>
        )}
      </div>

      <Link
        className="mt-4 block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        href={`/admin/commissions/${commission.id}`}
      >
        <h3 className="break-words font-medium text-white">
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
      </Link>

      {onChangeStatus && (
        <button
          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onClick={onChangeStatus}
          type="button"
        >
          Change status
        </button>
      )}
    </article>
  );
}
