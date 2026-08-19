import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      name,
      email,
      message,
      style,
      collection,
      category,
      option,
    } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        {
          error: "Missing required fields",
        },
        {
          status: 400,
        }
      );
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          error: "Invalid email",
        },
        {
          status: 400,
        }
      );
    }

    const safeData = {
      name: escapeHtml(name),
      email: escapeHtml(email),
      message: escapeHtml(message),
      style: escapeHtml(style ?? "Not specified"),
      collection: escapeHtml(collection ?? "Not specified"),
      category: escapeHtml(category ?? "Not specified"),
      option: escapeHtml(option ?? "Not specified"),
    };


    const results = await Promise.allSettled([
      sendOwnerEmail(safeData),
      sendClientConfirmationEmail(safeData),
    ]);

    const ownerEmailResult = results[0];
    const clientEmailResult = results[1];

    if (clientEmailResult.status === "rejected") {
      console.error(
        "Client confirmation email failed:",
        clientEmailResult.reason
      );
    }

    if (ownerEmailResult.status === "rejected") {
      throw ownerEmailResult.reason;
    }


    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Failed to send email",
      },
      {
        status: 500,
      }
    );
  }
}



async function sendOwnerEmail(data: {
  name: string;
  email: string;
  message: string;
  style: string;
  collection: string;
  category: string;
  option: string;
}) {

  return resend.emails.send({

    from: "Fefierys <contact@fefierys.com>",

    to: "fefierys@outlook.com",

    replyTo: data.email,

    subject: "✨ New Commission Request - Fefierys",

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
              <td style="padding:10px 0; color:#6b7280;">Style</td>
              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.style}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0; color:#6b7280;">Collection</td>
              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.collection}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0; color:#6b7280;">Category</td>
              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.category}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0; color:#6b7280;">Selected Option</td>
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
              <td style="padding:10px 0; color:#6b7280;">Name</td>
              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.name}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0; color:#6b7280;">Email</td>
              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.email}
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


        </div>
      </div>
    `,
  });
}




async function sendClientConfirmationEmail(data: {
  name: string;
  email: string;
  message: string;
  style: string;
  collection: string;
  category: string;
  option: string;
}) {

  return resend.emails.send({

    from: "Fefierys <contact@fefierys.com>",

    to: data.email,

    replyTo: "fefierys@outlook.com",

    subject: "✨ Your Fefierys commission request has been received",

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
              <td style="padding:10px 0; color:#6b7280;">Style</td>
              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.style}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0; color:#6b7280;">Collection</td>
              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.collection}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0; color:#6b7280;">Category</td>
              <td style="padding:10px 0; color:#111827; font-weight:600;">
                ${data.category}
              </td>
            </tr>

            <tr>
              <td style="padding:10px 0; color:#6b7280;">Selected Option</td>
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
            Thank you for trusting me with your idea!.
          </p>


          <p style="color:#2f3558;">
            Fefierys
          </p>


        </div>

      </div>
    `,
  });
}




function escapeHtml(value: string) {

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}