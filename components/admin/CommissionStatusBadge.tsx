import { COMMISSION_STATUS_LABELS } from "@/lib/commissions/commissionStatus";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

interface CommissionStatusBadgeProps {
  status: CommissionStatus;
}

function getTone(status: CommissionStatus): string {
  if (status === "completed") {
    return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  }

  if (["cancelled", "declined", "expired"].includes(status)) {
    return "border-rose-300/25 bg-rose-300/10 text-rose-100";
  }

  if (status.startsWith("awaiting_")) {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }

  if (status === "received" || status === "under_review") {
    return "border-sky-300/25 bg-sky-300/10 text-sky-100";
  }

  return "border-violet-300/25 bg-violet-300/10 text-violet-100";
}

export default function CommissionStatusBadge({
  status,
}: CommissionStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs ${getTone(status)}`}
    >
      {COMMISSION_STATUS_LABELS[status]}
    </span>
  );
}
