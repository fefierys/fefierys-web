import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  generatePublicAgreementToken,
} from "../commissions/commissionAgreementAccessToken";

import {
  buildCommissionAgreementDocumentData,
} from "../commissions/commissionAgreementDocumentData";

import {
  renderCommissionAgreementPdf,
} from "../commissions/commissionAgreementPdfRenderer";

import {
  getAdminCommissionDetail,
} from "../repositories/commissionAdminRepository";

import {
  getActiveCommissionAgreement,
} from "../repositories/commissionAgreements/commissionAgreementDataRepository";

import {
  presentCommissionAgreement,
} from "../repositories/commissionAgreements/commissionAgreementPresentRepository";

import type {
  PresentCommissionAgreementResult,
} from "../repositories/commissionAgreements/commissionAgreementPresentRepository";

import {
  getCommissionDeliverables,
  getCommissionPaymentPlan,
} from "../repositories/commissionPayments/commissionPaymentPlanRepository";

import {
  getCommissionQuotes,
} from "../repositories/commissionQuoteRepository";

import {
  buildCommissionAgreementStorageKey,
  deleteCommissionDocumentObject,
  uploadCommissionDocument,
} from "../storage/commissionDocumentStorage";

import {
  buildCommissionAgreementEmail,
} from "./commissionAgreementEmail";

import {
  deliverCommissionEmailMessage,
} from "./commissionEmailDeliveryService";

import type {
  CommissionEmailProvider,
} from "./commissionEmailProvider";

import {
  ownerEmail,
  senderEmail,
} from "./emailClient";

export interface PresentCommissionAgreementToClientInput {
  commissionId: string;
  agreementId: string;
  expectedUpdatedAt: Date;
  presentedByAdminUserId: string;
}

type AgreementPresentationFailure =
  Exclude<
    PresentCommissionAgreementResult,
    {
      outcome: "presented";
    }
  >;

export type PresentCommissionAgreementToClientResult =
  | AgreementPresentationFailure
  | {
      outcome: "document_not_ready";
    }
  | {
      outcome: "storage_failed";
    }
  | {
      outcome: "sent";
      commissionId: string;
      agreementId: string;
      documentId: string;
      messageId: string;
      providerEmailId: string;
      providerMessageId: string | null;
    }
  | {
      outcome: "delivery_failed";
      commissionId: string;
      agreementId: string;
      documentId: string;
      messageId: string;
      failureMessage: string;
    }
  | {
      outcome: "delivery_pending";
      commissionId: string;
      agreementId: string;
      documentId: string;
      messageId: string;
      currentStatus:
        | "queued"
        | "sending"
        | "sent"
        | "failed";
    };

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

async function cleanupUploadedDocument(
  storageKey: string,
): Promise<void> {
  try {
    await deleteCommissionDocumentObject(
      storageKey,
    );
  } catch (error) {
    /*
     * Business state was not committed, so this object is
     * orphaned. Failure to clean it up must not replace the
     * original business result.
     */
    console.error(
      "Failed to clean up orphaned Commission Agreement PDF:",
      error,
    );
  }
}

export async function presentCommissionAgreementToClient(
  input: PresentCommissionAgreementToClientInput,
  provider?: CommissionEmailProvider,
): Promise<PresentCommissionAgreementToClientResult> {
  const commissionId =
    normalizeRequiredValue(
      input.commissionId,
      "commissionId",
    );

  const agreementId =
    normalizeRequiredValue(
      input.agreementId,
      "agreementId",
    );

  const presentedByAdminUserId =
    normalizeRequiredValue(
      input.presentedByAdminUserId,
      "presentedByAdminUserId",
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

  /*
   * Build the exact snapshot that will become the immutable
   * presented Agreement.
   */
  const [
    detail,
    agreement,
    quotes,
  ] =
    await Promise.all([
      getAdminCommissionDetail(
        commissionId,
      ),

      getActiveCommissionAgreement(
        commissionId,
      ),

      getCommissionQuotes(
        commissionId,
      ),
    ]);

  if (
    !detail ||
    !agreement ||
    agreement.id !==
      agreementId
  ) {
    return {
      outcome:
        "not_found",
    };
  }

  if (
    agreement.status !==
    "draft"
  ) {
    return {
      outcome:
        "not_draft",

      currentStatus:
        agreement.status,
    };
  }

  if (
    detail.commission.status !==
    "awaiting_agreement"
  ) {
    return {
      outcome:
        "wrong_commission_status",

      currentStatus:
        detail.commission.status,
    };
  }

  if (
    detail.commission.isOnHold
  ) {
    return {
      outcome:
        "on_hold",
    };
  }

  if (
    agreement.updatedAt.getTime() !==
    input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome:
        "conflict",

      currentUpdatedAt:
        agreement.updatedAt,
    };
  }

  const quoteWithItems =
    quotes.find(
      ({ quote }) =>
        quote.id ===
        agreement.quoteId,
    );

  if (
    !quoteWithItems
  ) {
    return {
      outcome:
        "not_found",
    };
  }

  if (
    quoteWithItems.quote.status !==
    "accepted"
  ) {
    return {
      outcome:
        "quote_not_accepted",

      currentStatus:
        quoteWithItems.quote.status,
    };
  }

  const [
    paymentStages,
    deliverables,
  ] =
    await Promise.all([
      getCommissionPaymentPlan(
        commissionId,
        agreement.quoteId,
      ),

      getCommissionDeliverables(
        commissionId,
        agreement.quoteId,
      ),
    ]);

  let documentData;

  try {
    documentData =
      buildCommissionAgreementDocumentData({
        commission:
          detail.commission,

        agreement,

        quote:
          quoteWithItems.quote,

        quoteItems:
          quoteWithItems.items,

        deliverables,

        paymentStages,
      });
  } catch (error) {
    console.error(
      "Commission Agreement presentation snapshot validation failed:",
      error,
    );

    return {
      outcome:
        "document_not_ready",
    };
  }

    /*
   * Single authoritative instant for presentation.
   *
   * This timestamp will be used both for the Artist's
   * electronic signature and for the persisted Agreement
   * presentation records.
   */
  const presentedAt =
    new Date();

  /*
   * Validate all configuration required after the DB write
   * before uploading anything to R2.
   *
   * Both helpers are deterministic, so the same token can be
   * reconstructed later without persisting the plaintext value.
   */
  const publicToken =
    generatePublicAgreementToken(
      agreement.id,
    );

  const emailBody =
    buildCommissionAgreementEmail({
      clientName:
        detail.commission.clientName,

      publicToken,

      reference:
        detail.commission.reference,

      revision:
        agreement.version,

      termsVersion:
        agreement.termsVersion,
    });

  /*
   * Render the client-facing immutable version.
   *
   * It intentionally does NOT contain the internal
   * "DRAFT - NOT FOR CLIENT DELIVERY" label.
   */
  const pdf =
    await renderCommissionAgreementPdf(
        documentData,
        {
        variant:
            "presented",

        artistSignedAt:
            presentedAt,
        },
    );

  const contentSha256 =
    createHash(
      "sha256",
    )
      .update(
        pdf,
      )
      .digest(
        "hex",
      );

  const documentId =
    randomUUID();

  const storageKey =
    buildCommissionAgreementStorageKey({
      commissionId,

      agreementId:
        agreement.id,

      documentId,

      kind:
        "presented",
    });

  /*
   * R2 is written first.
   *
   * The database is therefore never allowed to claim that a
   * presented Agreement exists unless its immutable object was
   * successfully uploaded.
   */
  try {
    await uploadCommissionDocument({
      key:
        storageKey,

      pdf:
        new Uint8Array(
          pdf,
        ),
    });
  } catch (error) {
    console.error(
      "Failed to upload presented Commission Agreement PDF:",
      error,
    );

    return {
      outcome:
        "storage_failed",
    };
  }

  let creation:
    PresentCommissionAgreementResult;

  try {
    creation =
    await presentCommissionAgreement({
        agreementId:
        agreement.id,

        expectedUpdatedAt:
        input.expectedUpdatedAt,

        presentedAt,

        documentId,

        storageKey,

        contentSha256,

        presentedByAdminUserId,

        senderEmail,

        replyToEmail:
          ownerEmail,
      });
  } catch (error) {
    /*
     * Do NOT delete the uploaded object here.
     *
     * An exception may represent an uncertain Neon response:
     * the atomic database statement could already have
     * committed and could therefore reference this exact R2
     * object.
     */
    console.error(
      "Commission Agreement presentation database state is uncertain:",
      error,
    );

    throw error;
  }

  if (
    creation.outcome !==
    "presented"
  ) {
    /*
     * A classified business failure means the repository has
     * confirmed that this presentation was not committed.
     * Our unique R2 object can therefore be removed safely.
     */
    await cleanupUploadedDocument(
      storageKey,
    );

    return creation;
  }

  /*
   * At this point:
   * - the Agreement is sent;
   * - commission_documents references the immutable R2 PDF;
   * - the public-token digest exists;
   * - agreement_sent exists;
   * - one agreement_ready logical email is queued.
   *
   * Provider delivery may now succeed, fail, or remain pending
   * without rolling back the contractual presentation.
   */
  const delivery =
    provider
      ? await deliverCommissionEmailMessage(
          {
            messageId:
              creation.messageId,

            body:
              emailBody,
          },
          provider,
        )
      : await deliverCommissionEmailMessage({
          messageId:
            creation.messageId,

          body:
            emailBody,
        });

  switch (
    delivery.outcome
  ) {
    case "sent":
      return {
        outcome:
          "sent",

        commissionId:
          creation.agreement.commissionId,

        agreementId:
          creation.agreement.id,

        documentId:
          creation.document.id,

        messageId:
          delivery.messageId,

        providerEmailId:
          delivery.providerEmailId,

        providerMessageId:
          delivery.providerMessageId,
      };

    case "failed":
      return {
        outcome:
          "delivery_failed",

        commissionId:
          creation.agreement.commissionId,

        agreementId:
          creation.agreement.id,

        documentId:
          creation.document.id,

        messageId:
          delivery.messageId,

        failureMessage:
          delivery.failureMessage,
      };

    case "not_claimed":
      return {
        outcome:
          "delivery_pending",

        commissionId:
          creation.agreement.commissionId,

        agreementId:
          creation.agreement.id,

        documentId:
          creation.document.id,

        messageId:
          delivery.messageId,

        currentStatus:
          delivery.currentStatus,
      };

    case "not_found":
      throw new Error(
        "Agreement presentation created a logical email message that could not be found for delivery.",
      );
  }
}