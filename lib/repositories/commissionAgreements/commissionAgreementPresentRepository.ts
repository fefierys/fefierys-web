import { randomUUID } from "node:crypto";
import {
  eq,
  sql,
} from "drizzle-orm";
import {
  generatePublicAgreementToken,
  hashPublicAgreementToken,
} from "../../commissions/commissionAgreementAccessToken";
import { db } from "../../db";
import {
  commissionAgreements,
  commissionDocuments,
  commissionEmailThreads,
  commissionEvents,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";
import {
  getCommissionEmailMessageById,
} from "../commissionEmailRepository";
type CommissionAgreement =
  typeof commissionAgreements.$inferSelect;
type CommissionDocument =
  typeof commissionDocuments.$inferSelect;
type CommissionEvent =
  typeof commissionEvents.$inferSelect;
type CommissionStatus =
  typeof commissions.$inferSelect.status;
type AgreementStatus =
  typeof commissionAgreements.$inferSelect.status;
type QuoteStatus =
  typeof commissionQuotes.$inferSelect.status;
interface CommissionAgreementPresentState {
  agreementId: string;
  agreementStatus: AgreementStatus;
  agreementUpdatedAt: Date;
  commissionId: string;
  commissionStatus: CommissionStatus;
  isOnHold: boolean;
  quoteId: string;
  quoteStatus: QuoteStatus;
  version: number;
  documentId: string | null;
  publicTokenHash: string | null;
  reference: string;
  clientName: string;
  clientEmail: string;
  threadId: string | null;
  subject: string | null;
  rootMessageId: string | null;
  hasBlockingMessage: boolean;
}

export interface PresentCommissionAgreementInput {
  agreementId: string;
  expectedUpdatedAt: Date;
  presentedAt: Date;
  documentId: string;
  storageKey: string;
  contentSha256: string;
  presentedByAdminUserId: string;
  senderEmail: string;
  replyToEmail: string;
}

export type PresentCommissionAgreementResult =
  | {
      outcome: "presented";
      agreement: CommissionAgreement;
      document: CommissionDocument;
      event: CommissionEvent;
      messageId: string;
      clientName: string;
      reference: string;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_draft";
      currentStatus: AgreementStatus;
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "quote_not_accepted";
      currentStatus: QuoteStatus;
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
      currentUpdatedAt: Date;
    };
interface PresentCommissionAgreementWriteRow
  extends Record<string, unknown> {
  agreementId: string;
  documentId: string;
  eventId: string;
  messageId: string;
  clientName: string;
  reference: string;
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
    normalized.length > 320
  ) {
    throw new Error(
      `${fieldName} must be 320 characters or fewer.`,
    );
  }
  return normalized;
}

function normalizeStorageKey(
  value: string,
): string {
  const normalized =
    normalizeRequiredValue(
      value,
      "storageKey",
    );
  if (
    normalized.length > 2_000
  ) {
    throw new Error(
      "storageKey is too long.",
    );
  }
  return normalized;
}

function normalizeSha256(
  value: string,
): string {
  const normalized =
    value.trim().toLowerCase();
  if (
    !/^[a-f0-9]{64}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "contentSha256 must be a 64-character hexadecimal SHA-256 digest.",
    );
  }
  return normalized;
}

async function getCommissionAgreementPresentState(
  agreementId: string,
): Promise<CommissionAgreementPresentState | null> {
  const rows =
    await db
      .select({
        agreementId:
          commissionAgreements.id,
        agreementStatus:
          commissionAgreements.status,
        agreementUpdatedAt:
          commissionAgreements.updatedAt,
        commissionId:
          commissionAgreements.commissionId,
        quoteId:
          commissionAgreements.quoteId,
        version:
          commissionAgreements.version,
        documentId:
          commissionAgreements.documentId,
        publicTokenHash:
          commissionAgreements.publicTokenHash,
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
        quoteStatus:
          commissionQuotes.status,
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
              FROM commission_email_messages
                AS pending_message
              WHERE
                pending_message.thread_id =
                  ${commissionEmailThreads.id}
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
          `,
      })
      .from(
        commissionAgreements,
      )
      .innerJoin(
        commissions,
        eq(
          commissions.id,
          commissionAgreements.commissionId,
        ),
      )
      .innerJoin(
        commissionQuotes,
        eq(
          commissionQuotes.id,
          commissionAgreements.quoteId,
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
          commissionAgreements.id,
          agreementId,
        ),
      )
      .limit(1);
  return (
    rows[0] ??
    null
  );
}

async function classifyCommissionAgreementPresentFailure(
  agreementId: string,
  expectedUpdatedAt: Date,
): Promise<
  Exclude<
    PresentCommissionAgreementResult,
    {
      outcome: "presented";
    }
  >
> {
  const state =
    await getCommissionAgreementPresentState(
      agreementId,
    );
  if (!state) {
    return {
      outcome:
        "not_found",
    };
  }
  if (
    state.agreementStatus !==
    "draft"
  ) {
    return {
      outcome:
        "not_draft",
      currentStatus:
        state.agreementStatus,
    };
  }
  if (
    state.commissionStatus !==
    "awaiting_agreement"
  ) {
    return {
      outcome:
        "wrong_commission_status",
      currentStatus:
        state.commissionStatus,
    };
  }
  if (
    state.isOnHold
  ) {
    return {
      outcome:
        "on_hold",
    };
  }
  if (
    state.quoteStatus !==
    "accepted"
  ) {
    return {
      outcome:
        "quote_not_accepted",
      currentStatus:
        state.quoteStatus,
    };
  }
  if (
    state.agreementUpdatedAt.getTime() !==
    expectedUpdatedAt.getTime()
  ) {
    return {
      outcome:
        "conflict",
      currentUpdatedAt:
        state.agreementUpdatedAt,
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
  if (
    !state.rootMessageId
  ) {
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
   * The visible state still satisfies every business
   * prerequisite, so a concurrent write must have prevented
   * this exact operation.
   */
  return {
    outcome:
      "conflict",
    currentUpdatedAt:
      state.agreementUpdatedAt,
  };
}

export async function presentCommissionAgreement(
  input: PresentCommissionAgreementInput,
): Promise<PresentCommissionAgreementResult> {
  const presentedByAdminUserId =
    normalizeRequiredValue(
      input.presentedByAdminUserId,
      "presentedByAdminUserId",
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
  const storageKey =
    normalizeStorageKey(
      input.storageKey,
    );
  const contentSha256 =
    normalizeSha256(
      input.contentSha256,
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

  if (
    !(
      input.presentedAt
      instanceof Date
    ) ||
    Number.isNaN(
      input.presentedAt.getTime(),
    )
  ) {
    throw new Error(
      "presentedAt must be a valid Date.",
    );
  }
  const initialState =
    await getCommissionAgreementPresentState(
      input.agreementId,
    );
  if (
    !initialState
  ) {
    return {
      outcome:
        "not_found",
    };
  }
  if (
    initialState.agreementStatus !==
    "draft"
  ) {
    return {
      outcome:
        "not_draft",
      currentStatus:
        initialState.agreementStatus,
    };
  }
  if (
    initialState.commissionStatus !==
    "awaiting_agreement"
  ) {
    return {
      outcome:
        "wrong_commission_status",
      currentStatus:
        initialState.commissionStatus,
    };
  }
  if (
    initialState.isOnHold
  ) {
    return {
      outcome:
        "on_hold",
    };
  }
  if (
    initialState.quoteStatus !==
    "accepted"
  ) {
    return {
      outcome:
        "quote_not_accepted",
      currentStatus:
        initialState.quoteStatus,
    };
  }
  if (
    initialState.agreementUpdatedAt.getTime() !==
    input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome:
        "conflict",
      currentUpdatedAt:
        initialState.agreementUpdatedAt,
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
   * A draft Agreement must not already reference an immutable
   * document or have an active public bearer token.
   *
   * These fields being populated while status is still draft
   * would indicate inconsistent persisted state.
   */
  if (
    initialState.documentId !==
      null ||
    initialState.publicTokenHash !==
      null
  ) {
    return {
      outcome:
        "conflict",
      currentUpdatedAt:
        initialState.agreementUpdatedAt,
    };
  }
  /*
   * The public token is deterministic for this Agreement ID.
   * Only the SHA-256 digest is persisted.
   */
  const publicToken =
    generatePublicAgreementToken(
      input.agreementId,
    );
  const publicTokenHash =
    hashPublicAgreementToken(
      publicToken,
    );
  const presentedAt =
    input.presentedAt;
  const eventId =
    randomUUID();
  const messageId =
    randomUUID();
  const eventMetadata =
    JSON.stringify({
      agreementId:
        input.agreementId,
      quoteId:
        initialState.quoteId,
      documentId:
        input.documentId,
      sentAt:
        presentedAt.toISOString(),
    });
  try {
    /*
     * The immutable R2 object has already been uploaded by the
     * application service before reaching this repository.
     *
     * This one database statement:
     * - creates its immutable document metadata;
     * - freezes the Agreement as sent;
     * - persists the bearer-token digest;
     * - records the Agreement event;
     * - creates the logical email in the existing client thread.
     *
     * The commission itself intentionally remains in
     * awaiting_agreement until the Client accepts.
     */
    const writeResult =
      await db.execute<PresentCommissionAgreementWriteRow>(
        sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              agreement.id
                AS agreement_id,
              agreement.commission_id,
              agreement.quote_id,
              agreement.version,
              commission.reference,
              commission.client_name,
              commission.client_email,
              email_thread.id
                AS thread_id,
              email_thread.subject,
              email_thread.root_message_id
            FROM commission_agreements
              AS agreement
            INNER JOIN commissions
              AS commission
              ON commission.id =
                agreement.commission_id
            INNER JOIN commission_quotes
              AS quote
              ON quote.id =
                agreement.quote_id
              AND quote.commission_id =
                agreement.commission_id
            INNER JOIN commission_email_threads
              AS email_thread
              ON email_thread.commission_id =
                commission.id
            WHERE
              agreement.id =
                ${input.agreementId}::uuid
              AND agreement.status =
                'draft'
              AND agreement.updated_at =
                ${input.expectedUpdatedAt}
              AND agreement.document_id
                IS NULL
              AND agreement.public_token_hash
                IS NULL
              AND commission.status =
                'awaiting_agreement'
              AND commission.is_on_hold =
                false
              AND quote.status =
                'accepted'
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
              agreement,
              commission,
              quote,
              email_thread
          ),
          created_document AS (
            INSERT INTO commission_documents (
              id,
              commission_id,
              type,
              document_number,
              version,
              status,
              storage_key,
              content_sha256,
              recipient_email,
              generated_at,
              sent_at,
              created_at,
              updated_at
            )
            SELECT
              ${input.documentId}::uuid,
              locked_target.commission_id,
              'commission_agreement'
                ::document_type,
              null,
              locked_target.version,
              'sent'
                ::document_status,
              ${storageKey},
              ${contentSha256},
              locked_target.client_email,
              ${presentedAt},
              ${presentedAt},
              ${presentedAt},
              ${presentedAt}
            FROM locked_target
            RETURNING
              id,
              commission_id,
              version
          ),
          updated_agreement AS (
            UPDATE commission_agreements
              AS agreement
            SET
              document_id =
                created_document.id,
              status =
                'sent',
              public_token_hash =
                ${publicTokenHash},
              public_token_created_at =
                ${presentedAt},
              public_token_revoked_at =
                null,
              sent_at =
                ${presentedAt},
              updated_at =
                ${presentedAt}
            FROM
              locked_target,
              created_document
            WHERE
              agreement.id =
                locked_target.agreement_id
              AND created_document.commission_id =
                locked_target.commission_id
            RETURNING
              agreement.id,
              agreement.commission_id,
              agreement.quote_id,
              agreement.version,
              agreement.document_id
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
              updated_agreement.commission_id,
              'agreement_sent'
                ::commission_event_type,
              'artist'
                ::commission_actor,
              'Agreement v'
                || updated_agreement.version
                || ' sent',
              null,
              ${eventMetadata}::jsonb,
              ${presentedByAdminUserId},
              ${presentedAt}
            FROM updated_agreement
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
              updated_agreement.commission_id,
              locked_target.thread_id,
              updated_agreement.quote_id,
              'client_thread'
                ::commission_email_scope,
              'outbound'
                ::commission_email_direction,
              'agreement_ready'
                ::commission_email_kind,
              'artist'
                ::commission_actor,
              'queued'
                ::commission_email_delivery_status,
              ${senderEmail},
              locked_target.client_email,
              ${replyToEmail},
              locked_target.subject,
              'Agreement v'
                || updated_agreement.version
                || ' ready for client review.',
              null,
              null,
              /*
               * The common delivery claim fills these using the
               * immutable RFC root immediately before provider
               * delivery.
               */
              null,
              null,
              0,
              null,
              null,
              null,
              null,
              ${presentedByAdminUserId},
              ${presentedAt},
              ${presentedAt}
            FROM locked_target
            INNER JOIN updated_agreement
              ON updated_agreement.id =
                locked_target.agreement_id
            INNER JOIN created_event
              ON true
            RETURNING
              id,
              commission_id,
              quote_id
          )
          SELECT
            updated_agreement.id
              AS "agreementId",
            created_document.id
              AS "documentId",
            created_event.id
              AS "eventId",
            created_message.id
              AS "messageId",
            locked_target.client_name
              AS "clientName",
            locked_target.reference
              AS "reference"
          FROM updated_agreement
          CROSS JOIN created_document
          CROSS JOIN created_event
          CROSS JOIN created_message
          CROSS JOIN locked_target
        `,
      );
    const writeRow =
      writeResult.rows[0];
    if (
      !writeRow
    ) {
      return classifyCommissionAgreementPresentFailure(
        input.agreementId,
        input.expectedUpdatedAt,
      );
    }
    const [
      agreementRows,
      documentRows,
      eventRows,
      emailMessage,
    ] =
      await Promise.all([
        db
          .select()
          .from(
            commissionAgreements,
          )
          .where(
            eq(
              commissionAgreements.id,
              input.agreementId,
            ),
          )
          .limit(1),
        db
          .select()
          .from(
            commissionDocuments,
          )
          .where(
            eq(
              commissionDocuments.id,
              input.documentId,
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
    const agreement =
      agreementRows[0];
    const document =
      documentRows[0];
    const event =
      eventRows[0];
    if (
      !agreement ||
      !document ||
      !event ||
      !emailMessage ||
      writeRow.agreementId !==
        input.agreementId ||
      writeRow.documentId !==
        input.documentId ||
      writeRow.eventId !==
        eventId ||
      writeRow.messageId !==
        messageId ||
      agreement.status !==
        "sent" ||
      agreement.documentId !==
        input.documentId ||
      document.type !==
        "commission_agreement" ||
      document.status !==
        "sent" ||
      emailMessage.commissionId !==
        agreement.commissionId ||
      emailMessage.quoteId !==
        agreement.quoteId ||
      emailMessage.kind !==
        "agreement_ready"
    ) {
      throw new Error(
        "Agreement presentation returned incomplete or inconsistent records.",
      );
    }
    return {
      outcome:
        "presented",
      agreement,
      document,
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
     * These pre-generated IDs identify this exact operation if
     * Neon committed the statement but its HTTP response was
     * lost.
     *
     * This reconciliation is especially important here because
     * the immutable R2 object already exists. We must not treat
     * an uncertain committed write as a failed presentation and
     * subsequently delete the referenced object.
     */
    try {
      const [
        agreementRows,
        documentRows,
        eventRows,
        emailMessage,
      ] =
        await Promise.all([
          db
            .select()
            .from(
              commissionAgreements,
            )
            .where(
              eq(
                commissionAgreements.id,
                input.agreementId,
              ),
            )
            .limit(1),
          db
            .select()
            .from(
              commissionDocuments,
            )
            .where(
              eq(
                commissionDocuments.id,
                input.documentId,
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
      const agreement =
        agreementRows[0];
      const document =
        documentRows[0];
      const event =
        eventRows[0];
      if (
        agreement?.status ===
          "sent" &&
        agreement.documentId ===
          input.documentId &&
        document?.type ===
          "commission_agreement" &&
        document.status ===
          "sent" &&
        event?.type ===
          "agreement_sent" &&
        emailMessage?.kind ===
          "agreement_ready" &&
        emailMessage.commissionId ===
          agreement.commissionId
      ) {
        const state =
          await getCommissionAgreementPresentState(
            input.agreementId,
          );
        if (
          !state
        ) {
          throw new Error(
            "Presented Agreement could not be reconciled.",
          );
        }
        return {
          outcome:
            "presented",
          agreement,
          document,
          event,
          messageId:
            emailMessage.id,
          clientName:
            state.clientName,
          reference:
            state.reference,
        };
      }
      return await classifyCommissionAgreementPresentFailure(
        input.agreementId,
        input.expectedUpdatedAt,
      );
    } catch {
      /*
       * Preserve the original database error if reconciliation
       * cannot reach Neon either.
       *
       * The caller must NOT delete the uploaded R2 object after
       * this kind of uncertain error because the DB statement
       * may actually have committed.
       */
    }
    throw error;
  }
}
