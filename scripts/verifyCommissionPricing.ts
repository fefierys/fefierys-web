import { deepEqual, equal, ok } from "node:assert/strict";

import {
  COMMISSION_PRICING_ADJUSTMENT_KINDS,
  COMMISSION_PRICING_CALCULATION_BASES,
  COMMISSION_PRICING_CALCULATION_TYPES,
  COMMISSION_PRICING_VERSION_STATUSES,
  COMMISSION_PRICING_VISIBILITIES,
  calculateCommissionPricing,
  isCommissionPricingAvailable,
  validateCommissionPricingAdjustmentDefinition,
  type CommissionPricingAdjustmentInput,
} from "../lib/commissions/commissionPricing";
import {
  commissionPricingAdjustmentKindEnum,
  commissionPricingCalculationBasisEnum,
  commissionPricingCalculationTypeEnum,
  commissionPricingVersionStatusEnum,
  commissionPricingVisibilityEnum,
} from "../lib/db/schema/commissionPricing";

function percentageAdjustment(
  input: Partial<CommissionPricingAdjustmentInput> &
    Pick<CommissionPricingAdjustmentInput, "key" | "kind" | "label">,
): CommissionPricingAdjustmentInput {
  return {
    baseItemKey: input.kind === "discount" ? null : "base",
    calculationBasis:
      input.kind === "extra"
        ? "base_price"
        : input.kind === "license"
          ? "base_plus_extras"
          : "pre_discount_subtotal",
    calculationType: "percentage",
    fixedAmount: null,
    internalNote: null,
    maxQuantity: input.kind === "discount" ? 1 : null,
    percentageRate: "20",
    quantity: 1,
    requiresInternalNote: false,
    stackable: input.kind !== "discount",
    ...input,
  };
}

function fixedAdjustment(
  input: Partial<CommissionPricingAdjustmentInput> &
    Pick<CommissionPricingAdjustmentInput, "key" | "kind" | "label">,
): CommissionPricingAdjustmentInput {
  return {
    baseItemKey: input.kind === "discount" ? null : "base",
    calculationBasis: "none",
    calculationType: "fixed",
    fixedAmount: "100",
    internalNote: null,
    maxQuantity: input.kind === "discount" ? 1 : 1,
    percentageRate: null,
    quantity: 1,
    requiresInternalNote: false,
    stackable: input.kind !== "discount",
    ...input,
  };
}

function main(): void {
  deepEqual(
    [...COMMISSION_PRICING_VERSION_STATUSES],
    [...commissionPricingVersionStatusEnum.enumValues],
  );
  deepEqual(
    [...COMMISSION_PRICING_VISIBILITIES],
    [...commissionPricingVisibilityEnum.enumValues],
  );
  deepEqual(
    [...COMMISSION_PRICING_ADJUSTMENT_KINDS],
    [...commissionPricingAdjustmentKindEnum.enumValues],
  );
  deepEqual(
    [...COMMISSION_PRICING_CALCULATION_TYPES],
    [...commissionPricingCalculationTypeEnum.enumValues],
  );
  deepEqual(
    [...COMMISSION_PRICING_CALCULATION_BASES],
    [...commissionPricingCalculationBasisEnum.enumValues],
  );
  console.log("[OK] Pricing rules cover every database enum value");

  const now = new Date("2030-12-15T12:00:00.000Z");

  equal(
    isCommissionPricingAvailable(
      {
        availableFrom: new Date("2030-12-01T00:00:00.000Z"),
        availableUntil: new Date("2031-01-01T00:00:00.000Z"),
        isActive: true,
      },
      now,
    ),
    true,
  );
  equal(
    isCommissionPricingAvailable(
      {
        availableFrom: new Date("2030-12-20T00:00:00.000Z"),
        availableUntil: null,
        isActive: true,
      },
      now,
    ),
    false,
  );
  equal(
    isCommissionPricingAvailable(
      {
        availableFrom: null,
        availableUntil: null,
        isActive: false,
      },
      now,
    ),
    false,
  );
  console.log("[OK] Seasonal pricing availability is valid");

  equal(
    validateCommissionPricingAdjustmentDefinition(
      fixedAdjustment({
        key: "merchandising",
        kind: "license",
        label: "Merchandising",
      }),
    ).valid,
    true,
  );
  equal(
    validateCommissionPricingAdjustmentDefinition(
      percentageAdjustment({
        key: "pet",
        kind: "extra",
        label: "Pet",
      }),
    ).valid,
    true,
  );
  equal(
    validateCommissionPricingAdjustmentDefinition(
      percentageAdjustment({
        calculationBasis: "pre_discount_subtotal",
        internalNote: "Agreed with the client.",
        key: "indie",
        kind: "discount",
        label: "Indie Author Discount",
        requiresInternalNote: true,
      }),
    ).valid,
    true,
  );

  const invalidExtraBasis = validateCommissionPricingAdjustmentDefinition(
    percentageAdjustment({
      calculationBasis: "pre_discount_subtotal",
      key: "invalid-extra",
      kind: "extra",
      label: "Invalid extra",
    }),
  );
  equal(invalidExtraBasis.valid, false);
  if (!invalidExtraBasis.valid) {
    equal(invalidExtraBasis.code, "calculation_basis_invalid");
  }
  console.log("[OK] Adjustment definitions and bases are valid");

  const completeQuote = calculateCommissionPricing({
    baseItems: [
      {
        key: "base",
        label: "Lineart — Character Design",
        quantity: 1,
        unitAmount: "60.00",
      },
    ],
    adjustments: [
      percentageAdjustment({
        key: "pet",
        kind: "extra",
        label: "Pet",
        percentageRate: "20",
      }),
      percentageAdjustment({
        key: "commercial",
        kind: "license",
        label: "Commercial Use",
        percentageRate: "50",
      }),
      fixedAdjustment({
        fixedAmount: "100",
        key: "merchandising",
        kind: "license",
        label: "Merchandising",
      }),
      percentageAdjustment({
        baseItemKey: null,
        calculationBasis: "pre_discount_subtotal",
        internalNote: "Indie publishing budget agreed with the client.",
        key: "indie",
        kind: "discount",
        label: "Indie Author Discount",
        percentageRate: "20",
        requiresInternalNote: true,
      }),
    ],
  });

  equal(completeQuote.valid, true);
  if (completeQuote.valid) {
    equal(completeQuote.baseSubtotal, "60.00");
    equal(completeQuote.preDiscountSubtotal, "208.00");
    equal(completeQuote.discountTotal, "41.60");
    equal(completeQuote.totalAmount, "166.40");
    deepEqual(
      completeQuote.items.map((item) => item.lineAmount),
      ["60.00", "12.00", "36.00", "100.00", "-41.60"],
    );
  }
  console.log("[OK] Complete subtotal and indie discount are exact");

  const repeatedExtra = calculateCommissionPricing({
    baseItems: [
      {
        key: "base",
        label: "Flat — Character Design",
        quantity: 1,
        unitAmount: "100",
      },
    ],
    adjustments: [
      percentageAdjustment({
        key: "characters",
        kind: "extra",
        label: "Character",
        maxQuantity: null,
        percentageRate: "50",
        quantity: 2,
      }),
    ],
  });

  equal(repeatedExtra.valid, true);
  if (repeatedExtra.valid) {
    equal(repeatedExtra.preDiscountSubtotal, "200.00");
    equal(repeatedExtra.totalAmount, "200.00");
  }
  console.log("[OK] Repeated percentage extras use the base price");

  const volumeDiscount = calculateCommissionPricing({
    baseItems: [
      {
        key: "base",
        label: "Cover — Book Covers",
        quantity: 10,
        unitAmount: "450",
      },
    ],
    adjustments: [
      fixedAdjustment({
        baseItemKey: "base",
        fixedAmount: "80",
        key: "character",
        kind: "extra",
        label: "Character",
      }),
      percentageAdjustment({
        baseItemKey: null,
        calculationBasis: "base_items",
        internalNote: "Volume price agreed for ten covers.",
        key: "volume-discount",
        kind: "discount",
        label: "Volume Discount",
        percentageRate: "10",
        requiresInternalNote: true,
      }),
    ],
  });

  equal(volumeDiscount.valid, true);
  if (volumeDiscount.valid) {
    equal(volumeDiscount.baseSubtotal, "4500.00");
    equal(volumeDiscount.preDiscountSubtotal, "4580.00");
    equal(volumeDiscount.discountTotal, "450.00");
    equal(volumeDiscount.totalAmount, "4130.00");
  }
  console.log("[OK] Future base-only volume discounts are supported");

  const exactHalf = calculateCommissionPricing({
    baseItems: [
      {
        key: "base",
        label: "Flat — Icon",
        quantity: 1,
        unitAmount: "45",
      },
    ],
    adjustments: [
      percentageAdjustment({
        key: "character",
        kind: "extra",
        label: "Character",
        percentageRate: "50",
      }),
    ],
  });

  equal(exactHalf.valid, true);
  if (exactHalf.valid) {
    equal(exactHalf.items[1]?.lineAmount, "22.50");
    equal(exactHalf.totalAmount, "67.50");
  }
  console.log("[OK] Percentage calculations preserve exact cents");

  const noteRequired = calculateCommissionPricing({
    baseItems: [
      {
        key: "base",
        label: "Lineart",
        quantity: 1,
        unitAmount: "60",
      },
    ],
    adjustments: [
      percentageAdjustment({
        baseItemKey: null,
        calculationBasis: "pre_discount_subtotal",
        internalNote: "",
        key: "indie",
        kind: "discount",
        label: "Indie Author Discount",
        percentageRate: "20",
        requiresInternalNote: true,
      }),
    ],
  });
  equal(noteRequired.valid, false);
  if (!noteRequired.valid) {
    equal(noteRequired.code, "internal_note_required");
  }

  const tooMany = calculateCommissionPricing({
    baseItems: [
      {
        key: "base",
        label: "Chibi",
        quantity: 1,
        unitAmount: "30",
      },
    ],
    adjustments: [
      fixedAdjustment({
        fixedAmount: "25",
        key: "background",
        kind: "extra",
        label: "Simple Background",
        maxQuantity: 1,
        quantity: 2,
      }),
    ],
  });
  equal(tooMany.valid, false);
  if (!tooMany.valid) {
    equal(tooMany.code, "adjustment_quantity_invalid");
  }
  console.log("[OK] Notes and quantity limits are enforced");

  const conflictingDiscounts = calculateCommissionPricing({
    baseItems: [
      {
        key: "base",
        label: "Cover",
        quantity: 1,
        unitAmount: "450",
      },
    ],
    adjustments: [
      percentageAdjustment({
        baseItemKey: null,
        calculationBasis: "pre_discount_subtotal",
        internalNote: "Indie discount.",
        key: "indie",
        kind: "discount",
        label: "Indie Author Discount",
        requiresInternalNote: true,
      }),
      percentageAdjustment({
        baseItemKey: null,
        calculationBasis: "base_items",
        internalNote: "Seasonal discount.",
        key: "seasonal",
        kind: "discount",
        label: "Seasonal Discount",
        percentageRate: "10",
        requiresInternalNote: true,
      }),
    ],
  });
  equal(conflictingDiscounts.valid, false);
  if (!conflictingDiscounts.valid) {
    equal(conflictingDiscounts.code, "non_stackable_discount_conflict");
  }
  console.log("[OK] Multiple non-stackable discounts are rejected");

  ok(completeQuote.valid && volumeDiscount.valid && exactHalf.valid);
  console.log("[OK] Commission pricing verification passed");
}

main();
