import { and, asc, eq, isNull, ne } from "drizzle-orm";

import {
  hashPublicQuoteToken,
  isValidPublicQuoteToken,
} from "../../commissions/commissionQuoteAccessToken";
import type {
  PublicCommissionQuote,
  PublicCommissionQuoteStatus,
} from "../../commissions/publicCommissionQuote";
import { db } from "../../db";
import {
  commissionQuoteItems,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";

interface PublicQuoteAccessTarget {
  quoteId: string;
  commissionId: string;
  status: PublicCommissionQuoteStatus;
  updatedAt: Date;
  validUntil: Date;
}

/*
 * Internal resolver for server-side public quote operations.
 *
 * This function may return technical identifiers because its result
 * never crosses the server boundary.
 */
export async function resolveCommissionQuotePublicToken(
  token: string,
): Promise<PublicQuoteAccessTarget | null> {
  if (!isValidPublicQuoteToken(token)) {
    return null;
  }

  const tokenHash = hashPublicQuoteToken(token);

  const rows = await db
    .select({
      quoteId: commissionQuotes.id,
      commissionId: commissionQuotes.commissionId,
      status: commissionQuotes.status,
      updatedAt: commissionQuotes.updatedAt,
      validUntil: commissionQuotes.validUntil,
    })
    .from(commissionQuotes)
    .where(
      and(
        eq(commissionQuotes.publicTokenHash, tokenHash),
        isNull(commissionQuotes.publicTokenRevokedAt),
        ne(commissionQuotes.status, "draft"),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row || !row.validUntil) {
    return null;
  }

  return {
    quoteId: row.quoteId,
    commissionId: row.commissionId,
    status: row.status as PublicCommissionQuoteStatus,
    updatedAt: row.updatedAt,
    validUntil: row.validUntil,
  };
}

/*
 * Client-safe projection of a quote.
 *
 * No internal database identifiers, token hashes, pricing identifiers,
 * internal notes, events, or administrative metadata are returned.
 */
export async function getPublicCommissionQuoteByToken(
  token: string,
  now = new Date(),
): Promise<PublicCommissionQuote | null> {
  if (!isValidPublicQuoteToken(token)) {
    return null;
  }

  const tokenHash = hashPublicQuoteToken(token);

  const quoteRows = await db
    .select({
      reference: commissions.reference,
      clientName: commissions.clientName,

      version: commissionQuotes.version,
      status: commissionQuotes.status,

      currency: commissionQuotes.currency,
      totalAmount: commissionQuotes.totalAmount,

      description: commissionQuotes.description,

      validUntil: commissionQuotes.validUntil,
      sentAt: commissionQuotes.sentAt,

      acceptedAt: commissionQuotes.acceptedAt,
      declinedAt: commissionQuotes.declinedAt,
      expiredAt: commissionQuotes.expiredAt,
    })
    .from(commissionQuotes)
    .innerJoin(
      commissions,
      eq(commissions.id, commissionQuotes.commissionId),
    )
    .where(
      and(
        eq(commissionQuotes.publicTokenHash, tokenHash),
        isNull(commissionQuotes.publicTokenRevokedAt),
        ne(commissionQuotes.status, "draft"),
      ),
    )
    .limit(1);

  const quote = quoteRows[0];

  if (!quote || !quote.validUntil || !quote.sentAt) {
    return null;
  }

  const itemRows = await db
    .select({
      sequence: commissionQuoteItems.sequence,
      label: commissionQuoteItems.label,
      description: commissionQuoteItems.description,
      quantity: commissionQuoteItems.quantity,
      unitAmount: commissionQuoteItems.unitAmount,
    })
    .from(commissionQuoteItems)
    .innerJoin(
      commissionQuotes,
      eq(commissionQuotes.id, commissionQuoteItems.quoteId),
    )
    .where(
      and(
        eq(commissionQuotes.publicTokenHash, tokenHash),
        isNull(commissionQuotes.publicTokenRevokedAt),
        ne(commissionQuotes.status, "draft"),
      ),
    )
    .orderBy(
      asc(commissionQuoteItems.sequence),
      asc(commissionQuoteItems.id),
    );

  /*
   * A quote whose stored status is still "sent" but whose validity
   * period has already elapsed behaves as expired publicly even if
   * the maintenance process has not persisted the expired state yet.
   */
  const effectiveStatus: PublicCommissionQuoteStatus =
    quote.status === "sent" && quote.validUntil.getTime() <= now.getTime()
      ? "expired"
      : (quote.status as PublicCommissionQuoteStatus);

  return {
    reference: quote.reference,
    clientName: quote.clientName,

    version: quote.version,
    status: effectiveStatus,

    currency: quote.currency,
    totalAmount: quote.totalAmount,

    description: quote.description,

    validUntil: quote.validUntil,
    sentAt: quote.sentAt,

    acceptedAt: quote.acceptedAt,
    declinedAt: quote.declinedAt,
    expiredAt: quote.expiredAt,

    items: itemRows,
  };
}