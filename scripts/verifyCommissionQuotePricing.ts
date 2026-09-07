import { deepEqual, equal } from "node:assert/strict";

import { buildCommissionQuotePricingSnapshot } from "../lib/commissions/commissionQuotePricing";

const option = {
  baseAmount: "450.00",
  description: "Front cover illustration",
  id: "option-cover",
  quoteLabel: "Front Cover — Book Covers",
};

const adjustments = [
  {
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
  },
  {
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
  },
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
          optionId: "option-cover",
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

  console.log("[OK] Commission quote pricing snapshot verification passed");
}

main();
