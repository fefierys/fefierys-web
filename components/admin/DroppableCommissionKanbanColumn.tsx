"use client";

import { useDroppable } from "@dnd-kit/react";
import Link from "next/link";

import DraggableCommissionKanbanCard from "@/components/admin/DraggableCommissionKanbanCard";
import {
  getCommissionKanbanDropColumns,
  type CommissionKanbanColumn,
} from "@/lib/commissions/commissionKanban";
import {
  getCommissionKanbanColumnDropId,
  type CommissionKanbanDragData,
} from "@/lib/commissions/commissionKanbanDrag";
import { getAllowedCommissionTransitions } from "@/lib/commissions/commissionWorkflow";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";
import type {
  AdminCommissionKanbanBoard,
  AdminCommissionKanbanCard,
} from "@/lib/repositories/commissionKanbanRepository";

interface DroppableCommissionKanbanColumnProps {
  activeStatus: CommissionStatus | null;
  column: CommissionKanbanColumn;
  result: AdminCommissionKanbanBoard[CommissionKanbanColumn["id"]];
  total: number;
  onChangeStatus: (commission: AdminCommissionKanbanCard) => void;
}

export default function DroppableCommissionKanbanColumn({
  activeStatus,
  column,
  result,
  total,
  onChangeStatus,
}: DroppableCommissionKanbanColumnProps) {
  const enabled =
    activeStatus !== null &&
    getCommissionKanbanDropColumns(activeStatus).some(
      (candidate) => candidate.id === column.id,
    );

  const { isDropTarget, ref } = useDroppable<CommissionKanbanDragData>({
    id: getCommissionKanbanColumnDropId(column.id),
    type: "column",
    accept: "commission",
    data: {
      kind: "column",
      columnId: column.id,
    },
    disabled: !enabled,
  });

  return (
    <section
      ref={(element) => ref(element)}
      aria-labelledby={`kanban-${column.id}`}
      className={`w-full rounded-3xl border p-4 backdrop-blur-xl transition md:w-[20rem] md:shrink-0 md:snap-start ${
        isDropTarget
          ? "border-emerald-200/45 bg-emerald-200/10 shadow-[0_18px_50px_rgba(52,211,153,0.12)]"
          : enabled
            ? "border-white/25 bg-white/[0.09]"
            : "border-white/10 bg-white/[0.055]"
      }`}
    >
      <header className="mb-4 border-b border-white/10 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium" id={`kanban-${column.id}`}>
            {column.label}
          </h2>

          <span className="flex min-w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-white/70">
            {total}
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-white/45">
          {column.description}
        </p>

        {enabled && (
          <p
            aria-live="polite"
            className={`mt-3 text-xs ${
              isDropTarget ? "text-emerald-100" : "text-white/70"
            }`}
          >
            {isDropTarget
              ? "Release to choose status"
              : "Available destination"}
          </p>
        )}
      </header>

      <div className="space-y-3 md:max-h-[62vh] md:overflow-y-auto md:overscroll-contain md:pr-1">
        {result.items.length === 0 ? (
          <div
            className={`rounded-2xl border border-dashed px-4 py-10 text-center transition ${
              isDropTarget
                ? "border-emerald-200/35 bg-emerald-200/5"
                : "border-white/10"
            }`}
          >
            <p className="text-sm text-white/45">No commissions</p>
          </div>
        ) : (
          result.items.map((commission) => (
            <DraggableCommissionKanbanCard
              commission={commission}
              disabled={
                getAllowedCommissionTransitions(commission.status).length === 0
              }
              key={commission.id}
              onChangeStatus={() => onChangeStatus(commission)}
            />
          ))
        )}
      </div>

      {result.hasMore && (
        <footer className="mt-4 border-t border-white/10 pt-4">
          <p className="text-xs text-white/45">
            Showing the latest {result.items.length} of {total}.
          </p>
          <Link
            className="mt-2 inline-block text-xs text-white/70 transition hover:text-white"
            href="/admin/commissions"
          >
            Open full list →
          </Link>
        </footer>
      )}
    </section>
  );
}
