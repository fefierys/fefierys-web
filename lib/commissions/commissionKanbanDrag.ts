import {
  COMMISSION_KANBAN_COLUMNS,
  type CommissionKanbanColumnId,
} from "@/lib/commissions/commissionKanban";
import { isCommissionStatus } from "@/lib/commissions/commissionStatus";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

export interface CommissionKanbanCardDragData {
  kind: "commission";
  commissionId: string;
  status: CommissionStatus;
}

export interface CommissionKanbanColumnDropData {
  kind: "column";
  columnId: CommissionKanbanColumnId;
}

export type CommissionKanbanDragData =
  CommissionKanbanCardDragData | CommissionKanbanColumnDropData;

export function getCommissionKanbanCardDragId(commissionId: string): string {
  return `commission:${commissionId}`;
}

export function getCommissionKanbanColumnDropId(
  columnId: CommissionKanbanColumnId,
): string {
  return `column:${columnId}`;
}

export function isCommissionKanbanCardDragData(
  value: unknown,
): value is CommissionKanbanCardDragData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<CommissionKanbanCardDragData>;

  return (
    data.kind === "commission" &&
    typeof data.commissionId === "string" &&
    typeof data.status === "string" &&
    isCommissionStatus(data.status)
  );
}

export function isCommissionKanbanColumnDropData(
  value: unknown,
): value is CommissionKanbanColumnDropData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Partial<CommissionKanbanColumnDropData>;

  return (
    data.kind === "column" &&
    typeof data.columnId === "string" &&
    COMMISSION_KANBAN_COLUMNS.some((column) => column.id === data.columnId)
  );
}
