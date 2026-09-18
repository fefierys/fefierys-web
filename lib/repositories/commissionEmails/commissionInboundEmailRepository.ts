import { randomUUID } from "node:crypto";

import {
  eq,
  or,
} from "drizzle-orm";

import { db } from "../../db";
import {
  commissionEmailMessages,
  commissionEmailThreads,
} from "../../db/schema/commissions";
import type {
  CommissionEmailMessage,
  CommissionEmailThread,
  CreateReceivedCommissionEmailMessageInput,
  CreateReceivedCommissionEmailMessageResult,
} from "./commissionEmailTypes";

const MAX_EMAIL_LENGTH = 320;
const MAX_SUBJECT_LENGTH = 350;
const MAX_PROVIDER_EMAIL_ID_LENGTH = 255;
const MAX_MESSAGE_TEXT_LENGTH = 50_000;
const MAX_HEADER_LENGTH = 32_000;

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

function normalizeSubject(
  value: string,
): string {
  const normalized =
    normalizeRequiredValue(
      value,
      "subject",
    );

  /*
   * Unlike outbound subjects, inbound subjects are controlled by the
   * external sender. Truncate rather than fail the webhook for an
   * excessively long but otherwise valid subject.
   */
  return normalized.slice(
    0,
    MAX_SUBJECT_LENGTH,
  );
}

function normalizeMessageText(
  value: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      "messageText is required.",
    );
  }

  /*
   * Received email is untrusted external input. Keep the conversation
   * useful without allowing an unusually large email body to grow the
   * commission record without bound.
   */
  return normalized.slice(
    0,
    MAX_MESSAGE_TEXT_LENGTH,
  );
}

function normalizeProviderEmailId(
  value: string,
): string {
  const normalized =
    normalizeRequiredValue(
      value,
      "providerEmailId",
    );

  if (
    normalized.length >
    MAX_PROVIDER_EMAIL_ID_LENGTH
  ) {
    throw new Error(
      `providerEmailId must be ${MAX_PROVIDER_EMAIL_ID_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function normalizeHeader(
  value: string,
  fieldName: string,
): string {
  return normalizeRequiredValue(
    value,
    fieldName,
  );
}

function normalizeOptionalHeader(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    normalizeHeader(
      value,
      fieldName,
    );

  return normalized.slice(
    0,
    MAX_HEADER_LENGTH,
  );
}

function normalizeReceivedAt(
  value: Date,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(
      value.getTime(),
    )
  ) {
    throw new Error(
      "receivedAt must be a valid Date.",
    );
  }

  return new Date(
    value.getTime(),
  );
}

async function getThreadById(
  threadId: string,
): Promise<CommissionEmailThread | null> {
  const rows =
    await db
      .select()
      .from(
        commissionEmailThreads,
      )
      .where(
        eq(
          commissionEmailThreads.id,
          threadId,
        ),
      )
      .limit(1);

  return rows[0] ?? null;
}

async function getMessagesByProviderIdentity(
  providerEmailId: string,
  providerMessageId: string,
): Promise<CommissionEmailMessage[]> {
  return db
    .select()
    .from(
      commissionEmailMessages,
    )
    .where(
      or(
        eq(
          commissionEmailMessages.providerEmailId,
          providerEmailId,
        ),
        eq(
          commissionEmailMessages.providerMessageId,
          providerMessageId,
        ),
      ),
    );
}

function isSameInboundMessage(
  message: CommissionEmailMessage,
  input: {
    commissionId: string;
    threadId: string;
    providerEmailId: string;
    providerMessageId: string;
  },
): boolean {
  return (
    message.commissionId ===
      input.commissionId &&
    message.threadId ===
      input.threadId &&
    message.scope ===
      "client_thread" &&
    message.direction ===
      "inbound" &&
    message.kind ===
      "general_message" &&
    message.actor ===
      "client" &&
    message.deliveryStatus ===
      "received" &&
    message.providerEmailId ===
      input.providerEmailId &&
    message.providerMessageId ===
      input.providerMessageId
  );
}

function classifyExistingProviderIdentity(
  messages: CommissionEmailMessage[],
  input: {
    commissionId: string;
    threadId: string;
    providerEmailId: string;
    providerMessageId: string;
  },
):
  | {
      outcome: "already_received";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "conflict";
      messages: CommissionEmailMessage[];
    }
  | null {
  if (
    messages.length === 0
  ) {
    return null;
  }

  const providerEmailMatch =
    messages.find(
      (message) =>
        message.providerEmailId ===
        input.providerEmailId,
    ) ?? null;

  const providerMessageMatch =
    messages.find(
      (message) =>
        message.providerMessageId ===
        input.providerMessageId,
    ) ?? null;

  /*
   * Both provider identifiers should resolve to one immutable logical
   * email. If they point at different rows, provider identity has become
   * ambiguous and must never be silently reassigned.
   */
  if (
    providerEmailMatch &&
    providerMessageMatch &&
    providerEmailMatch.id !==
      providerMessageMatch.id
  ) {
    return {
      outcome: "conflict",
      messages,
    };
  }

  const candidate =
    providerEmailMatch ??
    providerMessageMatch;

  if (
    candidate &&
    isSameInboundMessage(
      candidate,
      input,
    )
  ) {
    return {
      outcome:
        "already_received",
      message:
        candidate,
    };
  }

  return {
    outcome: "conflict",
    messages,
  };
}

export async function createReceivedCommissionEmailMessage(
  input: CreateReceivedCommissionEmailMessageInput,
): Promise<CreateReceivedCommissionEmailMessageResult> {
  const messageId =
    randomUUID();

  const commissionId =
    normalizeRequiredValue(
      input.commissionId,
      "commissionId",
    );

  const threadId =
    normalizeRequiredValue(
      input.threadId,
      "threadId",
    );

  const senderEmail =
    normalizeEmail(
      input.senderEmail,
      "senderEmail",
    );

  const recipientEmail =
    normalizeEmail(
      input.recipientEmail,
      "recipientEmail",
    );

  const subject =
    normalizeSubject(
      input.subject,
    );

  const messageText =
    normalizeMessageText(
      input.messageText,
    );

  const providerEmailId =
    normalizeProviderEmailId(
      input.providerEmailId,
    );

  const providerMessageId =
    normalizeHeader(
      input.providerMessageId,
      "providerMessageId",
    );

  const inReplyToMessageId =
    normalizeOptionalHeader(
      input.inReplyToMessageId,
      "inReplyToMessageId",
    );

  const referencesHeader =
    normalizeOptionalHeader(
      input.referencesHeader,
      "referencesHeader",
    );

  const receivedAt =
    normalizeReceivedAt(
      input.receivedAt,
    );

  if (
    !inReplyToMessageId &&
    !referencesHeader
  ) {
    throw new Error(
      "A received commission reply requires In-Reply-To or References.",
    );
  }

  /*
   * commission_email_messages has separate commission_id and thread_id
   * foreign keys. Verify that the supplied thread actually belongs to the
   * commission before accepting an external email into that conversation.
   */
  const thread =
    await getThreadById(
      threadId,
    );

  if (!thread) {
    return {
      outcome:
        "thread_not_found",
    };
  }

  if (
    thread.commissionId !==
    commissionId
  ) {
    return {
      outcome:
        "thread_mismatch",
      thread,
    };
  }

  /*
   * Fast idempotency check before attempting the INSERT.
   */
  const existingMessages =
    await getMessagesByProviderIdentity(
      providerEmailId,
      providerMessageId,
    );

  const existingClassification =
    classifyExistingProviderIdentity(
      existingMessages,
      {
        commissionId,
        threadId,
        providerEmailId,
        providerMessageId,
      },
    );

  if (
    existingClassification
  ) {
    return existingClassification;
  }

  try {
    /*
     * provider_email_id and provider_message_id are both UNIQUE.
     *
     * ON CONFLICT DO NOTHING handles concurrent webhook deliveries. Only
     * one worker can create the logical inbound message; another worker
     * reconciles the provider identity below and returns already_received.
     */
    const rows =
      await db
        .insert(
          commissionEmailMessages,
        )
        .values({
          id:
            messageId,

          commissionId,
          threadId,

          quoteId:
            null,

          scope:
            "client_thread",

          direction:
            "inbound",

          kind:
            "general_message",

          actor:
            "client",

          deliveryStatus:
            "received",

          senderEmail,
          recipientEmail,

          replyToEmail:
            null,

          subject,
          messageText,

          providerEmailId,
          providerMessageId,

          inReplyToMessageId,
          referencesHeader,

          attemptCount:
            0,

          lastAttemptAt:
            null,

          sentAt:
            null,

          failedAt:
            null,

          failureMessage:
            null,

          createdByAdminUserId:
            null,

          createdAt:
            receivedAt,

          updatedAt:
            receivedAt,
        })
        .onConflictDoNothing()
        .returning();

    const createdMessage =
      rows[0];

    if (createdMessage) {
      return {
        outcome:
          "created",
        message:
          createdMessage,
      };
    }

    /*
     * Another webhook worker won the race, so classify the row now stored
     * under the provider's immutable identifiers.
     */
    const reconciledMessages =
      await getMessagesByProviderIdentity(
        providerEmailId,
        providerMessageId,
      );

    const reconciledClassification =
      classifyExistingProviderIdentity(
        reconciledMessages,
        {
          commissionId,
          threadId,
          providerEmailId,
          providerMessageId,
        },
      );

    if (
      reconciledClassification
    ) {
      return reconciledClassification;
    }

    throw new Error(
      "Received commission email insert could not be reconciled.",
    );
  } catch (error) {
    /*
     * Neon may commit an INSERT even if the client loses the response.
     * Re-read by provider identity before surfacing the original database
     * error so a retry cannot create a second logical inbound message.
     */
    try {
      const reconciledMessages =
        await getMessagesByProviderIdentity(
          providerEmailId,
          providerMessageId,
        );

      const reconciledClassification =
        classifyExistingProviderIdentity(
          reconciledMessages,
          {
            commissionId,
            threadId,
            providerEmailId,
            providerMessageId,
          },
        );

      if (
        reconciledClassification
      ) {
        return reconciledClassification;
      }
    } catch {
      /*
       * Preserve the original database error when reconciliation itself
       * cannot be completed.
       */
    }

    throw error;
  }
}