import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  r2BucketName,
  r2Client,
} from "./r2Client";

const PDF_CONTENT_TYPE =
  "application/pdf";

function assertStorageIdentifier(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `${field} is required to build a commission document storage key.`,
    );
  }

  /*
   * Storage keys are assembled only from internal UUIDs / controlled
   * identifiers. Reject path separators so callers cannot escape
   * the expected document namespace.
   */
  if (
    normalized.includes("/") ||
    normalized.includes("\\")
  ) {
    throw new Error(
      `${field} contains an invalid storage path separator.`,
    );
  }

  return normalized;
}

export interface BuildCommissionAgreementStorageKeyInput {
  commissionId: string;
  agreementId: string;
  documentId: string;
  kind: "presented" | "executed";
}

export function buildCommissionAgreementStorageKey(
  input: BuildCommissionAgreementStorageKeyInput,
): string {
  const commissionId =
    assertStorageIdentifier(
      input.commissionId,
      "commissionId",
    );

  const agreementId =
    assertStorageIdentifier(
      input.agreementId,
      "agreementId",
    );

  const documentId =
    assertStorageIdentifier(
      input.documentId,
      "documentId",
    );

  return [
    "commissions",
    commissionId,
    "agreements",
    agreementId,
    input.kind,
    `${documentId}.pdf`,
  ].join("/");
}

export interface UploadCommissionDocumentInput {
  key: string;
  pdf: Uint8Array;
}

export async function uploadCommissionDocument(
  input: UploadCommissionDocumentInput,
): Promise<void> {
  if (!input.key.trim()) {
    throw new Error(
      "Commission document storage key is required.",
    );
  }

  if (input.pdf.byteLength === 0) {
    throw new Error(
      "Commission document PDF cannot be empty.",
    );
  }

  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2BucketName,
      Key: input.key,
      Body: input.pdf,
      ContentType: PDF_CONTENT_TYPE,

      /*
       * Documents stored here are private contractual records.
       * Do not add public ACLs or public cache metadata.
       */
      CacheControl:
        "private, no-store",
    }),
  );
}

export async function getCommissionDocument(
  key: string,
): Promise<Uint8Array | null> {
  const normalizedKey = key.trim();

  if (!normalizedKey) {
    throw new Error(
      "Commission document storage key is required.",
    );
  }

  try {
    const result =
      await r2Client.send(
        new GetObjectCommand({
          Bucket: r2BucketName,
          Key: normalizedKey,
        }),
      );

    if (!result.Body) {
      throw new Error(
        "Commission document object has no body.",
      );
    }

    return await result.Body.transformToByteArray();
  } catch (error) {
    const status =
      (
        error as {
          $metadata?: {
            httpStatusCode?: number;
          };
        }
      ).$metadata?.httpStatusCode;

    if (
      status === 404 ||
      status === 403
    ) {
      /*
       * R2/S3 may intentionally obscure a missing private object
       * as 403 depending on bucket permissions.
       */
      return null;
    }

    throw error;
  }
}

/*
 * Used only for compensating cleanup when document persistence fails
 * after the R2 upload. Published contractual documents must never be
 * deleted through ordinary application flows.
 */
export async function deleteCommissionDocumentObject(
  key: string,
): Promise<void> {
  const normalizedKey = key.trim();

  if (!normalizedKey) {
    throw new Error(
      "Commission document storage key is required.",
    );
  }

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: r2BucketName,
      Key: normalizedKey,
    }),
  );
}