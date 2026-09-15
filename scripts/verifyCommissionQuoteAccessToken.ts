import {
  generatePublicQuoteToken,
  hashPublicQuoteToken,
  isValidPublicQuoteToken,
} from "../lib/commissions/commissionQuoteAccessToken";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const token = generatePublicQuoteToken();
const secondToken = generatePublicQuoteToken();

assert(
  isValidPublicQuoteToken(token),
  "Generated token must have a valid public quote token format.",
);

assert(
  isValidPublicQuoteToken(secondToken),
  "Second generated token must have a valid public quote token format.",
);

assert(token !== secondToken, "Generated tokens must be unique.");

const hash = hashPublicQuoteToken(token);
const repeatedHash = hashPublicQuoteToken(token);
const secondHash = hashPublicQuoteToken(secondToken);

assert(
  /^[a-f0-9]{64}$/.test(hash),
  "Public quote token hash must be a 64-character lowercase SHA-256 digest.",
);

assert(hash === repeatedHash, "Hashing must be deterministic.");

assert(
  hash !== secondHash,
  "Different public quote tokens must produce different hashes.",
);

assert(
  !isValidPublicQuoteToken("invalid"),
  "Malformed tokens must be rejected.",
);

console.log("✓ generated public quote token has the expected format");
console.log("✓ generated tokens are distinct");
console.log("✓ SHA-256 digest has the expected format");
console.log("✓ hashing is deterministic");
console.log("✓ different tokens produce different hashes");
console.log("✓ malformed public quote tokens are rejected");