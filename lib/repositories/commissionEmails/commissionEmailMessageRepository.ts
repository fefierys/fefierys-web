import { randomUUID } from "node:crypto";

import {
  and,
  eq,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "../../db";
import {
  commissionEmailMessages,
} from "../../db/schema/commissions";
import type {
  CommissionEmailMessage,
  CreateQueuedCommissionEmailMessageInput,
  MarkCommissionEmailMessageSentInput,
  ReconcileCommissionEmailMessageSentFromProviderInput,
  ReconcileCommissionEmailMessageSentFromProviderResult,
} from "./commissionEmailTypes";

const MAX_EMAIL_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 350;
const MAX_FAILURE_MESSAGE_LENGTH = 2_000;

function normalizeRequiredId(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeOptionalId(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} must not be blank when provided.`);
  }

  return normalized;
}

function normalizeEmail(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  if (normalized.length > MAX_EMAIL_LENGTH) {
    throw new Error(
      `${fieldName} must be ${MAX_EMAIL_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function normalizeOptionalEmail(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} must not be blank when provided.`);
  }

  if (normalized.length > MAX_EMAIL_LENGTH) {
    throw new Error(
      `${fieldName} must be ${MAX_EMAIL_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function normalizeSubject(subject: string): string {
  const normalized = subject.trim();

  if (!normalized) {
    throw new Error("subject is required.");
  }

  if (normalized.length > MAX_SUBJECT_LENGTH) {
    throw new Error(
      `subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return value;
}

function normalizeOptionalHeader(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} must not be blank when provided.`);
  }

  return normalized;
}

function normalizeFailureMessage(message: string): string {
  const normalized = message.trim();

  if (!normalized) {
    throw new Error("failureMessage is required.");
  }

  if (normalized.length <= MAX_FAILURE_MESSAGE_LENGTH) {
    return normalized;
  }

  return normalized.slice(0, MAX_FAILURE_MESSAGE_LENGTH);
}

function validateThreadScope(
  scope: CreateQueuedCommissionEmailMessageInput["scope"],
  threadId: string | null,
): void {
  if (scope === "client_thread" && threadId === null) {
    throw new Error(
      "threadId is required for client_thread messages.",
    );
  }

  if (scope === "internal_notification" && threadId !== null) {
    throw new Error(
      "threadId must be null for internal_notification messages.",
    );
  }
}

export async function getCommissionEmailMessageById(
  messageId: string,
): Promise<CommissionEmailMessage | null> {
  const normalizedMessageId = normalizeRequiredId(
    messageId,
    "messageId",
  );

  const rows = await db
    .select()
    .from(commissionEmailMessages)
    .where(eq(commissionEmailMessages.id, normalizedMessageId))
    .limit(1);

  return rows[0] ?? null;
}

export async function createQueuedCommissionEmailMessage(
  input: CreateQueuedCommissionEmailMessageInput,
): Promise<CommissionEmailMessage> {
  const messageId = randomUUID();
  const commissionId = normalizeRequiredId(
    input.commissionId,
    "commissionId",
  );
  const threadId = normalizeOptionalId(
    input.threadId,
    "threadId",
  );
  const quoteId = normalizeOptionalId(
    input.quoteId,
    "quoteId",
  );
  const senderEmail = normalizeEmail(
    input.senderEmail,
    "senderEmail",
  );
  const recipientEmail = normalizeEmail(
    input.recipientEmail,
    "recipientEmail",
  );
  const replyToEmail = normalizeOptionalEmail(
    input.replyToEmail,
    "replyToEmail",
  );
  const subject = normalizeSubject(input.subject);
  const inReplyToMessageId = normalizeOptionalHeader(
    input.inReplyToMessageId,
    "inReplyToMessageId",
  );
  const referencesHeader = normalizeOptionalHeader(
    input.referencesHeader,
    "referencesHeader",
  );
  const createdByAdminUserId = normalizeOptionalId(
    input.createdByAdminUserId,
    "createdByAdminUserId",
  );

  validateThreadScope(input.scope, threadId);

  if (
    input.scope === "internal_notification" &&
    (inReplyToMessageId !== null || referencesHeader !== null)
  ) {
    throw new Error(
      "Internal notification messages must not contain client thread headers.",
    );
  }

  try {
    const rows = await db
      .insert(commissionEmailMessages)
      .values({
        id: messageId,
        commissionId,
        threadId,
        quoteId,
        scope: input.scope,
        direction: "outbound",
        kind: input.kind,
        actor: input.actor,
        deliveryStatus: "queued",
        senderEmail,
        recipientEmail,
        replyToEmail,
        subject,
        messageText: normalizeOptionalText(input.messageText),
        providerEmailId: null,
        providerMessageId: null,
        inReplyToMessageId,
        referencesHeader,
        attemptCount: 0,
        lastAttemptAt: null,
        sentAt: null,
        failedAt: null,
        failureMessage: null,
        createdByAdminUserId,
      })
      .returning();

    const createdMessage = rows[0];

    if (!createdMessage) {
      throw new Error(
        "Commission email message insert returned no record.",
      );
    }

    return createdMessage;
  } catch (error) {
    /*
     * The ID is generated before the write so an uncertain Neon response can
     * be reconciled without creating another logical email message.
     */
    try {
      const reconciledMessage =
        await getCommissionEmailMessageById(messageId);

      if (reconciledMessage) {
        return reconciledMessage;
      }
    } catch {
      /*
       * Preserve the original database error if reconciliation also fails.
       */
    }

    throw error;
  }
}

export async function claimCommissionEmailMessageForSending(
  messageId: string,
): Promise<CommissionEmailMessage | null> {
  const normalizedMessageId = normalizeRequiredId(
    messageId,
    "messageId",
  );
  const claimedAt = new Date();

  /*
   * Client-thread delivery is FIFO.
   *
   * A client message may be claimed only when there is no older unsent
   * outbound message in the same thread. This prevents two workers from
   * sending different messages in the same conversation out of order.
   *
   * Before the RFC root Message-ID exists, only the first outbound message
   * in the thread may be claimed. If that first message was accepted by the
   * provider but the RFC Message-ID is still unavailable, later messages
   * remain queued until the root identity is completed.
   *
   * Internal notifications do not belong to a client thread and therefore
   * keep the original independent claim behavior.
   */
  const threadEligibility = sql`
    (
      ${commissionEmailMessages.scope} = 'internal_notification'
      OR
      (
        ${commissionEmailMessages.scope} = 'client_thread'
        AND ${commissionEmailMessages.threadId} IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM commission_email_threads AS thread
          WHERE thread.id = ${commissionEmailMessages.threadId}
            AND (
              thread.root_message_id IS NOT NULL
              OR NOT EXISTS (
                SELECT 1
                FROM commission_email_messages AS prior_root_message
                WHERE prior_root_message.thread_id = ${commissionEmailMessages.threadId}
                  AND prior_root_message.scope = 'client_thread'
                  AND prior_root_message.direction = 'outbound'
                  AND (
                    prior_root_message.created_at < ${commissionEmailMessages.createdAt}
                    OR (
                      prior_root_message.created_at = ${commissionEmailMessages.createdAt}
                      AND prior_root_message.id::text < ${commissionEmailMessages.id}::text
                    )
                  )
              )
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM commission_email_messages AS earlier_message
          WHERE earlier_message.thread_id = ${commissionEmailMessages.threadId}
            AND earlier_message.scope = 'client_thread'
            AND earlier_message.direction = 'outbound'
            AND earlier_message.delivery_status IN ('queued', 'sending', 'failed')
            AND (
              earlier_message.created_at < ${commissionEmailMessages.createdAt}
              OR (
                earlier_message.created_at = ${commissionEmailMessages.createdAt}
                AND earlier_message.id::text < ${commissionEmailMessages.id}::text
              )
            )
        )
      )
    )
  `;

  const rootMessageId = sql`
    (
      SELECT thread.root_message_id
      FROM commission_email_threads AS thread
      WHERE thread.id = ${commissionEmailMessages.threadId}
      LIMIT 1
    )
  `;

  try {
    const rows = await db
      .update(commissionEmailMessages)
      .set({
        deliveryStatus: "sending",
        attemptCount: sql`${commissionEmailMessages.attemptCount} + 1`,
        lastAttemptAt: claimedAt,
        failedAt: null,
        failureMessage: null,
        /*
         * Once a thread has a root RFC Message-ID, that immutable root is
         * persisted on every subsequent logical message before provider send.
         * Retrying the same row therefore reproduces the same thread headers.
         */
        inReplyToMessageId: sql`
          CASE
            WHEN ${commissionEmailMessages.scope} = 'client_thread'
              AND ${rootMessageId} IS NOT NULL
            THEN ${rootMessageId}
            ELSE ${commissionEmailMessages.inReplyToMessageId}
          END
        `,
        referencesHeader: sql`
          CASE
            WHEN ${commissionEmailMessages.scope} = 'client_thread'
              AND ${rootMessageId} IS NOT NULL
            THEN ${rootMessageId}
            ELSE ${commissionEmailMessages.referencesHeader}
          END
        `,
        updatedAt: claimedAt,
      })
      .where(
        and(
          eq(
            commissionEmailMessages.id,
            normalizedMessageId,
          ),
          inArray(
            commissionEmailMessages.deliveryStatus,
            ["queued", "failed"],
          ),
          threadEligibility,
        ),
      )
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    /*
     * If Neon committed the UPDATE but the response was lost, identify this
     * exact claim by the timestamp written by this invocation.
     */
    try {
      const reconciledMessage =
        await getCommissionEmailMessageById(
          normalizedMessageId,
        );

      if (
        reconciledMessage?.deliveryStatus === "sending" &&
        reconciledMessage.lastAttemptAt?.getTime() ===
          claimedAt.getTime()
      ) {
        return reconciledMessage;
      }
    } catch {
      /*
       * Preserve the original database error if reconciliation also fails.
       */
    }

    throw error;
  }
}

export async function markCommissionEmailMessageSent(
  input: MarkCommissionEmailMessageSentInput,
): Promise<CommissionEmailMessage | null> {
  const messageId = normalizeRequiredId(
    input.messageId,
    "messageId",
  );
  const providerEmailId = normalizeRequiredId(
    input.providerEmailId,
    "providerEmailId",
  );
  const providerMessageId = normalizeOptionalHeader(
    input.providerMessageId,
    "providerMessageId",
  );
  const sentAt = new Date();

  try {
    const rows = await db
      .update(commissionEmailMessages)
      .set({
        deliveryStatus: "sent",
        providerEmailId,
        providerMessageId,
        sentAt,
        failedAt: null,
        failureMessage: null,
        updatedAt: sentAt,
      })
      .where(
        and(
          eq(commissionEmailMessages.id, messageId),
          eq(
            commissionEmailMessages.deliveryStatus,
            "sending",
          ),
        ),
      )
      .returning();

    const sentMessage =
      rows[0];

    if (sentMessage) {
      return sentMessage;
    }

    /*
     * email.sent can race ahead of the send() response. In that case the
     * verified webhook may already have transitioned this row to sent and
     * persisted the RFC Message-ID before this request reaches its local
     * delivery-finalization step.
     *
     * A provider result with providerMessageId = null is intentionally less
     * complete than a verified webhook result, so it must never erase or
     * reject the richer persisted identity.
     */
    const reconciledMessage =
      await getCommissionEmailMessageById(
        messageId,
      );

    if (
      reconciledMessage?.deliveryStatus === "sent" &&
      reconciledMessage.providerEmailId ===
        providerEmailId &&
      (
        providerMessageId === null ||
        reconciledMessage.providerMessageId ===
          providerMessageId
      )
    ) {
      return reconciledMessage;
    }

    return null;
  } catch (error) {
    try {
      const reconciledMessage =
        await getCommissionEmailMessageById(messageId);

      if (
        reconciledMessage?.deliveryStatus === "sent" &&
        reconciledMessage.providerEmailId ===
          providerEmailId &&
        (
          providerMessageId === null ||
          reconciledMessage.providerMessageId ===
            providerMessageId
        )
      ) {
        return reconciledMessage;
      }
    } catch {
      /*
       * Preserve the original database error if reconciliation also fails.
       */
    }

    throw error;
  }
}

export async function markCommissionEmailMessageFailed(
  messageId: string,
  failureMessage: string,
): Promise<CommissionEmailMessage | null> {
  const normalizedMessageId = normalizeRequiredId(
    messageId,
    "messageId",
  );
  const safeFailureMessage =
    normalizeFailureMessage(failureMessage);
  const failedAt = new Date();

  try {
    const rows = await db
      .update(commissionEmailMessages)
      .set({
        deliveryStatus: "failed",
        failedAt,
        sentAt: null,
        failureMessage: safeFailureMessage,
        updatedAt: failedAt,
      })
      .where(
        and(
          eq(
            commissionEmailMessages.id,
            normalizedMessageId,
          ),
          eq(
            commissionEmailMessages.deliveryStatus,
            "sending",
          ),
        ),
      )
      .returning();

    return rows[0] ?? null;
  } catch (error) {
    try {
      const reconciledMessage =
        await getCommissionEmailMessageById(
          normalizedMessageId,
        );

      if (
        reconciledMessage?.deliveryStatus === "failed" &&
        reconciledMessage.failureMessage ===
          safeFailureMessage
      ) {
        return reconciledMessage;
      }
    } catch {
      /*
       * Preserve the original database error if reconciliation also fails.
       */
    }

    throw error;
  }
}


export async function reconcileCommissionEmailMessageSentFromProvider(
  input: ReconcileCommissionEmailMessageSentFromProviderInput,
): Promise<ReconcileCommissionEmailMessageSentFromProviderResult> {
  const messageId = normalizeRequiredId(
    input.messageId,
    "messageId",
  );
  const providerEmailId = normalizeRequiredId(
    input.providerEmailId,
    "providerEmailId",
  );
  const providerMessageId = normalizeOptionalHeader(
    input.providerMessageId,
    "providerMessageId",
  );

  if (!providerMessageId) {
    throw new Error(
      "providerMessageId is required.",
    );
  }

  if (
    !(input.sentAt instanceof Date) ||
    Number.isNaN(input.sentAt.getTime())
  ) {
    throw new Error(
      "sentAt must be a valid Date.",
    );
  }

  const updatedAt = new Date();

  try {
    const rows = await db
      .update(commissionEmailMessages)
      .set({
        deliveryStatus: "sent",
        providerEmailId,
        providerMessageId,
        sentAt: sql`
          COALESCE(
            ${commissionEmailMessages.sentAt},
            ${input.sentAt}
          )
        `,
        failedAt: null,
        failureMessage: null,
        updatedAt,
      })
      .where(
        and(
          eq(
            commissionEmailMessages.id,
            messageId,
          ),
          inArray(
            commissionEmailMessages.deliveryStatus,
            ["sending", "sent"],
          ),
          or(
            isNull(
              commissionEmailMessages.providerEmailId,
            ),
            eq(
              commissionEmailMessages.providerEmailId,
              providerEmailId,
            ),
          ),
          or(
            isNull(
              commissionEmailMessages.providerMessageId,
            ),
            eq(
              commissionEmailMessages.providerMessageId,
              providerMessageId,
            ),
          ),
          or(
            ne(
              commissionEmailMessages.deliveryStatus,
              "sent",
            ),
            isNull(
              commissionEmailMessages.providerEmailId,
            ),
            isNull(
              commissionEmailMessages.providerMessageId,
            ),
          ),
        ),
      )
      .returning();

    const reconciledMessage =
      rows[0];

    if (reconciledMessage) {
      return {
        outcome: "reconciled",
        message:
          reconciledMessage,
      };
    }
  } catch (error) {
    /*
     * If Neon committed the reconciliation but the response was lost, the
     * exact provider identities let us classify the final state safely.
     */
    try {
      const reconciledMessage =
        await getCommissionEmailMessageById(
          messageId,
        );

      if (
        reconciledMessage?.deliveryStatus === "sent" &&
        reconciledMessage.providerEmailId ===
          providerEmailId &&
        reconciledMessage.providerMessageId ===
          providerMessageId
      ) {
        return {
          outcome: "already_reconciled",
          message:
            reconciledMessage,
        };
      }
    } catch {
      /*
       * Preserve the original database error if reconciliation also fails.
       */
    }

    throw error;
  }

  const currentMessage =
    await getCommissionEmailMessageById(
      messageId,
    );

  if (!currentMessage) {
    return {
      outcome: "not_found",
    };
  }

  if (
    currentMessage.providerEmailId !== null &&
    currentMessage.providerEmailId !==
      providerEmailId
  ) {
    return {
      outcome: "conflict",
      message:
        currentMessage,
    };
  }

  if (
    currentMessage.providerMessageId !== null &&
    currentMessage.providerMessageId !==
      providerMessageId
  ) {
    return {
      outcome: "conflict",
      message:
        currentMessage,
    };
  }

  if (
    currentMessage.deliveryStatus === "sent" &&
    currentMessage.providerEmailId ===
      providerEmailId &&
    currentMessage.providerMessageId ===
      providerMessageId
  ) {
    return {
      outcome: "already_reconciled",
      message:
        currentMessage,
    };
  }

  return {
    outcome: "invalid_state",
    message:
      currentMessage,
  };
}
