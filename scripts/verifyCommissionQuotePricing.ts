import { deepEqual, equal } from "node:assert/strict";

import { buildCommissionQuotePricingSnapshot } from "../lib/commissions/commissionQuotePricing";

const option = {
  baseAmount: "450.00",
  description: "Front cover illustration",
  id: "option-cover",
  quoteLabel: "Front Cover — Book Covers",
};

const interiorOption = {
  baseAmount: "250.00",
  description: "Full-page interior illustration",
  id: "option-interior",
  quoteLabel: "Full Page — Book Interior",
};

const characterAdjustment = {
  calculationBasis: "none" as const,
  calculationType: "fixed" as const,
  description: "Additional illustrated character",
  fixedAmount: "80.00",
  id: "adjustment-character",
  isValueEditable: false,
  kind: "extra" as const,
  maxQuantity: null,
  maximumPercentageRate: null,
  minimumPercentageRate: null,
  name: "Additional Character",
  percentageRate: null,
  requiresInternalNote: false,
  stackable: true,
};

const indieDiscountAdjustment = {
  calculationBasis: "pre_discount_subtotal" as const,
  calculationType: "percentage" as const,
  description: "Independent author pricing",
  fixedAmount: null,
  id: "adjustment-indie",
  isValueEditable: true,
  kind: "discount" as const,
  maxQuantity: 1,
  maximumPercentageRate: "25.00",
  minimumPercentageRate: "5.00",
  name: "Indie Author Discount",
  percentageRate: "20.00",
  requiresInternalNote: true,
  stackable: false,
};

const customDiscountAdjustment = {
  calculationBasis: "none" as const,
  calculationType: "fixed" as const,
  description:
    "A manually selected fixed-amount discount for special agreements or other cases not covered by a predefined discount.",
  fixedAmount: "0.00",
  id: "adjustment-custom-discount",
  isValueEditable: true,
  kind: "discount" as const,
  maxQuantity: 1,
  maximumPercentageRate: null,
  minimumPercentageRate: null,
  name: "Custom Discount",
  percentageRate: null,
  requiresInternalNote: true,
  stackable: false,
};

const adjustments = [
  characterAdjustment,
  indieDiscountAdjustment,
  customDiscountAdjustment,
];

function main(): void {
  const catalogResult = buildCommissionQuotePricingSnapshot({
    mode: "catalog",
    pricingVersionId: "version-2026-1",
    option,
    adjustments,
    selectedAdjustments: [
      {
        adjustmentId: "adjustment-character",
        quantity: 1,
      },
      {
        adjustmentId: "adjustment-indie",
        internalNote: "Indie publishing budget confirmed.",
        percentageRate: "20.00",
        quantity: 1,
      },
    ],
    customItems: [
      {
        description: "Specific title treatment requested by the client",
        key: "custom-lettering",
        label: "Custom illustrated lettering",
        quantity: 1,
        unitAmount: "100.00",
      },
    ],
  });

  equal(catalogResult.valid, true);

  if (catalogResult.valid) {
    equal(catalogResult.snapshot.pricingMode, "catalog");
    equal(catalogResult.snapshot.pricingVersionId, "version-2026-1");
    equal(catalogResult.snapshot.baseSubtotal, "450.00");
    equal(catalogResult.snapshot.preDiscountSubtotal, "630.00");
    equal(catalogResult.snapshot.discountTotal, "126.00");
    equal(catalogResult.snapshot.totalAmount, "504.00");

    deepEqual(
      catalogResult.snapshot.items.map((item) => ({
        adjustmentId: item.pricingAdjustmentId,
        kind: item.kind,
        optionId: item.pricingOptionId,
        sequence: item.sequence,
        unitAmount: item.unitAmount,
      })),
      [
        {
          adjustmentId: null,
          kind: "base",
          optionId: "option-cover",
          sequence: 1,
          unitAmount: "450.00",
        },
        {
          adjustmentId: "adjustment-character",
          kind: "extra",
          optionId: "option-cover",
          sequence: 2,
          unitAmount: "80.00",
        },
        {
          adjustmentId: null,
          kind: "custom",
          optionId: null,
          sequence: 3,
          unitAmount: "100.00",
        },
        {
          adjustmentId: "adjustment-indie",
          kind: "discount",
          optionId: null,
          sequence: 4,
          unitAmount: "-126.00",
        },
      ],
    );

    equal(
      catalogResult.snapshot.items[3]?.internalNote,
      "Indie publishing budget confirmed.",
    );
  }

  console.log("[OK] Catalog selection produces an immutable pricing snapshot");

  const customResult = buildCommissionQuotePricingSnapshot({
    mode: "custom",
    customItems: [
      {
        key: "custom-service",
        label: "Custom commission service",
        quantity: 2,
        unitAmount: "175.00",
      },
    ],
  });

  equal(customResult.valid, true);

  if (customResult.valid) {
    equal(customResult.snapshot.pricingMode, "custom");
    equal(customResult.snapshot.pricingVersionId, null);
    equal(customResult.snapshot.baseSubtotal, "0.00");
    equal(customResult.snapshot.totalAmount, "350.00");
    equal(customResult.snapshot.items[0]?.kind, "custom");
  }

  console.log("[OK] Custom classification produces a custom quote snapshot");

  const unknownAdjustment = buildCommissionQuotePricingSnapshot({
    mode: "catalog",
    pricingVersionId: "version-2026-1",
    option,
    adjustments,
    selectedAdjustments: [
      {
        adjustmentId: "not-allowed",
        quantity: 1,
      },
    ],
  });

  equal(unknownAdjustment.valid, false);

  if (!unknownAdjustment.valid) {
    equal(unknownAdjustment.code, "adjustment_not_allowed");
  }

  console.log("[OK] Adjustments outside the selected option are rejected");

  const outOfRangeDiscount = buildCommissionQuotePricingSnapshot({
    mode: "catalog",
    pricingVersionId: "version-2026-1",
    option,
    adjustments,
    selectedAdjustments: [
      {
        adjustmentId: "adjustment-indie",
        internalNote: "Requested discount.",
        percentageRate: "30.00",
        quantity: 1,
      },
    ],
  });

  equal(outOfRangeDiscount.valid, false);

  if (!outOfRangeDiscount.valid) {
    equal(outOfRangeDiscount.code, "percentage_out_of_range");
  }

  console.log("[OK] Editable percentages stay within catalog limits");

  /*
   * ------------------------------------------------------------------
   * Custom Discount
   * ------------------------------------------------------------------
   *
   * Simulates a Bulk quote containing two different catalog options:
   *
   * Cover       450 USD
   * Full Page   250 USD
   * -------------------
   * Subtotal    700 USD
   *
   * Custom Discount:
   * -100 USD
   *
   * Final:
   * 600 USD
   */

  const customDiscountResult = buildCommissionQuotePricingSnapshot({
    mode: "catalog",
    pricingVersionId: "version-2026-2",
    catalogOptions: [
      {
        option,
        adjustments: [customDiscountAdjustment],
      },
      {
        option: interiorOption,
        adjustments: [customDiscountAdjustment],
      },
    ],
    illustrations: [
      {
        id: "illustration-cover",
        pricingOptionId: option.id,
        selectedAdjustments: [],
      },
      {
        id: "illustration-interior",
        pricingOptionId: interiorOption.id,
        selectedAdjustments: [],
      },
    ],
    selectedAdjustments: [],
    globalAdjustments: [
      {
        adjustmentId: customDiscountAdjustment.id,
        fixedAmount: "100.00",
        internalNote: "Special project discount agreed with the client.",
        quantity: 1,
      },
    ],
    customItems: [],
  });

  equal(customDiscountResult.valid, true);

  if (customDiscountResult.valid) {
    equal(customDiscountResult.snapshot.pricingMode, "catalog");
    equal(customDiscountResult.snapshot.pricingVersionId, "version-2026-2");

    equal(customDiscountResult.snapshot.baseSubtotal, "700.00");
    equal(customDiscountResult.snapshot.preDiscountSubtotal, "700.00");
    equal(customDiscountResult.snapshot.discountTotal, "100.00");
    equal(customDiscountResult.snapshot.totalAmount, "600.00");

    equal(customDiscountResult.snapshot.illustrations.length, 2);

    deepEqual(
      customDiscountResult.snapshot.items.map((item) => ({
        adjustmentId: item.pricingAdjustmentId,
        illustrationId: item.illustrationId,
        kind: item.kind,
        optionId: item.pricingOptionId,
        sequence: item.sequence,
        unitAmount: item.unitAmount,
      })),
      [
        {
          adjustmentId: null,
          illustrationId: "illustration-cover",
          kind: "base",
          optionId: "option-cover",
          sequence: 1,
          unitAmount: "450.00",
        },
        {
          adjustmentId: null,
          illustrationId: "illustration-interior",
          kind: "base",
          optionId: "option-interior",
          sequence: 2,
          unitAmount: "250.00",
        },
        {
          adjustmentId: "adjustment-custom-discount",
          illustrationId: null,
          kind: "discount",
          optionId: null,
          sequence: 3,
          unitAmount: "-100.00",
        },
      ],
    );

    const discountItem = customDiscountResult.snapshot.items[2];

    equal(discountItem?.calculationType, "fixed");
    equal(discountItem?.calculationBasis, "none");
    equal(discountItem?.percentageRate, null);
    equal(discountItem?.pricingOptionId, null);
    equal(discountItem?.illustrationId, null);
    equal(
      discountItem?.internalNote,
      "Special project discount agreed with the client.",
    );
  }

  console.log(
    "[OK] Custom Discount applies one editable fixed USD amount to the full quote",
  );

  const customDiscountWithoutAmount = buildCommissionQuotePricingSnapshot({
    mode: "catalog",
    pricingVersionId: "version-2026-2",
    catalogOptions: [
      {
        option,
        adjustments: [customDiscountAdjustment],
      },
      {
        option: interiorOption,
        adjustments: [customDiscountAdjustment],
      },
    ],
    illustrations: [
      {
        id: "illustration-cover",
        pricingOptionId: option.id,
        selectedAdjustments: [],
      },
      {
        id: "illustration-interior",
        pricingOptionId: interiorOption.id,
        selectedAdjustments: [],
      },
    ],
    selectedAdjustments: [],
    globalAdjustments: [
      {
        adjustmentId: customDiscountAdjustment.id,
        internalNote: "Special project discount.",
        quantity: 1,
      },
    ],
    customItems: [],
  });

  equal(customDiscountWithoutAmount.valid, false);

  if (!customDiscountWithoutAmount.valid) {
    equal(customDiscountWithoutAmount.code, "editable_fixed_amount_required");
  }

  console.log("[OK] Editable fixed discounts require an explicit amount");

  const negativeCustomDiscount = buildCommissionQuotePricingSnapshot({
    mode: "catalog",
    pricingVersionId: "version-2026-2",
    catalogOptions: [
      {
        option,
        adjustments: [customDiscountAdjustment],
      },
      {
        option: interiorOption,
        adjustments: [customDiscountAdjustment],
      },
    ],
    illustrations: [
      {
        id: "illustration-cover",
        pricingOptionId: option.id,
        selectedAdjustments: [],
      },
      {
        id: "illustration-interior",
        pricingOptionId: interiorOption.id,
        selectedAdjustments: [],
      },
    ],
    selectedAdjustments: [],
    globalAdjustments: [
      {
        adjustmentId: customDiscountAdjustment.id,
        fixedAmount: "-10.00",
        internalNote: "Invalid negative discount test.",
        quantity: 1,
      },
    ],
    customItems: [],
  });

  equal(negativeCustomDiscount.valid, false);

  if (!negativeCustomDiscount.valid) {
    equal(negativeCustomDiscount.code, "fixed_amount_invalid");
  }

  console.log("[OK] Editable fixed discounts reject negative amounts");

  const customDiscountWithoutNote = buildCommissionQuotePricingSnapshot({
    mode: "catalog",
    pricingVersionId: "version-2026-2",
    catalogOptions: [
      {
        option,
        adjustments: [customDiscountAdjustment],
      },
      {
        option: interiorOption,
        adjustments: [customDiscountAdjustment],
      },
    ],
    illustrations: [
      {
        id: "illustration-cover",
        pricingOptionId: option.id,
        selectedAdjustments: [],
      },
      {
        id: "illustration-interior",
        pricingOptionId: interiorOption.id,
        selectedAdjustments: [],
      },
    ],
    selectedAdjustments: [],
    globalAdjustments: [
      {
        adjustmentId: customDiscountAdjustment.id,
        fixedAmount: "100.00",
        quantity: 1,
      },
    ],
    customItems: [],
  });

  equal(customDiscountWithoutNote.valid, false);

  if (!customDiscountWithoutNote.valid) {
    equal(customDiscountWithoutNote.code, "pricing_invalid");
  }

  console.log("[OK] Custom Discount requires an internal reason");

  const nonEditableFixedOverride = buildCommissionQuotePricingSnapshot({
    mode: "catalog",
    pricingVersionId: "version-2026-1",
    option,
    adjustments,
    selectedAdjustments: [
      {
        adjustmentId: characterAdjustment.id,
        fixedAmount: "90.00",
        quantity: 1,
      },
    ],
  });

  equal(nonEditableFixedOverride.valid, false);

  if (!nonEditableFixedOverride.valid) {
    equal(nonEditableFixedOverride.code, "fixed_amount_not_editable");
  }

  console.log("[OK] Non-editable fixed catalog amounts cannot be overridden");

  console.log("[OK] Commission quote pricing snapshot verification passed");
}

main();
