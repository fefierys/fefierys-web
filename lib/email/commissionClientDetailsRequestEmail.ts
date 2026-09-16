import { escapeEmailHtml } from "./emailClient";
import {
  buildArtistSignatureText,
  buildBrandedEmailLayout,
} from "./emailLayout";

export interface CommissionClientDetailsRequestEmailData {
  clientName: string;
  message: string;
  reference: string;
}

export interface CommissionClientDetailsRequestEmailBody {
  html: string;
  text: string;
}

function toSafeMultilineHtml(value: string): string {
  return escapeEmailHtml(value)
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("\n", "<br>");
}

export function buildCommissionClientDetailsRequestEmail(
  data: CommissionClientDetailsRequestEmailData,
): CommissionClientDetailsRequestEmailBody {
  const clientName = escapeEmailHtml(data.clientName);
  const reference = escapeEmailHtml(data.reference);
  const message = toSafeMultilineHtml(data.message);

  return {
    text: [
      `Hi ${data.clientName},`,
      "",
      "Thank you again for your project inquiry.",
      "",
      "Before I continue reviewing your project, I need a few additional details:",
      "",
      data.message,
      "",
      "You can reply directly to this email with the information whenever you're ready.",
      "",
      `Project reference: ${data.reference}`,
      "",
      buildArtistSignatureText(),
    ].join("\n"),

    html: buildBrandedEmailLayout({
      title: "A few details about your project",
      preheader: `A few additional details are needed for project ${data.reference}.`,
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
          margin:0 0 16px;
          color:#4b5563;
          font-size:15px;
          line-height:1.7;
        ">
          Thank you again for your project inquiry. Before I continue
          reviewing your project, I need a few additional details:
        </p>

        <div style="
          margin:24px 0;
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
          You can reply directly to this email with the information whenever
          you&apos;re ready.
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
