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

    console.log("Sending email to Outlook...");

    const result = await resend.emails.send({
      from: "Fefierys <onboarding@resend.dev>",
      to: "luanart.2026@gmail.com",
      replyTo: email,
      subject: "OUTLOOK - TEST - Fefierys",

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
                <td style="padding:10px 0; color:#6b7280; width:140px;">Style</td>
                <td style="padding:10px 0; color:#111827; font-weight:600;">${style ?? "-"}</td>
              </tr>
              <tr>
                <td style="padding:10px 0; color:#6b7280;">Collection</td>
                <td style="padding:10px 0; color:#111827; font-weight:600;">${collection ?? "-"}</td>
              </tr>
              <tr>
                <td style="padding:10px 0; color:#6b7280;">Category</td>
                <td style="padding:10px 0; color:#111827; font-weight:600;">${category ?? "-"}</td>
              </tr>
              <tr>
                <td style="padding:10px 0; color:#6b7280;">Selected Option</td>
                <td style="padding:10px 0; color:#111827; font-weight:600;">${option ?? "-"}</td>
              </tr>
            </table>

            <h2 style="margin:0 0 12px; color:#374151; font-size:18px;">
              Client Information
            </h2>

            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
              <tr>
                <td style="padding:10px 0; color:#6b7280; width:140px;">Name</td>
                <td style="padding:10px 0; color:#111827; font-weight:600;">${name}</td>
              </tr>
              <tr>
                <td style="padding:10px 0; color:#6b7280;">Email</td>
                <td style="padding:10px 0; color:#111827; font-weight:600;">${email}</td>
              </tr>
            </table>

            <h2 style="margin:0 0 12px; color:#374151; font-size:18px;">
              Project Message
            </h2>

            <div style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:18px; color:#111827; white-space:pre-wrap; line-height:1.6;">
${message}
            </div>

            <p style="margin:28px 0 0; color:#9ca3af; font-size:13px;">
              This message was sent from the Fefierys contact form.
            </p>

          </div>
        </div>
      `,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}