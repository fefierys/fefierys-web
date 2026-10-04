import {
  createHash,
  createHmac,
} from "node:crypto";

const PUBLIC_AGREEMENT_TOKEN_PREFIX = "ag_";
const PUBLIC_AGREEMENT_TOKEN_RANDOM_LENGTH = 43;

const PUBLIC_AGREEMENT_TOKEN_PATTERN = new RegExp(
  `^${PUBLIC_AGREEMENT_TOKEN_PREFIX}[A-Za-z0-9_-]{${PUBLIC_AGREEMENT_TOKEN_RANDOM_LENGTH}}$`,
);

const PUBLIC_AGREEMENT_TOKEN_SECRET_ENV =
  "COMMISSION_AGREEMENT_TOKEN_SECRET";

const PUBLIC_AGREEMENT_TOKEN_CONTEXT =
  "fefierys-public-agreement-v1";

function getPublicAgreementTokenSecret(): string {
  const secret =
    process.env[
      PUBLIC_AGREEMENT_TOKEN_SECRET_ENV
    ]?.trim();

  if (!secret) {
    throw new Error(
      `${PUBLIC_AGREEMENT_TOKEN_SECRET_ENV} is required.`,
    );
  }

  if (
    Buffer.byteLength(
      secret,
      "utf8",
    ) < 32
  ) {
    throw new Error(
      `${PUBLIC_AGREEMENT_TOKEN_SECRET_ENV} must contain at least 32 bytes.`,
    );
  }

  return secret;
}

export function generatePublicAgreementToken(
  agreementId: string,
): string {
  const normalizedAgreementId =
    agreementId.trim();

  if (!normalizedAgreementId) {
    throw new Error(
      "agreementId is required to generate a public Agreement token.",
    );
  }

  const tokenPart =
    createHmac(
      "sha256",
      getPublicAgreementTokenSecret(),
    )
      .update(
        `${PUBLIC_AGREEMENT_TOKEN_CONTEXT}:${normalizedAgreementId}`,
        "utf8",
      )
      .digest("base64url");

  return `${PUBLIC_AGREEMENT_TOKEN_PREFIX}${tokenPart}`;
}

export function isValidPublicAgreementToken(
  token: string,
): boolean {
  return PUBLIC_AGREEMENT_TOKEN_PATTERN.test(token);
}

/*
 * Only this SHA-256 digest is persisted in commission_agreements.
 *
 * The original token must never be written to the database, logs,
 * events, analytics metadata, or error messages.
 */
export function hashPublicAgreementToken(
  token: string,
): string {
  if (!isValidPublicAgreementToken(token)) {
    throw new Error(
      "Invalid public Agreement token.",
    );
  }

  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}