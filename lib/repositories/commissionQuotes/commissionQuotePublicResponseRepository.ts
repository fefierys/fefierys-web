import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import {
  hashPublicQuoteToken,
  isValidPublicQuoteToken,
} from "../../commissions/commissionQuoteAccessToken";
import { db } from "../../db";
import {
  commissionEvents,
  commissionStatusHistory,
} from "../../db/schema/commissions";
import { resolveCommissionQuotePublicToken } from "./commissionQuoteAccessRepository";
import {
  getCommissionQuoteById,
  getCommissionQuoteOperationState,
} from "./commissionQuoteShared";

export type AcceptCommissionQuotePubliclyResult =
  | {
      outcome: "accepted";
    }
  | {
      /*
       * Invalid, unknown, revoked, or otherwise inaccessible token.
       *
       * These cases intentionally share one public outcome so callers do
       * not reveal whether a quote exists.
       */
      outcome: "unavailable";
    }
  | {
      /*
       * The quote still exists but can no longer be accepted from the
       * public page, for example because it was already acted upon or the
       * commission is no longer awaiting a quote response.
       */
      outcome: "not_actionable";
    }
  | {
      outcome: "expired";
    }
  | {
      /*
       * A concurrent operation changed the quote after the public token
       * was resolved but before the acceptance could be persisted.
       */
      outcome: "conflict";
    };

export type DeclineCommissionQuotePubliclyResult =
  | {
      outcome: "declined";
    }
  | {
      outcome: "unavailable";
    }
  | {
      outcome: "not_actionable";
    }
  | {
      outcome: "expired";
    }
  | {
      outcome: "conflict";
    };

interface PublicDeclineCommissionQuoteWriteRow
  extends Record<string, unknown> {
  quoteId: string;
  transitionId: string;
  eventId: string;
}

async function classifyPublicDeclineFailure(
  token: string,
  expectedUpdatedAt: Date,
  now: Date,
): Promise<
  Exclude<
    DeclineCommissionQuotePubliclyResult,
    {
      outcome: "declined";
    }
  >
> {
  const target = await resolveCommissionQuotePublicToken(token);

  if (!target) {
    return {
      outcome: "unavailable",
    };
  }

  if (target.status !== "sent") {
    return {
      outcome: "not_actionable",
    };
  }

  const state = await getCommissionQuoteOperationState(
    target.quoteId,
  );

  if (!state) {
    return {
      outcome: "unavailable",
    };
  }

  if (
    state.quoteStatus !== "sent" ||
    state.commissionStatus !== "awaiting_quote_response"
  ) {
    return {
      outcome: "not_actionable",
    };
  }

  if (
    !state.validUntil ||
    state.validUntil.getTime() <= now.getTime()
  ) {
    return {
      outcome: "expired",
    };
  }

  if (
    state.quoteUpdatedAt.getTime() !==
    expectedUpdatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
    };
  }

  return {
    outcome: "conflict",
  };
}

/*
 * Declines a quote directly from its secure public bearer token.
 *
 * Decline closes the current commission request as a client action.
 * Unlike acceptance, decline is allowed even if the commission is on hold;
 * closing the commission clears the hold state atomically.
 *
 * The plaintext token and token hash are never recorded in audit metadata.
 */
export async function declineCommissionQuotePublicly(
  token: string,
): Promise<DeclineCommissionQuotePubliclyResult> {
  if (!isValidPublicQuoteToken(token)) {
    return {
      outcome: "unavailable",
    };
  }

  const tokenHash = hashPublicQuoteToken(token);

  const target =
    await resolveCommissionQuotePublicToken(token);

  if (!target) {
    return {
      outcome: "unavailable",
    };
  }

  if (target.status !== "sent") {
    return {
      outcome: "not_actionable",
    };
  }

  const initialState =
    await getCommissionQuoteOperationState(
      target.quoteId,
    );

  if (!initialState) {
    return {
      outcome: "unavailable",
    };
  }

  if (
    initialState.quoteStatus !== "sent" ||
    initialState.commissionStatus !==
      "awaiting_quote_response"
  ) {
    return {
      outcome: "not_actionable",
    };
  }

  const declinedAt = new Date();

  if (
    !initialState.validUntil ||
    initialState.validUntil.getTime() <=
      declinedAt.getTime()
  ) {
    return {
      outcome: "expired",
    };
  }

  if (
    initialState.quoteUpdatedAt.getTime() !==
    target.updatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
    };
  }

  const expectedUpdatedAt = target.updatedAt;

  const transitionId = randomUUID();
  const eventId = randomUUID();

  const eventMetadata = JSON.stringify({
    quoteId: target.quoteId,
    closeReason: "client_declined_quote",
    declinedAt: declinedAt.toISOString(),
  });

  try {
    const writeResult =
      await db.execute<PublicDeclineCommissionQuoteWriteRow>(
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
              quote.id =
                ${target.quoteId}::uuid
              AND quote.public_token_hash =
                ${tokenHash}
              AND quote.public_token_revoked_at
                IS NULL
              AND quote.status = 'sent'
              AND quote.updated_at =
                ${expectedUpdatedAt}
              AND quote.valid_until IS NOT NULL
              AND quote.valid_until >
                ${declinedAt}
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
              close_reason_note = null,
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
              null,
              null,
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
              null,
              ${eventMetadata}::jsonb,
              null,
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

    if (!writeResult.rows[0]) {
      return classifyPublicDeclineFailure(
        token,
        expectedUpdatedAt,
        declinedAt,
      );
    }

    return {
      outcome: "declined",
    };
  } catch (error) {
    try {
      const [
        declinedQuote,
        transitionRows,
        eventRows,
      ] = await Promise.all([
        getCommissionQuoteById(target.quoteId),

        db
          .select()
          .from(commissionStatusHistory)
          .where(
            eq(
              commissionStatusHistory.id,
              transitionId,
            ),
          )
          .limit(1),

        db
          .select()
          .from(commissionEvents)
          .where(
            eq(
              commissionEvents.id,
              eventId,
            ),
          )
          .limit(1),
      ]);

      if (
        declinedQuote?.quote.status ===
          "declined" &&
        transitionRows[0] &&
        eventRows[0]
      ) {
        return {
          outcome: "declined",
        };
      }

      return await classifyPublicDeclineFailure(
        token,
        expectedUpdatedAt,
        declinedAt,
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

interface PublicAcceptCommissionQuoteWriteRow
  extends Record<string, unknown> {
  quoteId: string;
  transitionId: string;
  eventId: string;
}

async function classifyPublicAcceptanceFailure(
  token: string,
  expectedUpdatedAt: Date,
  now: Date,
): Promise<Exclude<AcceptCommissionQuotePubliclyResult, { outcome: "accepted" }>> {
  const target = await resolveCommissionQuotePublicToken(token);

  if (!target) {
    return {
      outcome: "unavailable",
    };
  }

  if (target.status !== "sent") {
    return {
      outcome: "not_actionable",
    };
  }

  const state = await getCommissionQuoteOperationState(target.quoteId);

  if (!state) {
    return {
      outcome: "unavailable",
    };
  }

  if (
    state.quoteStatus !== "sent" ||
    state.commissionStatus !== "awaiting_quote_response" ||
    state.isOnHold
  ) {
    return {
      outcome: "not_actionable",
    };
  }

  if (!state.validUntil || state.validUntil.getTime() <= now.getTime()) {
    return {
      outcome: "expired",
    };
  }

  if (state.quoteUpdatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return {
      outcome: "conflict",
    };
  }

  /*
   * Every known precondition still holds, so the SQL operation must
   * have lost a race with another write.
   */
  return {
    outcome: "conflict",
  };
}

/*
 * Accepts a quote directly from its secure public bearer token.
 *
 * No quote ID, commission ID, admin ID, or expected timestamp is supplied
 * by the browser. They are derived and revalidated server-side.
 *
 * The token itself is never persisted or included in events/log metadata.
 */
export async function acceptCommissionQuotePublicly(
  token: string,
): Promise<AcceptCommissionQuotePubliclyResult> {
  if (!isValidPublicQuoteToken(token)) {
    return {
      outcome: "unavailable",
    };
  }

  const tokenHash = hashPublicQuoteToken(token);
  const target = await resolveCommissionQuotePublicToken(token);

  if (!target) {
    return {
      outcome: "unavailable",
    };
  }

  if (target.status !== "sent") {
    return {
      outcome: "not_actionable",
    };
  }

  const initialState = await getCommissionQuoteOperationState(target.quoteId);

  if (!initialState) {
    return {
      outcome: "unavailable",
    };
  }

  if (
    initialState.quoteStatus !== "sent" ||
    initialState.commissionStatus !== "awaiting_quote_response" ||
    initialState.isOnHold
  ) {
    return {
      outcome: "not_actionable",
    };
  }

  const acceptedAt = new Date();

  if (
    !initialState.validUntil ||
    initialState.validUntil.getTime() <= acceptedAt.getTime()
  ) {
    return {
      outcome: "expired",
    };
  }

  /*
   * The resolver and operation-state query must describe the same version
   * of the quote before we attempt the transactional write.
   */
  if (
    initialState.quoteUpdatedAt.getTime() !== target.updatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
    };
  }

  const expectedUpdatedAt = target.updatedAt;
  const transitionId = randomUUID();
  const eventId = randomUUID();

  /*
   * Internal audit metadata may contain the quote ID, but never the
   * plaintext public token or its hash.
   */
  const eventMetadata = JSON.stringify({
    quoteId: target.quoteId,
    acceptedAt: acceptedAt.toISOString(),
  });

  try {
    const writeResult =
      await db.execute<PublicAcceptCommissionQuoteWriteRow>(
        sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              quote.id AS quote_id,
              quote.commission_id,
              quote.version
            FROM commission_quotes AS quote
            INNER JOIN commissions AS commission
              ON commission.id = quote.commission_id
            WHERE
              quote.id = ${target.quoteId}::uuid
              AND quote.public_token_hash = ${tokenHash}
              AND quote.public_token_revoked_at IS NULL
              AND quote.status = 'sent'
              AND quote.updated_at = ${expectedUpdatedAt}
              AND quote.valid_until IS NOT NULL
              AND quote.valid_until > ${acceptedAt}
              AND commission.status = 'awaiting_quote_response'
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
              quote.id = locked_target.quote_id
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
              commission.id = locked_target.commission_id
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
              null,
              ${acceptedAt}
            FROM updated_quote
            INNER JOIN updated_commission
              ON updated_commission.id = updated_quote.commission_id
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
              null,
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

    if (!writeResult.rows[0]) {
      return classifyPublicAcceptanceFailure(
        token,
        expectedUpdatedAt,
        acceptedAt,
      );
    }

    return {
      outcome: "accepted",
    };
  } catch (error) {
    /*
     * Neon may commit the transaction and lose the HTTP response.
     *
     * The pre-generated transition/event IDs let us determine whether
     * this exact public acceptance was committed before treating it as
     * an error.
     */
    try {
      const [acceptedQuote, transitionRows, eventRows] = await Promise.all([
        getCommissionQuoteById(target.quoteId),

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

      if (
        acceptedQuote?.quote.status === "accepted" &&
        transitionRows[0] &&
        eventRows[0]
      ) {
        return {
          outcome: "accepted",
        };
      }

      return await classifyPublicAcceptanceFailure(
        token,
        expectedUpdatedAt,
        acceptedAt,
      );
    } catch {
      /*
       * If reconciliation itself cannot reach Neon, preserve the original
       * database error rather than replacing it with a secondary failure.
       */
    }

    throw error;
  }
}