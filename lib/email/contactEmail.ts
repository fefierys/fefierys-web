import {
  escapeEmailHtml,
  ownerEmail,
  resend,
  senderEmail,
} from "./emailClient";
import {
  buildAdminEmailSubject,
  buildArtistSignatureText,
  buildBrandedEmailLayout,
  buildClientProjectSubject,
  buildInternalEmailFooterHtml,
} from "./emailLayout";

export interface ContactEmailData {
  reference: string;
  name: string;
  email: string;
  message: string;
  style: string;
  collection: string;
  category: string;
  option: string;
}

export async function sendOwnerInquiryEmail(
  data: ContactEmailData,
) {
  const reference = escapeEmailHtml(
    data.reference,
  );

  const name = escapeEmailHtml(
    data.name,
  );

  const email = escapeEmailHtml(
    data.email,
  );

  const message = escapeEmailHtml(
    data.message,
  );

  const style = escapeEmailHtml(
    data.style,
  );

  const collection = escapeEmailHtml(
    data.collection,
  );

  const category = escapeEmailHtml(
    data.category,
  );

  const option = escapeEmailHtml(
    data.option,
  );

  return resend.emails.send({
    from: `Fefierys Art <${senderEmail}>`,

    to: ownerEmail,

    subject: buildAdminEmailSubject(
      "New project inquiry",
      data.reference,
    ),

    text: [
      "New project inquiry",
      "",
      `Reference: ${data.reference}`,
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      "",
      `Style: ${data.style}`,
      `Collection: ${data.collection}`,
      `Category: ${data.category}`,
      `Selected option: ${data.option}`,
      "",
      "Project message:",
      data.message,
      "",
      "This is an internal Fefierys notification.",
    ].join("\n"),

    html: buildBrandedEmailLayout({
      title: "New project inquiry",

      preheader:
        `New inquiry ${data.reference} from ${data.name}.`,

      footerHtml:
        buildInternalEmailFooterHtml(),

      contentHtml: `
        <p style="
          margin:0 0 24px;
          color:#4b5563;
          font-size:15px;
          line-height:1.7;
        ">
          A new project inquiry has been submitted through the
          Fefierys website.
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
                Name
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${name}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#6b7280;
              ">
                Email
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${email}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#6b7280;
              ">
                Style
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${style}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#6b7280;
              ">
                Collection
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${collection}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#6b7280;
              ">
                Category
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${category}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#6b7280;
              ">
                Selected option
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${option}
              </td>
            </tr>
          </table>
        </div>

        <p style="
          margin:0 0 10px;
          color:#374151;
          font-size:13px;
          font-weight:600;
          letter-spacing:0.08em;
          text-transform:uppercase;
        ">
          Project message
        </p>

        <div style="
          padding:18px;
          border:1px solid #e5e7eb;
          border-radius:14px;
          background:#f9fafb;
          color:#374151;
          font-size:14px;
          line-height:1.7;
          white-space:pre-wrap;
          overflow-wrap:anywhere;
        ">${message}</div>

        <p style="
          margin:20px 0 0;
          color:#9ca3af;
          font-size:12px;
          line-height:1.6;
        ">
          User-submitted content may contain untrusted links.
          Verify links before opening them.
        </p>
      `,
    }),
  });
}

export interface ClientInquiryConfirmationEmailContent {
  subject: string;
  text: string;
  html: string;
}

export function buildClientInquiryConfirmationEmail(
  data: ContactEmailData,
): ClientInquiryConfirmationEmailContent {
  const reference = escapeEmailHtml(
    data.reference,
  );

  const name = escapeEmailHtml(
    data.name,
  );

  const style = escapeEmailHtml(
    data.style,
  );

  const collection = escapeEmailHtml(
    data.collection,
  );

  const category = escapeEmailHtml(
    data.category,
  );

  const option = escapeEmailHtml(
    data.option,
  );

  return {
    subject: buildClientProjectSubject(
      data.reference,
    ),

    text: [
      `Hi ${data.name},`,
      "",
      "I've received your project inquiry and will personally review the details you shared.",
      "",
      `Reference: ${data.reference}`,
      `Style: ${data.style}`,
      `Collection: ${data.collection}`,
      `Category: ${data.category}`,
      `Selected option: ${data.option}`,
      "",
      "Current status: Inquiry received — Under review",
      "",
      "I'll get back to you with the next steps once I've reviewed your project.",
      "",
      buildArtistSignatureText(),
    ].join("\n"),

    html: buildBrandedEmailLayout({
      title: "Your inquiry has been received",

      preheader:
        "I've received your project inquiry and will review the details you shared.",

      contentHtml: `
        <p style="
          margin:0 0 20px;
          color:#374151;
          font-size:16px;
          line-height:1.6;
        ">
          Hi ${name},
        </p>

        <p style="
          margin:0 0 28px;
          color:#4b5563;
          font-size:15px;
          line-height:1.7;
        ">
          I've received your project inquiry and will personally
          review the details you shared.
        </p>

        <div style="
          margin-bottom:24px;
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
                Style
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${style}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#6b7280;
              ">
                Collection
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${collection}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#6b7280;
              ">
                Category
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${category}
              </td>
            </tr>

            <tr>
              <td style="
                padding:6px 0;
                color:#6b7280;
              ">
                Selected option
              </td>

              <td style="
                padding:6px 0;
                text-align:right;
                color:#111827;
                font-weight:600;
              ">
                ${option}
              </td>
            </tr>
          </table>
        </div>

        <div style="
          margin-bottom:28px;
          padding:18px 20px;
          border:1px solid #dfe3f3;
          border-radius:14px;
          background:#f6f7fc;
        ">
          <p style="
            margin:0;
            color:#5966A5;
            font-size:12px;
            font-weight:600;
            letter-spacing:0.08em;
            text-transform:uppercase;
          ">
            Current status
          </p>

          <p style="
            margin:8px 0 0;
            color:#374151;
            font-size:14px;
            line-height:1.6;
          ">
            Inquiry received — Under review
          </p>
        </div>

        <p style="
          margin:0;
          color:#4b5563;
          font-size:14px;
          line-height:1.7;
        ">
          I'll get back to you with the next steps once I've
          reviewed your project.
        </p>
      `,
    }),
  };
}
