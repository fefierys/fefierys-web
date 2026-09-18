import { Resend } from "resend";

export interface CommissionInboundEmail {
  providerEmailId: string;
  providerMessageId: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  headers: Record<string, string>;
  receivedAt: Date;
}

export interface CommissionInboundEmailProvider {
  getReceivedEmail(
    providerEmailId: string,
  ): Promise<CommissionInboundEmail>;
}

function getRequiredInboundEnv(
  name: "RESEND_INBOUND_API_KEY",
): string {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} environment variable is not configured.`,
    );
  }

  return value;
}

function getInboundResendClient(): Resend {
  return new Resend(
    getRequiredInboundEnv(
      "RESEND_INBOUND_API_KEY",
    ),
  );
}

function normalizeRequiredString(
  value: unknown,
  fieldName: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(
      `Received email ${fieldName} is missing.`,
    );
  }

  return value.trim();
}

function normalizeStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string",
    )
    .map(
      (item) =>
        item.trim(),
    )
    .filter(Boolean);
}

function normalizeOptionalContent(
  value: unknown,
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  if (!value.trim()) {
    return null;
  }

  return value;
}

function normalizeHeaders(
  value: unknown,
): Record<string, string> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const headers:
    Record<string, string> = {};

  for (
    const [key, headerValue] of
    Object.entries(value)
  ) {
    if (
      typeof headerValue !==
      "string"
    ) {
      continue;
    }

    headers[key] =
      headerValue;
  }

  return headers;
}

function normalizeReceivedAt(
  value: unknown,
): Date {
  const raw =
    normalizeRequiredString(
      value,
      "created_at",
    );

  const receivedAt =
    new Date(raw);

  if (
    Number.isNaN(
      receivedAt.getTime(),
    )
  ) {
    throw new Error(
      "Received email created_at is invalid.",
    );
  }

  return receivedAt;
}

export const resendCommissionInboundEmailProvider:
  CommissionInboundEmailProvider = {
    async getReceivedEmail(
      providerEmailId,
    ) {
      const normalizedProviderEmailId =
        providerEmailId.trim();

      if (
        !normalizedProviderEmailId
      ) {
        throw new Error(
          "providerEmailId is required.",
        );
      }

      const resend =
        getInboundResendClient();

      const {
        data,
        error,
      } =
        await resend.emails.receiving.get(
          normalizedProviderEmailId,
        );

      if (error) {
        throw new Error(
          `Resend received email retrieval failed: ${error.message}`,
        );
      }

      if (!data) {
        throw new Error(
          "Resend received email retrieval returned no data.",
        );
      }

      return {
        providerEmailId:
          normalizedProviderEmailId,

        providerMessageId:
          normalizeRequiredString(
            data.message_id,
            "message_id",
          ),

        from:
          normalizeRequiredString(
            data.from,
            "from",
          ),

        to:
          normalizeStringArray(
            data.to,
          ),

        subject:
          normalizeRequiredString(
            data.subject,
            "subject",
          ),

        text:
          normalizeOptionalContent(
            data.text,
          ),

        html:
          normalizeOptionalContent(
            data.html,
          ),

        headers:
          normalizeHeaders(
            data.headers,
          ),

        receivedAt:
          normalizeReceivedAt(
            data.created_at,
          ),
      };
    },
  };