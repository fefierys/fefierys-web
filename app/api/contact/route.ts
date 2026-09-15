import { NextResponse } from "next/server";

import {
  sendClientInquiryConfirmationEmail,
  sendOwnerInquiryEmail,
  type ContactEmailData,
} from "@/lib/email/contactEmail";
import { createCommission } from "@/lib/repositories/commissionRepository";

/*
 * ============================================================
 * LIMITS
 * ============================================================
 */

const MAX_BODY_SIZE = 20_000;

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;

const MAX_STYLE_LENGTH = 100;
const MAX_COLLECTION_LENGTH = 100;
const MAX_CATEGORY_LENGTH = 100;
const MAX_OPTION_LENGTH = 150;

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

interface ContactBody {
  submissionId?: unknown;

  name?: unknown;
  email?: unknown;
  message?: unknown;

  style?: unknown;
  collection?: unknown;
  category?: unknown;
  option?: unknown;

  pricingVersionId?: unknown;
  pricingServiceId?: unknown;
  pricingOptionId?: unknown;

  website?: unknown;
}

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(request: Request) {
  try {
    /*
     * CONTENT TYPE
     */

    const contentType = request.headers.get("content-type");

    if (!contentType?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json(
        {
          error: "Unsupported content type",
        },
        {
          status: 415,
        },
      );
    }

    /*
     * BODY SIZE
     */

    const rawBody = await readBodyWithLimit(request, MAX_BODY_SIZE);

    if (rawBody === null) {
      return NextResponse.json(
        {
          error: "Request too large",
        },
        {
          status: 413,
        },
      );
    }

    /*
     * JSON
     */

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * Debe ser un objeto JSON.
     */

    if (!isRecord(parsedBody)) {
      return NextResponse.json(
        {
          error: "Invalid request body",
        },
        {
          status: 400,
        },
      );
    }

    const body = parsedBody as ContactBody;

    /*
     * ============================================================
     * HONEYPOT
     * ============================================================
     */

    if (
      body.website !== undefined &&
      body.website !== null &&
      typeof body.website !== "string"
    ) {
      return NextResponse.json(
        {
          error: "Invalid field types",
        },
        {
          status: 400,
        },
      );
    }

    if (typeof body.website === "string" && body.website.trim() !== "") {
      /*
       * Fingimos éxito para no
       * revelar al bot que lo detectamos.
       */

      return NextResponse.json({
        success: true,
      });
    }

    /*
     * ============================================================
     * REQUIRED FIELD TYPES
     * ============================================================
     */

    if (
      typeof body.submissionId !== "string" ||
      typeof body.name !== "string" ||
      typeof body.email !== "string" ||
      typeof body.message !== "string"
    ) {
      return NextResponse.json(
        {
          error: "Invalid field types",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * NORMALIZATION
     * ============================================================
     */

    const name = body.name.trim();

    const submissionId = body.submissionId.trim().toLowerCase();

    const email = body.email.trim().toLowerCase();

    const message = body.message.trim();

    /*
     * ============================================================
     * SUBMISSION ID
     * ============================================================
     *
     * crypto.randomUUID() generates RFC 4122 version 4 UUIDs.
     */

    const submissionIdRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

    if (!submissionIdRegex.test(submissionId)) {
      return NextResponse.json(
        {
          error: "Invalid submission ID",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * REQUIRED
     * ============================================================
     */

    if (!name || !email || !message) {
      return NextResponse.json(
        {
          error: "Missing required fields",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * LENGTHS
     * ============================================================
     */

    if (
      name.length > MAX_NAME_LENGTH ||
      email.length > MAX_EMAIL_LENGTH ||
      message.length > MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json(
        {
          error: "One or more fields are too long",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * NAME
     * ============================================================
     *
     * También se valida en backend.
     *
     * Permitimos letras latinas,
     * espacios, apóstrofe, guion y punto.
     *
     * No permite:
     *
     * https://...
     * www....
     * emails
     * HTML
     */

    const nameRegex = /^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/;

    if (!nameRegex.test(name)) {
      return NextResponse.json(
        {
          error: "Invalid name",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * EMAIL
     * ============================================================
     */

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "Invalid email",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * OPTIONAL / CLIENT-FACING FIELDS
     * ============================================================
     *
     * Estos valores aparecen en el email
     * automático enviado al cliente.
     *
     * Por eso NO permitimos:
     *
     * - URLs
     * - dominios
     * - emails
     * - saltos de línea
     *
     * No dependemos del cliente de correo
     * para neutralizarlos.
     */

    const style = normalizeClientField(body.style, MAX_STYLE_LENGTH);

    const collection = normalizeClientField(
      body.collection,
      MAX_COLLECTION_LENGTH,
    );

    const category = normalizeClientField(body.category, MAX_CATEGORY_LENGTH);

    const option = normalizeClientField(body.option, MAX_OPTION_LENGTH);

    if (
      style === null ||
      collection === null ||
      category === null ||
      option === null
    ) {
      return NextResponse.json(
        {
          error: "Invalid commission selection",
        },
        {
          status: 400,
        },
      );
    }

    /*
     * ============================================================
     * CANONICAL PRICING SELECTION
     * ============================================================
     *
     * /commissions sends the real pricing version/service/option
     * identifiers together with the human-readable snapshots.
     *
     * The client is never trusted as the source of truth. These
     * identifiers are validated again by createCommission() against
     * the current public pricing catalog before they can classify
     * the inquiry.
     *
     * An API caller may omit the entire canonical set for a
     * generic Contact inquiry, but partial sets are rejected.
     */

    const canonicalPricingValues = [
      body.pricingVersionId,
      body.pricingServiceId,
      body.pricingOptionId,
    ];

    const hasAnyCanonicalPricingValue =
      canonicalPricingValues.some(
        (value) =>
          value !== undefined &&
          value !== null &&
          value !== "",
      );

    let pricingVersionId: string | null = null;
    let pricingServiceId: string | null = null;
    let pricingOptionId: string | null = null;

    if (hasAnyCanonicalPricingValue) {
      if (
        typeof body.pricingVersionId !== "string" ||
        typeof body.pricingServiceId !== "string" ||
        typeof body.pricingOptionId !== "string"
      ) {
        return NextResponse.json(
          {
            error: "Invalid pricing selection",
          },
          {
            status: 400,
          },
        );
      }

      pricingVersionId =
        body.pricingVersionId.trim().toLowerCase();

      pricingServiceId =
        body.pricingServiceId.trim().toLowerCase();

      pricingOptionId =
        body.pricingOptionId.trim().toLowerCase();

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

      if (
        !uuidRegex.test(pricingVersionId) ||
        !uuidRegex.test(pricingServiceId) ||
        !uuidRegex.test(pricingOptionId) ||
        style === "Not specified" ||
        collection === "Not specified" ||
        category === "Not specified" ||
        option === "Not specified"
      ) {
        return NextResponse.json(
          {
            error: "Invalid pricing selection",
          },
          {
            status: 400,
          },
        );
      }
    }

    const requestSource =
      pricingVersionId &&
      pricingServiceId &&
      pricingOptionId
        ? "commissions"
        : "contact";

    /*
     * ============================================================
     * PERSIST COMMISSION
     * ============================================================
     *
     * The database is the source of truth. Email delivery is a
     * best-effort side effect after the commission is persisted.
     */

    const commission = await createCommission({
      submissionId,

      clientName: name,

      clientEmail: email,

      styleSnapshot: style || null,

      collectionSnapshot: collection || null,

      categorySnapshot: category || null,

      optionSnapshot: option || null,

      pricingVersionId,
      pricingServiceId,
      pricingOptionId,

      requestSource,

      initialMessage: message,

      termsVersion: null,

      agreementVersion: null,
    });

    /*
     * The original request already sent its emails. A retry only
     * confirms the existing persisted commission.
     */

    if (!commission.wasCreated) {
      return NextResponse.json({
        success: true,
        reference: commission.reference,
      });
    }

    /*
     * ============================================================
     * SAFE EMAIL DATA
     * ============================================================
     */

    const emailData: ContactEmailData = {
      reference: commission.reference,
      name,
      email,
      message,
      style,
      collection,
      category,
      option,
    };

    /*
     * ============================================================
     * EMAIL SIDE EFFECTS
     * ============================================================
     *
     * The persisted commission remains successful even if one or
     * both email deliveries fail. Each delivery is independent.
     */

    try {
      const ownerResult =
        await sendOwnerInquiryEmail(emailData);

      if (ownerResult.error) {
        console.error(
          "Owner email failed:",
          ownerResult.error,
        );
      }
    } catch (error) {
      console.error(
        "Owner email failed:",
        error,
      );
    }

    try {
      const clientResult =
        await sendClientInquiryConfirmationEmail(
          emailData,
        );

      if (clientResult.error) {
        console.error(
          "Client confirmation email failed:",
          clientResult.error,
        );
      }
    } catch (error) {
      console.error(
        "Client confirmation email failed:",
        error,
      );
    }

    return NextResponse.json({
      success: true,
      reference: commission.reference,
    });
  } catch (error) {
    console.error("Contact API error:", error);

    return NextResponse.json(
      {
        error: "Failed to submit inquiry",
      },
      {
        status: 500,
      },
    );
  }
}

/*
 * ============================================================
 * CLIENT-FACING FIELD NORMALIZATION
 * ============================================================
 */

function normalizeClientField(
  value: unknown,
  maxLength: number,
): string | null {
  if (value === undefined || value === null || value === "") {
    return "Not specified";
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "Not specified";
  }

  if (trimmed.length > maxLength) {
    return null;
  }

  /*
   * No permitimos saltos de línea
   * en campos de resumen.
   */

  if (/[\r\n]/.test(trimmed)) {
    return null;
  }

  /*
   * No permitimos URLs, dominios
   * ni direcciones de email.
   */

  if (containsLinkLikeContent(trimmed)) {
    return null;
  }

  return trimmed;
}

/*
 * ============================================================
 * URL / EMAIL DETECTION
 * ============================================================
 */

function containsLinkLikeContent(value: string): boolean {
  /*
   * http://
   * https://
   */

  const protocolRegex = /https?:\/\//i;

  /*
   * www.example.com
   */

  const wwwRegex = /\bwww\./i;

  /*
   * example.com
   * evil.net/path
   * domain.co.uk
   */

  const domainRegex =
    /(?:^|[\s([{"'])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?=$|[\s/:?#)\]}"',])/i;

  /*
   * test@example.com
   */

  const emailLikeRegex = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;

  return (
    protocolRegex.test(value) ||
    wwwRegex.test(value) ||
    domainRegex.test(value) ||
    emailLikeRegex.test(value)
  );
}

/*
 * ============================================================
 * READ BODY WITH HARD LIMIT
 * ============================================================
 */

async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const contentLength = request.headers.get("content-length");

  if (contentLength) {
    const parsedLength = Number(contentLength);

    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      return null;
    }
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();

  const decoder = new TextDecoder();

  let totalBytes = 0;
  let result = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();

      return null;
    }

    result += decoder.decode(value, {
      stream: true,
    });
  }

  result += decoder.decode();

  return result;
}

/*
 * ============================================================
 * OBJECT VALIDATION
 * ============================================================
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
