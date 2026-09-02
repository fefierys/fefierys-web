import Link from "next/link";

import CommissionKanbanCard from "@/components/admin/CommissionKanbanCard";
import { COMMISSION_KANBAN_COLUMNS } from "@/lib/commissions/commissionKanban";
import type { CommissionStatusCounts } from "@/lib/repositories/commissionAdminRepository";
import type { AdminCommissionKanbanBoard } from "@/lib/repositories/commissionKanbanRepository";

interface CommissionKanbanBoardProps {
  board: AdminCommissionKanbanBoard;
  counts: CommissionStatusCounts;
}

export default function CommissionKanbanBoard({
  board,
  counts,
}: CommissionKanbanBoardProps) {
  return (
    <section aria-label="Commission workflow board">
      <div className="pb-6 md:-mx-6 md:overflow-x-auto md:px-6">
        <div className="grid gap-5 md:flex md:min-w-max md:snap-x md:snap-mandatory">
          {COMMISSION_KANBAN_COLUMNS.map((column) => {
            const result = board[column.id];

            const total = column.statuses.reduce(
              (sum, status) => sum + counts[status],
              0,
            );

            return (
              <section
                aria-labelledby={`kanban-${column.id}`}
                className="w-full rounded-3xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-xl md:w-[20rem] md:shrink-0 md:snap-start"
                key={column.id}
              >
                <header className="mb-4 border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2
                      className="text-lg font-medium"
                      id={`kanban-${column.id}`}
                    >
                      {column.label}
                    </h2>

                    <span className="flex min-w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs text-white/70">
                      {total}
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-white/45">
                    {column.description}
                  </p>
                </header>

                <div className="space-y-3 md:max-h-[62vh] md:overflow-y-auto md:overscroll-contain md:pr-1">
                  {result.items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center">
                      <p className="text-sm text-white/45">No commissions</p>
                    </div>
                  ) : (
                    result.items.map((commission) => (
                      <CommissionKanbanCard
                        commission={commission}
                        key={commission.id}
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
          })}
        </div>
      </div>
    </section>
  );
}
