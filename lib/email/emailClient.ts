import { Resend } from "resend";

export function getRequiredEmailEnv(
  name: string,
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} environment variable is not configured.`,
    );
  }

  return value;
}

export const resend = new Resend(
  getRequiredEmailEnv("RESEND_API_KEY"),
);

export const senderEmail =
  getRequiredEmailEnv("SENDER_EMAIL");

export const ownerEmail =
  getRequiredEmailEnv("OWNER_EMAIL");

export function escapeEmailHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}