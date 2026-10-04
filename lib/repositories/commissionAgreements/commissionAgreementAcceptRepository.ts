import {
  randomUUID,
} from "node:crypto";

import {
  eq,
  sql,
} from "drizzle-orm";

import {
  hashPublicAgreementToken,
  isValidPublicAgreementToken,
} from "../../commissions/commissionAgreementAccessToken";

import {
  COMMISSION_AGREEMENT_ACCEPTANCE_STATEMENT_VERSION,
} from "../../legal/commissionAgreementAcceptance";

import {
  db,
} from "../../db";

import {
  commissionAgreements,
  commissionDocuments,
  commissionEvents,
  commissionStatusHistory,
  commissions,
} from "../../db/schema/commissions";

import {
  resolveCommissionAgreementPublicToken,
} from "./commissionAgreementAccessRepository";

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const MAX_ACCEPTED_BY_NAME_LENGTH =
  200;

export interface AcceptCommissionAgreementPubliclyInput {
  /*
   * Public bearer credential.
   *
   * Never include this value or its hash in events, logs or
   * other audit metadata.
   */
  token: string;

  /*
   * Agreement state resolved before generating the executed
   * document.
   *
   * The atomic write requires the Agreement to still have this
   * exact updated_at value.
   */
  expectedUpdatedAt: Date;

  /*
   * Exact immutable presented document that was read from R2
   * and verified before the executed PDF was generated.
   */
  presentedDocumentId: string;
  presentedStorageKey: string;
  presentedContentSha256: string;

  /*
   * Contractual snapshot used to build the executed PDF.
   *
   * The final database transaction requires these values to
   * remain unchanged so the executed document cannot describe
   * different data from the data persisted by acceptance.
   */
  expectedReference: string;
  expectedClientEmail: string;
  expectedAgreementRevision: number;

  /*
   * Executed document already uploaded to its unique private
   * R2 key before this database transition begins.
   */
  executedDocumentId: string;
  executedStorageKey: string;
  executedContentSha256: string;

  /*
   * Explicit name entered by the Client as their electronic
   * signature.
   */
  acceptedByName: string;

  /*
   * The same timestamp must be used both in the executed PDF
   * evidence page and in the database acceptance record.
   */
  acceptedAt: Date;
}

export type AcceptCommissionAgreementPubliclyResult =
  | {
      outcome: "accepted";

      agreementId: string;
      commissionId: string;
      executedDocumentId: string;
      acceptedAt: Date;
    }
  | {
      /*
       * Invalid, unknown or revoked public bearer.
       *
       * Public callers intentionally cannot distinguish these
       * cases.
       */
      outcome: "unavailable";
    }
  | {
      /*
       * The Agreement exists but can no longer be accepted,
       * for example because it was already accepted or the
       * Commission is no longer awaiting Agreement acceptance.
       */
      outcome: "not_actionable";
    }
  | {
      /*
       * State changed between public-token resolution and the
       * final atomic write.
       */
      outcome: "conflict";
    };

interface AgreementAcceptanceOperationState {
  agreementId: string;
  agreementStatus: string;
  agreementUpdatedAt: Date;

  executedDocumentId: string | null;

  presentedDocumentId: string | null;
  presentedStorageKey: string | null;
  presentedContentSha256: string | null;

  commissionStatus: string;
  commissionIsOnHold: boolean;
}

interface PublicAgreementAcceptanceWriteRow
  extends Record<string, unknown> {
  agreementId: string;
  commissionId: string;
  executedDocumentId: string;
  transitionId: string;
  eventId: string;
}

function normalizeRequiredText(
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

function normalizeAcceptedByName(
  value: string,
): string {
  const normalized =
    normalizeRequiredText(
      value,
      "acceptedByName",
    );

  if (
    normalized.length >
    MAX_ACCEPTED_BY_NAME_LENGTH
  ) {
    throw new Error(
      `acceptedByName cannot exceed ${MAX_ACCEPTED_BY_NAME_LENGTH} characters.`,
    );
  }

  return normalized;
}

function normalizeSha256(
  value: string,
  fieldName: string,
): string {
  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    !SHA256_PATTERN.test(
      normalized,
    )
  ) {
    throw new Error(
      `${fieldName} must be a hexadecimal SHA-256 digest.`,
    );
  }

  return normalized;
}

function normalizeDate(
  value: Date,
  fieldName: string,
): Date {
  if (
    !(
      value instanceof Date
    ) ||
    Number.isNaN(
      value.getTime(),
    )
  ) {
    throw new Error(
      `${fieldName} must be a valid Date.`,
    );
  }

  return value;
}

async function getAgreementAcceptanceOperationState(
  agreementId: string,
): Promise<AgreementAcceptanceOperationState | null> {
  const rows =
    await db
      .select({
        agreementId:
          commissionAgreements.id,

        agreementStatus:
          commissionAgreements.status,

        agreementUpdatedAt:
          commissionAgreements.updatedAt,

        executedDocumentId:
          commissionAgreements.executedDocumentId,

        presentedDocumentId:
          commissionAgreements.documentId,

        presentedStorageKey:
          commissionDocuments.storageKey,

        presentedContentSha256:
          commissionDocuments.contentSha256,

        commissionStatus:
          commissions.status,

        commissionIsOnHold:
          commissions.isOnHold,
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
      .leftJoin(
        commissionDocuments,
        eq(
          commissionDocuments.id,
          commissionAgreements.documentId,
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

async function classifyPublicAgreementAcceptanceFailure(
  input: {
    token: string;
    expectedUpdatedAt: Date;

    presentedDocumentId: string;
    presentedStorageKey: string;
    presentedContentSha256: string;
  },
): Promise<
  Exclude<
    AcceptCommissionAgreementPubliclyResult,
    {
      outcome: "accepted";
    }
  >
> {
  const target =
    await resolveCommissionAgreementPublicToken(
      input.token,
    );

  if (!target) {
    return {
      outcome:
        "unavailable",
    };
  }

  if (
    target.status !==
    "sent"
  ) {
    return {
      outcome:
        "not_actionable",
    };
  }

  const state =
    await getAgreementAcceptanceOperationState(
      target.agreementId,
    );

  if (!state) {
    return {
      outcome:
        "unavailable",
    };
  }

  if (
    state.agreementStatus !==
      "sent" ||
    state.commissionStatus !==
      "awaiting_agreement" ||
    state.commissionIsOnHold ||
    state.executedDocumentId !==
      null
  ) {
    return {
      outcome:
        "not_actionable",
    };
  }

  if (
    state.agreementUpdatedAt.getTime() !==
      input.expectedUpdatedAt.getTime() ||
    state.presentedDocumentId !==
      input.presentedDocumentId ||
    state.presentedStorageKey !==
      input.presentedStorageKey ||
    state.presentedContentSha256 !==
      input.presentedContentSha256
  ) {
    return {
      outcome:
        "conflict",
    };
  }

  /*
   * Every known precondition still appears valid.
   *
   * The atomic SQL write therefore most likely lost a race
   * against another concurrent operation.
   */
  return {
    outcome:
      "conflict",
  };
}

/*
 * Persists an electronic Agreement acceptance after the service
 * layer has:
 *
 * 1. resolved the public bearer;
 * 2. downloaded the immutable presented PDF;
 * 3. verified its persisted SHA-256;
 * 4. generated the executed PDF from those exact bytes;
 * 5. uploaded the executed PDF to a unique private R2 key.
 *
 * This function never uploads or deletes R2 objects.
 *
 * If it returns a known non-accepted business outcome, the
 * caller knows the database did not commit this exact operation
 * and may perform compensating cleanup of the uploaded executed
 * object.
 *
 * If this function throws, the caller must NOT immediately
 * delete the uploaded R2 object because the Neon transaction
 * may have committed while its HTTP response was lost.
 */
export async function acceptCommissionAgreementPublicly(
  rawInput: AcceptCommissionAgreementPubliclyInput,
): Promise<AcceptCommissionAgreementPubliclyResult> {
  if (
    !isValidPublicAgreementToken(
      rawInput.token,
    )
  ) {
    return {
      outcome:
        "unavailable",
    };
  }

  const expectedUpdatedAt =
    normalizeDate(
      rawInput.expectedUpdatedAt,
      "expectedUpdatedAt",
    );

  const acceptedAt =
    normalizeDate(
      rawInput.acceptedAt,
      "acceptedAt",
    );

  const acceptedByName =
    normalizeAcceptedByName(
      rawInput.acceptedByName,
    );

  const presentedDocumentId =
    normalizeRequiredText(
      rawInput.presentedDocumentId,
      "presentedDocumentId",
    );

  const presentedStorageKey =
    normalizeRequiredText(
      rawInput.presentedStorageKey,
      "presentedStorageKey",
    );

  const presentedContentSha256 =
    normalizeSha256(
      rawInput.presentedContentSha256,
      "presentedContentSha256",
    );

  const expectedReference =
    normalizeRequiredText(
      rawInput.expectedReference,
      "expectedReference",
    );

  const expectedClientEmail =
    normalizeRequiredText(
      rawInput.expectedClientEmail,
      "expectedClientEmail",
    );

  if (
    !Number.isInteger(
      rawInput.expectedAgreementRevision,
    ) ||
    rawInput.expectedAgreementRevision <
      1
  ) {
    throw new Error(
      "expectedAgreementRevision must be a positive integer.",
    );
  }

  const expectedAgreementRevision =
    rawInput.expectedAgreementRevision;

  const executedDocumentId =
    normalizeRequiredText(
      rawInput.executedDocumentId,
      "executedDocumentId",
    );

  const executedStorageKey =
    normalizeRequiredText(
      rawInput.executedStorageKey,
      "executedStorageKey",
    );

  const executedContentSha256 =
    normalizeSha256(
      rawInput.executedContentSha256,
      "executedContentSha256",
    );

  const tokenHash =
    hashPublicAgreementToken(
      rawInput.token,
    );

  const target =
    await resolveCommissionAgreementPublicToken(
      rawInput.token,
    );

  if (!target) {
    return {
      outcome:
        "unavailable",
    };
  }

  if (
    target.status !==
    "sent"
  ) {
    return {
      outcome:
        "not_actionable",
    };
  }

  if (
    target.updatedAt.getTime() !==
      expectedUpdatedAt.getTime() ||
    target.documentId !==
      presentedDocumentId ||
    target.storageKey !==
      presentedStorageKey ||
    target.contentSha256 !==
      presentedContentSha256 ||
    target.reference !==
      expectedReference ||
    target.clientEmail !==
      expectedClientEmail ||
    target.agreementRevision !==
      expectedAgreementRevision
  ) {
    return {
      outcome:
        "conflict",
    };
  }

  const initialState =
    await getAgreementAcceptanceOperationState(
      target.agreementId,
    );

  if (!initialState) {
    return {
      outcome:
        "unavailable",
    };
  }

  if (
    initialState.agreementStatus !==
      "sent" ||
    initialState.commissionStatus !==
      "awaiting_agreement" ||
    initialState.commissionIsOnHold ||
    initialState.executedDocumentId !==
      null
  ) {
    return {
      outcome:
        "not_actionable",
    };
  }

  if (
    initialState.agreementUpdatedAt.getTime() !==
      expectedUpdatedAt.getTime() ||
    initialState.presentedDocumentId !==
      presentedDocumentId ||
    initialState.presentedStorageKey !==
      presentedStorageKey ||
    initialState.presentedContentSha256 !==
      presentedContentSha256
  ) {
    return {
      outcome:
        "conflict",
    };
  }

  const transitionId =
    randomUUID();

  const eventId =
    randomUUID();

  /*
   * Do not put the public token, token hash, client email or
   * signature name in event metadata.
   *
   * Acceptance identity lives in commission_agreements.
   */
  const eventMetadata =
    JSON.stringify({
      agreementId:
        target.agreementId,

      presentedDocumentId,

      executedDocumentId,

      acceptedAt:
        acceptedAt.toISOString(),

      acceptanceMethod:
        "electronic",

      acceptanceStatementVersion:
        COMMISSION_AGREEMENT_ACCEPTANCE_STATEMENT_VERSION,
    });

  try {
    const writeResult =
      await db.execute<PublicAgreementAcceptanceWriteRow>(
        sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              agreement.id AS agreement_id,
              agreement.commission_id,
              agreement.quote_id,
              agreement.version,
              commission.client_email,
              commission.reference
            FROM commission_agreements AS agreement
            INNER JOIN commissions AS commission
              ON commission.id =
                agreement.commission_id
            INNER JOIN commission_documents AS presented_document
              ON presented_document.id =
                agreement.document_id
            WHERE
              agreement.id =
                ${target.agreementId}::uuid
              AND agreement.public_token_hash =
                ${tokenHash}
              AND agreement.public_token_revoked_at
                IS NULL
              AND agreement.status =
                'sent'
              AND agreement.updated_at =
                ${expectedUpdatedAt}
              AND agreement.version =
                ${expectedAgreementRevision}
              AND agreement.document_id =
                ${presentedDocumentId}::uuid
              AND commission.reference =
                ${expectedReference}
              AND commission.client_email =
                ${expectedClientEmail}
              AND agreement.executed_document_id
                IS NULL
              AND agreement.accepted_by_name
                IS NULL
              AND agreement.accepted_by_email
                IS NULL
              AND agreement.acceptance_method
                IS NULL
              AND agreement.acceptance_statement_version
                IS NULL
              AND agreement.accepted_at
                IS NULL
              AND commission.status =
                'awaiting_agreement'
              AND commission.is_on_hold =
                false
              AND presented_document.type =
                'commission_agreement'
              AND presented_document.status =
                'sent'
              AND presented_document.storage_key =
                ${presentedStorageKey}
              AND presented_document.content_sha256 =
                ${presentedContentSha256}
            FOR UPDATE OF
              agreement,
              commission,
              presented_document
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
              ${executedDocumentId}::uuid,
              locked_target.commission_id,
              'commission_agreement_executed'::document_type,
              null,
              locked_target.version,
              'generated'::document_status,
              ${executedStorageKey},
              ${executedContentSha256},
              locked_target.client_email,
              ${acceptedAt},
              null,
              ${acceptedAt},
              ${acceptedAt}
            FROM locked_target
            RETURNING
              id,
              commission_id,
              version
          ),

          updated_agreement AS (
            UPDATE commission_agreements AS agreement
            SET
              executed_document_id =
                created_document.id,
              status =
                'accepted',
              accepted_by_name =
                ${acceptedByName},
              accepted_by_email =
                locked_target.client_email,
              acceptance_method =
                'electronic',
              acceptance_statement_version =
                ${COMMISSION_AGREEMENT_ACCEPTANCE_STATEMENT_VERSION},
              accepted_at =
                ${acceptedAt},
              updated_at =
                ${acceptedAt}
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
              agreement.version,
              agreement.executed_document_id
          ),

          updated_commission AS (
            UPDATE commissions AS commission
            SET
              status =
                'awaiting_payment',
              updated_at =
                ${acceptedAt}
            FROM updated_agreement
            WHERE
              commission.id =
                updated_agreement.commission_id
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
              updated_agreement.commission_id,
              'awaiting_agreement'::commission_status,
              'awaiting_payment'::commission_status,
              'client'::commission_actor,
              'agreement_accepted',
              null,
              null,
              ${acceptedAt}
            FROM updated_agreement
            INNER JOIN updated_commission
              ON updated_commission.id =
                updated_agreement.commission_id
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
              updated_agreement.commission_id,
              'agreement_accepted'::commission_event_type,
              'client'::commission_actor,
              'Agreement v'
                || updated_agreement.version
                || ' accepted',
              null,
              ${eventMetadata}::jsonb,
              null,
              ${acceptedAt}
            FROM updated_agreement
            INNER JOIN created_transition
              ON true
            RETURNING
              id
          )

          SELECT
            updated_agreement.id
              AS "agreementId",
            updated_agreement.commission_id
              AS "commissionId",
            updated_agreement.executed_document_id
              AS "executedDocumentId",
            created_transition.id
              AS "transitionId",
            created_event.id
              AS "eventId"
          FROM updated_agreement
          CROSS JOIN created_transition
          CROSS JOIN created_event
        `,
      );

    const row =
      writeResult.rows[0];

    if (!row) {
      return classifyPublicAgreementAcceptanceFailure({
        token:
          rawInput.token,

        expectedUpdatedAt,

        presentedDocumentId,

        presentedStorageKey,

        presentedContentSha256,
      });
    }

    return {
      outcome:
        "accepted",

      agreementId:
        row.agreementId,

      commissionId:
        row.commissionId,

      executedDocumentId:
        row.executedDocumentId,

      acceptedAt,
    };
  } catch (error) {
    /*
     * Neon may commit a transaction successfully while the
     * HTTP response carrying that result is lost.
     *
     * Reconcile using identifiers generated before the write.
     * If this exact operation exists, it is safe to report
     * success and the caller must preserve the R2 object.
     */
    try {
      const [
        agreementRows,
        commissionRows,
        documentRows,
        transitionRows,
        eventRows,
      ] =
        await Promise.all([
          db
            .select({
              id:
                commissionAgreements.id,

              status:
                commissionAgreements.status,

              executedDocumentId:
                commissionAgreements.executedDocumentId,

              acceptedByName:
                commissionAgreements.acceptedByName,

              acceptedByEmail:
                commissionAgreements.acceptedByEmail,

              acceptanceMethod:
                commissionAgreements.acceptanceMethod,

              acceptanceStatementVersion:
                commissionAgreements.acceptanceStatementVersion,

              acceptedAt:
                commissionAgreements.acceptedAt,
            })
            .from(
              commissionAgreements,
            )
            .where(
              eq(
                commissionAgreements.id,
                target.agreementId,
              ),
            )
            .limit(1),

          db
            .select({
              id:
                commissions.id,

              status:
                commissions.status,

              reference:
                commissions.reference,

              clientEmail:
                commissions.clientEmail,
            })
            .from(
              commissions,
            )
            .where(
              eq(
                commissions.id,
                target.commissionId,
              ),
            )
            .limit(1),

          db
            .select({
              id:
                commissionDocuments.id,

              commissionId:
                commissionDocuments.commissionId,

              type:
                commissionDocuments.type,

              status:
                commissionDocuments.status,

              version:
                commissionDocuments.version,

              storageKey:
                commissionDocuments.storageKey,

              contentSha256:
                commissionDocuments.contentSha256,

              recipientEmail:
                commissionDocuments.recipientEmail,

              generatedAt:
                commissionDocuments.generatedAt,
            })
            .from(
              commissionDocuments,
            )
            .where(
              eq(
                commissionDocuments.id,
                executedDocumentId,
              ),
            )
            .limit(1),

          db
            .select({
              id:
                commissionStatusHistory.id,

              commissionId:
                commissionStatusHistory.commissionId,

              fromStatus:
                commissionStatusHistory.fromStatus,

              toStatus:
                commissionStatusHistory.toStatus,
            })
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
            .select({
              id:
                commissionEvents.id,

              commissionId:
                commissionEvents.commissionId,

              type:
                commissionEvents.type,
            })
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
        ]);

      const agreement =
        agreementRows[0];

      const commission =
        commissionRows[0];

      const document =
        documentRows[0];

      const transition =
        transitionRows[0];

      const event =
        eventRows[0];

      if (
        agreement?.status ===
          "accepted" &&
        agreement.executedDocumentId ===
          executedDocumentId &&
        agreement.acceptedByName ===
          acceptedByName &&
        agreement.acceptedByEmail ===
          expectedClientEmail &&
        agreement.acceptanceMethod ===
          "electronic" &&
        agreement.acceptanceStatementVersion ===
          COMMISSION_AGREEMENT_ACCEPTANCE_STATEMENT_VERSION &&
        agreement.acceptedAt?.getTime() ===
          acceptedAt.getTime() &&
        commission?.status ===
          "awaiting_payment" &&
        commission.reference ===
          expectedReference &&
        commission.clientEmail ===
          expectedClientEmail &&
        document?.id ===
          executedDocumentId &&
        document.commissionId ===
          target.commissionId &&
        document.type ===
          "commission_agreement_executed" &&
        document.status ===
          "generated" &&
        document.version ===
          expectedAgreementRevision &&
        document.storageKey ===
          executedStorageKey &&
        document.contentSha256 ===
          executedContentSha256 &&
        document.recipientEmail ===
          expectedClientEmail &&
        document.generatedAt?.getTime() ===
          acceptedAt.getTime() &&
        transition?.commissionId ===
          target.commissionId &&
        transition.fromStatus ===
          "awaiting_agreement" &&
        transition.toStatus ===
          "awaiting_payment" &&
        event?.commissionId ===
          target.commissionId &&
        event.type ===
          "agreement_accepted"
      ) {
        return {
          outcome:
            "accepted",

          agreementId:
            target.agreementId,

          commissionId:
            target.commissionId,

          executedDocumentId,

          acceptedAt,
        };
      }

      return await classifyPublicAgreementAcceptanceFailure({
        token:
          rawInput.token,

        expectedUpdatedAt,

        presentedDocumentId,

        presentedStorageKey,

        presentedContentSha256,
      });
    } catch {
      /*
       * Preserve the original database error when reconciliation
       * itself cannot reach Neon.
       *
       * The service must leave the uploaded executed R2 object
       * intact because commit state is now uncertain.
       */
    }

    throw error;
  }
}
