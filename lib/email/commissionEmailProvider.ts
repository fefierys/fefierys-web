import { resend } from "./emailClient";

export type CommissionEmailBody =
  | {
      html: string;
      text?: string | null;
    }
  | {
      html?: string | null;
      text: string;
    };

export interface CommissionEmailProviderSendInput {
  idempotencyKey: string;
  senderEmail: string;
  recipientEmail: string;
  replyToEmail: string | null;
  subject: string;
  body: CommissionEmailBody;
  inReplyToMessageId: string | null;
  referencesHeader: string | null;
}

export type CommissionEmailProviderSendResult =
  | {
      outcome: "sent";
      providerEmailId: string;
      providerMessageId: string | null;
    }
  | {
      outcome: "failed";
      failureMessage: string;
    };

export interface CommissionEmailProvider {
  send(
    input: CommissionEmailProviderSendInput,
  ): Promise<CommissionEmailProviderSendResult>;
}

export type CommissionEmailProviderMessageLookupResult =
  | {
      outcome: "found";
      providerMessageId: string;
    }
  | {
      outcome: "pending";
    }
  | {
      outcome: "failed";
      failureMessage: string;
    };

export interface CommissionEmailMessageLookupProvider {
  lookupMessageId(
    providerEmailId: string,
  ): Promise<CommissionEmailProviderMessageLookupResult>;
}

const MAX_SAFE_PROVIDER_ERROR_NAME_LENGTH = 80;

function safeProviderErrorName(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replaceAll(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, MAX_SAFE_PROVIDER_ERROR_NAME_LENGTH);

  return normalized || null;
}

function safeProviderStatusCode(
  value: unknown,
): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 100 &&
    value <= 599
    ? value
    : null;
}

function getSafeResendFailureMessage(
  error: unknown,
): string {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return "Resend delivery failed.";
  }

  const record = error as Record<string, unknown>;
  const name = safeProviderErrorName(record.name);
  const statusCode = safeProviderStatusCode(
    record.statusCode,
  );

  if (name && statusCode !== null) {
    return `Resend delivery failed (${name}, HTTP ${statusCode}).`;
  }

  if (name) {
    return `Resend delivery failed (${name}).`;
  }

  if (statusCode !== null) {
    return `Resend delivery failed (HTTP ${statusCode}).`;
  }

  return "Resend delivery failed.";
}

function getThreadHeaders(
  input: CommissionEmailProviderSendInput,
): Record<string, string> | undefined {
  const headers: Record<string, string> = {};

  if (input.inReplyToMessageId) {
    headers["In-Reply-To"] =
      input.inReplyToMessageId;
  }

  if (input.referencesHeader) {
    headers.References =
      input.referencesHeader;
  }

  return Object.keys(headers).length > 0
    ? headers
    : undefined;
}

function getRenderOptions(
  body: CommissionEmailBody,
):
  | {
      html: string;
      text?: string;
    }
  | {
      text: string;
    } {
  if (
    typeof body.html === "string" &&
    body.html.length > 0
  ) {
    return {
      html: body.html,
      ...(typeof body.text === "string" &&
      body.text.length > 0
        ? {
            text: body.text,
          }
        : {}),
    };
  }

  if (
    typeof body.text === "string" &&
    body.text.length > 0
  ) {
    return {
      text: body.text,
    };
  }

  throw new Error(
    "Commission email provider requires a non-empty HTML or text body.",
  );
}

export const resendCommissionEmailProvider:
  CommissionEmailProvider = {
    async send(
      input,
    ): Promise<CommissionEmailProviderSendResult> {
      const sendResult =
        await resend.emails.send(
          {
            from:
              `Fefierys <${input.senderEmail}>`,
            to: input.recipientEmail,
            ...(input.replyToEmail
              ? {
                  replyTo:
                    input.replyToEmail,
                }
              : {}),
            subject: input.subject,
            ...getRenderOptions(input.body),
            ...(getThreadHeaders(input)
              ? {
                  headers:
                    getThreadHeaders(input),
                }
              : {}),
          },
          {
            idempotencyKey:
              input.idempotencyKey,
          },
        );

      if (sendResult.error) {
        return {
          outcome: "failed",
          failureMessage:
            getSafeResendFailureMessage(
              sendResult.error,
            ),
        };
      }

      const providerEmailId =
        sendResult.data?.id;

      if (!providerEmailId) {
        return {
          outcome: "failed",
          failureMessage:
            "Resend delivery returned no email identifier.",
        };
      }

      /*
       * Resend exposes the RFC Message-ID through GET /emails/:id.
       *
       * A failure here does not mean the email failed to send, so the
       * provider email ID is still enough to mark delivery as sent.
       * Message-ID can be reconciled later from the provider ID.
       */
      try {
        const getResult =
          await resend.emails.get(
            providerEmailId,
          );

        if (!getResult.error) {
          return {
            outcome: "sent",
            providerEmailId,
            providerMessageId:
              getResult.data?.message_id ??
              null,
          };
        }
      } catch {
        /*
         * Do not turn a successfully accepted email into a failed delivery
         * just because Message-ID retrieval was temporarily unavailable.
         */
      }

      return {
        outcome: "sent",
        providerEmailId,
        providerMessageId: null,
      };
    },
  };


function getSafeResendLookupFailureMessage(
  error: unknown,
): string {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return "Resend message lookup failed.";
  }

  const record =
    error as Record<string, unknown>;
  const name =
    safeProviderErrorName(record.name);
  const statusCode =
    safeProviderStatusCode(
      record.statusCode,
    );

  if (
    name &&
    statusCode !== null
  ) {
    return `Resend message lookup failed (${name}, HTTP ${statusCode}).`;
  }

  if (name) {
    return `Resend message lookup failed (${name}).`;
  }

  if (statusCode !== null) {
    return `Resend message lookup failed (HTTP ${statusCode}).`;
  }

  return "Resend message lookup failed.";
}

function normalizeProviderEmailId(
  providerEmailId: string,
): string {
  const normalized =
    providerEmailId.trim();

  if (!normalized) {
    throw new Error(
      "providerEmailId is required.",
    );
  }

  return normalized;
}

export const resendCommissionEmailMessageLookupProvider:
  CommissionEmailMessageLookupProvider = {
    async lookupMessageId(
      providerEmailId,
    ): Promise<CommissionEmailProviderMessageLookupResult> {
      const normalizedProviderEmailId =
        normalizeProviderEmailId(
          providerEmailId,
        );

      try {
        const getResult =
          await resend.emails.get(
            normalizedProviderEmailId,
          );

        if (getResult.error) {
          return {
            outcome: "failed",
            failureMessage:
              getSafeResendLookupFailureMessage(
                getResult.error,
              ),
          };
        }

        const providerMessageId =
          getResult.data?.message_id?.trim();

        if (!providerMessageId) {
          return {
            outcome: "pending",
          };
        }

        return {
          outcome: "found",
          providerMessageId,
        };
      } catch {
        /*
         * Do not persist provider exception details. They may contain request
         * metadata or other information that should not enter failure logs.
         */
        return {
          outcome: "failed",
          failureMessage:
            "Resend message lookup failed unexpectedly.",
        };
      }
    },
  };
