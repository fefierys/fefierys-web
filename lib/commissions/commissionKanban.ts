import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

import { getAllowedCommissionTransitions } from "@/lib/commissions/commissionWorkflow";

export const COMMISSION_KANBAN_COLUMNS = [
  {
    id: "inbox",
    label: "Inbox",
    description: "New inquiries and initial review",
    statuses: ["received", "under_review", "awaiting_client_details"],
  },
  {
    id: "quote",
    label: "Quote",
    description: "Quote preparation and client response",
    statuses: ["quoting", "awaiting_quote_response"],
  },
  {
    id: "payment",
    label: "Payment",
    description: "Commissions waiting for payment",
    statuses: ["awaiting_payment"],
  },
  {
    id: "production",
    label: "Production",
    description: "Artwork currently in progress",
    statuses: ["in_progress"],
  },
  {
    id: "sketch",
    label: "Sketch",
    description: "Sketch review and revisions",
    statuses: ["sketch_review", "sketch_revision"],
  },
  {
    id: "final",
    label: "Final",
    description: "Final preview, review, and revisions",
    statuses: ["final_preview", "final_review", "final_revision"],
  },
  {
    id: "closed",
    label: "Closed",
    description: "Completed or otherwise closed commissions",
    statuses: ["completed", "cancelled", "declined", "expired"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  description: string;
  statuses: readonly CommissionStatus[];
}[];

export type CommissionKanbanColumn = (typeof COMMISSION_KANBAN_COLUMNS)[number];

export type CommissionKanbanColumnId = CommissionKanbanColumn["id"];

export const COMMISSION_KANBAN_COLUMN_LIMIT = 20;

export function getCommissionKanbanColumn(
  status: CommissionStatus,
): CommissionKanbanColumn {
  const column = COMMISSION_KANBAN_COLUMNS.find((candidate) =>
    (candidate.statuses as readonly CommissionStatus[]).includes(status),
  );

  if (!column) {
    throw new Error(
      `Commission status ${status} is not assigned to a Kanban column.`,
    );
  }

  return column;
}

export function getCommissionKanbanColumnById(
  columnId: CommissionKanbanColumnId,
): CommissionKanbanColumn {
  const column = COMMISSION_KANBAN_COLUMNS.find(
    (candidate) => candidate.id === columnId,
  );

  if (!column) {
    throw new Error(`Unknown Commission Kanban column: ${columnId}.`);
  }

  return column;
}

export function getCommissionKanbanTransitionStatuses(
  fromStatus: CommissionStatus,
  targetColumnId: CommissionKanbanColumnId,
): readonly CommissionStatus[] {
  const column = getCommissionKanbanColumnById(targetColumnId);
  const allowedTransitions = getAllowedCommissionTransitions(fromStatus);

  return column.statuses.filter((status) =>
    (allowedTransitions as readonly CommissionStatus[]).includes(status),
  );
}

export function getCommissionKanbanDropColumns(
  fromStatus: CommissionStatus,
): readonly CommissionKanbanColumn[] {
  const sourceColumn = getCommissionKanbanColumn(fromStatus);

  return COMMISSION_KANBAN_COLUMNS.filter(
    (column) =>
      column.id !== sourceColumn.id &&
      getCommissionKanbanTransitionStatuses(fromStatus, column.id).length > 0,
  );
}
