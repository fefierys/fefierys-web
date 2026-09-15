import { escapeEmailHtml } from "./emailClient";

interface BrandedEmailLayoutInput {
  contentHtml: string;
  preheader?: string;
  title: string;
  footerHtml?: string;
}

export function buildClientProjectSubject(
  reference: string,
): string {
  return `Fefierys Art — Your project — ${reference}`;
}

export function buildAdminEmailSubject(
  purpose: string,
  reference: string,
): string {
  return `Fefierys Admin — ${purpose} — ${reference}`;
}

export function buildArtistSignatureHtml(): string {
  return `
    <div style="
      margin-top:32px;
      padding-top:24px;
      border-top:1px solid #e5e7eb;
    ">
      <p style="
        margin:0 0 8px;
        color:#6b7280;
        font-size:14px;
        line-height:1.6;
      ">
        Best regards,
      </p>

      <p style="
        margin:0;
        color:#5966A5;
        font-size:16px;
        font-weight:600;
        line-height:1.5;
      ">
        Fefierys
      </p>

      <p style="
        margin:2px 0 0;
        color:#6b7280;
        font-size:13px;
        line-height:1.5;
      ">
        Fantasy Illustrator
      </p>

      <p style="
        margin:4px 0 0;
        font-size:13px;
        line-height:1.5;
      ">
        <a
          href="https://fefierys.com"
          style="
            color:#5966A5;
            text-decoration:none;
          "
        >
          fefierys.com
        </a>
      </p>
    </div>
  `;
}

export function buildArtistSignatureText(): string {
  return [
    "Best regards,",
    "Fefierys",
    "Fantasy Illustrator",
    "https://fefierys.com",
  ].join("\n");
}

export function buildInternalEmailFooterHtml(): string {
  return `
    <div style="
      margin-top:32px;
      padding-top:20px;
      border-top:1px solid #e5e7eb;
    ">
      <p style="
        margin:0;
        color:#9ca3af;
        font-size:12px;
        line-height:1.6;
      ">
        This is an internal Fefierys notification.
      </p>
    </div>
  `;
}

export function buildBrandedEmailLayout({
  contentHtml,
  footerHtml,
  preheader,
  title,
}: BrandedEmailLayoutInput): string {
  const safeTitle = escapeEmailHtml(title);

  const safePreheader = preheader
    ? escapeEmailHtml(preheader)
    : "";

  return `
    <!doctype html>
    <html>
      <body style="
        margin:0;
        padding:0;
        background:#f4f4f8;
      ">
        ${
          preheader
            ? `
              <div style="
                display:none;
                max-height:0;
                overflow:hidden;
                opacity:0;
                color:transparent;
              ">
                ${safePreheader}
              </div>
            `
            : ""
        }

        <div style="
          margin:0;
          padding:40px 20px;
          background:#f4f4f8;
          font-family:Arial,Helvetica,sans-serif;
        ">
          <div style="
            max-width:640px;
            margin:0 auto;
            overflow:hidden;
            border:1px solid #e5e7eb;
            border-radius:20px;
            background:#ffffff;
          ">
            <div style="
              padding:32px;
              background:#5966A5;
              color:#ffffff;
            ">
              <p style="
                margin:0 0 8px;
                font-size:12px;
                letter-spacing:0.16em;
                text-transform:uppercase;
                opacity:0.72;
              ">
                Fefierys Art
              </p>

              <h1 style="
                margin:0;
                font-size:28px;
                font-weight:400;
                line-height:1.25;
              ">
                ${safeTitle}
              </h1>
            </div>

            <div style="padding:32px;">
              ${contentHtml}

              ${footerHtml ?? buildArtistSignatureHtml()}
            </div>
          </div>

          <p style="
            max-width:640px;
            margin:16px auto 0;
            color:#9ca3af;
            font-size:11px;
            line-height:1.5;
            text-align:center;
          ">
            Fefierys Art · Fantasy Illustration
          </p>
        </div>
      </body>
    </html>
  `;
}