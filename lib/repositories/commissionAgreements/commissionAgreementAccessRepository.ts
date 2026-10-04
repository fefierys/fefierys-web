import {
  and,
  eq,
  inArray,
  isNull,
} from "drizzle-orm";

import {
  hashPublicAgreementToken,
  isValidPublicAgreementToken,
} from "../../commissions/commissionAgreementAccessToken";

import type {
  PublicCommissionAgreement,
  PublicCommissionAgreementStatus,
} from "../../commissions/publicCommissionAgreement";

import {
  db,
} from "../../db";

import {
  commissionAgreements,
  commissionDocuments,
  commissions,
} from "../../db/schema/commissions";

export interface PublicAgreementAccessTarget {
  /*
   * Technical identifiers and storage information in this
   * interface are server-only.
   *
   * They must never be sent directly to the browser.
   */
  agreementId: string;
  commissionId: string;
  documentId: string;

  /*
   * These values are also server-only in this resolver.
   *
   * They are needed by the electronic acceptance service so
   * the executed PDF can be generated from exactly the same
   * contractual snapshot later required by the atomic write.
   */
  reference: string;
  clientName: string;
  clientEmail: string;
  agreementRevision: number;

  status:
    PublicCommissionAgreementStatus;

  updatedAt: Date;

  storageKey: string;
  contentSha256: string;

  sentAt: Date;
  acceptedAt: Date | null;
}

export interface PublicExecutedAgreementAccessTarget {
  /*
   * Server-only descriptor for the final executed Agreement.
   *
   * None of these technical fields are projected into the
   * public Agreement page.
   */
  agreementId: string;
  commissionId: string;
  documentId: string;

  storageKey: string;
  contentSha256: string;

  agreementRevision: number;

  acceptedAt: Date;
}

/*
 * Resolves a public bearer token into the immutable Agreement
 * document that was actually presented to the Client.
 *
 * This internal resolver is intended for:
 * - the public Presented PDF endpoint;
 * - the electronic acceptance operation.
 *
 * It deliberately returns technical identifiers because its
 * result remains on the server.
 */
export async function resolveCommissionAgreementPublicToken(
  token: string,
): Promise<PublicAgreementAccessTarget | null> {
  if (
    !isValidPublicAgreementToken(
      token,
    )
  ) {
    return null;
  }

  const tokenHash =
    hashPublicAgreementToken(
      token,
    );

  const rows =
    await db
      .select({
        agreementId:
          commissionAgreements.id,

        commissionId:
          commissionAgreements.commissionId,

        documentId:
          commissionDocuments.id,

        reference:
          commissions.reference,

        clientName:
          commissions.clientName,

        clientEmail:
          commissions.clientEmail,

        agreementRevision:
          commissionAgreements.version,

        status:
          commissionAgreements.status,

        updatedAt:
          commissionAgreements.updatedAt,

        storageKey:
          commissionDocuments.storageKey,

        contentSha256:
          commissionDocuments.contentSha256,

        sentAt:
          commissionAgreements.sentAt,

        acceptedAt:
          commissionAgreements.acceptedAt,
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
        commissionDocuments,
        eq(
          commissionDocuments.id,
          commissionAgreements.documentId,
        ),
      )
      .where(
        and(
          eq(
            commissionAgreements.publicTokenHash,
            tokenHash,
          ),

          isNull(
            commissionAgreements.publicTokenRevokedAt,
          ),

          inArray(
            commissionAgreements.status,
            [
              "sent",
              "accepted",
            ],
          ),

          eq(
            commissionDocuments.type,
            "commission_agreement",
          ),

          eq(
            commissionDocuments.status,
            "sent",
          ),
        ),
      )
      .limit(1);

  const row =
    rows[0];

  /*
   * A publicly accessible Agreement must always resolve to the
   * immutable document that was generated at presentation time.
   *
   * Missing storage metadata means the persisted state is
   * inconsistent and must not be exposed publicly.
   */
  if (
    !row ||
    !row.documentId ||
    !row.storageKey ||
    !row.contentSha256 ||
    !row.sentAt
  ) {
    return null;
  }

  return {
    agreementId:
      row.agreementId,

    commissionId:
      row.commissionId,

    documentId:
      row.documentId,

    reference:
      row.reference,

    clientName:
      row.clientName,

    clientEmail:
      row.clientEmail,

    agreementRevision:
      row.agreementRevision,

    status:
      row.status as
        PublicCommissionAgreementStatus,

    updatedAt:
      row.updatedAt,

    storageKey:
      row.storageKey,

    contentSha256:
      row.contentSha256,

    sentAt:
      row.sentAt,

    acceptedAt:
      row.acceptedAt,
  };
}

/*
 * Resolves the final executed Agreement after electronic
 * acceptance.
 *
 * The same public bearer token is reused. The token therefore
 * continues to identify the Agreement relationship, while this
 * resolver deliberately returns a different immutable document:
 *
 *   commission_agreement_executed
 *
 * The executed document is never available while the Agreement
 * is only "sent".
 */
export async function resolveCommissionAgreementExecutedPublicToken(
  token: string,
): Promise<PublicExecutedAgreementAccessTarget | null> {
  if (
    !isValidPublicAgreementToken(
      token,
    )
  ) {
    return null;
  }

  const tokenHash =
    hashPublicAgreementToken(
      token,
    );

  /*
   * Resolve the accepted Agreement first.
   *
   * Do not join the executed document yet: keeping this query
   * focused on the Agreement makes the required relationship
   * explicit and avoids accidentally treating the presented
   * document as the executed one.
   */
  const agreementRows =
    await db
      .select({
        agreementId:
          commissionAgreements.id,

        commissionId:
          commissionAgreements.commissionId,

        executedDocumentId:
          commissionAgreements.executedDocumentId,

        agreementRevision:
          commissionAgreements.version,

        acceptedAt:
          commissionAgreements.acceptedAt,
      })
      .from(
        commissionAgreements,
      )
      .where(
        and(
          eq(
            commissionAgreements.publicTokenHash,
            tokenHash,
          ),

          isNull(
            commissionAgreements.publicTokenRevokedAt,
          ),

          eq(
            commissionAgreements.status,
            "accepted",
          ),
        ),
      )
      .limit(1);

  const agreement =
    agreementRows[0];

  if (
    !agreement ||
    !agreement.executedDocumentId ||
    !agreement.acceptedAt
  ) {
    return null;
  }

  /*
   * Resolve only the exact executed document referenced by the
   * accepted Agreement.
   *
   * Its commission, type, status and revision are all checked.
   * This prevents another document from being served even if an
   * incorrect ID were ever persisted.
   */
  const documentRows =
    await db
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
      })
      .from(
        commissionDocuments,
      )
      .where(
        and(
          eq(
            commissionDocuments.id,
            agreement.executedDocumentId,
          ),

          eq(
            commissionDocuments.commissionId,
            agreement.commissionId,
          ),

          eq(
            commissionDocuments.type,
            "commission_agreement_executed",
          ),

          eq(
            commissionDocuments.status,
            "generated",
          ),
        ),
      )
      .limit(1);

  const document =
    documentRows[0];

  if (
    !document ||
    document.version !==
      agreement.agreementRevision ||
    !document.storageKey ||
    !document.contentSha256
  ) {
    return null;
  }

  return {
    agreementId:
      agreement.agreementId,

    commissionId:
      agreement.commissionId,

    documentId:
      document.id,

    storageKey:
      document.storageKey,

    contentSha256:
      document.contentSha256,

    agreementRevision:
      agreement.agreementRevision,

    acceptedAt:
      agreement.acceptedAt,
  };
}

/*
 * Client-safe projection used by /agreement/[token].
 *
 * No database IDs, token hashes, R2 keys, SHA-256 digests,
 * administrative metadata, internal notes or email metadata
 * cross the public boundary.
 */
export async function getPublicCommissionAgreementByToken(
  token: string,
): Promise<PublicCommissionAgreement | null> {
  if (
    !isValidPublicAgreementToken(
      token,
    )
  ) {
    return null;
  }

  const tokenHash =
    hashPublicAgreementToken(
      token,
    );

  const rows =
    await db
      .select({
        reference:
          commissions.reference,

        clientName:
          commissions.clientName,

        revision:
          commissionAgreements.version,

        agreementVersion:
          commissionAgreements.agreementVersion,

        termsVersion:
          commissionAgreements.termsVersion,

        status:
          commissionAgreements.status,

        sentAt:
          commissionAgreements.sentAt,

        acceptedAt:
          commissionAgreements.acceptedAt,

        documentId:
          commissionAgreements.documentId,

        documentType:
          commissionDocuments.type,

        documentStatus:
          commissionDocuments.status,

        storageKey:
          commissionDocuments.storageKey,

        contentSha256:
          commissionDocuments.contentSha256,
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
        commissionDocuments,
        eq(
          commissionDocuments.id,
          commissionAgreements.documentId,
        ),
      )
      .where(
        and(
          eq(
            commissionAgreements.publicTokenHash,
            tokenHash,
          ),

          isNull(
            commissionAgreements.publicTokenRevokedAt,
          ),

          inArray(
            commissionAgreements.status,
            [
              "sent",
              "accepted",
            ],
          ),

          eq(
            commissionDocuments.type,
            "commission_agreement",
          ),

          eq(
            commissionDocuments.status,
            "sent",
          ),
        ),
      )
      .limit(1);

  const agreement =
    rows[0];

  if (
    !agreement ||
    !agreement.sentAt ||
    !agreement.documentId ||
    !agreement.storageKey ||
    !agreement.contentSha256 ||
    agreement.documentType !==
      "commission_agreement" ||
    agreement.documentStatus !==
      "sent"
  ) {
    return null;
  }

  return {
    reference:
      agreement.reference,

    clientName:
      agreement.clientName,

    revision:
      agreement.revision,

    agreementVersion:
      agreement.agreementVersion,

    termsVersion:
      agreement.termsVersion,

    status:
      agreement.status as
        PublicCommissionAgreementStatus,

    sentAt:
      agreement.sentAt,

    acceptedAt:
      agreement.acceptedAt,
  };
}
