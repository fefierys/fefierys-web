import { desc, inArray } from "drizzle-orm";

import {
  COMMISSION_KANBAN_COLUMNS,
  COMMISSION_KANBAN_COLUMN_LIMIT,
  type CommissionKanbanColumnId,
} from "../commissions/commissionKanban";
import { db } from "../db";
import { commissions } from "../db/schema/commissions";
import type { Commission, CommissionStatus } from "./commissionAdminRepository";

export type AdminCommissionKanbanCard = Pick<
  Commission,
  | "id"
  | "reference"
  | "clientName"
  | "styleSnapshot"
  | "categorySnapshot"
  | "optionSnapshot"
  | "status"
  | "isOnHold"
  | "submittedAt"
  | "updatedAt"
>;

export interface AdminCommissionKanbanColumn {
  items: AdminCommissionKanbanCard[];
  hasMore: boolean;
}

export type AdminCommissionKanbanBoard = Record<
  CommissionKanbanColumnId,
  AdminCommissionKanbanColumn
>;

const MAX_COLUMN_LIMIT = 50;

function normalizeColumnLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return COMMISSION_KANBAN_COLUMN_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_COLUMN_LIMIT);
}

function selectColumn(statuses: readonly CommissionStatus[], limit: number) {
  return db
    .select({
      id: commissions.id,
      reference: commissions.reference,
      clientName: commissions.clientName,
      styleSnapshot: commissions.styleSnapshot,
      categorySnapshot: commissions.categorySnapshot,
      optionSnapshot: commissions.optionSnapshot,
      status: commissions.status,
      isOnHold: commissions.isOnHold,
      submittedAt: commissions.submittedAt,
      updatedAt: commissions.updatedAt,
    })
    .from(commissions)
    .where(inArray(commissions.status, [...statuses]))
    .orderBy(desc(commissions.updatedAt), desc(commissions.id))
    .limit(limit + 1);
}

function toColumn(
  rows: AdminCommissionKanbanCard[],
  limit: number,
): AdminCommissionKanbanColumn {
  return {
    items: rows.length > limit ? rows.slice(0, limit) : rows,
    hasMore: rows.length > limit,
  };
}

/*
 * Loads every Kanban lane in one Neon HTTP batch.
 *
 * Each query returns one extra row so the UI can indicate that
 * additional commissions exist without loading an unbounded board.
 * Sensitive client fields are intentionally excluded.
 */
export async function getAdminCommissionKanban(
  requestedLimit?: number,
): Promise<AdminCommissionKanbanBoard> {
  const limit = normalizeColumnLimit(requestedLimit);

  const [
    inboxRows,
    quoteRows,
    paymentRows,
    productionRows,
    sketchRows,
    finalRows,
    closedRows,
  ] = await db.batch([
    selectColumn(COMMISSION_KANBAN_COLUMNS[0].statuses, limit),
    selectColumn(COMMISSION_KANBAN_COLUMNS[1].statuses, limit),
    selectColumn(COMMISSION_KANBAN_COLUMNS[2].statuses, limit),
    selectColumn(COMMISSION_KANBAN_COLUMNS[3].statuses, limit),
    selectColumn(COMMISSION_KANBAN_COLUMNS[4].statuses, limit),
    selectColumn(COMMISSION_KANBAN_COLUMNS[5].statuses, limit),
    selectColumn(COMMISSION_KANBAN_COLUMNS[6].statuses, limit),
  ]);

  return {
    inbox: toColumn(inboxRows, limit),
    quote: toColumn(quoteRows, limit),
    payment: toColumn(paymentRows, limit),
    production: toColumn(productionRows, limit),
    sketch: toColumn(sketchRows, limit),
    final: toColumn(finalRows, limit),
    closed: toColumn(closedRows, limit),
  };
}
