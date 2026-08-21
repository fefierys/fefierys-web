import { NextResponse } from "next/server";
import { Resend } from "resend";


/*
 * ============================================================
 * ENVIRONMENT VARIABLES
 * ============================================================
 */

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} environment variable is not configured`
    );
  }

  return value;
}

const resendApiKey =
  getRequiredEnv("RESEND_API_KEY");

const ownerEmail =
  getRequiredEnv("OWNER_EMAIL");

const senderEmail =
  getRequiredEnv("SENDER_EMAIL");

const resend =
  new Resend(resendApiKey);


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
  name?: unknown;
  email?: unknown;
  message?: unknown;

  style?: unknown;
  collection?: unknown;
  category?: unknown;
  option?: unknown;

  website?: unknown;
}

interface SafeEmailData {
  name: string;
  email: string;
  message: string;

  style: string;
  collection: string;
  category: string;
  option: string;
}


/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  request: Request
) {
  try {

    /*
     * CONTENT TYPE
     */

    const contentType =
      request.headers.get(
        "content-type"
      );

    if (
      !contentType
        ?.toLowerCase()
        .startsWith(
          "application/json"
        )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported content type",
        },
        {
          status: 415,
        }
      );
    }


    /*
     * BODY SIZE
     */

    const rawBody =
      await readBodyWithLimit(
        request,
        MAX_BODY_SIZE
      );

    if (rawBody === null) {
      return NextResponse.json(
        {
          error:
            "Request too large",
        },
        {
          status: 413,
        }
      );
    }


    /*
     * JSON
     */

    let parsedBody: unknown;

    try {
      parsedBody =
        JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * Debe ser un objeto JSON.
     */

    if (!isRecord(parsedBody)) {
      return NextResponse.json(
        {
          error:
            "Invalid request body",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      parsedBody as ContactBody;


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
          error:
            "Invalid field types",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof body.website ===
        "string" &&
      body.website.trim() !== ""
    ) {
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
      typeof body.name !==
        "string" ||
      typeof body.email !==
        "string" ||
      typeof body.message !==
        "string"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid field types",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * ============================================================
     * NORMALIZATION
     * ============================================================
     */

    const name =
      body.name.trim();

    const email =
      body.email
        .trim()
        .toLowerCase();

    const message =
      body.message.trim();


    /*
     * ============================================================
     * REQUIRED
     * ============================================================
     */

    if (
      !name ||
      !email ||
      !message
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * ============================================================
     * LENGTHS
     * ============================================================
     */

    if (
      name.length >
        MAX_NAME_LENGTH ||
      email.length >
        MAX_EMAIL_LENGTH ||
      message.length >
        MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            "One or more fields are too long",
        },
        {
          status: 400,
        }
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

    const nameRegex =
      /^[a-zA-ZÀ-ÿ\s'.-]{2,100}$/;

    if (!nameRegex.test(name)) {
      return NextResponse.json(
        {
          error:
            "Invalid name",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * ============================================================
     * EMAIL
     * ============================================================
     */

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error:
            "Invalid email",
        },
        {
          status: 400,
        }
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

    const style =
      normalizeClientField(
        body.style,
        MAX_STYLE_LENGTH
      );

    const collection =
      normalizeClientField(
        body.collection,
        MAX_COLLECTION_LENGTH
      );

    const category =
      normalizeClientField(
        body.category,
        MAX_CATEGORY_LENGTH
      );

    const option =
      normalizeClientField(
        body.option,
        MAX_OPTION_LENGTH
      );

    if (
      style === null ||
      collection === null ||
      category === null ||
      option === null
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid commission selection",
        },
        {
          status: 400,
        }
      );
    }


    /*
     * ============================================================
     * SAFE EMAIL DATA
     * ============================================================
     */

    const safeData: SafeEmailData = {
      name:
        escapeHtml(name),

      /*
       * NO escapamos el email aquí.
       *
       * Tiene que seguir siendo una
       * dirección válida para to/replyTo.
       */

      email,

      /*
       * Message puede contener URLs porque
       * solamente aparece en TU correo.
       *
       * El HTML sí queda neutralizado.
       */

      message:
        escapeHtml(message),

      style:
        escapeHtml(style),

      collection:
        escapeHtml(collection),

      category:
        escapeHtml(category),

      option:
        escapeHtml(option),
    };


    /*
     * ============================================================
     * OWNER EMAIL FIRST
     * ============================================================
     *
     * Primero debemos asegurarnos de que
     * tú recibiste realmente la comisión.
     */

    const ownerResult =
      await sendOwnerEmail(
        safeData
      );

    if (ownerResult.error) {
      console.error(
        "Owner email failed:",
        ownerResult.error
      );

      throw new Error(
        ownerResult.error.message
      );
    }


    /*
     * ============================================================
     * CLIENT CONFIRMATION
     * ============================================================
     *
     * Solo llegamos aquí si tu correo
     * se envió correctamente.
     *
     * Si falla la confirmación al cliente,
     * NO perdemos la comisión.
     */

    try {

      const clientResult =
        await sendClientConfirmationEmail(
          safeData
        );

      if (clientResult.error) {
        console.error(
          "Client confirmation email failed:",
          clientResult.error
        );
      }

    } catch (error) {

      console.error(
        "Client confirmation email failed:",
        error
      );
    }


    return NextResponse.json({
      success: true,
    });

  } catch (error) {

    console.error(
      "Contact API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to send email",
      },
      {
        status: 500,
      }
    );
  }
}


/*
 * ============================================================
 * OWNER EMAIL
 * ============================================================
 */

async function sendOwnerEmail(
  data: SafeEmailData
) {

  return resend.emails.send({

    from:
      `Fefierys <${senderEmail}>`,

    to:
      ownerEmail,

    replyTo:
      data.email,

    subject:
      "✨ New Commission Request - Fefierys",

    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; background:#f4f4f8; padding:40px;">

        <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px; border:1px solid #e5e7eb;">

          <h1 style="margin:0 0 8px; color:#2f3558; font-size:28px; font-weight:400;">
            New Commission Inquiry
          </h1>

          <p style="margin:0 0 24px; color:#6b7280;">
            A new commission request has been submitted through the Fefierys website.
          </p>


          <h2 style="margin:0 0 12px; color:#374151; font-size:18px;">
            Commission Summary
          </h2>


          <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">

            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Style
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.style}
              </td>
            </tr>


            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Collection
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.collection}
              </td>
            </tr>


            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Category
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.category}
              </td>
            </tr>


            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Selected Option
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.option}
              </td>
            </tr>

          </table>


          <h2 style="margin:0 0 12px; color:#374151; font-size:18px;">
            Client Information
          </h2>


          <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">

            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Name
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.name}
              </td>
            </tr>


            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Email
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${escapeHtml(
                  data.email
                )}
              </td>
            </tr>

          </table>


          <h2 style="margin:0 0 12px; color:#374151; font-size:18px;">
            Project Message
          </h2>


          <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:18px; color:#111827; white-space:pre-wrap; line-height:1.6;">
            ${data.message}
          </div>


          <p style="margin:28px 0 0; color:#9ca3af; font-size:13px;">
            This message was sent from the Fefierys contact form.
          </p>

          <p style="margin:8px 0 0; color:#9ca3af; font-size:12px;">
            User-submitted content may contain untrusted links. Verify links before opening them.
          </p>

        </div>

      </div>
    `,
  });
}


/*
 * ============================================================
 * CLIENT CONFIRMATION EMAIL
 * ============================================================
 */

async function sendClientConfirmationEmail(
  data: SafeEmailData
) {

  return resend.emails.send({

    from:
      `Fefierys <${senderEmail}>`,

    to:
      data.email,

    replyTo:
      ownerEmail,

    subject:
      "✨ Your Fefierys commission request has been received",

    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; background:#f4f4f8; padding:40px;">

        <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:16px; padding:32px; border:1px solid #e5e7eb;">


          <h1 style="color:#2f3558; font-size:28px; font-weight:400;">
            Thank you for reaching out ✨
          </h1>


          <p style="color:#374151; line-height:1.6;">
            Hello ${data.name},
          </p>


          <p style="color:#374151; line-height:1.6;">
            Your commission request has been successfully received through the Fefierys website.
          </p>


          <p style="color:#374151; line-height:1.6;">
            I will personally review your project details and get back to you with the next steps.
          </p>


          <h2 style="margin-top:28px; margin-bottom:12px; color:#374151; font-size:18px;">
            Commission Summary
          </h2>


          <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">

            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Style
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.style}
              </td>
            </tr>


            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Collection
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.collection}
              </td>
            </tr>


            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Category
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.category}
              </td>
            </tr>


            <tr>
              <td style="padding:10px 0; color:#6b7280;">
                Selected Option
              </td>

              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.option}
              </td>
            </tr>

          </table>


          <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:18px;">

            <strong style="color:#2f3558;">
              Current status:
            </strong>


            <p style="margin:8px 0 0; color:#374151;">
              🟡 Request Received - Under Review
            </p>

          </div>


          <p style="margin-top:32px; color:#6b7280;">
            Thank you for trusting me with your idea!
          </p>


          <p style="color:#2f3558;">
            Fefierys
          </p>

        </div>

      </div>
    `,
  });
}


/*
 * ============================================================
 * CLIENT-FACING FIELD NORMALIZATION
 * ============================================================
 */

function normalizeClientField(
  value: unknown,
  maxLength: number
): string | null {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "Not specified";
  }


  if (typeof value !== "string") {
    return null;
  }


  const trimmed =
    value.trim();


  if (!trimmed) {
    return "Not specified";
  }


  if (
    trimmed.length >
      maxLength
  ) {
    return null;
  }


  /*
   * No permitimos saltos de línea
   * en campos de resumen.
   */

  if (
    /[\r\n]/.test(trimmed)
  ) {
    return null;
  }


  /*
   * No permitimos URLs, dominios
   * ni direcciones de email.
   */

  if (
    containsLinkLikeContent(
      trimmed
    )
  ) {
    return null;
  }


  return trimmed;
}


/*
 * ============================================================
 * URL / EMAIL DETECTION
 * ============================================================
 */

function containsLinkLikeContent(
  value: string
): boolean {

  /*
   * http://
   * https://
   */

  const protocolRegex =
    /https?:\/\//i;


  /*
   * www.example.com
   */

  const wwwRegex =
    /\bwww\./i;


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

  const emailLikeRegex =
    /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;


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
  maxBytes: number
): Promise<string | null> {

  const contentLength =
    request.headers.get(
      "content-length"
    );


  if (contentLength) {

    const parsedLength =
      Number(contentLength);


    if (
      Number.isFinite(
        parsedLength
      ) &&
      parsedLength >
        maxBytes
    ) {
      return null;
    }
  }


  if (!request.body) {
    return "";
  }


  const reader =
    request.body.getReader();

  const decoder =
    new TextDecoder();

  let totalBytes = 0;
  let result = "";


  while (true) {

    const {
      done,
      value,
    } =
      await reader.read();


    if (done) {
      break;
    }


    totalBytes +=
      value.byteLength;


    if (
      totalBytes >
        maxBytes
    ) {
      await reader.cancel();

      return null;
    }


    result +=
      decoder.decode(
        value,
        {
          stream: true,
        }
      );
  }


  result +=
    decoder.decode();


  return result;
}


/*
 * ============================================================
 * OBJECT VALIDATION
 * ============================================================
 */

function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {

  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}


/*
 * ============================================================
 * HTML ESCAPING
 * ============================================================
 */

function escapeHtml(
  value: string
) {

  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}