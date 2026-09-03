import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { validateCommissionQuoteTransition } from "../../commissions/commissionQuote";
import { validateCommissionTransition } from "../../commissions/commissionWorkflow";
import { db } from "../../db";
import {
  commissionEvents,
  commissionQuotes,
  commissionStatusHistory,
} from "../../db/schema/commissions";
import {
  getCommissionQuoteById,
  getCommissionQuoteOperationState,
} from "./commissionQuoteShared";
import type {
  SupersedeCommissionQuoteInput,
  SupersedeCommissionQuoteResult,
} from "./commissionQuoteTypes";

import type { CommissionManualActor } from "../../commissions/commissionActivity";

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
  const state = await getCommissionQuoteOperationState(quoteId);

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

  const initialState = await getCommissionQuoteOperationState(input.quoteId);

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
