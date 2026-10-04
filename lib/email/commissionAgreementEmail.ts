import {
  escapeEmailHtml,
  getRequiredEmailEnv,
} from "./emailClient";

import {
  buildArtistSignatureText,
  buildBrandedEmailLayout,
} from "./emailLayout";

export interface BuildCommissionAgreementEmailInput {
  clientName: string;
  publicToken: string;
  reference: string;
  revision: number;
  termsVersion: string;
}

export interface CommissionAgreementEmailBody {
  html: string;
  text: string;
}

function getAppUrl(): string {
  const value =
    getRequiredEmailEnv(
      "APP_URL",
    );

  let url: URL;

  try {
    url =
      new URL(
        value,
      );
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

function buildPublicAgreementUrl(
  publicToken: string,
): string {
  const url =
    new URL(
      `/agreement/${encodeURIComponent(publicToken)}`,
      getAppUrl(),
    );

  return url.toString();
}

export function buildCommissionAgreementEmail(
  input: BuildCommissionAgreementEmailInput,
): CommissionAgreementEmailBody {
  const agreementUrl =
    buildPublicAgreementUrl(
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

  const agreementUrlHtml =
    escapeEmailHtml(
      agreementUrl,
    );

  const termsVersion =
    escapeEmailHtml(
      input.termsVersion,
    );

  return {
    text: [
      `Hi ${input.clientName},`,
      "",
      "Your Commission Agreement is ready for review.",
      "",
      `Project reference: ${input.reference}`,
      `Agreement revision: ${input.revision}`,
      `Terms of Service: ${input.termsVersion}`,
      "",
      "Please review the Agreement, project details, license rights, payment plan, and applicable Terms of Service before accepting.",
      "",
      "You can review and electronically accept your Agreement securely here:",
      agreementUrl,
      "",
      "If anything looks incorrect or you would like something clarified, please reply to this email before accepting the Agreement.",
      "",
      buildArtistSignatureText(),
    ].join("\n"),

    html:
      buildBrandedEmailLayout({
        title:
          "Your Commission Agreement is ready",

        preheader:
          `Your Commission Agreement for ${input.reference} is ready for review.`,

        contentHtml: `
          <p style="
            margin:0 0 16px;
            color:#374151;
            font-size:15px;
            line-height:1.7;
          ">
            Hi ${clientName},
          </p>

          <p style="
            margin:0 0 20px;
            color:#4b5563;
            font-size:15px;
            line-height:1.7;
          ">
            Your Commission Agreement is ready for review.
            Please review the project details, license rights,
            payment plan, and applicable Terms of Service before
            accepting.
          </p>

          <div style="
            margin:24px 0;
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
                  Project reference
                </td>

                <td style="
                  padding:6px 0;
                  color:#111827;
                  font-weight:600;
                  text-align:right;
                ">
                  ${reference}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:6px 0;
                  color:#6b7280;
                ">
                  Agreement revision
                </td>

                <td style="
                  padding:6px 0;
                  color:#111827;
                  font-weight:600;
                  text-align:right;
                ">
                  ${input.revision}
                </td>
              </tr>

              <tr>
                <td style="
                  padding:6px 0;
                  color:#6b7280;
                ">
                  Terms of Service
                </td>

                <td style="
                  padding:6px 0;
                  color:#111827;
                  font-weight:600;
                  text-align:right;
                ">
                  ${termsVersion}
                </td>
              </tr>
            </table>
          </div>

          <div style="
            margin:28px 0;
            text-align:center;
          ">
            <a
              href="${agreementUrlHtml}"
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
              Review Agreement
            </a>
          </div>

          <p style="
            margin:0 0 16px;
            color:#4b5563;
            font-size:14px;
            line-height:1.7;
          ">
            The secure page will show the Agreement that has
            been prepared for your project and will provide the
            electronic acceptance step.
          </p>

          <p style="
            margin:0;
            color:#6b7280;
            font-size:13px;
            line-height:1.7;
          ">
            If anything looks incorrect or you would like
            something clarified, please reply directly to this
            email before accepting the Agreement.
          </p>
        `,
      }),
  };
}