import {
  and,
  eq,
  inArray,
} from "drizzle-orm";

import { db } from "../db";
import {
  commissionEmailMessages,
  commissionEmailThreads,
  commissions,
} from "../db/schema/commissions";

const MAX_EMAIL_LENGTH = 320;
const MAX_CORRELATION_MESSAGE_IDS = 100;

export interface ResolveCommissionInboundReplyInput {
  senderEmail: string;
  inReplyToMessageId?: string | null;
  referencesHeader?: string | null;
}

export type ResolveCommissionInboundReplyResult =
  | {
      outcome: "matched";
      commissionId: string;
      threadId: string;
      subject: string;
      clientEmail: string;
    }
  | {
      outcome: "no_thread_evidence";
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "sender_mismatch";
      commissionId: string;
      threadId: string;
    }
  | {
      outcome: "ambiguous";
      threadIds: string[];
    }
  | {
      outcome: "conflict";
    };

function normalizeSenderEmail(
  value: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      "senderEmail is required.",
    );
  }

  if (
    normalized.length >
    MAX_EMAIL_LENGTH
  ) {
    throw new Error(
      `senderEmail must be ${MAX_EMAIL_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function normalizeEmailForComparison(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

/*
 * RFC Message-ID values normally use:
 *
 *   <message-id@example.com>
 *
 * References may contain several of them:
 *
 *   <root@example.com> <second@example.com>
 *
 * Preserve the complete <...> token because that is exactly how the
 * provider Message-ID is persisted in commission_email_messages and
 * commission_email_threads.
 */
function extractMessageIds(
  value: string | null | undefined,
): string[] {
  if (
    value === null ||
    value === undefined
  ) {
    return [];
  }

  const normalized =
    value.trim();

  if (!normalized) {
    return [];
  }

  const bracketedIds =
    normalized.match(
      /<[^<>\r\n]+>/g,
    );

  if (
    bracketedIds &&
    bracketedIds.length > 0
  ) {
    return bracketedIds.map(
      (messageId) =>
        messageId.trim(),
    );
  }

  /*
   * Be tolerant if a provider ever exposes a Message-ID without angle
   * brackets. Do not treat an entire multi-value References header as one
   * identifier; split it into individual tokens instead.
   */
  return normalized
    .split(/\s+/)
    .map(
      (messageId) =>
        messageId.trim(),
    )
    .filter(Boolean);
}

function getCorrelationMessageIds(
  input: ResolveCommissionInboundReplyInput,
): string[] {
  const values = [
    ...extractMessageIds(
      input.inReplyToMessageId,
    ),
    ...extractMessageIds(
      input.referencesHeader,
    ),
  ];

  return [
    ...new Set(values),
  ].slice(
    0,
    MAX_CORRELATION_MESSAGE_IDS,
  );
}

export async function resolveCommissionInboundReply(
  input: ResolveCommissionInboundReplyInput,
): Promise<ResolveCommissionInboundReplyResult> {
  const senderEmail =
    normalizeSenderEmail(
      input.senderEmail,
    );

  const messageIds =
    getCorrelationMessageIds(
      input,
    );

  if (
    messageIds.length === 0
  ) {
    return {
      outcome:
        "no_thread_evidence",
    };
  }

  /*
   * A client may reply to:
   *
   * 1. The immutable root RFC Message-ID.
   * 2. A later outbound email's own RFC Message-ID.
   *
   * Check both sources. Subject matching is intentionally not used.
   */
  const [
    matchingMessages,
    matchingRootThreads,
  ] =
    await Promise.all([
      db
        .select({
          threadId:
            commissionEmailMessages.threadId,
          commissionId:
            commissionEmailMessages.commissionId,
        })
        .from(
          commissionEmailMessages,
        )
        .where(
          and(
            eq(
              commissionEmailMessages.scope,
              "client_thread",
            ),
            inArray(
              commissionEmailMessages.providerMessageId,
              messageIds,
            ),
          ),
        ),

      db
        .select({
          threadId:
            commissionEmailThreads.id,
          commissionId:
            commissionEmailThreads.commissionId,
        })
        .from(
          commissionEmailThreads,
        )
        .where(
          inArray(
            commissionEmailThreads.rootMessageId,
            messageIds,
          ),
        ),
    ]);

  const threadIds =
    new Set<string>();

  for (
    const message of
    matchingMessages
  ) {
    if (
      message.threadId
    ) {
      threadIds.add(
        message.threadId,
      );
    }
  }

  for (
    const thread of
    matchingRootThreads
  ) {
    threadIds.add(
      thread.threadId,
    );
  }

  if (
    threadIds.size === 0
  ) {
    return {
      outcome:
        "not_found",
    };
  }

  /*
   * References can contain many Message-IDs. They must all resolve to one
   * logical commission thread. If provider data points to multiple threads,
   * never guess which one the email belongs to.
   */
  if (
    threadIds.size > 1
  ) {
    return {
      outcome:
        "ambiguous",

      threadIds: [
        ...threadIds,
      ],
    };
  }

  const threadId =
    [...threadIds][0];

  if (!threadId) {
    return {
      outcome:
        "not_found",
    };
  }

  const rows =
    await db
      .select({
        threadId:
          commissionEmailThreads.id,

        commissionId:
          commissionEmailThreads.commissionId,

        subject:
          commissionEmailThreads.subject,

        clientEmail:
          commissions.clientEmail,
      })
      .from(
        commissionEmailThreads,
      )
      .innerJoin(
        commissions,
        eq(
          commissions.id,
          commissionEmailThreads.commissionId,
        ),
      )
      .where(
        eq(
          commissionEmailThreads.id,
          threadId,
        ),
      )
      .limit(1);

  const resolved =
    rows[0];

  if (!resolved) {
    /*
     * A matched provider identity should always point to an existing thread
     * and commission because of the database foreign keys.
     */
    return {
      outcome:
        "conflict",
    };
  }

  /*
   * commission_email_messages stores both thread_id and commission_id.
   * Verify historical/provider matches are internally consistent before
   * accepting external input into the conversation.
   */
  if (
    matchingMessages.some(
      (message) =>
        message.threadId ===
          threadId &&
        message.commissionId !==
          resolved.commissionId,
    )
  ) {
    return {
      outcome:
        "conflict",
    };
  }

  if (
    matchingRootThreads.some(
      (thread) =>
        thread.threadId ===
          threadId &&
        thread.commissionId !==
          resolved.commissionId,
    )
  ) {
    return {
      outcome:
        "conflict",
    };
  }

  /*
   * Thread evidence identifies the commission, but the sender must still be
   * the client registered for that commission.
   *
   * This prevents someone possessing or fabricating an RFC Message-ID from
   * being automatically represented in Admin as the client.
   */
  if (
    normalizeEmailForComparison(
      senderEmail,
    ) !==
    normalizeEmailForComparison(
      resolved.clientEmail,
    )
  ) {
    return {
      outcome:
        "sender_mismatch",

      commissionId:
        resolved.commissionId,

      threadId:
        resolved.threadId,
    };
  }

  return {
    outcome:
      "matched",

    commissionId:
      resolved.commissionId,

    threadId:
      resolved.threadId,

    subject:
      resolved.subject,

    clientEmail:
      resolved.clientEmail,
  };
}