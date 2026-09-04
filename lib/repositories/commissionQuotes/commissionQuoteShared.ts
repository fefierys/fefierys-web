import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "../../db";
import {
  commissionQuoteItems,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";
import type {
  CommissionQuote,
  CommissionQuoteItem,
  CommissionQuoteWithItems,
} from "./commissionQuoteTypes";
import type { CommissionStatus } from "../commissionAdminRepository";

export async function getCommissionQuoteById(
  quoteId: string,
): Promise<CommissionQuoteWithItems | null> {
  const [quoteRows, itemRows] = await db.batch([
    db
      .select()
      .from(commissionQuotes)
      .where(eq(commissionQuotes.id, quoteId))
      .limit(1),

    db
      .select()
      .from(commissionQuoteItems)
      .where(eq(commissionQuoteItems.quoteId, quoteId))
      .orderBy(
        asc(commissionQuoteItems.sequence),
        asc(commissionQuoteItems.id),
      ),
  ]);

  const quote = quoteRows[0];

  if (!quote) {
    return null;
  }

  return {
    quote,
    items: itemRows,
  };
}

export async function getCommissionQuotes(
  commissionId: string,
): Promise<CommissionQuoteWithItems[]> {
  const quoteRows = await db
    .select()
    .from(commissionQuotes)
    .where(eq(commissionQuotes.commissionId, commissionId))
    .orderBy(desc(commissionQuotes.version), desc(commissionQuotes.createdAt));

  if (quoteRows.length === 0) {
    return [];
  }

  const quoteIds = quoteRows.map((quote) => quote.id);

  const itemRows = await db
    .select()
    .from(commissionQuoteItems)
    .where(inArray(commissionQuoteItems.quoteId, quoteIds))
    .orderBy(
      asc(commissionQuoteItems.quoteId),
      asc(commissionQuoteItems.sequence),
      asc(commissionQuoteItems.id),
    );

  const itemsByQuoteId = new Map<string, CommissionQuoteItem[]>();

  for (const item of itemRows) {
    const existingItems = itemsByQuoteId.get(item.quoteId) ?? [];

    existingItems.push(item);
    itemsByQuoteId.set(item.quoteId, existingItems);
  }

  return quoteRows.map((quote) => ({
    quote,
    items: itemsByQuoteId.get(quote.id) ?? [],
  }));
}

export interface CommissionQuoteOperationState {
  quoteStatus: CommissionQuote["status"];
  quoteUpdatedAt: Date;
  validUntil: Date | null;
  commissionStatus: CommissionStatus;
  isOnHold: boolean;
}

export async function getCommissionQuoteOperationState(
  quoteId: string,
): Promise<CommissionQuoteOperationState | null> {
  const rows = await db
    .select({
      quoteStatus: commissionQuotes.status,
      quoteUpdatedAt: commissionQuotes.updatedAt,
      validUntil: commissionQuotes.validUntil,
      commissionStatus: commissions.status,
      isOnHold: commissions.isOnHold,
    })
    .from(commissionQuotes)
    .innerJoin(commissions, eq(commissions.id, commissionQuotes.commissionId))
    .where(eq(commissionQuotes.id, quoteId))
    .limit(1);

  return rows[0] ?? null;
}
