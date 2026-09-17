import {
  escapeEmailHtml,
} from "./emailClient";
import {
  buildArtistSignatureText,
  buildBrandedEmailLayout,
} from "./emailLayout";

export interface CommissionClientMessageEmailData {
  clientName: string;
  message: string;
  reference: string;
}

export interface CommissionClientMessageEmailBody {
  html: string;
  text: string;
}

function toSafeMultilineHtml(
  value: string,
): string {
  return escapeEmailHtml(
    value,
  )
    .replaceAll(
      "\r\n",
      "\n",
    )
    .replaceAll(
      "\r",
      "\n",
    )
    .replaceAll(
      "\n",
      "<br>",
    );
}

export function buildCommissionClientMessageEmail(
  data: CommissionClientMessageEmailData,
): CommissionClientMessageEmailBody {
  const clientName =
    escapeEmailHtml(
      data.clientName,
    );

  const reference =
    escapeEmailHtml(
      data.reference,
    );

  const message =
    toSafeMultilineHtml(
      data.message,
    );

  return {
    text: [
      `Hi ${data.clientName},`,
      "",
      data.message,
      "",
      `Project reference: ${data.reference}`,
      "",
      "You can reply directly to this email if you need anything.",
      "",
      buildArtistSignatureText(),
    ].join("\n"),

    html:
      buildBrandedEmailLayout({
        title:
          "A message about your project",

        preheader:
          `A message about project ${data.reference}.`,

        contentHtml: `
          <p style="
            margin:0 0 20px;
            color:#374151;
            font-size:15px;
            line-height:1.7;
          ">
            Hi ${clientName},
          </p>

          <div style="
            margin:0 0 24px;
            padding:20px;
            border:1px solid #e5e7eb;
            border-radius:14px;
            background:#f9fafb;
            color:#374151;
            font-size:15px;
            line-height:1.7;
          ">
            ${message}
          </div>

          <p style="
            margin:0 0 24px;
            color:#4b5563;
            font-size:15px;
            line-height:1.7;
          ">
            You can reply directly to this email if you need anything.
          </p>

          <div style="
            padding:16px 18px;
            border:1px solid #e5e7eb;
            border-radius:12px;
            background:#ffffff;
          ">
            <p style="
              margin:0 0 4px;
              color:#9ca3af;
              font-size:11px;
              letter-spacing:0.12em;
              text-transform:uppercase;
            ">
              Project reference
            </p>

            <p style="
              margin:0;
              color:#111827;
              font-size:14px;
              font-weight:600;
            ">
              ${reference}
            </p>
          </div>
        `,
      }),
  };
}