import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import {
  validateCommissionQuoteDraft,
  validateCommissionQuoteTransition,
  type CommissionQuoteDraftInput,
  type CommissionQuoteDraftValidation,
  type CommissionQuoteTransitionValidation,
} from "../commissions/commissionQuote";
import { db } from "../db";
import {
  commissionEvents,
  commissionQuoteItems,
  commissionQuotes,
  commissions,
  commissionStatusHistory,
} from "../db/schema/commissions";
import {
  validateCommissionTransition,
  type CommissionTransitionValidation,
} from "../commissions/commissionWorkflow";
import type { CommissionStatus } from "./commissionAdminRepository";

import type { CommissionManualActor } from "../commissions/commissionActivity";

export type CommissionQuote = typeof commissionQuotes.$inferSelect;

export type CommissionQuoteItem = typeof commissionQuoteItems.$inferSelect;

export type CommissionQuoteEvent = typeof commissionEvents.$inferSelect;

export interface CommissionQuoteWithItems {
  quote: CommissionQuote;
  items: CommissionQuoteItem[];
}

type InvalidQuoteDraftValidation = Extract<
  CommissionQuoteDraftValidation,
  { valid: false }
>;

type InvalidQuoteTransitionValidation = Extract<
  CommissionQuoteTransitionValidation,
  { valid: false }
>;

type InvalidCommissionTransitionValidation = Extract<
  CommissionTransitionValidation,
  { valid: false }
>;

export type CommissionStatusHistoryEntry =
  typeof commissionStatusHistory.$inferSelect;

export interface CreateCommissionQuoteDraftInput extends CommissionQuoteDraftInput {
  commissionId: string;
  createdByAdminUserId: string;
}

export type CreateCommissionQuoteDraftResult =
  | {
      outcome: "created";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidQuoteDraftValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "wrong_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "active_quote_exists";
      activeQuote: Pick<CommissionQuote, "id" | "version" | "status">;
    }
  | {
      outcome: "conflict";
    };

export interface UpdateCommissionQuoteDraftInput extends CommissionQuoteDraftInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  updatedByAdminUserId: string;
}

export type UpdateCommissionQuoteDraftResult =
  | {
      outcome: "updated";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidQuoteDraftValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_draft";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface SendCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  sentByAdminUserId: string;
}

export type SendCommissionQuoteResult =
  | {
      outcome: "sent";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      transition: CommissionStatusHistoryEntry;
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidQuoteTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_draft";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface AcceptCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  acceptedByAdminUserId: string;
}

export type AcceptCommissionQuoteResult =
  | {
      outcome: "accepted";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      transition: CommissionStatusHistoryEntry;
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidQuoteTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface DeclineCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  declinedByAdminUserId: string;
  closeReasonNote?: string | null;
}

export type DeclineCommissionQuoteResult =
  | {
      outcome: "declined";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      transition: CommissionStatusHistoryEntry;
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation:
        | InvalidQuoteTransitionValidation
        | InvalidCommissionTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface ExpireCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  recordedByAdminUserId?: string | null;
  note?: string | null;
}

export type ExpireCommissionQuoteResult =
  | {
      outcome: "expired";
      quote: CommissionQuote;
      items: CommissionQuoteItem[];
      transition: CommissionStatusHistoryEntry;
      event: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation:
        | InvalidQuoteTransitionValidation
        | InvalidCommissionTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

export interface SupersedeCommissionQuoteInput {
  quoteId: string;
  expectedUpdatedAt: Date;
  initiatedBy: CommissionManualActor;
  supersededByAdminUserId: string;
  note?: string | null;
}

export type SupersedeCommissionQuoteResult =
  | {
      outcome: "superseded";
      supersededQuote: CommissionQuote;
      draft: CommissionQuoteWithItems;
      transition: CommissionStatusHistoryEntry;
      supersededEvent: CommissionQuoteEvent;
      createdEvent: CommissionQuoteEvent;
    }
  | {
      outcome: "invalid";
      validation:
        | InvalidQuoteTransitionValidation
        | InvalidCommissionTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: CommissionQuote["status"];
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

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

interface SendCommissionQuoteWriteRow extends Record<string, unknown> {
  quoteId: string;
  transitionId: string;
  eventId: string;
}

interface CommissionQuoteSendState {
  quoteStatus: CommissionQuote["status"];
  quoteUpdatedAt: Date;
  validUntil: Date | null;
  commissionStatus: CommissionStatus;
  isOnHold: boolean;
}

async function getCommissionQuoteSendState(
  quoteId: string,
): Promise<CommissionQuoteSendState | null> {
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

async function classifyCommissionQuoteSendFailure(
  quoteId: string,
  expectedUpdatedAt: Date,
  now: Date,
): Promise<
  Exclude<
    SendCommissionQuoteResult,
    {
      outcome: "sent";
    }
  >
> {
  const state = await getCommissionQuoteSendState(quoteId);

  if (!state) {
    return {
      outcome: "not_found",
    };
  }

  if (state.quoteStatus !== "draft") {
    return {
      outcome: "not_draft",
      currentStatus: state.quoteStatus,
    };
  }

  if (state.commissionStatus !== "quoting") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: state.commissionStatus,
    };
  }

  if (state.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (state.quoteUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return {
      outcome: "conflict",
      currentUpdatedAt: state.quoteUpdatedAt,
    };
  }

  const validation = validateCommissionQuoteTransition({
    fromStatus: state.quoteStatus,
    toStatus: "sent",
    validUntil: state.validUntil,
    now,
  });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  /*
   * Every known state still satisfies the preconditions. A
   * concurrent write must have prevented the SQL operation.
   */
  return {
    outcome: "conflict",
    currentUpdatedAt: state.quoteUpdatedAt,
  };
}

export async function sendCommissionQuote(
  input: SendCommissionQuoteInput,
): Promise<SendCommissionQuoteResult> {
  const sentByAdminUserId = input.sentByAdminUserId.trim();

  if (!sentByAdminUserId) {
    throw new Error("sentByAdminUserId is required.");
  }

  if (
    !(input.expectedUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedUpdatedAt.getTime())
  ) {
    throw new Error("expectedUpdatedAt must be a valid Date.");
  }

  const initialState = await getCommissionQuoteSendState(input.quoteId);

  if (!initialState) {
    return {
      outcome: "not_found",
    };
  }

  if (initialState.quoteStatus !== "draft") {
    return {
      outcome: "not_draft",
      currentStatus: initialState.quoteStatus,
    };
  }

  if (initialState.commissionStatus !== "quoting") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: initialState.commissionStatus,
    };
  }

  if (initialState.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (
    initialState.quoteUpdatedAt.getTime() !== input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
      currentUpdatedAt: initialState.quoteUpdatedAt,
    };
  }

  const sentAt = new Date();

  const validation = validateCommissionQuoteTransition({
    fromStatus: initialState.quoteStatus,
    toStatus: "sent",
    validUntil: initialState.validUntil,
    now: sentAt,
  });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  const transitionId = randomUUID();
  const eventId = randomUUID();

  const eventMetadata = JSON.stringify({
    quoteId: input.quoteId,
    sentAt: sentAt.toISOString(),
  });

  try {
    const writeResult = await db.execute<SendCommissionQuoteWriteRow>(
      sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              quote.id AS quote_id,
              quote.commission_id,
              quote.version,
              quote.currency,
              quote.total_amount
            FROM commission_quotes AS quote
            INNER JOIN commissions AS commission
              ON commission.id =
                quote.commission_id
            WHERE
              quote.id = ${input.quoteId}::uuid
              AND quote.status = 'draft'
              AND quote.updated_at =
                ${input.expectedUpdatedAt}
              AND quote.valid_until IS NOT NULL
              AND quote.valid_until > ${sentAt}
              AND commission.status = 'quoting'
              AND commission.is_on_hold = false
            FOR UPDATE OF quote, commission
          ),

          updated_quote AS (
            UPDATE commission_quotes AS quote
            SET
              status = 'sent',
              sent_at = ${sentAt},
              updated_at = ${sentAt}
            FROM locked_target
            WHERE
              quote.id =
                locked_target.quote_id
            RETURNING
              quote.id,
              quote.commission_id,
              quote.version,
              quote.currency,
              quote.total_amount
          ),

          updated_commission AS (
            UPDATE commissions AS commission
            SET
              status = 'awaiting_quote_response',
              updated_at = ${sentAt}
            FROM locked_target
            WHERE
              commission.id =
                locked_target.commission_id
            RETURNING commission.id
          ),

          created_transition AS (
            INSERT INTO commission_status_history (
              id,
              commission_id,
              from_status,
              to_status,
              initiated_by,
              reason,
              note,
              changed_by_admin_user_id,
              created_at
            )
            SELECT
              ${transitionId}::uuid,
              updated_quote.commission_id,
              'quoting'::commission_status,
              'awaiting_quote_response'::commission_status,
              'artist'::commission_actor,
              'quote_sent',
              null,
              ${sentByAdminUserId},
              ${sentAt}
            FROM updated_quote
            INNER JOIN updated_commission
              ON updated_commission.id =
                updated_quote.commission_id
            RETURNING id
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
              'quote_sent'::commission_event_type,
              'artist'::commission_actor,
              'Quote v'
                || updated_quote.version
                || ' sent',
              null,
              ${eventMetadata}::jsonb,
              ${sentByAdminUserId},
              ${sentAt}
            FROM updated_quote
            INNER JOIN created_transition
              ON true
            RETURNING id
          )

          SELECT
            updated_quote.id AS "quoteId",
            created_transition.id AS "transitionId",
            created_event.id AS "eventId"
          FROM updated_quote
          CROSS JOIN created_transition
          CROSS JOIN created_event
        `,
    );

    const writeRow = writeResult.rows[0];

    if (!writeRow) {
      return classifyCommissionQuoteSendFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        sentAt,
      );
    }

    const [sentQuote, transitionRows, eventRows] = await Promise.all([
      getCommissionQuoteById(input.quoteId),

      db
        .select()
        .from(commissionStatusHistory)
        .where(eq(commissionStatusHistory.id, transitionId))
        .limit(1),

      db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, eventId))
        .limit(1),
    ]);

    const transition = transitionRows[0];
    const event = eventRows[0];

    if (!sentQuote || !transition || !event) {
      throw new Error("Quote send returned incomplete records.");
    }

    return {
      outcome: "sent",
      quote: sentQuote.quote,
      items: sentQuote.items,
      transition,
      event,
    };
  } catch (error) {
    /*
     * The generated history and event IDs identify this exact
     * operation if Neon committed but lost the HTTP response.
     */
    try {
      const [sentQuote, transitionRows, eventRows] = await Promise.all([
        getCommissionQuoteById(input.quoteId),

        db
          .select()
          .from(commissionStatusHistory)
          .where(eq(commissionStatusHistory.id, transitionId))
          .limit(1),

        db
          .select()
          .from(commissionEvents)
          .where(eq(commissionEvents.id, eventId))
          .limit(1),
      ]);

      const transition = transitionRows[0];
      const event = eventRows[0];

      if (sentQuote?.quote.status === "sent" && transition && event) {
        return {
          outcome: "sent",
          quote: sentQuote.quote,
          items: sentQuote.items,
          transition,
          event,
        };
      }

      return await classifyCommissionQuoteSendFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        sentAt,
      );
    } catch {
      /*
       * Preserve the original database error when
       * reconciliation cannot reach Neon either.
       */
    }

    throw error;
  }
}

interface AcceptCommissionQuoteWriteRow extends Record<string, unknown> {
  quoteId: string;
  transitionId: string;
  eventId: string;
}

async function classifyCommissionQuoteAcceptanceFailure(
  quoteId: string,
  expectedUpdatedAt: Date,
  now: Date,
): Promise<
  Exclude<
    AcceptCommissionQuoteResult,
    {
      outcome: "accepted";
    }
  >
> {
  const state = await getCommissionQuoteSendState(quoteId);

  if (!state) {
    return {
      outcome: "not_found",
    };
  }

  if (state.quoteStatus !== "sent") {
    return {
      outcome: "not_sent",
      currentStatus: state.quoteStatus,
    };
  }

  if (state.commissionStatus !== "awaiting_quote_response") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: state.commissionStatus,
    };
  }

  if (state.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (state.quoteUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return {
      outcome: "conflict",
      currentUpdatedAt: state.quoteUpdatedAt,
    };
  }

  const validation = validateCommissionQuoteTransition({
    fromStatus: state.quoteStatus,
    toStatus: "accepted",
    validUntil: state.validUntil,
    now,
  });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  return {
    outcome: "conflict",
    currentUpdatedAt: state.quoteUpdatedAt,
  };
}

export async function acceptCommissionQuote(
  input: AcceptCommissionQuoteInput,
): Promise<AcceptCommissionQuoteResult> {
  const acceptedByAdminUserId = input.acceptedByAdminUserId.trim();

  if (!acceptedByAdminUserId) {
    throw new Error("acceptedByAdminUserId is required.");
  }

  if (
    !(input.expectedUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedUpdatedAt.getTime())
  ) {
    throw new Error("expectedUpdatedAt must be a valid Date.");
  }

  const initialState = await getCommissionQuoteSendState(input.quoteId);

  if (!initialState) {
    return {
      outcome: "not_found",
    };
  }

  if (initialState.quoteStatus !== "sent") {
    return {
      outcome: "not_sent",
      currentStatus: initialState.quoteStatus,
    };
  }

  if (initialState.commissionStatus !== "awaiting_quote_response") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: initialState.commissionStatus,
    };
  }

  if (initialState.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (
    initialState.quoteUpdatedAt.getTime() !== input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
      currentUpdatedAt: initialState.quoteUpdatedAt,
    };
  }

  const acceptedAt = new Date();

  const validation = validateCommissionQuoteTransition({
    fromStatus: initialState.quoteStatus,
    toStatus: "accepted",
    validUntil: initialState.validUntil,
    now: acceptedAt,
  });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  const transitionId = randomUUID();
  const eventId = randomUUID();

  const eventMetadata = JSON.stringify({
    quoteId: input.quoteId,
    acceptedAt: acceptedAt.toISOString(),
  });

  try {
    const writeResult = await db.execute<AcceptCommissionQuoteWriteRow>(
      sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              quote.id AS quote_id,
              quote.commission_id,
              quote.version
            FROM commission_quotes AS quote
            INNER JOIN commissions AS commission
              ON commission.id =
                quote.commission_id
            WHERE
              quote.id = ${input.quoteId}::uuid
              AND quote.status = 'sent'
              AND quote.updated_at =
                ${input.expectedUpdatedAt}
              AND quote.valid_until IS NOT NULL
              AND quote.valid_until > ${acceptedAt}
              AND commission.status =
                'awaiting_quote_response'
              AND commission.is_on_hold = false
            FOR UPDATE OF quote, commission
          ),

          updated_quote AS (
            UPDATE commission_quotes AS quote
            SET
              status = 'accepted',
              accepted_at = ${acceptedAt},
              updated_at = ${acceptedAt}
            FROM locked_target
            WHERE
              quote.id =
                locked_target.quote_id
            RETURNING
              quote.id,
              quote.commission_id,
              quote.version
          ),

          updated_commission AS (
            UPDATE commissions AS commission
            SET
              status = 'awaiting_payment',
              updated_at = ${acceptedAt}
            FROM locked_target
            WHERE
              commission.id =
                locked_target.commission_id
            RETURNING commission.id
          ),

          created_transition AS (
            INSERT INTO commission_status_history (
              id,
              commission_id,
              from_status,
              to_status,
              initiated_by,
              reason,
              note,
              changed_by_admin_user_id,
              created_at
            )
            SELECT
              ${transitionId}::uuid,
              updated_quote.commission_id,
              'awaiting_quote_response'::commission_status,
              'awaiting_payment'::commission_status,
              'client'::commission_actor,
              'quote_accepted',
              null,
              ${acceptedByAdminUserId},
              ${acceptedAt}
            FROM updated_quote
            INNER JOIN updated_commission
              ON updated_commission.id =
                updated_quote.commission_id
            RETURNING id
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
              'quote_accepted'::commission_event_type,
              'client'::commission_actor,
              'Quote v'
                || updated_quote.version
                || ' accepted',
              null,
              ${eventMetadata}::jsonb,
              ${acceptedByAdminUserId},
              ${acceptedAt}
            FROM updated_quote
            INNER JOIN created_transition
              ON true
            RETURNING id
          )

          SELECT
            updated_quote.id AS "quoteId",
            created_transition.id AS "transitionId",
            created_event.id AS "eventId"
          FROM updated_quote
          CROSS JOIN created_transition
          CROSS JOIN created_event
        `,
    );

    const writeRow = writeResult.rows[0];

    if (!writeRow) {
      return classifyCommissionQuoteAcceptanceFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        acceptedAt,
      );
    }

    const [acceptedQuote, transitionRows, eventRows] = await Promise.all([
      getCommissionQuoteById(input.quoteId),

      db
        .select()
        .from(commissionStatusHistory)
        .where(eq(commissionStatusHistory.id, transitionId))
        .limit(1),

      db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, eventId))
        .limit(1),
    ]);

    const transition = transitionRows[0];
    const event = eventRows[0];

    if (!acceptedQuote || !transition || !event) {
      throw new Error("Quote acceptance returned incomplete records.");
    }

    return {
      outcome: "accepted",
      quote: acceptedQuote.quote,
      items: acceptedQuote.items,
      transition,
      event,
    };
  } catch (error) {
    /*
     * Pre-generated IDs identify this exact acceptance if
     * Neon committed but lost the HTTP response.
     */
    try {
      const [acceptedQuote, transitionRows, eventRows] = await Promise.all([
        getCommissionQuoteById(input.quoteId),

        db
          .select()
          .from(commissionStatusHistory)
          .where(eq(commissionStatusHistory.id, transitionId))
          .limit(1),

        db
          .select()
          .from(commissionEvents)
          .where(eq(commissionEvents.id, eventId))
          .limit(1),
      ]);

      const transition = transitionRows[0];
      const event = eventRows[0];

      if (acceptedQuote?.quote.status === "accepted" && transition && event) {
        return {
          outcome: "accepted",
          quote: acceptedQuote.quote,
          items: acceptedQuote.items,
          transition,
          event,
        };
      }

      return await classifyCommissionQuoteAcceptanceFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        acceptedAt,
      );
    } catch {
      /*
       * Preserve the original database error if
       * reconciliation cannot reach Neon.
       */
    }

    throw error;
  }
}

interface DeclineCommissionQuoteWriteRow extends Record<string, unknown> {
  quoteId: string;
  transitionId: string;
  eventId: string;
}

async function classifyCommissionQuoteDeclineFailure(
  quoteId: string,
  expectedUpdatedAt: Date,
  now: Date,
  closeReasonNote: string | null,
): Promise<
  Exclude<
    DeclineCommissionQuoteResult,
    {
      outcome: "declined";
    }
  >
> {
  const state = await getCommissionQuoteSendState(quoteId);

  if (!state) {
    return {
      outcome: "not_found",
    };
  }

  if (state.quoteStatus !== "sent") {
    return {
      outcome: "not_sent",
      currentStatus: state.quoteStatus,
    };
  }

  if (state.commissionStatus !== "awaiting_quote_response") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: state.commissionStatus,
    };
  }

  if (state.quoteUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return {
      outcome: "conflict",
      currentUpdatedAt: state.quoteUpdatedAt,
    };
  }

  const quoteValidation = validateCommissionQuoteTransition({
    fromStatus: state.quoteStatus,
    toStatus: "declined",
    validUntil: state.validUntil,
    now,
  });

  if (!quoteValidation.valid) {
    return {
      outcome: "invalid",
      validation: quoteValidation,
    };
  }

  const commissionValidation = validateCommissionTransition({
    fromStatus: state.commissionStatus,
    toStatus: "declined",
    initiatedBy: "client",
    closeReason: "client_declined_quote",
    closeReasonNote,
  });

  if (!commissionValidation.valid) {
    return {
      outcome: "invalid",
      validation: commissionValidation,
    };
  }

  return {
    outcome: "conflict",
    currentUpdatedAt: state.quoteUpdatedAt,
  };
}

export async function declineCommissionQuote(
  input: DeclineCommissionQuoteInput,
): Promise<DeclineCommissionQuoteResult> {
  const declinedByAdminUserId = input.declinedByAdminUserId.trim();

  if (!declinedByAdminUserId) {
    throw new Error("declinedByAdminUserId is required.");
  }

  if (
    !(input.expectedUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedUpdatedAt.getTime())
  ) {
    throw new Error("expectedUpdatedAt must be a valid Date.");
  }

  const closeReasonNote = input.closeReasonNote?.trim() || null;

  const initialState = await getCommissionQuoteSendState(input.quoteId);

  if (!initialState) {
    return {
      outcome: "not_found",
    };
  }

  if (initialState.quoteStatus !== "sent") {
    return {
      outcome: "not_sent",
      currentStatus: initialState.quoteStatus,
    };
  }

  if (initialState.commissionStatus !== "awaiting_quote_response") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: initialState.commissionStatus,
    };
  }

  if (
    initialState.quoteUpdatedAt.getTime() !== input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
      currentUpdatedAt: initialState.quoteUpdatedAt,
    };
  }

  const declinedAt = new Date();

  const quoteValidation = validateCommissionQuoteTransition({
    fromStatus: initialState.quoteStatus,
    toStatus: "declined",
    validUntil: initialState.validUntil,
    now: declinedAt,
  });

  if (!quoteValidation.valid) {
    return {
      outcome: "invalid",
      validation: quoteValidation,
    };
  }

  const commissionValidation = validateCommissionTransition({
    fromStatus: initialState.commissionStatus,
    toStatus: "declined",
    initiatedBy: "client",
    closeReason: "client_declined_quote",
    closeReasonNote,
  });

  if (!commissionValidation.valid) {
    return {
      outcome: "invalid",
      validation: commissionValidation,
    };
  }

  const transitionId = randomUUID();
  const eventId = randomUUID();

  const eventMetadata = JSON.stringify({
    quoteId: input.quoteId,
    closeReason: "client_declined_quote",
    declinedAt: declinedAt.toISOString(),
  });

  try {
    const writeResult = await db.execute<DeclineCommissionQuoteWriteRow>(
      sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              quote.id AS quote_id,
              quote.commission_id,
              quote.version
            FROM commission_quotes AS quote
            INNER JOIN commissions AS commission
              ON commission.id =
                quote.commission_id
            WHERE
              quote.id = ${input.quoteId}::uuid
              AND quote.status = 'sent'
              AND quote.updated_at =
                ${input.expectedUpdatedAt}
              AND commission.status =
                'awaiting_quote_response'
            FOR UPDATE OF quote, commission
          ),

          updated_quote AS (
            UPDATE commission_quotes AS quote
            SET
              status = 'declined',
              declined_at = ${declinedAt},
              updated_at = ${declinedAt}
            FROM locked_target
            WHERE
              quote.id =
                locked_target.quote_id
            RETURNING
              quote.id,
              quote.commission_id,
              quote.version
          ),

          updated_commission AS (
            UPDATE commissions AS commission
            SET
              status = 'declined',
              close_reason =
                'client_declined_quote',
              close_reason_note = ${closeReasonNote},
              closed_by = 'client',
              is_on_hold = false,
              hold_reason = null,
              hold_started_at = null,
              closed_at = ${declinedAt},
              updated_at = ${declinedAt}
            FROM locked_target
            WHERE
              commission.id =
                locked_target.commission_id
            RETURNING commission.id
          ),

          created_transition AS (
            INSERT INTO commission_status_history (
              id,
              commission_id,
              from_status,
              to_status,
              initiated_by,
              reason,
              note,
              changed_by_admin_user_id,
              created_at
            )
            SELECT
              ${transitionId}::uuid,
              updated_quote.commission_id,
              'awaiting_quote_response'::commission_status,
              'declined'::commission_status,
              'client'::commission_actor,
              'client_declined_quote',
              ${closeReasonNote},
              ${declinedByAdminUserId},
              ${declinedAt}
            FROM updated_quote
            INNER JOIN updated_commission
              ON updated_commission.id =
                updated_quote.commission_id
            RETURNING id
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
              'quote_declined'::commission_event_type,
              'client'::commission_actor,
              'Quote v'
                || updated_quote.version
                || ' declined',
              ${closeReasonNote},
              ${eventMetadata}::jsonb,
              ${declinedByAdminUserId},
              ${declinedAt}
            FROM updated_quote
            INNER JOIN created_transition
              ON true
            RETURNING id
          )

          SELECT
            updated_quote.id AS "quoteId",
            created_transition.id AS "transitionId",
            created_event.id AS "eventId"
          FROM updated_quote
          CROSS JOIN created_transition
          CROSS JOIN created_event
        `,
    );

    const writeRow = writeResult.rows[0];

    if (!writeRow) {
      return classifyCommissionQuoteDeclineFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        declinedAt,
        closeReasonNote,
      );
    }

    const [declinedQuote, transitionRows, eventRows] = await Promise.all([
      getCommissionQuoteById(input.quoteId),

      db
        .select()
        .from(commissionStatusHistory)
        .where(eq(commissionStatusHistory.id, transitionId))
        .limit(1),

      db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, eventId))
        .limit(1),
    ]);

    const transition = transitionRows[0];
    const event = eventRows[0];

    if (!declinedQuote || !transition || !event) {
      throw new Error("Quote decline returned incomplete records.");
    }

    return {
      outcome: "declined",
      quote: declinedQuote.quote,
      items: declinedQuote.items,
      transition,
      event,
    };
  } catch (error) {
    /*
     * Pre-generated IDs identify this exact decline if Neon
     * committed but lost the HTTP response.
     */
    try {
      const [declinedQuote, transitionRows, eventRows] = await Promise.all([
        getCommissionQuoteById(input.quoteId),

        db
          .select()
          .from(commissionStatusHistory)
          .where(eq(commissionStatusHistory.id, transitionId))
          .limit(1),

        db
          .select()
          .from(commissionEvents)
          .where(eq(commissionEvents.id, eventId))
          .limit(1),
      ]);

      const transition = transitionRows[0];
      const event = eventRows[0];

      if (declinedQuote?.quote.status === "declined" && transition && event) {
        return {
          outcome: "declined",
          quote: declinedQuote.quote,
          items: declinedQuote.items,
          transition,
          event,
        };
      }

      return await classifyCommissionQuoteDeclineFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        declinedAt,
        closeReasonNote,
      );
    } catch {
      /*
       * Preserve the original database error if
       * reconciliation cannot reach Neon.
       */
    }

    throw error;
  }
}

interface ExpireCommissionQuoteWriteRow extends Record<string, unknown> {
  quoteId: string;
  transitionId: string;
  eventId: string;
}

async function classifyCommissionQuoteExpirationFailure(
  quoteId: string,
  expectedUpdatedAt: Date,
  now: Date,
  note: string | null,
): Promise<
  Exclude<
    ExpireCommissionQuoteResult,
    {
      outcome: "expired";
    }
  >
> {
  const state = await getCommissionQuoteSendState(quoteId);

  if (!state) {
    return {
      outcome: "not_found",
    };
  }

  if (state.quoteStatus !== "sent") {
    return {
      outcome: "not_sent",
      currentStatus: state.quoteStatus,
    };
  }

  if (state.commissionStatus !== "awaiting_quote_response") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: state.commissionStatus,
    };
  }

  if (state.quoteUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return {
      outcome: "conflict",
      currentUpdatedAt: state.quoteUpdatedAt,
    };
  }

  const quoteValidation = validateCommissionQuoteTransition({
    fromStatus: state.quoteStatus,
    toStatus: "expired",
    validUntil: state.validUntil,
    now,
  });

  if (!quoteValidation.valid) {
    return {
      outcome: "invalid",
      validation: quoteValidation,
    };
  }

  const commissionValidation = validateCommissionTransition({
    fromStatus: state.commissionStatus,
    toStatus: "expired",
    initiatedBy: "system",
    closeReason: "quote_expired",
    closeReasonNote: note,
  });

  if (!commissionValidation.valid) {
    return {
      outcome: "invalid",
      validation: commissionValidation,
    };
  }

  return {
    outcome: "conflict",
    currentUpdatedAt: state.quoteUpdatedAt,
  };
}

export async function expireCommissionQuote(
  input: ExpireCommissionQuoteInput,
): Promise<ExpireCommissionQuoteResult> {
  if (
    !(input.expectedUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedUpdatedAt.getTime())
  ) {
    throw new Error("expectedUpdatedAt must be a valid Date.");
  }

  const recordedByAdminUserId = input.recordedByAdminUserId?.trim() || null;

  const note = input.note?.trim() || null;

  const initialState = await getCommissionQuoteSendState(input.quoteId);

  if (!initialState) {
    return {
      outcome: "not_found",
    };
  }

  if (initialState.quoteStatus !== "sent") {
    return {
      outcome: "not_sent",
      currentStatus: initialState.quoteStatus,
    };
  }

  if (initialState.commissionStatus !== "awaiting_quote_response") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: initialState.commissionStatus,
    };
  }

  if (
    initialState.quoteUpdatedAt.getTime() !== input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
      currentUpdatedAt: initialState.quoteUpdatedAt,
    };
  }

  const expiredAt = new Date();

  const quoteValidation = validateCommissionQuoteTransition({
    fromStatus: initialState.quoteStatus,
    toStatus: "expired",
    validUntil: initialState.validUntil,
    now: expiredAt,
  });

  if (!quoteValidation.valid) {
    return {
      outcome: "invalid",
      validation: quoteValidation,
    };
  }

  const commissionValidation = validateCommissionTransition({
    fromStatus: initialState.commissionStatus,
    toStatus: "expired",
    initiatedBy: "system",
    closeReason: "quote_expired",
    closeReasonNote: note,
  });

  if (!commissionValidation.valid) {
    return {
      outcome: "invalid",
      validation: commissionValidation,
    };
  }

  const transitionId = randomUUID();
  const eventId = randomUUID();

  const eventMetadata = JSON.stringify({
    quoteId: input.quoteId,
    closeReason: "quote_expired",
    expiredAt: expiredAt.toISOString(),
  });

  try {
    const writeResult = await db.execute<ExpireCommissionQuoteWriteRow>(
      sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              quote.id AS quote_id,
              quote.commission_id,
              quote.version
            FROM commission_quotes AS quote
            INNER JOIN commissions AS commission
              ON commission.id =
                quote.commission_id
            WHERE
              quote.id = ${input.quoteId}::uuid
              AND quote.status = 'sent'
              AND quote.updated_at =
                ${input.expectedUpdatedAt}
              AND quote.valid_until IS NOT NULL
              AND quote.valid_until <= ${expiredAt}
              AND commission.status =
                'awaiting_quote_response'
            FOR UPDATE OF quote, commission
          ),

          updated_quote AS (
            UPDATE commission_quotes AS quote
            SET
              status = 'expired',
              expired_at = ${expiredAt},
              updated_at = ${expiredAt}
            FROM locked_target
            WHERE
              quote.id =
                locked_target.quote_id
            RETURNING
              quote.id,
              quote.commission_id,
              quote.version
          ),

          updated_commission AS (
            UPDATE commissions AS commission
            SET
              status = 'expired',
              close_reason = 'quote_expired',
              close_reason_note = ${note},
              closed_by = 'system',
              is_on_hold = false,
              hold_reason = null,
              hold_started_at = null,
              closed_at = ${expiredAt},
              updated_at = ${expiredAt}
            FROM locked_target
            WHERE
              commission.id =
                locked_target.commission_id
            RETURNING commission.id
          ),

          created_transition AS (
            INSERT INTO commission_status_history (
              id,
              commission_id,
              from_status,
              to_status,
              initiated_by,
              reason,
              note,
              changed_by_admin_user_id,
              created_at
            )
            SELECT
              ${transitionId}::uuid,
              updated_quote.commission_id,
              'awaiting_quote_response'::commission_status,
              'expired'::commission_status,
              'system'::commission_actor,
              'quote_expired',
              ${note},
              ${recordedByAdminUserId},
              ${expiredAt}
            FROM updated_quote
            INNER JOIN updated_commission
              ON updated_commission.id =
                updated_quote.commission_id
            RETURNING id
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
              'quote_expired'::commission_event_type,
              'system'::commission_actor,
              'Quote v'
                || updated_quote.version
                || ' expired',
              ${note},
              ${eventMetadata}::jsonb,
              ${recordedByAdminUserId},
              ${expiredAt}
            FROM updated_quote
            INNER JOIN created_transition
              ON true
            RETURNING id
          )

          SELECT
            updated_quote.id AS "quoteId",
            created_transition.id AS "transitionId",
            created_event.id AS "eventId"
          FROM updated_quote
          CROSS JOIN created_transition
          CROSS JOIN created_event
        `,
    );

    const writeRow = writeResult.rows[0];

    if (!writeRow) {
      return classifyCommissionQuoteExpirationFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        expiredAt,
        note,
      );
    }

    const [expiredQuote, transitionRows, eventRows] = await Promise.all([
      getCommissionQuoteById(input.quoteId),

      db
        .select()
        .from(commissionStatusHistory)
        .where(eq(commissionStatusHistory.id, transitionId))
        .limit(1),

      db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, eventId))
        .limit(1),
    ]);

    const transition = transitionRows[0];
    const event = eventRows[0];

    if (!expiredQuote || !transition || !event) {
      throw new Error("Quote expiration returned incomplete records.");
    }

    return {
      outcome: "expired",
      quote: expiredQuote.quote,
      items: expiredQuote.items,
      transition,
      event,
    };
  } catch (error) {
    /*
     * Pre-generated IDs identify this exact expiration if
     * Neon committed but lost the HTTP response.
     */
    try {
      const [expiredQuote, transitionRows, eventRows] = await Promise.all([
        getCommissionQuoteById(input.quoteId),

        db
          .select()
          .from(commissionStatusHistory)
          .where(eq(commissionStatusHistory.id, transitionId))
          .limit(1),

        db
          .select()
          .from(commissionEvents)
          .where(eq(commissionEvents.id, eventId))
          .limit(1),
      ]);

      const transition = transitionRows[0];
      const event = eventRows[0];

      if (expiredQuote?.quote.status === "expired" && transition && event) {
        return {
          outcome: "expired",
          quote: expiredQuote.quote,
          items: expiredQuote.items,
          transition,
          event,
        };
      }

      return await classifyCommissionQuoteExpirationFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        expiredAt,
        note,
      );
    } catch {
      /*
       * Preserve the original database error if
       * reconciliation cannot reach Neon.
       */
    }

    throw error;
  }
}

interface SupersedeCommissionQuoteWriteRow extends Record<string, unknown> {
  supersededQuoteId: string;
  draftQuoteId: string;
  transitionId: string;
  supersededEventId: string;
  createdEventId: string;
}

async function classifyCommissionQuoteSupersedeFailure(
  quoteId: string,
  expectedUpdatedAt: Date,
  now: Date,
  initiatedBy: CommissionManualActor,
): Promise<
  Exclude<
    SupersedeCommissionQuoteResult,
    {
      outcome: "superseded";
    }
  >
> {
  const state = await getCommissionQuoteSendState(quoteId);

  if (!state) {
    return {
      outcome: "not_found",
    };
  }

  if (state.quoteStatus !== "sent") {
    return {
      outcome: "not_sent",
      currentStatus: state.quoteStatus,
    };
  }

  if (state.commissionStatus !== "awaiting_quote_response") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: state.commissionStatus,
    };
  }

  if (state.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (state.quoteUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return {
      outcome: "conflict",
      currentUpdatedAt: state.quoteUpdatedAt,
    };
  }

  const quoteValidation = validateCommissionQuoteTransition({
    fromStatus: state.quoteStatus,
    toStatus: "superseded",
    validUntil: state.validUntil,
    now,
  });

  if (!quoteValidation.valid) {
    return {
      outcome: "invalid",
      validation: quoteValidation,
    };
  }

  const commissionValidation = validateCommissionTransition({
    fromStatus: state.commissionStatus,
    toStatus: "quoting",
    initiatedBy,
  });

  if (!commissionValidation.valid) {
    return {
      outcome: "invalid",
      validation: commissionValidation,
    };
  }

  return {
    outcome: "conflict",
    currentUpdatedAt: state.quoteUpdatedAt,
  };
}

export async function supersedeCommissionQuote(
  input: SupersedeCommissionQuoteInput,
): Promise<SupersedeCommissionQuoteResult> {
  const supersededByAdminUserId = input.supersededByAdminUserId.trim();

  if (!supersededByAdminUserId) {
    throw new Error("supersededByAdminUserId is required.");
  }

  if (
    !(input.expectedUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedUpdatedAt.getTime())
  ) {
    throw new Error("expectedUpdatedAt must be a valid Date.");
  }

  const note = input.note?.trim() || null;

  const initialState = await getCommissionQuoteSendState(input.quoteId);

  if (!initialState) {
    return {
      outcome: "not_found",
    };
  }

  if (initialState.quoteStatus !== "sent") {
    return {
      outcome: "not_sent",
      currentStatus: initialState.quoteStatus,
    };
  }

  if (initialState.commissionStatus !== "awaiting_quote_response") {
    return {
      outcome: "wrong_commission_status",
      currentStatus: initialState.commissionStatus,
    };
  }

  if (initialState.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (
    initialState.quoteUpdatedAt.getTime() !== input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
      currentUpdatedAt: initialState.quoteUpdatedAt,
    };
  }

  const supersededAt = new Date();

  const quoteValidation = validateCommissionQuoteTransition({
    fromStatus: initialState.quoteStatus,
    toStatus: "superseded",
    validUntil: initialState.validUntil,
    now: supersededAt,
  });

  if (!quoteValidation.valid) {
    return {
      outcome: "invalid",
      validation: quoteValidation,
    };
  }

  const commissionValidation = validateCommissionTransition({
    fromStatus: initialState.commissionStatus,
    toStatus: "quoting",
    initiatedBy: input.initiatedBy,
  });

  if (!commissionValidation.valid) {
    return {
      outcome: "invalid",
      validation: commissionValidation,
    };
  }

  const draftQuoteId = randomUUID();
  const transitionId = randomUUID();
  const supersededEventId = randomUUID();
  const createdEventId = randomUUID();

  try {
    const writeResult = await db.execute<SupersedeCommissionQuoteWriteRow>(
      sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              quote.id AS quote_id,
              quote.commission_id,
              quote.version,
              quote.currency,
              quote.total_amount,
              quote.description,
              quote.notes
            FROM commission_quotes AS quote
            INNER JOIN commissions AS commission
              ON commission.id =
                quote.commission_id
            WHERE
              quote.id = ${input.quoteId}::uuid
              AND quote.status = 'sent'
              AND quote.updated_at =
                ${input.expectedUpdatedAt}
              AND commission.status =
                'awaiting_quote_response'
              AND commission.is_on_hold = false
            FOR UPDATE OF quote, commission
          ),

          updated_quote AS (
            UPDATE commission_quotes AS quote
            SET
              status = 'superseded',
              updated_at = ${supersededAt}
            FROM locked_target
            WHERE
              quote.id =
                locked_target.quote_id
            RETURNING
              quote.id,
              quote.commission_id,
              quote.version
          ),

          updated_commission AS (
            UPDATE commissions AS commission
            SET
              status = 'quoting',
              updated_at = ${supersededAt}
            FROM locked_target
            WHERE
              commission.id =
                locked_target.commission_id
            RETURNING commission.id
          ),

          created_draft AS (
            INSERT INTO commission_quotes (
              id,
              commission_id,
              version,
              status,
              currency,
              total_amount,
              description,
              notes,
              valid_until,
              sent_at,
              accepted_at,
              declined_at,
              expired_at,
              created_at,
              updated_at
            )
            SELECT
              ${draftQuoteId}::uuid,
              locked_target.commission_id,
              locked_target.version + 1,
              'draft'::quote_status,
              locked_target.currency,
              locked_target.total_amount,
              locked_target.description,
              locked_target.notes,
              null,
              null,
              null,
              null,
              null,
              ${supersededAt},
              ${supersededAt}
            FROM locked_target
            INNER JOIN updated_quote
              ON updated_quote.id =
                locked_target.quote_id
            INNER JOIN updated_commission
              ON updated_commission.id =
                locked_target.commission_id
            RETURNING
              id,
              commission_id,
              version
          ),

          created_items AS (
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
              created_draft.id,
              item.sequence,
              item.label,
              item.description,
              item.quantity,
              item.unit_amount,
              ${supersededAt},
              ${supersededAt}
            FROM created_draft
            INNER JOIN commission_quote_items AS item
              ON item.quote_id =
                ${input.quoteId}::uuid
            RETURNING id
          ),

          created_transition AS (
            INSERT INTO commission_status_history (
              id,
              commission_id,
              from_status,
              to_status,
              initiated_by,
              reason,
              note,
              changed_by_admin_user_id,
              created_at
            )
            SELECT
              ${transitionId}::uuid,
              created_draft.commission_id,
              'awaiting_quote_response'::commission_status,
              'quoting'::commission_status,
              ${input.initiatedBy}::commission_actor,
              'quote_revision_requested',
              ${note},
              ${supersededByAdminUserId},
              ${supersededAt}
            FROM created_draft
            RETURNING id
          ),

          created_superseded_event AS (
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
              ${supersededEventId}::uuid,
              created_draft.commission_id,
              'quote_superseded'::commission_event_type,
              ${input.initiatedBy}::commission_actor,
              'Quote v'
                || updated_quote.version
                || ' superseded',
              ${note},
              jsonb_build_object(
                'quoteId',
                updated_quote.id,
                'version',
                updated_quote.version,
                'newQuoteId',
                created_draft.id,
                'newVersion',
                created_draft.version
              ),
              ${supersededByAdminUserId},
              ${supersededAt}
            FROM created_draft
            INNER JOIN updated_quote
              ON true
            INNER JOIN created_transition
              ON true
            RETURNING id
          ),

          created_draft_event AS (
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
              ${createdEventId}::uuid,
              created_draft.commission_id,
              'quote_created'::commission_event_type,
              ${input.initiatedBy}::commission_actor,
              'Quote v'
                || created_draft.version
                || ' created',
              ${note},
              jsonb_build_object(
                'quoteId',
                created_draft.id,
                'version',
                created_draft.version,
                'supersededQuoteId',
                updated_quote.id,
                'supersededVersion',
                updated_quote.version
              ),
              ${supersededByAdminUserId},
              ${supersededAt}
            FROM created_draft
            INNER JOIN updated_quote
              ON true
            INNER JOIN created_superseded_event
              ON true
            RETURNING id
          )

          SELECT
            updated_quote.id AS "supersededQuoteId",
            created_draft.id AS "draftQuoteId",
            created_transition.id AS "transitionId",
            created_superseded_event.id AS "supersededEventId",
            created_draft_event.id AS "createdEventId",
            (
              SELECT count(*)
              FROM created_items
            ) AS "createdItemCount"
          FROM updated_quote
          CROSS JOIN created_draft
          CROSS JOIN created_transition
          CROSS JOIN created_superseded_event
          CROSS JOIN created_draft_event
        `,
    );

    const writeRow = writeResult.rows[0];

    if (!writeRow) {
      return classifyCommissionQuoteSupersedeFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        supersededAt,
        input.initiatedBy,
      );
    }

    const [
      supersededQuoteRows,
      draft,
      transitionRows,
      supersededEventRows,
      createdEventRows,
    ] = await Promise.all([
      db
        .select()
        .from(commissionQuotes)
        .where(eq(commissionQuotes.id, input.quoteId))
        .limit(1),

      getCommissionQuoteById(draftQuoteId),

      db
        .select()
        .from(commissionStatusHistory)
        .where(eq(commissionStatusHistory.id, transitionId))
        .limit(1),

      db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, supersededEventId))
        .limit(1),

      db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, createdEventId))
        .limit(1),
    ]);

    const supersededQuote = supersededQuoteRows[0];
    const transition = transitionRows[0];
    const supersededEvent = supersededEventRows[0];
    const createdEvent = createdEventRows[0];

    if (
      !supersededQuote ||
      !draft ||
      !transition ||
      !supersededEvent ||
      !createdEvent
    ) {
      throw new Error("Quote supersede returned incomplete records.");
    }

    return {
      outcome: "superseded",
      supersededQuote,
      draft,
      transition,
      supersededEvent,
      createdEvent,
    };
  } catch (error) {
    /*
     * Generated IDs identify this exact operation when Neon
     * commits but loses the HTTP response.
     */
    try {
      const [
        supersededQuoteRows,
        draft,
        transitionRows,
        supersededEventRows,
        createdEventRows,
      ] = await Promise.all([
        db
          .select()
          .from(commissionQuotes)
          .where(eq(commissionQuotes.id, input.quoteId))
          .limit(1),

        getCommissionQuoteById(draftQuoteId),

        db
          .select()
          .from(commissionStatusHistory)
          .where(eq(commissionStatusHistory.id, transitionId))
          .limit(1),

        db
          .select()
          .from(commissionEvents)
          .where(eq(commissionEvents.id, supersededEventId))
          .limit(1),

        db
          .select()
          .from(commissionEvents)
          .where(eq(commissionEvents.id, createdEventId))
          .limit(1),
      ]);

      const supersededQuote = supersededQuoteRows[0];
      const transition = transitionRows[0];
      const supersededEvent = supersededEventRows[0];
      const createdEvent = createdEventRows[0];

      if (
        supersededQuote?.status === "superseded" &&
        draft?.quote.status === "draft" &&
        transition &&
        supersededEvent &&
        createdEvent
      ) {
        return {
          outcome: "superseded",
          supersededQuote,
          draft,
          transition,
          supersededEvent,
          createdEvent,
        };
      }

      return await classifyCommissionQuoteSupersedeFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        supersededAt,
        input.initiatedBy,
      );
    } catch {
      /*
       * Preserve the original database error if
       * reconciliation cannot reach Neon.
       */
    }

    throw error;
  }
}
