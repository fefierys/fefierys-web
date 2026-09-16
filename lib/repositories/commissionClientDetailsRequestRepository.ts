import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import {
  validateCommissionTransition,
  type CommissionTransitionValidation,
} from "../commissions/commissionWorkflow";
import { db } from "../db";
import { commissionStatusHistory } from "../db/schema/commissions";
import type { CommissionStatus } from "./commissionAdminRepository";
import { getCommissionEmailMessageById } from "./commissionEmailRepository";
import type { CommissionEmailMessage } from "./commissionEmails/commissionEmailTypes";

type StatusHistoryEntry = typeof commissionStatusHistory.$inferSelect;

type InvalidTransitionValidation = Extract<
  CommissionTransitionValidation,
  { valid: false }
>;

const MAX_EMAIL_LENGTH = 320;
export const MAX_CLIENT_DETAILS_REQUEST_LENGTH = 5_000;

export interface CreateCommissionClientDetailsRequestInput {
  commissionId: string;
  messageText: string;
  requestedByAdminUserId: string;
  senderEmail: string;
  replyToEmail: string;
}

export interface CreatedCommissionClientDetailsRequest {
  clientEmail: string;
  clientName: string;
  message: CommissionEmailMessage;
  reference: string;
  subject: string;
  transition: StatusHistoryEntry;
}

export type CreateCommissionClientDetailsRequestResult =
  | {
      outcome: "created";
      request: CreatedCommissionClientDetailsRequest;
    }
  | {
      outcome: "invalid";
      validation: InvalidTransitionValidation;
    }
  | {
      outcome: "invalid_message";
      message: string;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "wrong_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
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
      currentStatus: CommissionStatus;
    };

interface CommissionClientDetailsRequestStateRow extends Record<string, unknown> {
  clientEmail: string;
  clientName: string;
  hasBlockingMessage: boolean;
  isOnHold: boolean;
  reference: string;
  rootMessageId: string | null;
  status: CommissionStatus;
  subject: string | null;
  threadId: string | null;
}

interface CreateCommissionClientDetailsRequestWriteRow extends Record<string, unknown> {
  clientEmail: string;
  clientName: string;
  messageId: string;
  reference: string;
  subject: string;
  transitionId: string;
}

function normalizeRequiredValue(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeEmail(value: string, fieldName: string): string {
  const normalized = normalizeRequiredValue(value, fieldName);

  if (normalized.length > MAX_EMAIL_LENGTH) {
    throw new Error(`${fieldName} must be ${MAX_EMAIL_LENGTH} characters or fewer.`);
  }

  return normalized;
}

function normalizeMessageText(value: string): string | null {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_CLIENT_DETAILS_REQUEST_LENGTH) {
    return null;
  }

  return normalized;
}

async function getCommissionClientDetailsRequestState(
  commissionId: string,
): Promise<CommissionClientDetailsRequestStateRow | null> {
  const result = await db.execute<CommissionClientDetailsRequestStateRow>(sql`
    SELECT
      commission.status AS "status",
      commission.is_on_hold AS "isOnHold",
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
    WHERE commission.id = ${commissionId}::uuid
    LIMIT 1
  `);

  return result.rows[0] ?? null;
}

async function classifyCommissionClientDetailsRequestFailure(
  commissionId: string,
): Promise<Exclude<CreateCommissionClientDetailsRequestResult, { outcome: "created" }>> {
  const state = await getCommissionClientDetailsRequestState(commissionId);

  if (!state) {
    return {
      outcome: "not_found",
    };
  }

  if (state.status !== "under_review") {
    return {
      outcome: "wrong_status",
      currentStatus: state.status,
    };
  }

  if (state.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (!state.threadId || !state.subject) {
    return {
      outcome: "thread_not_found",
    };
  }

  if (!state.rootMessageId) {
    return {
      outcome: "thread_not_ready",
    };
  }

  if (state.hasBlockingMessage) {
    return {
      outcome: "thread_blocked",
    };
  }

  return {
    outcome: "conflict",
    currentStatus: state.status,
  };
}

async function getCommittedClientDetailsRequest(
  commissionId: string,
  messageId: string,
  transitionId: string,
): Promise<CreatedCommissionClientDetailsRequest | null> {
  const [state, message, transitionRows] = await Promise.all([
    getCommissionClientDetailsRequestState(commissionId),
    getCommissionEmailMessageById(messageId),
    db
      .select()
      .from(commissionStatusHistory)
      .where(eq(commissionStatusHistory.id, transitionId))
      .limit(1),
  ]);

  const transition = transitionRows[0];

  if (
    !state ||
    !message ||
    !transition ||
    !state.subject ||
    message.commissionId !== commissionId ||
    transition.commissionId !== commissionId
  ) {
    return null;
  }

  return {
    clientEmail: state.clientEmail,
    clientName: state.clientName,
    message,
    reference: state.reference,
    subject: state.subject,
    transition,
  };
}

export async function createCommissionClientDetailsRequest(
  input: CreateCommissionClientDetailsRequestInput,
): Promise<CreateCommissionClientDetailsRequestResult> {
  const commissionId = normalizeRequiredValue(input.commissionId, "commissionId");
  const requestedByAdminUserId = normalizeRequiredValue(
    input.requestedByAdminUserId,
    "requestedByAdminUserId",
  );
  const senderEmail = normalizeEmail(input.senderEmail, "senderEmail");
  const replyToEmail = normalizeEmail(input.replyToEmail, "replyToEmail");
  const messageText = normalizeMessageText(input.messageText);

  if (!messageText) {
    return {
      outcome: "invalid_message",
      message: `The client details request must contain between 1 and ${MAX_CLIENT_DETAILS_REQUEST_LENGTH} characters.`,
    };
  }

  const validation = validateCommissionTransition({
    fromStatus: "under_review",
    toStatus: "awaiting_client_details",
    initiatedBy: "artist",
  });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  const initialState = await getCommissionClientDetailsRequestState(commissionId);

  if (!initialState) {
    return {
      outcome: "not_found",
    };
  }

  if (initialState.status !== "under_review") {
    return {
      outcome: "wrong_status",
      currentStatus: initialState.status,
    };
  }

  if (initialState.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (!initialState.threadId || !initialState.subject) {
    return {
      outcome: "thread_not_found",
    };
  }

  if (!initialState.rootMessageId) {
    return {
      outcome: "thread_not_ready",
    };
  }

  if (initialState.hasBlockingMessage) {
    return {
      outcome: "thread_blocked",
    };
  }

  const requestedAt = new Date();
  const transitionId = randomUUID();
  const messageId = randomUUID();

  try {
    const writeResult = await db.execute<CreateCommissionClientDetailsRequestWriteRow>(sql`
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
          AND commission.status = 'under_review'
          AND commission.is_on_hold = false
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

      updated_commission AS (
        UPDATE commissions AS commission
        SET
          status = 'awaiting_client_details',
          updated_at = ${requestedAt}
        FROM locked_target
        WHERE commission.id = locked_target.commission_id
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
          locked_target.commission_id,
          'under_review'::commission_status,
          'awaiting_client_details'::commission_status,
          'artist'::commission_actor,
          'client_details_requested',
          null,
          ${requestedByAdminUserId},
          ${requestedAt}
        FROM locked_target
        INNER JOIN updated_commission
          ON updated_commission.id = locked_target.commission_id
        RETURNING id, commission_id
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
          'client_details_request'::commission_email_kind,
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
          ${requestedByAdminUserId},
          ${requestedAt},
          ${requestedAt}
        FROM locked_target
        INNER JOIN updated_commission
          ON updated_commission.id = locked_target.commission_id
        INNER JOIN created_transition
          ON created_transition.commission_id = locked_target.commission_id
        RETURNING id, commission_id
      )

      SELECT
        locked_target.reference AS "reference",
        locked_target.client_name AS "clientName",
        locked_target.client_email AS "clientEmail",
        locked_target.subject AS "subject",
        created_transition.id AS "transitionId",
        created_message.id AS "messageId"
      FROM locked_target
      CROSS JOIN created_transition
      CROSS JOIN created_message
    `);

    const writeRow = writeResult.rows[0];

    if (!writeRow) {
      return classifyCommissionClientDetailsRequestFailure(commissionId);
    }

    const committedRequest = await getCommittedClientDetailsRequest(
      commissionId,
      messageId,
      transitionId,
    );

    if (!committedRequest) {
      throw new Error("Client details request write returned incomplete records.");
    }

    return {
      outcome: "created",
      request: committedRequest,
    };
  } catch (error) {
    /*
     * Both IDs are generated before the atomic statement. If Neon committed
     * the statement but lost the HTTP response, reconcile this exact business
     * operation instead of creating a second client request.
     */
    try {
      const committedRequest = await getCommittedClientDetailsRequest(
        commissionId,
        messageId,
        transitionId,
      );

      if (committedRequest) {
        return {
          outcome: "created",
          request: committedRequest,
        };
      }
    } catch {
      /* Preserve the original database error when reconciliation also fails. */
    }

    throw error;
  }
}
