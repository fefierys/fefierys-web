import { createHash, randomBytes } from "node:crypto";

const PUBLIC_QUOTE_TOKEN_PREFIX = "qt_";
const PUBLIC_QUOTE_TOKEN_BYTES = 32;
const PUBLIC_QUOTE_TOKEN_RANDOM_LENGTH = 43;

const PUBLIC_QUOTE_TOKEN_PATTERN = new RegExp(
  `^${PUBLIC_QUOTE_TOKEN_PREFIX}[A-Za-z0-9_-]{${PUBLIC_QUOTE_TOKEN_RANDOM_LENGTH}}$`,
);

/*
 * 32 cryptographically-random bytes provide 256 bits of entropy.
 *
 * base64url keeps the resulting token safe to place directly in a URL
 * path without additional encoding.
 *
 * Example:
 * qt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 */
export function generatePublicQuoteToken(): string {
  const randomPart = randomBytes(PUBLIC_QUOTE_TOKEN_BYTES).toString("base64url");

  return `${PUBLIC_QUOTE_TOKEN_PREFIX}${randomPart}`;
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