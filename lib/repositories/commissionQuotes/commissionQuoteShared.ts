import { asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "../../db";
import {
  commissionQuoteIllustrations,
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
  const [quoteRows, itemRows, illustrationRows] = await db.batch([
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

    db
      .select()
      .from(commissionQuoteIllustrations)
      .where(eq(commissionQuoteIllustrations.quoteId, quoteId))
      .orderBy(
        asc(commissionQuoteIllustrations.sequence),
        asc(commissionQuoteIllustrations.id),
      ),
  ]);

  const quote = quoteRows[0];

  if (!quote) {
    return null;
  }

  return {
    quote,
    items: itemRows,
    illustrations: illustrationRows,
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

  const [itemRows, illustrationRows] = await db.batch([
    db
      .select()
      .from(commissionQuoteItems)
      .where(inArray(commissionQuoteItems.quoteId, quoteIds))
      .orderBy(
        asc(commissionQuoteItems.quoteId),
        asc(commissionQuoteItems.sequence),
        asc(commissionQuoteItems.id),
      ),

    db
      .select()
      .from(commissionQuoteIllustrations)
      .where(inArray(commissionQuoteIllustrations.quoteId, quoteIds))
      .orderBy(
        asc(commissionQuoteIllustrations.quoteId),
        asc(commissionQuoteIllustrations.sequence),
        asc(commissionQuoteIllustrations.id),
      ),
  ]);

  const itemsByQuoteId = new Map<string, CommissionQuoteItem[]>();

  for (const item of itemRows) {
    const existingItems = itemsByQuoteId.get(item.quoteId) ?? [];

    existingItems.push(item);
    itemsByQuoteId.set(item.quoteId, existingItems);
  }

  const illustrationsByQuoteId = new Map<string, typeof illustrationRows>();

  for (const illustration of illustrationRows) {
    const existingIllustrations =
      illustrationsByQuoteId.get(illustration.quoteId) ?? [];

    existingIllustrations.push(illustration);

    illustrationsByQuoteId.set(illustration.quoteId, existingIllustrations);
  }

  return quoteRows.map((quote) => ({
    quote,
    items: itemsByQuoteId.get(quote.id) ?? [],
    illustrations: illustrationsByQuoteId.get(quote.id) ?? [],
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
