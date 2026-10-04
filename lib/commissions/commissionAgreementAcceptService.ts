import {
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  renderExecutedCommissionAgreementPdf,
} from "./commissionAgreementExecutedPdfRenderer";

import {
  resolveCommissionAgreementPublicToken,
} from "../repositories/commissionAgreements/commissionAgreementAccessRepository";

import {
  acceptCommissionAgreementPublicly,
  type AcceptCommissionAgreementPubliclyResult,
} from "../repositories/commissionAgreements/commissionAgreementAcceptRepository";

import {
  buildCommissionAgreementStorageKey,
  deleteCommissionDocumentObject,
  getCommissionDocument,
  uploadCommissionDocument,
} from "../storage/commissionDocumentStorage";

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const MAX_ACCEPTED_BY_NAME_LENGTH =
  200;

export interface AcceptCommissionAgreementServiceInput {
  /*
   * Public bearer credential.
   *
   * Never log this value.
   */
  token: string;

  /*
   * Name explicitly entered by the Client as their
   * electronic signature.
   */
  acceptedByName: string;

  /*
   * Must come from an explicit checkbox / confirmation in
   * the public acceptance form.
   *
   * The server does not rely only on the browser UI.
   */
  acceptanceConfirmed: boolean;
}

export type AcceptCommissionAgreementServiceResult =
  | AcceptCommissionAgreementPubliclyResult
  | {
      outcome: "validation_error";

      field:
        | "acceptedByName"
        | "acceptanceConfirmed";

      message: string;
    };

function normalizeAcceptedByName(
  value: string,
):
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
      result: AcceptCommissionAgreementServiceResult;
    } {
  const normalized =
    value.trim();

  if (!normalized) {
    return {
      ok:
        false,

      result: {
        outcome:
          "validation_error",

        field:
          "acceptedByName",

        message:
          "Enter your full name to accept the Agreement.",
      },
    };
  }

  if (
    normalized.length >
    MAX_ACCEPTED_BY_NAME_LENGTH
  ) {
    return {
      ok:
        false,

      result: {
        outcome:
          "validation_error",

        field:
          "acceptedByName",

        message:
          `Your name cannot exceed ${MAX_ACCEPTED_BY_NAME_LENGTH} characters.`,
      },
    };
  }

  return {
    ok:
      true,

    value:
      normalized,
  };
}

function calculateSha256(
  bytes: Uint8Array,
): string {
  return createHash(
    "sha256",
  )
    .update(
      bytes,
    )
    .digest(
      "hex",
    );
}

function hasMatchingSha256(
  bytes: Uint8Array,
  expectedSha256: string,
): boolean {
  const normalizedExpected =
    expectedSha256
      .trim()
      .toLowerCase();

  if (
    !SHA256_PATTERN.test(
      normalizedExpected,
    )
  ) {
    return false;
  }

  const actualSha256 =
    calculateSha256(
      bytes,
    );

  const expectedBuffer =
    Buffer.from(
      normalizedExpected,
      "hex",
    );

  const actualBuffer =
    Buffer.from(
      actualSha256,
      "hex",
    );

  if (
    expectedBuffer.length !==
    actualBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    actualBuffer,
  );
}

async function cleanupUncommittedExecutedDocument(
  storageKey: string,
): Promise<void> {
  try {
    await deleteCommissionDocumentObject(
      storageKey,
    );
  } catch (error) {
    /*
     * Cleanup failure does not make the database operation
     * committed.
     *
     * Do not log the R2 key, token, hash or client data.
     */
    const errorName =
      error instanceof Error
        ? error.name
        : "UnknownError";

    console.error(
      `Failed to clean up an uncommitted executed Agreement document (${errorName}).`,
    );
  }
}

/*
 * Public electronic-acceptance orchestration.
 *
 * Sequence:
 *
 * 1. Validate explicit Client confirmation.
 * 2. Resolve the active Agreement bearer.
 * 3. Read the immutable presented PDF from private R2.
 * 4. Verify its SHA-256 against PostgreSQL.
 * 5. Create the executed PDF from those exact presented bytes.
 * 6. Upload the executed PDF to a unique R2 key.
 * 7. Persist acceptance atomically in PostgreSQL.
 *
 * R2 and PostgreSQL cannot participate in the same transaction.
 *
 * Therefore:
 *
 * - known database business failure:
 *     delete the newly-uploaded executed object;
 *
 * - database exception / uncertain commit:
 *     DO NOT delete the object, because the database transaction
 *     may have committed even if its response was lost.
 */
export async function acceptCommissionAgreementService(
  input: AcceptCommissionAgreementServiceInput,
): Promise<AcceptCommissionAgreementServiceResult> {
  if (
    input.acceptanceConfirmed !==
    true
  ) {
    return {
      outcome:
        "validation_error",

      field:
        "acceptanceConfirmed",

      message:
        "You must confirm that you have read and agree to the Agreement and Terms of Service.",
    };
  }

  const normalizedNameResult =
    normalizeAcceptedByName(
      input.acceptedByName,
    );

  if (
    !normalizedNameResult.ok
  ) {
    return (
      normalizedNameResult.result
    );
  }

  const acceptedByName =
    normalizedNameResult.value;

  /*
   * Resolve the exact Agreement and presented-document snapshot
   * before generating any new contractual artifact.
   */
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

  /*
   * Read the exact immutable PDF that the Client was given.
   *
   * getCommissionDocument intentionally returns null for both
   * inaccessible and missing objects. Either case means we must
   * not proceed with acceptance.
   */
  const presentedPdf =
    await getCommissionDocument(
      target.storageKey,
    );

  if (!presentedPdf) {
    console.error(
      "Presented Commission Agreement document is unavailable in storage.",
    );

    return {
      outcome:
        "unavailable",
    };
  }

  /*
   * Never generate an executed Agreement unless the presented
   * bytes still match the digest persisted at presentation time.
   */
  if (
    !hasMatchingSha256(
      presentedPdf,
      target.contentSha256,
    )
  ) {
    console.error(
      "Presented Commission Agreement failed integrity verification.",
    );

    throw new Error(
      "Presented Commission Agreement integrity verification failed.",
    );
  }

  /*
   * Capture this once.
   *
   * The exact same timestamp will appear in:
   * - the Client signature in the executed PDF;
   * - commission_agreements.accepted_at;
   * - commission_documents.generated_at;
   * - status history;
   * - agreement_accepted event.
   */
  const acceptedAt =
    new Date();

  const executedPdf =
    await renderExecutedCommissionAgreementPdf({
      presentedPdf,

      presentedContentSha256:
        target.contentSha256,

      reference:
        target.reference,

      agreementRevision:
        target.agreementRevision,

      acceptedByName,

      clientContactName:
        target.clientName,

      acceptedByEmail:
        target.clientEmail,

      acceptedAt,
    });

  const executedContentSha256 =
    calculateSha256(
      executedPdf,
    );

  const executedDocumentId =
    randomUUID();

  const executedStorageKey =
    buildCommissionAgreementStorageKey({
      commissionId:
        target.commissionId,

      agreementId:
        target.agreementId,

      documentId:
        executedDocumentId,

      kind:
        "executed",
    });

  /*
   * Upload first because PostgreSQL must never reference a
   * document that was not successfully written to R2.
   */
  try {
    await uploadCommissionDocument({
      key:
        executedStorageKey,

      pdf:
        executedPdf,
    });
  } catch (error) {
    /*
     * A network failure could happen after R2 accepted the PUT.
     *
     * No database operation has started yet, so deleting this
     * unique key is always safe.
     */
    await cleanupUncommittedExecutedDocument(
      executedStorageKey,
    );

    throw error;
  }

  let result:
    AcceptCommissionAgreementPubliclyResult;

  try {
    result =
      await acceptCommissionAgreementPublicly({
        token:
          input.token,

        expectedUpdatedAt:
          target.updatedAt,

        presentedDocumentId:
          target.documentId,

        presentedStorageKey:
          target.storageKey,

        presentedContentSha256:
          target.contentSha256,

        expectedReference:
          target.reference,

        expectedClientEmail:
          target.clientEmail,

        expectedAgreementRevision:
          target.agreementRevision,

        executedDocumentId,

        executedStorageKey,

        executedContentSha256,

        acceptedByName,

        acceptedAt,
      });
  } catch (error) {
    /*
     * IMPORTANT:
     *
     * Do not delete the executed R2 object here.
     *
     * The repository performs commit reconciliation internally.
     * If it still throws, commit state is uncertain and deleting
     * the object could leave a committed database record pointing
     * to a missing contractual document.
     */
    throw error;
  }

  if (
    result.outcome !==
    "accepted"
  ) {
    /*
     * A returned business outcome means the repository knows
     * this exact acceptance operation was not committed.
     *
     * The unique uploaded object therefore has no legitimate
     * database owner and can be removed safely.
     */
    await cleanupUncommittedExecutedDocument(
      executedStorageKey,
    );

    return result;
  }

  /*
   * Database acceptance committed or was successfully reconciled.
   *
   * The executed R2 object is now immutable business evidence
   * and must remain untouched.
   */
  return result;
}
