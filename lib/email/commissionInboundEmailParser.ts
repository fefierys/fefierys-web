import type {
  CommissionInboundEmail,
} from "./commissionInboundEmailProvider";

const MAX_EMAIL_LENGTH = 320;

export interface ParsedCommissionInboundEmail {
  providerEmailId: string;
  providerMessageId: string;
  senderEmail: string;
  recipientEmails: string[];
  subject: string;
  messageText: string;
  inReplyToMessageId: string | null;
  referencesHeader: string | null;
  receivedAt: Date;
}

function normalizeRequiredValue(
  value: string,
  fieldName: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

function validateMailboxAddress(
  value: string,
): string {
  const normalized =
    value.trim();

  if (
    !normalized ||
    normalized.length >
      MAX_EMAIL_LENGTH ||
    /[\r\n]/.test(normalized) ||
    !/^[^\s@<>]+@[^\s@<>]+$/.test(
      normalized,
    )
  ) {
    throw new Error(
      "Received email From does not contain a valid mailbox address.",
    );
  }

  return normalized;
}

/*
 * Resend may expose From as either:
 *
 *   client@example.com
 *
 * or:
 *
 *   Client Name <client@example.com>
 *
 * We only need the mailbox address because that is what is compared against
 * commissions.client_email.
 */
export function extractCommissionInboundSenderEmail(
  from: string,
): string {
  const normalized =
    normalizeRequiredValue(
      from,
      "from",
    );

  const mailboxMatches = [
    ...normalized.matchAll(
      /<([^<>\r\n]+)>/g,
    ),
  ];

  if (
    mailboxMatches.length >
    1
  ) {
    throw new Error(
      "Received email From contains more than one mailbox.",
    );
  }

  if (
    mailboxMatches.length ===
    1
  ) {
    const mailbox =
      mailboxMatches[0]?.[1];

    if (!mailbox) {
      throw new Error(
        "Received email From mailbox could not be parsed.",
      );
    }

    return validateMailboxAddress(
      mailbox,
    );
  }

  return validateMailboxAddress(
    normalized,
  );
}

export function getCommissionInboundHeader(
  headers: Record<string, string>,
  headerName: string,
): string | null {
  const normalizedHeaderName =
    headerName
      .trim()
      .toLowerCase();

  if (!normalizedHeaderName) {
    throw new Error(
      "headerName is required.",
    );
  }

  for (
    const [
      key,
      value,
    ] of Object.entries(headers)
  ) {
    if (
      key
        .trim()
        .toLowerCase() !==
      normalizedHeaderName
    ) {
      continue;
    }

    const normalizedValue =
      value.trim();

    return normalizedValue ||
      null;
  }

  return null;
}

function normalizeRecipientEmails(
  values: string[],
): string[] {
  return [
    ...new Set(
      values
        .map(
          (value) =>
            value.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

function normalizeMessageText(
  text: string | null,
): string {
  if (
    typeof text !== "string"
  ) {
    throw new Error(
      "Received commission email does not contain a plain-text body.",
    );
  }

  const normalized =
    text.trim();

  if (!normalized) {
    throw new Error(
      "Received commission email does not contain a plain-text body.",
    );
  }

  return normalized;
}

export function parseCommissionInboundEmail(
  email: CommissionInboundEmail,
): ParsedCommissionInboundEmail {
  const providerEmailId =
    normalizeRequiredValue(
      email.providerEmailId,
      "providerEmailId",
    );

  const providerMessageId =
    normalizeRequiredValue(
      email.providerMessageId,
      "providerMessageId",
    );

  const senderEmail =
    extractCommissionInboundSenderEmail(
      email.from,
    );

  const recipientEmails =
    normalizeRecipientEmails(
      email.to,
    );

  if (
    recipientEmails.length ===
    0
  ) {
    throw new Error(
      "Received commission email does not contain a recipient.",
    );
  }

  const subject =
    normalizeRequiredValue(
      email.subject,
      "subject",
    );

  const messageText =
    normalizeMessageText(
      email.text,
    );

  const inReplyToMessageId =
    getCommissionInboundHeader(
      email.headers,
      "In-Reply-To",
    );

  const referencesHeader =
    getCommissionInboundHeader(
      email.headers,
      "References",
    );

  if (
    !(email.receivedAt instanceof Date) ||
    Number.isNaN(
      email.receivedAt.getTime(),
    )
  ) {
    throw new Error(
      "Received commission email receivedAt is invalid.",
    );
  }

  return {
    providerEmailId,
    providerMessageId,
    senderEmail,
    recipientEmails,
    subject,
    messageText,
    inReplyToMessageId,
    referencesHeader,
    receivedAt:
      new Date(
        email.receivedAt.getTime(),
      ),
  };
}