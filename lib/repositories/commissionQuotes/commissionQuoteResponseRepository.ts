import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { validateCommissionQuoteTransition } from "../../commissions/commissionQuote";
import { validateCommissionTransition } from "../../commissions/commissionWorkflow";
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
  AcceptCommissionQuoteInput,
  AcceptCommissionQuoteResult,
  DeclineCommissionQuoteInput,
  DeclineCommissionQuoteResult,
  ExpireCommissionQuoteInput,
  ExpireCommissionQuoteResult,
} from "./commissionQuoteTypes";

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
