import Link from "next/link";

import CommissionKanbanBoard from "@/components/admin/CommissionKanbanBoard";
import CommissionViewToggle from "@/components/admin/CommissionViewToggle";
import { requireAdmin } from "@/lib/auth/admin";
import { getCommissionStatusCounts } from "@/lib/repositories/commissionAdminRepository";
import { getAdminCommissionKanban } from "@/lib/repositories/commissionKanbanRepository";

export const dynamic = "force-dynamic";

export default async function CommissionKanbanPage() {
  await requireAdmin();

  const [counts, board] = await Promise.all([
    getCommissionStatusCounts(),
    getAdminCommissionKanban(),
  ]);

  return (
    <main className="min-h-screen px-6 pb-28 pt-36 md:py-28">
      <div className="mx-auto max-w-[100rem]">
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              className="text-sm text-white/60 transition hover:text-white"
              href="/admin"
            >
              ← Admin home
            </Link>

            <h1 className="mt-3 text-4xl font-light">Commission board</h1>

            <p className="mt-2 max-w-2xl text-white/60">
              Monitor each commission across its current workflow stage.
            </p>

            <p className="mt-1 text-xs text-white/45">
              Dates and times are shown in Chile local time.
            </p>
          </div>

          <CommissionViewToggle activeView="board" />
        </header>

        <CommissionKanbanBoard board={board} counts={counts} />
      </div>
    </main>
  );
}
