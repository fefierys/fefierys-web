import { and, asc, count, desc, eq, lt, or } from "drizzle-orm";

import { db } from "../db";
import {
  commissionEvents,
  commissionStatusEnum,
  commissions,
  commissionStatusHistory,
} from "../db/schema/commissions";

export type Commission = typeof commissions.$inferSelect;
export type CommissionEvent = typeof commissionEvents.$inferSelect;
export type CommissionStatus = Commission["status"];
export type CommissionStatusHistoryEntry =
  typeof commissionStatusHistory.$inferSelect;

export type AdminCommissionSummary = Pick<
  Commission,
  | "id"
  | "reference"
  | "clientName"
  | "styleSnapshot"
  | "collectionSnapshot"
  | "categorySnapshot"
  | "optionSnapshot"
  | "status"
  | "isOnHold"
  | "submittedAt"
  | "updatedAt"
>;

export interface AdminCommissionCursor {
  submittedAt: Date;
  id: string;
}

export interface AdminCommissionPageFilters {
  status?: CommissionStatus;
  limit?: number;
  cursor?: AdminCommissionCursor;
}

export interface AdminCommissionPage {
  items: AdminCommissionSummary[];
  nextCursor: AdminCommissionCursor | null;
}

export type CommissionStatusCounts = Record<CommissionStatus, number>;

export interface AdminCommissionDetail {
  commission: Commission;
  statusHistory: CommissionStatusHistoryEntry[];
  events: CommissionEvent[];
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function normalizePageSize(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
}

/*
 * Returns every workflow status, including statuses whose count is zero.
 */
export async function getCommissionStatusCounts(): Promise<CommissionStatusCounts> {
  const rows = await db
    .select({
      status: commissions.status,
      total: count(),
    })
    .from(commissions)
    .groupBy(commissions.status);

  const result = Object.fromEntries(
    commissionStatusEnum.enumValues.map((status) => [status, 0]),
  ) as CommissionStatusCounts;

  for (const row of rows) {
    result[row.status] = Number(row.total);
  }

  return result;
}

/*
 * Stable keyset pagination ordered by submittedAt DESC, id DESC.
 * The summary intentionally excludes client email and initial message;
 * those sensitive fields are returned only by the detail query.
 */
export async function getAdminCommissionPage(
  filters: AdminCommissionPageFilters = {},
): Promise<AdminCommissionPage> {
  const pageSize = normalizePageSize(filters.limit);

  const cursorCondition = filters.cursor
    ? or(
        lt(commissions.submittedAt, filters.cursor.submittedAt),
        and(
          eq(commissions.submittedAt, filters.cursor.submittedAt),
          lt(commissions.id, filters.cursor.id),
        ),
      )
    : undefined;

  const rows = await db
    .select({
      id: commissions.id,
      reference: commissions.reference,
      clientName: commissions.clientName,
      styleSnapshot: commissions.styleSnapshot,
      collectionSnapshot: commissions.collectionSnapshot,
      categorySnapshot: commissions.categorySnapshot,
      optionSnapshot: commissions.optionSnapshot,
      status: commissions.status,
      isOnHold: commissions.isOnHold,
      submittedAt: commissions.submittedAt,
      updatedAt: commissions.updatedAt,
    })
    .from(commissions)
    .where(
      and(
        filters.status ? eq(commissions.status, filters.status) : undefined,
        cursorCondition,
      ),
    )
    .orderBy(desc(commissions.submittedAt), desc(commissions.id))
    .limit(pageSize + 1);

  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;
  const lastItem = items[items.length - 1];

  return {
    items,
    nextCursor:
      hasNextPage && lastItem
        ? {
            submittedAt: lastItem.submittedAt,
            id: lastItem.id,
          }
        : null,
  };
}

/*
 * Loads the complete commission and its two initial timeline sources in
 * one Neon HTTP batch. Authorization belongs to the protected caller.
 */
export async function getAdminCommissionDetail(
  id: string,
): Promise<AdminCommissionDetail | null> {
  const [commissionRows, statusHistory, events] = await db.batch([
    db.select().from(commissions).where(eq(commissions.id, id)).limit(1),
    db
      .select()
      .from(commissionStatusHistory)
      .where(eq(commissionStatusHistory.commissionId, id))
      .orderBy(
        asc(commissionStatusHistory.createdAt),
        asc(commissionStatusHistory.id),
      ),
    db
      .select()
      .from(commissionEvents)
      .where(eq(commissionEvents.commissionId, id))
      .orderBy(asc(commissionEvents.createdAt), asc(commissionEvents.id)),
  ]);

  const commission = commissionRows[0];

  if (!commission) {
    return null;
  }

  return {
    commission,
    statusHistory,
    events,
  };
}
