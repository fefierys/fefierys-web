import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import {
  resolveCommissionAgreementPublicToken,
} from "@/lib/repositories/commissionAgreements/commissionAgreementAccessRepository";

import {
  getCommissionDocument,
} from "@/lib/storage/commissionDocumentStorage";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

interface PublicAgreementPdfRouteContext {
  params: Promise<{
    token: string;
  }>;
}

function documentUnavailableResponse(
  status:
    | 404
    | 503,
): Response {
  return new Response(
    "Document unavailable.",
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",

        "Content-Type":
          "text/plain; charset=utf-8",

        "Referrer-Policy":
          "no-referrer",

        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

function verifyDocumentIntegrity(
  documentBytes: Uint8Array,
  expectedSha256: string,
): boolean {
  const normalizedExpectedHash =
    expectedSha256
      .trim()
      .toLowerCase();

  /*
   * commission_documents.content_sha256 should always contain
   * one canonical hexadecimal SHA-256 digest.
   *
   * Treat malformed persisted metadata as an unavailable
   * document rather than exposing the object without an
   * integrity check.
   */
  if (
    !/^[a-f0-9]{64}$/.test(
      normalizedExpectedHash,
    )
  ) {
    return false;
  }

  const actualHash =
    createHash(
      "sha256",
    )
      .update(
        documentBytes,
      )
      .digest();

  const expectedHash =
    Buffer.from(
      normalizedExpectedHash,
      "hex",
    );

  return timingSafeEqual(
    actualHash,
    expectedHash,
  );
}

export async function GET(
  _request: Request,
  context: PublicAgreementPdfRouteContext,
): Promise<Response> {
  const {
    token,
  } =
    await context.params;

  try {
    /*
     * The bearer token is never logged.
     *
     * Resolution also requires:
     * - an active token;
     * - Agreement status sent/accepted;
     * - the immutable presented document;
     * - a valid R2 storage reference.
     */
    const target =
      await resolveCommissionAgreementPublicToken(
        token,
      );

    if (!target) {
      return documentUnavailableResponse(
        404,
      );
    }

    const documentBytes =
      await getCommissionDocument(
        target.storageKey,
      );

    if (!documentBytes) {
      /*
       * Do not reveal whether the token was valid and the
       * underlying private object was missing.
       */
      return documentUnavailableResponse(
        404,
      );
    }

    /*
     * Never serve a contractual document whose bytes no longer
     * match the SHA-256 digest persisted at presentation time.
     */
    if (
      !verifyDocumentIntegrity(
        documentBytes,
        target.contentSha256,
      )
    ) {
      console.error(
        "Public Commission Agreement PDF integrity verification failed.",
      );

      return documentUnavailableResponse(
        503,
      );
    }

    /*
     * Copy into a fresh ArrayBuffer suitable for the Web
     * Response API.
     */
    const body =
      Uint8Array.from(
        documentBytes,
      ).buffer;

    return new Response(
      body,
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",

          "Content-Disposition":
            'inline; filename="commission-agreement.pdf"',

          "Content-Length":
            String(
              documentBytes.byteLength,
            ),

          "Content-Type":
            "application/pdf",

          "Referrer-Policy":
            "no-referrer",

          "X-Content-Type-Options":
            "nosniff",
        },
      },
    );
  } catch (error) {
    /*
     * Never include the bearer token, storage key or persisted
     * digest in logs.
     */
    console.error(
      "Failed to serve public Commission Agreement PDF:",
      error,
    );

    return documentUnavailableResponse(
      503,
    );
  }
}