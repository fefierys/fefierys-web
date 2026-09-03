import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { validateCommissionQuoteTransition } from "../../commissions/commissionQuote";
import { db } from "../../db";
import {
  commissionEvents,
  commissionStatusHistory,
} from "../../db/schema/commissions";
import {
  getCommissionQuoteById,
  getCommissionQuoteOperationState,
} from "./commissionQuoteShared";
import type {
  SendCommissionQuoteInput,
  SendCommissionQuoteResult,
} from "./commissionQuoteTypes";

interface SendCommissionQuoteWriteRow extends Record<string, unknown> {
  quoteId: string;
  transitionId: string;
  eventId: string;
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
  const state = await getCommissionQuoteOperationState(quoteId);

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

  const initialState = await getCommissionQuoteOperationState(input.quoteId);

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
