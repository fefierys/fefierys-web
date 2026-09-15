import {
  escapeEmailHtml,
  getRequiredEmailEnv,
  ownerEmail,
  resend,
  senderEmail,
} from "./emailClient";
import {
  buildArtistSignatureText,
  buildBrandedEmailLayout,
  buildClientProjectSubject,
} from "./emailLayout";

interface SendCommissionQuoteEmailInput {
  clientEmail: string;
  clientName: string;
  currency: string;
  publicToken: string;
  reference: string;
  totalAmount: string;
  validUntil: Date;
  version: number;
}

function getAppUrl(): string {
  const value = getRequiredEmailEnv(
    "APP_URL",
  );

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "APP_URL must be a valid absolute URL.",
    );
  }

  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost"
  ) {
    throw new Error(
      "APP_URL must use HTTPS outside localhost.",
    );
  }

  return url.origin;
}

function buildPublicQuoteUrl(
  publicToken: string,
): string {
  const url = new URL(
    `/quote/${encodeURIComponent(publicToken)}`,
    getAppUrl(),
  );

  return url.toString();
}

function formatDate(
  date: Date,
): string {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      dateStyle: "long",
    },
  ).format(date);
}

export async function sendCommissionQuoteEmail(
  input: SendCommissionQuoteEmailInput,
) {
  const quoteUrl =
    buildPublicQuoteUrl(
      input.publicToken,
    );

  const clientName =
    escapeEmailHtml(
      input.clientName,
    );

  const reference =
    escapeEmailHtml(
      input.reference,
    );

  const currency =
    escapeEmailHtml(
      input.currency,
    );

  const totalAmount =
    escapeEmailHtml(
      input.totalAmount,
    );

  const validUntil =
    escapeEmailHtml(
      formatDate(
        input.validUntil,
      ),
    );

  /*
   * The raw URL is used in the plain-text email.
   * The escaped version is used inside HTML attributes.
   */
  const quoteUrlHtml =
    escapeEmailHtml(
      quoteUrl,
    );

  return resend.emails.send({
    from:
      `Fefierys Art <${senderEmail}>`,

    to:
      input.clientEmail,

    replyTo:
      ownerEmail,

    /*
     * This subject intentionally remains stable across
     * client-facing commission emails. A future email-thread
     * implementation will add the corresponding threading
     * headers without changing the visible subject.
     */
    subject:
      buildClientProjectSubject(
        input.reference,
      ),

    text: [
      `Hi ${input.clientName},`,
      "",
      "I've prepared your commission quote.",
      "",
      `Reference: ${input.reference}`,
      `Quote: v${input.version}`,
      `Total: ${input.totalAmount} ${input.currency}`,
      `Valid until: ${formatDate(input.validUntil)}`,
      "",
      "You can review and respond to your quote securely here:",
      quoteUrl,
      "",
      "Need something changed? Reply directly to this email and let me know what you would like adjusted.",
      "Requesting changes does not decline or cancel your quote.",
      "",
      buildArtistSignatureText(),
    ].join("\n"),

    html:
      buildBrandedEmailLayout({
        title:
          "Your quote is ready",

        preheader:
          `Quote v${input.version} is ready for your review.`,

        contentHtml: `
          <p style="
            margin:0 0 20px;
            color:#374151;
            font-size:16px;
            line-height:1.6;
          ">
            Hi ${clientName},
          </p>

          <p style="
            margin:0 0 28px;
            color:#4b5563;
            font-size:15px;
            line-height:1.7;
          ">
            I've prepared your commission quote. You can review
            the details and respond securely using the button below.
          </p>

          <div style="
            margin-bottom:28px;
            padding:20px;
            border:1px solid #e5e7eb;
            border-radius:14px;
            background:#f9fafb;
          ">
            <table style="
              width:100%;
              border-collapse:collapse;
              font-size:14px;
            ">
              <tr>
                <td style="
                  padding:6px 0;
                  color:#6b7280;
                ">
                  Reference
                </td>

                <td style="
                  padding:6px 0;
                  text-align:right;
                  color:#111827;
                  font-weight:600;
                ">
                  ${reference}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:6px 0;
                  color:#6b7280;
                ">
                  Quote
                </td>

                <td style="
                  padding:6px 0;
                  text-align:right;
                  color:#111827;
                  font-weight:600;
                ">
                  v${input.version}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:6px 0;
                  color:#6b7280;
                ">
                  Total
                </td>

                <td style="
                  padding:6px 0;
                  text-align:right;
                  color:#111827;
                  font-weight:600;
                ">
                  ${totalAmount} ${currency}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:6px 0;
                  color:#6b7280;
                ">
                  Valid until
                </td>

                <td style="
                  padding:6px 0;
                  text-align:right;
                  color:#111827;
                  font-weight:600;
                ">
                  ${validUntil}
                </td>
              </tr>
            </table>
          </div>

          <div style="
            margin:32px 0;
            text-align:center;
          ">
            <a
              href="${quoteUrlHtml}"
              style="
                display:inline-block;
                padding:14px 24px;
                border-radius:12px;
                background:#5966A5;
                color:#ffffff;
                font-size:15px;
                font-weight:600;
                text-decoration:none;
              "
            >
              View your quote
            </a>
          </div>

          <div style="
            margin-top:28px;
            padding:18px 20px;
            border:1px solid #dfe3f3;
            border-radius:14px;
            background:#f6f7fc;
          ">
            <p style="
              margin:0;
              color:#5966A5;
              font-size:13px;
              font-weight:600;
            ">
              Need something changed?
            </p>

            <p style="
              margin:8px 0 0;
              color:#6b7280;
              font-size:13px;
              line-height:1.7;
            ">
              Reply directly to this email and let me know what
              you would like adjusted. Requesting changes does
              not decline or cancel your quote.
            </p>
          </div>

          <p style="
            margin:24px 0 0;
            color:#9ca3af;
            font-size:12px;
            line-height:1.6;
          ">
            This secure link is intended for you. Please avoid
            forwarding or sharing it with others.
          </p>
        `,
      }),
  });
}