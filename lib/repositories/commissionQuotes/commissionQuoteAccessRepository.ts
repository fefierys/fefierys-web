import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";

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

interface PublicQuoteIllustrationRow extends Record<string, unknown> {
  id: string;
  sequence: number;
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
 *
 * Illustration UUIDs are used only inside this repository to resolve
 * grouping. The public projection exposes illustrationSequence instead.
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
    .innerJoin(commissions, eq(commissions.id, commissionQuotes.commissionId))
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

  const [illustrationResult, itemRows] = await Promise.all([
    db.execute<PublicQuoteIllustrationRow>(
      sql`
          SELECT
            illustration.id::text AS id,
            illustration.sequence
          FROM commission_quote_illustrations
            AS illustration
          INNER JOIN commission_quotes
            AS quote
            ON quote.id =
              illustration.quote_id
          WHERE
            quote.public_token_hash =
              ${tokenHash}
            AND quote.public_token_revoked_at
              IS NULL
            AND quote.status <> 'draft'
          ORDER BY
            illustration.sequence,
            illustration.id
        `,
    ),

    db
      .select({
        sequence: commissionQuoteItems.sequence,

        illustrationId: commissionQuoteItems.illustrationId,

        kind: commissionQuoteItems.kind,

        calculationType: commissionQuoteItems.calculationType,

        percentageRate: commissionQuoteItems.percentageRate,

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
      ),
  ]);

  const illustrationSequenceById = new Map(
    illustrationResult.rows.map((illustration) => [
      illustration.id,
      illustration.sequence,
    ]),
  );

  const items = itemRows.map((item) => ({
    sequence: item.sequence,

    illustrationSequence:
      item.illustrationId === null
        ? null
        : (illustrationSequenceById.get(item.illustrationId) ?? null),

    kind: item.kind,

    calculationType: item.calculationType,

    percentageRate: item.percentageRate,

    label: item.label,
    description: item.description,
    quantity: item.quantity,
    unitAmount: item.unitAmount,
  }));

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

    illustrations: illustrationResult.rows.map((illustration) => ({
      sequence: illustration.sequence,
    })),

    items,
  };
}
