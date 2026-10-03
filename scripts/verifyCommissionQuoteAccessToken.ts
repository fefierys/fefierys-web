import {
  generatePublicQuoteToken,
  hashPublicQuoteToken,
  isValidPublicQuoteToken,
} from "../lib/commissions/commissionQuoteAccessToken";

function assert(
  condition: boolean,
  message: string,
): void {
  if (!condition) {
    throw new Error(message);
  }
}

process.env.PUBLIC_QUOTE_TOKEN_SECRET =
  "verification-only-public-quote-secret-32-bytes-minimum";

const firstQuoteId =
  "00000000-0000-4000-8000-000000000001";

const secondQuoteId =
  "00000000-0000-4000-8000-000000000002";

const token =
  generatePublicQuoteToken(
    firstQuoteId,
  );

const repeatedToken =
  generatePublicQuoteToken(
    firstQuoteId,
  );

const secondToken =
  generatePublicQuoteToken(
    secondQuoteId,
  );

assert(
  isValidPublicQuoteToken(token),
  "Generated token must have a valid public quote token format.",
);

assert(
  isValidPublicQuoteToken(secondToken),
  "Second generated token must have a valid public quote token format.",
);

assert(
  token === repeatedToken,
  "The same quote ID must reproduce the same public quote token.",
);

assert(
  token !== secondToken,
  "Different quote IDs must produce different public quote tokens.",
);

const hash =
  hashPublicQuoteToken(
    token,
  );

const repeatedHash =
  hashPublicQuoteToken(
    repeatedToken,
  );

const secondHash =
  hashPublicQuoteToken(
    secondToken,
  );

assert(
  /^[a-f0-9]{64}$/.test(hash),
  "Public quote token hash must be a 64-character lowercase SHA-256 digest.",
);

assert(
  hash === repeatedHash,
  "Hashing the reproduced token must remain deterministic.",
);

assert(
  hash !== secondHash,
  "Different public quote tokens must produce different hashes.",
);

assert(
  !isValidPublicQuoteToken(
    "invalid",
  ),
  "Malformed tokens must be rejected.",
);

console.log(
  "[OK] Generated public quote token has the expected format",
);

console.log(
  "[OK] Same quote ID reproduces the same token",
);

console.log(
  "[OK] Different quote IDs produce different tokens",
);

console.log(
  "[OK] SHA-256 digest has the expected format",
);

console.log(
  "[OK] Hashing is deterministic",
);

console.log(
  "[OK] Different tokens produce different hashes",
);

console.log(
  "[OK] Malformed public quote tokens are rejected",
);