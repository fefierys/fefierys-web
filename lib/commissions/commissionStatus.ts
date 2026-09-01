import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

export const COMMISSION_STATUSES = [
  "received",
  "under_review",
  "awaiting_client_details",
  "quoting",
  "awaiting_quote_response",
  "awaiting_payment",
  "in_progress",
  "sketch_review",
  "sketch_revision",
  "final_preview",
  "final_review",
  "final_revision",
  "completed",
  "cancelled",
  "declined",
  "expired",
] as const satisfies readonly CommissionStatus[];

export const COMMISSION_STATUS_LABELS = {
  received: "Received",
  under_review: "Under review",
  awaiting_client_details: "Awaiting client details",
  quoting: "Quoting",
  awaiting_quote_response: "Awaiting quote response",
  awaiting_payment: "Awaiting payment",
  in_progress: "In progress",
  sketch_review: "Sketch review",
  sketch_revision: "Sketch revision",
  final_preview: "Final preview",
  final_review: "Final review",
  final_revision: "Final revision",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
  expired: "Expired",
} satisfies Record<CommissionStatus, string>;

export function isCommissionStatus(value: string): value is CommissionStatus {
  return (COMMISSION_STATUSES as readonly string[]).includes(value);
}
