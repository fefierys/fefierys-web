import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { validateCommissionQuoteDraft } from "../../commissions/commissionQuote";
import { db } from "../../db";
import {
  commissionEvents,
  commissionQuoteItems,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";
import { getCommissionQuoteById } from "./commissionQuoteShared";
import type {
  CommissionQuote,
  CreateCommissionQuoteDraftInput,
  CreateCommissionQuoteDraftResult,
  UpdateCommissionQuoteDraftInput,
  UpdateCommissionQuoteDraftResult,
} from "./commissionQuoteTypes";

export async function createCommissionQuoteDraft(
  input: CreateCommissionQuoteDraftInput,
): Promise<CreateCommissionQuoteDraftResult> {
  const validation = validateCommissionQuoteDraft(input);

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  const createdByAdminUserId = input.createdByAdminUserId.trim();

  if (!createdByAdminUserId) {
    throw new Error("createdByAdminUserId is required.");
  }

  const [commissionRows, latestQuoteRows, activeQuoteRows] = await db.batch([
    db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, input.commissionId))
      .limit(1),

    db
      .select({
        version: commissionQuotes.version,
      })
      .from(commissionQuotes)
      .where(eq(commissionQuotes.commissionId, input.commissionId))
      .orderBy(desc(commissionQuotes.version))
      .limit(1),

    db
      .select({
        id: commissionQuotes.id,
        version: commissionQuotes.version,
        status: commissionQuotes.status,
      })
      .from(commissionQuotes)
      .where(
        and(
          eq(commissionQuotes.commissionId, input.commissionId),
          inArray(commissionQuotes.status, ["draft", "sent"]),
        ),
      )
      .limit(1),
  ]);

  const commission = commissionRows[0];

  if (!commission) {
    return {
      outcome: "not_found",
    };
  }

  if (commission.status !== "quoting") {
    return {
      outcome: "wrong_status",
      currentStatus: commission.status,
    };
  }

  const activeQuote = activeQuoteRows[0];

  if (activeQuote) {
    return {
      outcome: "active_quote_exists",
      activeQuote,
    };
  }

  const quoteId = randomUUID();
  const eventId = randomUUID();
  const version = (latestQuoteRows[0]?.version ?? 0) + 1;
  const createdAt = new Date();

  try {
    const [createdQuoteRows, createdItemRows, , eventRows] = await db.batch([
      db
        .insert(commissionQuotes)
        .select(
          db
            .select({
              id: sql<string>`
                  ${quoteId}::uuid
                `.as("id"),

              commissionId: commissions.id,

              version: sql<number>`
                  ${version}::integer
                `.as("version"),

              status: sql<CommissionQuote["status"]>`
                  ${"draft"}::quote_status
                `.as("status"),

              currency: sql<string>`
                  ${validation.currency}
                `.as("currency"),

              totalAmount: sql<string>`
                  ${validation.totalAmount}::numeric
                `.as("total_amount"),

              description: sql<string | null>`
                  ${validation.description}
                `.as("description"),

              notes: sql<string | null>`
                  ${validation.notes}
                `.as("notes"),

              validUntil: sql<Date | null>`
                  ${validation.validUntil}
                `.as("valid_until"),

              sentAt: sql<Date | null>`
                  null::timestamptz
                `.as("sent_at"),

              acceptedAt: sql<Date | null>`
                  null::timestamptz
                `.as("accepted_at"),

              declinedAt: sql<Date | null>`
                  null::timestamptz
                `.as("declined_at"),

              expiredAt: sql<Date | null>`
                  null::timestamptz
                `.as("expired_at"),

              createdAt: sql<Date>`
                  ${createdAt}
                `.as("created_at"),

              updatedAt: sql<Date>`
                  ${createdAt}
                `.as("updated_at"),
            })
            .from(commissions)
            .where(
              and(
                eq(commissions.id, input.commissionId),
                eq(commissions.status, "quoting"),
              ),
            ),
        )
        .returning(),

      db
        .insert(commissionQuoteItems)
        .values(
          validation.items.map((item) => ({
            quoteId,
            sequence: item.sequence,
            label: item.label,
            description: item.description,
            quantity: item.quantity,
            unitAmount: item.unitAmount,
            createdAt,
            updatedAt: createdAt,
          })),
        )
        .returning(),

      db
        .update(commissions)
        .set({
          updatedAt: createdAt,
        })
        .where(
          and(
            eq(commissions.id, input.commissionId),
            eq(commissions.status, "quoting"),
          ),
        ),

      db
        .insert(commissionEvents)
        .values({
          id: eventId,
          commissionId: input.commissionId,
          type: "quote_created",
          actor: "artist",
          title: `Quote v${version} created`,
          description: validation.description,
          metadata: {
            quoteId,
            version,
            currency: validation.currency,
            totalAmount: validation.totalAmount,
          },
          createdByAdminUserId,
          createdAt,
        })
        .returning(),
    ]);

    const quote = createdQuoteRows[0];
    const event = eventRows[0];

    if (!quote || !event) {
      throw new Error("Quote draft creation returned incomplete records.");
    }

    return {
      outcome: "created",
      quote,
      items: createdItemRows,
      event,
    };
  } catch (error) {
    /*
     * Neon may commit the transaction but lose the HTTP response.
     * The pre-generated quote ID identifies that exact write.
     */
    try {
      const [committedQuote, committedEventRows] = await Promise.all([
        getCommissionQuoteById(quoteId),
        db
          .select()
          .from(commissionEvents)
          .where(eq(commissionEvents.id, eventId))
          .limit(1),
      ]);

      const committedEvent = committedEventRows[0];

      if (committedQuote && committedEvent) {
        return {
          outcome: "created",
          quote: committedQuote.quote,
          items: committedQuote.items,
          event: committedEvent,
        };
      }

      const [currentCommissionRows, currentActiveQuoteRows] = await db.batch([
        db
          .select({
            status: commissions.status,
          })
          .from(commissions)
          .where(eq(commissions.id, input.commissionId))
          .limit(1),

        db
          .select({
            id: commissionQuotes.id,
            version: commissionQuotes.version,
            status: commissionQuotes.status,
          })
          .from(commissionQuotes)
          .where(
            and(
              eq(commissionQuotes.commissionId, input.commissionId),
              inArray(commissionQuotes.status, ["draft", "sent"]),
            ),
          )
          .limit(1),
      ]);

      const currentCommission = currentCommissionRows[0];

      if (!currentCommission) {
        return {
          outcome: "not_found",
        };
      }

      if (currentCommission.status !== "quoting") {
        return {
          outcome: "wrong_status",
          currentStatus: currentCommission.status,
        };
      }

      const currentActiveQuote = currentActiveQuoteRows[0];

      if (currentActiveQuote) {
        return {
          outcome: "active_quote_exists",
          activeQuote: currentActiveQuote,
        };
      }
    } catch {
      /*
       * Preserve the original write error when reconciliation
       * cannot reach Neon either.
       */
    }

    /*
     * A concurrent finalized quote could consume the same
     * calculated version without leaving an active quote.
     */
    if (
      error instanceof Error &&
      error.message.includes("commission_quotes_commission_version_unique")
    ) {
      return {
        outcome: "conflict",
      };
    }

    throw error;
  }
}

interface UpdateCommissionQuoteDraftWriteRow extends Record<string, unknown> {
  quoteId: string;
  eventId: string;
}

async function classifyQuoteDraftUpdateFailure(quoteId: string): Promise<
  Exclude<
    UpdateCommissionQuoteDraftResult,
    {
      outcome: "updated" | "invalid";
    }
  >
> {
  const quoteRows = await db
    .select({
      commissionId: commissionQuotes.commissionId,
      status: commissionQuotes.status,
      updatedAt: commissionQuotes.updatedAt,
    })
    .from(commissionQuotes)
    .where(eq(commissionQuotes.id, quoteId))
    .limit(1);

  const quote = quoteRows[0];

  if (!quote) {
    return {
      outcome: "not_found",
    };
  }

  if (quote.status !== "draft") {
    return {
      outcome: "not_draft",
      currentStatus: quote.status,
    };
  }

  const commissionRows = await db
    .select({
      status: commissions.status,
    })
    .from(commissions)
    .where(eq(commissions.id, quote.commissionId))
    .limit(1);

  const commission = commissionRows[0];

  if (!commission) {
    return {
      outcome: "not_found",
    };
  }

  if (commission.status !== "quoting") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: commission.status,
    };
  }

  return {
    outcome: "conflict",
    currentUpdatedAt: quote.updatedAt,
  };
}

export async function updateCommissionQuoteDraft(
  input: UpdateCommissionQuoteDraftInput,
): Promise<UpdateCommissionQuoteDraftResult> {
  const validation = validateCommissionQuoteDraft(input);

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  const updatedByAdminUserId = input.updatedByAdminUserId.trim();

  if (!updatedByAdminUserId) {
    throw new Error("updatedByAdminUserId is required.");
  }

  if (
    !(input.expectedUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedUpdatedAt.getTime())
  ) {
    throw new Error("expectedUpdatedAt must be a valid Date.");
  }

  const eventId = randomUUID();
  const updatedAt = new Date();

  const serializedItems = JSON.stringify(
    validation.items.map((item) => ({
      sequence: item.sequence,
      label: item.label,
      description: item.description,
      quantity: item.quantity,
      unit_amount: item.unitAmount,
    })),
  );

  const eventMetadata = JSON.stringify({
    quoteId: input.quoteId,
    currency: validation.currency,
    totalAmount: validation.totalAmount,
    updatedAt: updatedAt.toISOString(),
  });

  try {
    const writeResult = await db.execute<UpdateCommissionQuoteDraftWriteRow>(
      sql`
          WITH
          input_items AS MATERIALIZED (
            SELECT
              input_item.sequence,
              input_item.label,
              input_item.description,
              input_item.quantity,
              input_item.unit_amount
            FROM jsonb_to_recordset(
              ${serializedItems}::jsonb
            ) AS input_item(
              sequence integer,
              label text,
              description text,
              quantity integer,
              unit_amount numeric(12, 2)
            )
          ),

          updated_quote AS (
            UPDATE commission_quotes AS quote
            SET
              currency = ${validation.currency},
              total_amount =
                ${validation.totalAmount}::numeric,
              description = ${validation.description},
              notes = ${validation.notes},
              valid_until = ${validation.validUntil},
              updated_at = ${updatedAt}
            FROM commissions AS commission
            WHERE
              quote.id = ${input.quoteId}::uuid
              AND quote.status = 'draft'
              AND quote.updated_at =
                ${input.expectedUpdatedAt}
              AND commission.id =
                quote.commission_id
              AND commission.status = 'quoting'
            RETURNING
              quote.id,
              quote.commission_id,
              quote.version
          ),

          upserted_items AS (
            INSERT INTO commission_quote_items (
              id,
              quote_id,
              sequence,
              label,
              description,
              quantity,
              unit_amount,
              created_at,
              updated_at
            )
            SELECT
              gen_random_uuid(),
              updated_quote.id,
              input_items.sequence,
              input_items.label,
              input_items.description,
              input_items.quantity,
              input_items.unit_amount,
              ${updatedAt},
              ${updatedAt}
            FROM updated_quote
            CROSS JOIN input_items
            ON CONFLICT (
              quote_id,
              sequence
            )
            DO UPDATE SET
              label = EXCLUDED.label,
              description = EXCLUDED.description,
              quantity = EXCLUDED.quantity,
              unit_amount = EXCLUDED.unit_amount,
              updated_at = EXCLUDED.updated_at
            RETURNING id
          ),

          deleted_items AS (
            DELETE FROM commission_quote_items
            USING updated_quote
            WHERE
              commission_quote_items.quote_id =
                updated_quote.id
              AND NOT EXISTS (
                SELECT 1
                FROM input_items
                WHERE
                  input_items.sequence =
                    commission_quote_items.sequence
              )
            RETURNING commission_quote_items.id
          ),

          updated_commission AS (
            UPDATE commissions AS commission
            SET updated_at = ${updatedAt}
            FROM updated_quote
            WHERE
              commission.id =
                updated_quote.commission_id
            RETURNING commission.id
          ),

          created_event AS (
            INSERT INTO commission_events (
              id,
              commission_id,
              type,
              actor,
              title,
              description,
              metadata,
              created_by_admin_user_id,
              created_at
            )
            SELECT
              ${eventId}::uuid,
              updated_quote.commission_id,
              'quote_updated'::commission_event_type,
              'artist'::commission_actor,
              'Quote v'
                || updated_quote.version
                || ' updated',
              ${validation.description},
              ${eventMetadata}::jsonb,
              ${updatedByAdminUserId},
              ${updatedAt}
            FROM updated_quote
            RETURNING id
          )

          SELECT
            updated_quote.id AS "quoteId",
            created_event.id AS "eventId",
            (
              SELECT count(*)
              FROM upserted_items
            ) AS "upsertedItemCount",
            (
              SELECT count(*)
              FROM deleted_items
            ) AS "deletedItemCount",
            (
              SELECT count(*)
              FROM updated_commission
            ) AS "updatedCommissionCount"
          FROM updated_quote
          CROSS JOIN created_event
        `,
    );

    const writeRow = writeResult.rows[0];

    if (!writeRow) {
      return classifyQuoteDraftUpdateFailure(input.quoteId);
    }

    const [updatedQuote, eventRows] = await Promise.all([
      getCommissionQuoteById(input.quoteId),

      db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, eventId))
        .limit(1),
    ]);

    const event = eventRows[0];

    if (!updatedQuote || !event) {
      throw new Error("Quote draft update returned incomplete records.");
    }

    return {
      outcome: "updated",
      quote: updatedQuote.quote,
      items: updatedQuote.items,
      event,
    };
  } catch (error) {
    /*
     * If Neon committed the transaction but its HTTP response was lost,
     * the pre-generated event ID proves that this exact update succeeded.
     */
    try {
      const [updatedQuote, eventRows] = await Promise.all([
        getCommissionQuoteById(input.quoteId),

        db
          .select()
          .from(commissionEvents)
          .where(eq(commissionEvents.id, eventId))
          .limit(1),
      ]);

      const event = eventRows[0];

      if (updatedQuote && event) {
        return {
          outcome: "updated",
          quote: updatedQuote.quote,
          items: updatedQuote.items,
          event,
        };
      }

      const classifiedFailure = await classifyQuoteDraftUpdateFailure(
        input.quoteId,
      );

      if (
        classifiedFailure.outcome === "not_found" ||
        classifiedFailure.outcome === "not_draft" ||
        classifiedFailure.outcome === "wrong_commission_status" ||
        classifiedFailure.outcome === "conflict"
      ) {
        return classifiedFailure;
      }
    } catch {
      /*
       * Preserve the original write error if reconciliation
       * cannot reach Neon either.
       */
    }

    throw error;
  }
}
