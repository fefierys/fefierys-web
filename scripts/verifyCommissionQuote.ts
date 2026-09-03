import { deepEqual, equal, ok } from "node:assert/strict";

import {
  COMMISSION_QUOTE_STATUSES,
  COMMISSION_QUOTE_STATUS_TRANSITIONS,
  MAX_COMMISSION_QUOTE_ITEMS,
  TERMINAL_COMMISSION_QUOTE_STATUSES,
  formatCommissionQuoteAmount,
  getAllowedCommissionQuoteTransitions,
  isCommissionQuoteStatus,
  isTerminalCommissionQuoteStatus,
  parseCommissionQuoteAmount,
  validateCommissionQuoteDraft,
  validateCommissionQuoteTransition,
} from "../lib/commissions/commissionQuote";
import { quoteStatusEnum } from "../lib/db/schema/commissions";

function main(): void {
  deepEqual([...COMMISSION_QUOTE_STATUSES], [...quoteStatusEnum.enumValues]);

  for (const status of COMMISSION_QUOTE_STATUSES) {
    ok(isCommissionQuoteStatus(status));
    deepEqual(
      getAllowedCommissionQuoteTransitions(status),
      COMMISSION_QUOTE_STATUS_TRANSITIONS[status],
    );
  }

  ok(!isCommissionQuoteStatus("unknown"));

  console.log("[OK] Quote rules cover every database status");

  for (const status of TERMINAL_COMMISSION_QUOTE_STATUSES) {
    ok(isTerminalCommissionQuoteStatus(status));
    equal(getAllowedCommissionQuoteTransitions(status).length, 0);
  }

  ok(!isTerminalCommissionQuoteStatus("draft"));
  ok(!isTerminalCommissionQuoteStatus("sent"));

  console.log("[OK] Terminal quote statuses are immutable");

  equal(parseCommissionQuoteAmount("450"), BigInt(45_000));

  equal(parseCommissionQuoteAmount("450.5"), BigInt(45_050));

  equal(parseCommissionQuoteAmount("-60.25"), BigInt(-6_025));

  equal(formatCommissionQuoteAmount(BigInt(45_050)), "450.50");

  equal(formatCommissionQuoteAmount(BigInt(-6_025)), "-60.25");

  equal(parseCommissionQuoteAmount("1.234"), null);
  equal(parseCommissionQuoteAmount("12 USD"), null);
  equal(parseCommissionQuoteAmount(""), null);
  equal(parseCommissionQuoteAmount("10000000000"), null);

  console.log("[OK] Quote money parsing is exact");

  const validDraft = validateCommissionQuoteDraft({
    currency: " usd ",
    description: "  Character illustration  ",
    notes: "  Indie author pricing  ",
    validUntil: new Date("2030-01-15T12:00:00.000Z"),
    items: [
      {
        label: " Full illustration ",
        description: " Full render ",
        quantity: 1,
        unitAmount: "450",
      },
      {
        label: "Additional character",
        quantity: 2,
        unitAmount: "80.00",
      },
      {
        label: "Indie author adjustment",
        quantity: 1,
        unitAmount: "-60",
      },
    ],
  });

  ok(validDraft.valid);

  if (validDraft.valid) {
    equal(validDraft.currency, "USD");
    equal(validDraft.description, "Character illustration");
    equal(validDraft.notes, "Indie author pricing");
    equal(validDraft.totalAmount, "550.00");
    equal(validDraft.items.length, 3);
    equal(validDraft.items[0]?.sequence, 1);
    equal(validDraft.items[0]?.label, "Full illustration");
    equal(validDraft.items[0]?.unitAmount, "450.00");
    equal(validDraft.items[1]?.lineAmount, "160.00");
    equal(validDraft.items[2]?.lineAmount, "-60.00");
  }

  const exactDecimalDraft = validateCommissionQuoteDraft({
    currency: "USD",
    items: [
      {
        label: "First decimal",
        quantity: 1,
        unitAmount: "0.10",
      },
      {
        label: "Second decimal",
        quantity: 1,
        unitAmount: "0.20",
      },
    ],
  });

  ok(exactDecimalDraft.valid);

  if (exactDecimalDraft.valid) {
    equal(exactDecimalDraft.totalAmount, "0.30");
  }

  console.log("[OK] Quote items and totals are normalized exactly");

  const invalidCurrency = validateCommissionQuoteDraft({
    currency: "US",
    items: [
      {
        label: "Illustration",
        quantity: 1,
        unitAmount: "450",
      },
    ],
  });

  equal(invalidCurrency.valid, false);

  if (!invalidCurrency.valid) {
    equal(invalidCurrency.code, "currency_invalid");
  }

  const emptyDraft = validateCommissionQuoteDraft({
    currency: "USD",
    items: [],
  });

  equal(emptyDraft.valid, false);

  if (!emptyDraft.valid) {
    equal(emptyDraft.code, "items_required");
  }

  const invalidQuantity = validateCommissionQuoteDraft({
    currency: "USD",
    items: [
      {
        label: "Illustration",
        quantity: 0,
        unitAmount: "450",
      },
    ],
  });

  equal(invalidQuantity.valid, false);

  if (!invalidQuantity.valid) {
    equal(invalidQuantity.code, "item_quantity_invalid");
  }

  const invalidAmount = validateCommissionQuoteDraft({
    currency: "USD",
    items: [
      {
        label: "Illustration",
        quantity: 1,
        unitAmount: "450.999",
      },
    ],
  });

  equal(invalidAmount.valid, false);

  if (!invalidAmount.valid) {
    equal(invalidAmount.code, "item_amount_invalid");
  }

  const negativeTotal = validateCommissionQuoteDraft({
    currency: "USD",
    items: [
      {
        label: "Illustration",
        quantity: 1,
        unitAmount: "50",
      },
      {
        label: "Invalid discount",
        quantity: 1,
        unitAmount: "-60",
      },
    ],
  });

  equal(negativeTotal.valid, false);

  if (!negativeTotal.valid) {
    equal(negativeTotal.code, "quote_total_negative");
  }

  const tooManyItems = validateCommissionQuoteDraft({
    currency: "USD",
    items: Array.from(
      {
        length: MAX_COMMISSION_QUOTE_ITEMS + 1,
      },
      (_, index) => ({
        label: `Item ${index + 1}`,
        quantity: 1,
        unitAmount: "1",
      }),
    ),
  });

  equal(tooManyItems.valid, false);

  if (!tooManyItems.valid) {
    equal(tooManyItems.code, "too_many_items");
  }

  console.log("[OK] Invalid quote drafts are rejected");

  const now = new Date("2030-01-01T12:00:00.000Z");
  const future = new Date("2030-01-15T12:00:00.000Z");
  const past = new Date("2029-12-31T12:00:00.000Z");

  equal(
    validateCommissionQuoteTransition({
      fromStatus: "draft",
      toStatus: "sent",
      validUntil: future,
      now,
    }).valid,
    true,
  );

  const missingValidity = validateCommissionQuoteTransition({
    fromStatus: "draft",
    toStatus: "sent",
    validUntil: null,
    now,
  });

  equal(missingValidity.valid, false);

  if (!missingValidity.valid) {
    equal(missingValidity.code, "valid_until_required");
  }

  const pastValidity = validateCommissionQuoteTransition({
    fromStatus: "draft",
    toStatus: "sent",
    validUntil: past,
    now,
  });

  equal(pastValidity.valid, false);

  if (!pastValidity.valid) {
    equal(pastValidity.code, "valid_until_not_future");
  }

  equal(
    validateCommissionQuoteTransition({
      fromStatus: "sent",
      toStatus: "accepted",
      validUntil: future,
      now,
    }).valid,
    true,
  );

  const expiredAcceptance = validateCommissionQuoteTransition({
    fromStatus: "sent",
    toStatus: "accepted",
    validUntil: past,
    now,
  });

  equal(expiredAcceptance.valid, false);

  if (!expiredAcceptance.valid) {
    equal(expiredAcceptance.code, "quote_expired");
  }

  for (const toStatus of ["declined", "superseded"] as const) {
    equal(
      validateCommissionQuoteTransition({
        fromStatus: "sent",
        toStatus,
        validUntil: future,
        now,
      }).valid,
      true,
    );
  }

  equal(
    validateCommissionQuoteTransition({
      fromStatus: "sent",
      toStatus: "expired",
      validUntil: past,
      now,
    }).valid,
    true,
  );

  const earlyExpiration = validateCommissionQuoteTransition({
    fromStatus: "sent",
    toStatus: "expired",
    validUntil: future,
    now,
  });

  equal(earlyExpiration.valid, false);

  if (!earlyExpiration.valid) {
    equal(earlyExpiration.code, "quote_not_expired");
  }

  const expirationWithoutValidity = validateCommissionQuoteTransition({
    fromStatus: "sent",
    toStatus: "expired",
    validUntil: null,
    now,
  });

  equal(expirationWithoutValidity.valid, false);

  if (!expirationWithoutValidity.valid) {
    equal(expirationWithoutValidity.code, "quote_not_expired");
  }

  const forbiddenTransition = validateCommissionQuoteTransition({
    fromStatus: "draft",
    toStatus: "accepted",
    validUntil: future,
    now,
  });

  equal(forbiddenTransition.valid, false);

  if (!forbiddenTransition.valid) {
    equal(forbiddenTransition.code, "quote_transition_not_allowed");
  }

  console.log("[OK] Quote lifecycle transitions are valid");

  console.log("[OK] Commission quote verification passed");
}

main();
