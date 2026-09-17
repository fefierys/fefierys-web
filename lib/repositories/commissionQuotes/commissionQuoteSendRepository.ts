import { randomUUID } from "node:crypto";

import {
  eq,
  sql,
} from "drizzle-orm";

import {
  validateCommissionQuoteTransition,
} from "../../commissions/commissionQuote";
import {
  generatePublicQuoteToken,
  hashPublicQuoteToken,
} from "../../commissions/commissionQuoteAccessToken";
import { db } from "../../db";
import {
  commissionEmailMessages,
  commissionEmailThreads,
  commissionEvents,
  commissionQuotes,
  commissions,
  commissionStatusHistory,
} from "../../db/schema/commissions";
import type {
  CommissionStatus,
} from "../commissionAdminRepository";
import {
  getCommissionEmailMessageById,
} from "../commissionEmailRepository";
import {
  getCommissionQuoteById,
} from "./commissionQuoteShared";
import type {
  CommissionQuote,
  SendCommissionQuoteInput,
  SendCommissionQuoteResult,
} from "./commissionQuoteTypes";

interface CommissionQuoteSendStateRow {
  clientEmail: string;
  clientName: string;
  commissionStatus: CommissionStatus;
  hasBlockingMessage: boolean;
  isOnHold: boolean;
  quoteStatus: CommissionQuote["status"];
  quoteUpdatedAt: Date;
  reference: string;
  rootMessageId: string | null;
  subject: string | null;
  threadId: string | null;
  validUntil: Date | null;
}

interface SendCommissionQuoteWriteRow
  extends Record<string, unknown> {
  clientName: string;
  eventId: string;
  messageId: string;
  quoteId: string;
  reference: string;
  transitionId: string;
}

const MAX_EMAIL_LENGTH = 320;

function normalizeRequiredValue(
  value: string,
  fieldName: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

function normalizeEmail(
  value: string,
  fieldName: string,
): string {
  const normalized =
    normalizeRequiredValue(
      value,
      fieldName,
    );

  if (
    normalized.length >
    MAX_EMAIL_LENGTH
  ) {
    throw new Error(
      `${fieldName} must be ${MAX_EMAIL_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

async function getCommissionQuoteSendState(
  quoteId: string,
): Promise<CommissionQuoteSendStateRow | null> {
  const rows =
    await db
      .select({
        quoteStatus:
          commissionQuotes.status,

        quoteUpdatedAt:
          commissionQuotes.updatedAt,

        validUntil:
          commissionQuotes.validUntil,

        commissionStatus:
          commissions.status,

        isOnHold:
          commissions.isOnHold,

        reference:
          commissions.reference,

        clientName:
          commissions.clientName,

        clientEmail:
          commissions.clientEmail,

        threadId:
          commissionEmailThreads.id,

        subject:
          commissionEmailThreads.subject,

        rootMessageId:
          commissionEmailThreads.rootMessageId,

        hasBlockingMessage:
          sql<boolean>`
            EXISTS (
              SELECT 1
              FROM ${commissionEmailMessages}
                AS pending_message
              WHERE
                pending_message.thread_id =
                  ${commissionEmailThreads.id}
                AND pending_message.scope =
                  'client_thread'
                AND pending_message.direction =
                  'outbound'
                AND pending_message.delivery_status IN (
                  'queued',
                  'sending',
                  'failed'
                )
            )
          `,
      })
      .from(
        commissionQuotes,
      )
      .innerJoin(
        commissions,
        eq(
          commissions.id,
          commissionQuotes.commissionId,
        ),
      )
      .leftJoin(
        commissionEmailThreads,
        eq(
          commissionEmailThreads.commissionId,
          commissions.id,
        ),
      )
      .where(
        eq(
          commissionQuotes.id,
          quoteId,
        ),
      )
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
  const state =
    await getCommissionQuoteSendState(
      quoteId,
    );

  if (!state) {
    return {
      outcome: "not_found",
    };
  }

  if (
    state.quoteStatus !==
    "draft"
  ) {
    return {
      outcome: "not_draft",
      currentStatus:
        state.quoteStatus,
    };
  }

  if (
    state.commissionStatus !==
    "quoting"
  ) {
    return {
      outcome:
        "wrong_commission_status",
      currentStatus:
        state.commissionStatus,
    };
  }

  if (state.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (
    state.quoteUpdatedAt.getTime() !==
    expectedUpdatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
      currentUpdatedAt:
        state.quoteUpdatedAt,
    };
  }

  const validation =
    validateCommissionQuoteTransition({
      fromStatus:
        state.quoteStatus,

      toStatus:
        "sent",

      validUntil:
        state.validUntil,

      now,
    });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  if (
    !state.threadId ||
    !state.subject
  ) {
    return {
      outcome:
        "thread_not_found",
    };
  }

  if (!state.rootMessageId) {
    return {
      outcome:
        "thread_not_ready",
    };
  }

  if (
    state.hasBlockingMessage
  ) {
    return {
      outcome:
        "thread_blocked",
    };
  }

  /*
   * Every known state still satisfies the preconditions.
   * A concurrent write must have prevented the atomic SQL
   * operation from being applied.
   */
  return {
    outcome: "conflict",
    currentUpdatedAt:
      state.quoteUpdatedAt,
  };
}

export async function sendCommissionQuote(
  input: SendCommissionQuoteInput,
): Promise<SendCommissionQuoteResult> {
  const sentByAdminUserId =
    normalizeRequiredValue(
      input.sentByAdminUserId,
      "sentByAdminUserId",
    );

  const senderEmail =
    normalizeEmail(
      input.senderEmail,
      "senderEmail",
    );

  const replyToEmail =
    normalizeEmail(
      input.replyToEmail,
      "replyToEmail",
    );

  if (
    !(
      input.expectedUpdatedAt
      instanceof Date
    ) ||
    Number.isNaN(
      input.expectedUpdatedAt.getTime(),
    )
  ) {
    throw new Error(
      "expectedUpdatedAt must be a valid Date.",
    );
  }

  const initialState =
    await getCommissionQuoteSendState(
      input.quoteId,
    );

  if (!initialState) {
    return {
      outcome: "not_found",
    };
  }

  if (
    initialState.quoteStatus !==
    "draft"
  ) {
    return {
      outcome: "not_draft",
      currentStatus:
        initialState.quoteStatus,
    };
  }

  if (
    initialState.commissionStatus !==
    "quoting"
  ) {
    return {
      outcome:
        "wrong_commission_status",
      currentStatus:
        initialState.commissionStatus,
    };
  }

  if (initialState.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (
    initialState.quoteUpdatedAt.getTime() !==
    input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome: "conflict",
      currentUpdatedAt:
        initialState.quoteUpdatedAt,
    };
  }

  const sentAt =
    new Date();

  const validation =
    validateCommissionQuoteTransition({
      fromStatus:
        initialState.quoteStatus,

      toStatus:
        "sent",

      validUntil:
        initialState.validUntil,

      now:
        sentAt,
    });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  if (
    !initialState.threadId ||
    !initialState.subject
  ) {
    return {
      outcome:
        "thread_not_found",
    };
  }

  if (
    !initialState.rootMessageId
  ) {
    return {
      outcome:
        "thread_not_ready",
    };
  }

  if (
    initialState.hasBlockingMessage
  ) {
    return {
      outcome:
        "thread_blocked",
    };
  }

  /*
   * The public token is reproducible from the quote ID and
   * the server-only secret. Only its SHA-256 digest is stored.
   *
   * The plaintext token is never persisted in the quote,
   * email message, event metadata, or activity history.
   */
  const publicToken =
    generatePublicQuoteToken(
      input.quoteId,
    );

  const publicTokenHash =
    hashPublicQuoteToken(
      publicToken,
    );

  const transitionId =
    randomUUID();

  const eventId =
    randomUUID();

  const messageId =
    randomUUID();

  const eventMetadata =
    JSON.stringify({
      quoteId:
        input.quoteId,

      sentAt:
        sentAt.toISOString(),
    });

  try {
    /*
     * Quote state, commission workflow state, activity records,
     * public-token digest and logical client email are created
     * by one database statement.
     *
     * If any precondition fails, none of these writes occur.
     */
    const writeResult =
      await db.execute<SendCommissionQuoteWriteRow>(
        sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              quote.id AS quote_id,
              quote.commission_id,
              quote.version,
              quote.currency,
              quote.total_amount,

              commission.reference,
              commission.client_name,
              commission.client_email,

              email_thread.id AS thread_id,
              email_thread.subject,
              email_thread.root_message_id

            FROM commission_quotes AS quote

            INNER JOIN commissions AS commission
              ON commission.id =
                quote.commission_id

            INNER JOIN commission_email_threads
              AS email_thread
              ON email_thread.commission_id =
                commission.id

            WHERE
              quote.id =
                ${input.quoteId}::uuid

              AND quote.status =
                'draft'

              AND quote.updated_at =
                ${input.expectedUpdatedAt}

              AND quote.valid_until
                IS NOT NULL

              AND quote.valid_until >
                ${sentAt}

              AND commission.status =
                'quoting'

              AND commission.is_on_hold =
                false

              AND email_thread.root_message_id
                IS NOT NULL

              AND NOT EXISTS (
                SELECT 1
                FROM commission_email_messages
                  AS pending_message
                WHERE
                  pending_message.thread_id =
                    email_thread.id

                  AND pending_message.scope =
                    'client_thread'

                  AND pending_message.direction =
                    'outbound'

                  AND pending_message.delivery_status
                    IN (
                      'queued',
                      'sending',
                      'failed'
                    )
              )

            FOR UPDATE OF
              quote,
              commission,
              email_thread
          ),

          updated_quote AS (
            UPDATE commission_quotes
              AS quote
            SET
              status =
                'sent',

              sent_at =
                ${sentAt},

              public_token_hash =
                ${publicTokenHash},

              public_token_created_at =
                ${sentAt},

              public_token_revoked_at =
                null,

              updated_at =
                ${sentAt}

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
            UPDATE commissions
              AS commission
            SET
              status =
                'awaiting_quote_response',

              updated_at =
                ${sentAt}

            FROM locked_target

            WHERE
              commission.id =
                locked_target.commission_id

            RETURNING
              commission.id
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

              'awaiting_quote_response'
                ::commission_status,

              'artist'::commission_actor,

              'quote_sent',

              null,

              ${sentByAdminUserId},

              ${sentAt}

            FROM updated_quote

            INNER JOIN updated_commission
              ON updated_commission.id =
                updated_quote.commission_id

            RETURNING
              id
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

              'quote_sent'
                ::commission_event_type,

              'artist'
                ::commission_actor,

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

            RETURNING
              id
          ),

          created_message AS (
            INSERT INTO commission_email_messages (
              id,
              commission_id,
              thread_id,
              quote_id,
              scope,
              direction,
              kind,
              actor,
              delivery_status,
              sender_email,
              recipient_email,
              reply_to_email,
              subject,
              message_text,
              provider_email_id,
              provider_message_id,
              in_reply_to_message_id,
              references_header,
              attempt_count,
              last_attempt_at,
              sent_at,
              failed_at,
              failure_message,
              created_by_admin_user_id,
              created_at,
              updated_at
            )
            SELECT
              ${messageId}::uuid,

              updated_quote.commission_id,

              locked_target.thread_id,

              updated_quote.id,

              'client_thread'
                ::commission_email_scope,

              'outbound'
                ::commission_email_direction,

              'quote_ready'
                ::commission_email_kind,

              'artist'
                ::commission_actor,

              'queued'
                ::commission_email_delivery_status,

              ${senderEmail},

              locked_target.client_email,

              ${replyToEmail},

              locked_target.subject,

              'Quote v'
                || updated_quote.version
                || ' ready for client review.',

              null,

              null,

              /*
               * Thread headers are intentionally null while
               * queued. The common delivery claim fills both
               * from the immutable thread root immediately
               * before the provider send.
               */
              null,

              null,

              0,

              null,

              null,

              null,

              null,

              ${sentByAdminUserId},

              ${sentAt},

              ${sentAt}

            FROM locked_target

            INNER JOIN updated_quote
              ON updated_quote.id =
                locked_target.quote_id

            INNER JOIN created_event
              ON true

            RETURNING
              id,
              commission_id,
              quote_id
          )

          SELECT
            updated_quote.id
              AS "quoteId",

            created_transition.id
              AS "transitionId",

            created_event.id
              AS "eventId",

            created_message.id
              AS "messageId",

            locked_target.client_name
              AS "clientName",

            locked_target.reference
              AS "reference"

          FROM updated_quote

          CROSS JOIN created_transition

          CROSS JOIN created_event

          CROSS JOIN created_message

          CROSS JOIN locked_target
        `,
      );

    const writeRow =
      writeResult.rows[0];

    if (!writeRow) {
      return classifyCommissionQuoteSendFailure(
        input.quoteId,
        input.expectedUpdatedAt,
        sentAt,
      );
    }

    /*
     * Read back the records produced by this exact operation.
     * messageId, transitionId and eventId were generated before
     * the write and therefore also work as reconciliation keys.
     */
    const [
      sentQuote,
      transitionRows,
      eventRows,
      emailMessage,
    ] =
      await Promise.all([
        getCommissionQuoteById(
          input.quoteId,
        ),

        db
          .select()
          .from(
            commissionStatusHistory,
          )
          .where(
            eq(
              commissionStatusHistory.id,
              transitionId,
            ),
          )
          .limit(1),

        db
          .select()
          .from(
            commissionEvents,
          )
          .where(
            eq(
              commissionEvents.id,
              eventId,
            ),
          )
          .limit(1),

        getCommissionEmailMessageById(
          messageId,
        ),
      ]);

    const transition =
      transitionRows[0];

    const event =
      eventRows[0];

    if (
      !sentQuote ||
      !transition ||
      !event ||
      !emailMessage ||
      writeRow.quoteId !==
        input.quoteId ||
      writeRow.transitionId !==
        transitionId ||
      writeRow.eventId !==
        eventId ||
      writeRow.messageId !==
        messageId ||
      emailMessage.commissionId !==
        sentQuote.quote.commissionId ||
      emailMessage.quoteId !==
        input.quoteId ||
      emailMessage.kind !==
        "quote_ready"
    ) {
      throw new Error(
        "Quote send returned incomplete or inconsistent records.",
      );
    }

    return {
      outcome: "sent",

      quote:
        sentQuote.quote,

      items:
        sentQuote.items,

      transition,

      event,

      messageId:
        emailMessage.id,

      clientName:
        writeRow.clientName,

      reference:
        writeRow.reference,
    };
  } catch (error) {
    /*
     * transitionId, eventId and messageId identify this exact
     * operation if Neon committed the statement but its HTTP
     * response was lost.
     *
     * A concurrent send cannot be mistaken for this operation
     * because it would have different generated IDs.
     */
    try {
      const [
        sentQuote,
        transitionRows,
        eventRows,
        emailMessage,
        committedState,
      ] =
        await Promise.all([
          getCommissionQuoteById(
            input.quoteId,
          ),

          db
            .select()
            .from(
              commissionStatusHistory,
            )
            .where(
              eq(
                commissionStatusHistory.id,
                transitionId,
              ),
            )
            .limit(1),

          db
            .select()
            .from(
              commissionEvents,
            )
            .where(
              eq(
                commissionEvents.id,
                eventId,
              ),
            )
            .limit(1),

          getCommissionEmailMessageById(
            messageId,
          ),

          getCommissionQuoteSendState(
            input.quoteId,
          ),
        ]);

      const transition =
        transitionRows[0];

      const event =
        eventRows[0];

      if (
        sentQuote?.quote.status ===
          "sent" &&
        transition &&
        event &&
        emailMessage &&
        committedState &&
        emailMessage.commissionId ===
          sentQuote.quote.commissionId &&
        emailMessage.quoteId ===
          input.quoteId &&
        emailMessage.kind ===
          "quote_ready"
      ) {
        return {
          outcome: "sent",

          quote:
            sentQuote.quote,

          items:
            sentQuote.items,

          transition,

          event,

          messageId:
            emailMessage.id,

          clientName:
            committedState.clientName,

          reference:
            committedState.reference,
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