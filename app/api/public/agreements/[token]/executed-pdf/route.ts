import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import {
  resolveCommissionAgreementExecutedPublicToken,
} from "@/lib/repositories/commissionAgreements/commissionAgreementAccessRepository";

import {
  getCommissionDocument,
} from "@/lib/storage/commissionDocumentStorage";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

interface PublicExecutedAgreementPdfRouteContext {
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
   * Never serve an executed contractual document unless the
   * persisted digest is a canonical SHA-256 value.
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
  context: PublicExecutedAgreementPdfRouteContext,
): Promise<Response> {
  const {
    token,
  } =
    await context.params;

  try {
    /*
     * The bearer token is never logged.
     *
     * Resolution requires:
     * - an active Agreement bearer token;
     * - Agreement status accepted;
     * - an accepted timestamp;
     * - the exact executedDocumentId;
     * - document type commission_agreement_executed;
     * - document status generated;
     * - matching Agreement/document revision;
     * - valid private storage metadata.
     */
    const target =
      await resolveCommissionAgreementExecutedPublicToken(
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
       * Do not reveal whether the bearer was valid and the
       * underlying private object was missing.
       */
      return documentUnavailableResponse(
        404,
      );
    }

    /*
     * The executed Agreement is an immutable contractual
     * artifact. Refuse to serve it if its bytes no longer match
     * the digest persisted when acceptance was committed.
     */
    if (
      !verifyDocumentIntegrity(
        documentBytes,
        target.contentSha256,
      )
    ) {
      console.error(
        "Public executed Commission Agreement PDF integrity verification failed.",
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
            'inline; filename="commission-agreement-accepted.pdf"',

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
     * Never include the bearer token, R2 key, document ID or
     * persisted digest in logs.
     */
    console.error(
      "Failed to serve public executed Commission Agreement PDF:",
      error,
    );

    return documentUnavailableResponse(
      503,
    );
  }
}