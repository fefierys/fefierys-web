import { randomUUID } from "node:crypto";

import {
  eq,
  sql,
} from "drizzle-orm";

import { db } from "../db";
import { getCommissionEmailMessageById } from "./commissionEmailRepository";
import type {
  CommissionEmailMessage,
} from "./commissionEmails/commissionEmailTypes";

const MAX_EMAIL_LENGTH = 320;

export const MAX_COMMISSION_CLIENT_MESSAGE_LENGTH =
  5_000;

export interface CreateCommissionClientMessageInput {
  commissionId: string;
  messageText: string;
  createdByAdminUserId: string;
  senderEmail: string;
  replyToEmail: string;
}

export interface CreatedCommissionClientMessage {
  clientEmail: string;
  clientName: string;
  message: CommissionEmailMessage;
  reference: string;
  subject: string;
}

export type CreateCommissionClientMessageResult =
  | {
      outcome: "created";
      clientMessage:
        CreatedCommissionClientMessage;
    }
  | {
      outcome: "invalid_message";
      message: string;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "thread_not_found";
    }
  | {
      outcome: "thread_not_ready";
    }
  | {
      outcome: "thread_blocked";
    }
  | {
      outcome: "conflict";
    };

interface CommissionClientMessageStateRow
  extends Record<string, unknown> {
  clientEmail: string;
  clientName: string;
  hasBlockingMessage: boolean;
  reference: string;
  rootMessageId: string | null;
  subject: string | null;
  threadId: string | null;
}

interface CreateCommissionClientMessageWriteRow
  extends Record<string, unknown> {
  clientEmail: string;
  clientName: string;
  messageId: string;
  reference: string;
  subject: string;
}

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

function normalizeMessageText(
  value: string,
): string | null {
  const normalized =
    value.trim();

  if (!normalized) {
    return null;
  }

  if (
    normalized.length >
    MAX_COMMISSION_CLIENT_MESSAGE_LENGTH
  ) {
    return null;
  }

  return normalized;
}

async function getCommissionClientMessageState(
  commissionId: string,
): Promise<CommissionClientMessageStateRow | null> {
  const result =
    await db.execute<CommissionClientMessageStateRow>(
      sql`
        SELECT
          commission.reference AS "reference",
          commission.client_name AS "clientName",
          commission.client_email AS "clientEmail",
          email_thread.id AS "threadId",
          email_thread.subject AS "subject",
          email_thread.root_message_id AS "rootMessageId",
          EXISTS (
            SELECT 1
            FROM commission_email_messages AS pending_message
            WHERE
              pending_message.thread_id = email_thread.id
              AND pending_message.scope = 'client_thread'
              AND pending_message.direction = 'outbound'
              AND pending_message.delivery_status IN (
                'queued',
                'sending',
                'failed'
              )
          ) AS "hasBlockingMessage"
        FROM commissions AS commission
        LEFT JOIN commission_email_threads AS email_thread
          ON email_thread.commission_id = commission.id
        WHERE
          commission.id = ${commissionId}::uuid
        LIMIT 1
      `,
    );

  return (
    result.rows[0] ??
    null
  );
}

async function classifyCommissionClientMessageFailure(
  commissionId: string,
): Promise<
  Exclude<
    CreateCommissionClientMessageResult,
    {
      outcome: "created";
    }
  >
> {
  const state =
    await getCommissionClientMessageState(
      commissionId,
    );

  if (!state) {
    return {
      outcome: "not_found",
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

  return {
    outcome: "conflict",
  };
}

async function getCommittedClientMessage(
  commissionId: string,
  messageId: string,
): Promise<CreatedCommissionClientMessage | null> {
  const [
    state,
    message,
  ] = await Promise.all([
    getCommissionClientMessageState(
      commissionId,
    ),

    getCommissionEmailMessageById(
      messageId,
    ),
  ]);

  if (
    !state ||
    !message ||
    !state.subject ||
    message.commissionId !==
      commissionId ||
    message.scope !==
      "client_thread" ||
    message.direction !==
      "outbound" ||
    message.kind !==
      "general_message"
  ) {
    return null;
  }

  return {
    clientEmail:
      state.clientEmail,

    clientName:
      state.clientName,

    message,

    reference:
      state.reference,

    subject:
      state.subject,
  };
}

export async function createCommissionClientMessage(
  input: CreateCommissionClientMessageInput,
): Promise<CreateCommissionClientMessageResult> {
  const commissionId =
    normalizeRequiredValue(
      input.commissionId,
      "commissionId",
    );

  const createdByAdminUserId =
    normalizeRequiredValue(
      input.createdByAdminUserId,
      "createdByAdminUserId",
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

  const messageText =
    normalizeMessageText(
      input.messageText,
    );

  if (!messageText) {
    return {
      outcome:
        "invalid_message",

      message:
        `The client message must contain between 1 and ${MAX_COMMISSION_CLIENT_MESSAGE_LENGTH} characters.`,
    };
  }

  const initialState =
    await getCommissionClientMessageState(
      commissionId,
    );

  if (!initialState) {
    return {
      outcome: "not_found",
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

  const createdAt =
    new Date();

  const messageId =
    randomUUID();

  try {
    const writeResult =
      await db.execute<CreateCommissionClientMessageWriteRow>(
        sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              commission.id AS commission_id,
              commission.reference,
              commission.client_name,
              commission.client_email,
              email_thread.id AS thread_id,
              email_thread.subject,
              email_thread.root_message_id
            FROM commissions AS commission
            INNER JOIN commission_email_threads AS email_thread
              ON email_thread.commission_id = commission.id
            WHERE
              commission.id = ${commissionId}::uuid
              AND email_thread.root_message_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM commission_email_messages AS pending_message
                WHERE
                  pending_message.thread_id = email_thread.id
                  AND pending_message.scope = 'client_thread'
                  AND pending_message.direction = 'outbound'
                  AND pending_message.delivery_status IN (
                    'queued',
                    'sending',
                    'failed'
                  )
              )
            FOR UPDATE OF commission, email_thread
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
              locked_target.commission_id,
              locked_target.thread_id,
              null,
              'client_thread'::commission_email_scope,
              'outbound'::commission_email_direction,
              'general_message'::commission_email_kind,
              'artist'::commission_actor,
              'queued'::commission_email_delivery_status,
              ${senderEmail},
              locked_target.client_email,
              ${replyToEmail},
              locked_target.subject,
              ${messageText},
              null,
              null,
              null,
              null,
              0,
              null,
              null,
              null,
              null,
              ${createdByAdminUserId},
              ${createdAt},
              ${createdAt}
            FROM locked_target
            RETURNING
              id,
              commission_id
          )

          SELECT
            locked_target.reference AS "reference",
            locked_target.client_name AS "clientName",
            locked_target.client_email AS "clientEmail",
            locked_target.subject AS "subject",
            created_message.id AS "messageId"
          FROM locked_target
          CROSS JOIN created_message
        `,
      );

    const writeRow =
      writeResult.rows[0];

    if (!writeRow) {
      return classifyCommissionClientMessageFailure(
        commissionId,
      );
    }

    const committedMessage =
      await getCommittedClientMessage(
        commissionId,
        messageId,
      );

    if (!committedMessage) {
      throw new Error(
        "Client message write returned an incomplete logical email record.",
      );
    }

    return {
      outcome: "created",
      clientMessage:
        committedMessage,
    };
  } catch (error) {
    /*
     * messageId is generated before the atomic statement.
     * If Neon committed the insert but the HTTP response
     * was lost, reconcile that exact logical message rather
     * than creating another one.
     */
    try {
      const committedMessage =
        await getCommittedClientMessage(
          commissionId,
          messageId,
        );

      if (committedMessage) {
        return {
          outcome: "created",
          clientMessage:
            committedMessage,
        };
      }
    } catch {
      /*
       * Preserve the original database error when
       * reconciliation also fails.
       */
    }

    throw error;
  }
}