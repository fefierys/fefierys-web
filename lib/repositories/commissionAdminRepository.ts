import { and, asc, count, desc, eq, inArray, lt, or } from "drizzle-orm";

import { db } from "../db";
import {
  commissionEmailMessages,
  commissionEmailThreads,
  commissionEvents,
  commissionQuotes,
  commissionStatusEnum,
  commissions,
  commissionStatusHistory,
} from "../db/schema/commissions";

export type Commission =
  typeof commissions.$inferSelect;

export type CommissionEvent =
  typeof commissionEvents.$inferSelect;

export type CommissionStatus =
  Commission["status"];

export type CommissionStatusHistoryEntry =
  typeof commissionStatusHistory.$inferSelect;

export type CommissionEmailThread =
  typeof commissionEmailThreads.$inferSelect;

export type CommissionEmailMessage =
  typeof commissionEmailMessages.$inferSelect;

export type AdminCommissionSummary =
  Pick<
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
  > & {
    hasPastDueQuote: boolean;
  };

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
  nextCursor:
    | AdminCommissionCursor
    | null;
}

export type CommissionStatusCounts =
  Record<
    CommissionStatus,
    number
  >;

export interface AdminCommissionConversation {
  thread:
    | CommissionEmailThread
    | null;

  messages:
    CommissionEmailMessage[];
}

export interface AdminCommissionDetail {
  commission: Commission;

  statusHistory:
    CommissionStatusHistoryEntry[];

  events:
    CommissionEvent[];

  conversation:
    AdminCommissionConversation;
}

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
 * A quote is "past due" when its validity timestamp has already passed but
 * the persisted workflow still says it is sent and awaiting a client response.
 * This is a derived admin signal only; it does not mutate quote or commission
 * status. The expiration action/job remains responsible for that transition.
 */
export async function getPastDueCommissionQuoteCount(): Promise<number> {
  const rows = await db
    .select({
      total: count(),
    })
    .from(commissionQuotes)
    .innerJoin(
      commissions,
      eq(commissions.id, commissionQuotes.commissionId),
    )
    .where(
      and(
        eq(commissionQuotes.status, "sent"),
        eq(commissions.status, "awaiting_quote_response"),
        lt(commissionQuotes.validUntil, new Date()),
      ),
    );

  return Number(rows[0]?.total ?? 0);
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
  const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;

  const pastDueQuoteRows =
    pageRows.length === 0
      ? []
      : await db
          .select({
            commissionId: commissionQuotes.commissionId,
          })
          .from(commissionQuotes)
          .where(
            and(
              inArray(
                commissionQuotes.commissionId,
                pageRows.map((commission) => commission.id),
              ),
              eq(commissionQuotes.status, "sent"),
              lt(commissionQuotes.validUntil, new Date()),
            ),
          );

  const pastDueCommissionIds = new Set(
    pastDueQuoteRows.map((row) => row.commissionId),
  );

  const items: AdminCommissionSummary[] = pageRows.map((commission) => ({
    ...commission,
    hasPastDueQuote:
      commission.status === "awaiting_quote_response" &&
      pastDueCommissionIds.has(commission.id),
  }));

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
 * Loads the complete commission together with its workflow
 * activity and client-facing email conversation.
 *
 * Internal notifications are intentionally excluded from the
 * conversation projection.
 *
 * Authorization belongs to the protected caller.
 */
export async function getAdminCommissionDetail(
  id: string,
): Promise<AdminCommissionDetail | null> {
  const [
    commissionRows,
    statusHistory,
    events,
    threadRows,
    messages,
  ] = await db.batch([
    db
      .select()
      .from(commissions)
      .where(
        eq(
          commissions.id,
          id,
        ),
      )
      .limit(1),

    db
      .select()
      .from(
        commissionStatusHistory,
      )
      .where(
        eq(
          commissionStatusHistory.commissionId,
          id,
        ),
      )
      .orderBy(
        asc(
          commissionStatusHistory.createdAt,
        ),
        asc(
          commissionStatusHistory.id,
        ),
      ),

    db
      .select()
      .from(
        commissionEvents,
      )
      .where(
        eq(
          commissionEvents.commissionId,
          id,
        ),
      )
      .orderBy(
        asc(
          commissionEvents.createdAt,
        ),
        asc(
          commissionEvents.id,
        ),
      ),

    db
      .select()
      .from(
        commissionEmailThreads,
      )
      .where(
        eq(
          commissionEmailThreads.commissionId,
          id,
        ),
      )
      .limit(1),

    db
      .select()
      .from(
        commissionEmailMessages,
      )
      .where(
        and(
          eq(
            commissionEmailMessages.commissionId,
            id,
          ),
          eq(
            commissionEmailMessages.scope,
            "client_thread",
          ),
        ),
      )
      .orderBy(
        asc(
          commissionEmailMessages.createdAt,
        ),
        asc(
          commissionEmailMessages.id,
        ),
      ),
  ]);

  const commission =
    commissionRows[0];

  if (!commission) {
    return null;
  }

  return {
    commission,
    statusHistory,
    events,

    conversation: {
      thread:
        threadRows[0] ??
        null,

      messages,
    },
  };
}
