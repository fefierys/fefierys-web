import {
  createHash,
  createHmac,
} from "node:crypto";

const PUBLIC_QUOTE_TOKEN_PREFIX = "qt_";
const PUBLIC_QUOTE_TOKEN_RANDOM_LENGTH = 43;

const PUBLIC_QUOTE_TOKEN_PATTERN = new RegExp(
  `^${PUBLIC_QUOTE_TOKEN_PREFIX}[A-Za-z0-9_-]{${PUBLIC_QUOTE_TOKEN_RANDOM_LENGTH}}$`,
);

const PUBLIC_QUOTE_TOKEN_SECRET_ENV =
  "PUBLIC_QUOTE_TOKEN_SECRET";

const PUBLIC_QUOTE_TOKEN_CONTEXT =
  "fefierys-public-quote-v1";

function getPublicQuoteTokenSecret(): string {
  const secret =
    process.env[
      PUBLIC_QUOTE_TOKEN_SECRET_ENV
    ]?.trim();

  if (!secret) {
    throw new Error(
      `${PUBLIC_QUOTE_TOKEN_SECRET_ENV} is required.`,
    );
  }

  if (
    Buffer.byteLength(
      secret,
      "utf8",
    ) < 32
  ) {
    throw new Error(
      `${PUBLIC_QUOTE_TOKEN_SECRET_ENV} must contain at least 32 bytes.`,
    );
  }

  return secret;
}

export function generatePublicQuoteToken(
  quoteId: string,
): string {
  const normalizedQuoteId =
    quoteId.trim();

  if (!normalizedQuoteId) {
    throw new Error(
      "quoteId is required to generate a public quote token.",
    );
  }

  const tokenPart =
    createHmac(
      "sha256",
      getPublicQuoteTokenSecret(),
    )
      .update(
        `${PUBLIC_QUOTE_TOKEN_CONTEXT}:${normalizedQuoteId}`,
        "utf8",
      )
      .digest("base64url");

  return `${PUBLIC_QUOTE_TOKEN_PREFIX}${tokenPart}`;
}

export function isValidPublicQuoteToken(token: string): boolean {
  return PUBLIC_QUOTE_TOKEN_PATTERN.test(token);
}

/*
 * Only this digest is persisted in commission_quotes.
 *
 * The original token must never be written to the database, logs,
 * events, analytics metadata, or error messages.
 */
export function hashPublicQuoteToken(token: string): string {
  if (!isValidPublicQuoteToken(token)) {
    throw new Error("Invalid public quote token.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}