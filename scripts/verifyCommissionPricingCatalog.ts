import { deepEqual, equal, ok } from "node:assert/strict";

import {
  INITIAL_COMMISSION_PRICING_SERVICES,
  INITIAL_COMMISSION_PRICING_VERSION_NAME,
  INITIAL_INDIE_AUTHOR_DISCOUNT,
} from "../data/commissionPricingCatalog";
import {
  validateCommissionPricingAdjustmentDefinition,
  type CommissionPricingAdjustmentDefinitionInput,
} from "../lib/commissions/commissionPricing";

const EXPECTED_OPTION_AMOUNTS: Record<string, readonly string[]> = {
  "semi-covers": ["450", "600"],
  "semi-interior-illustration": ["100", "150", "250", "350"],
  "semi-icons": ["35", "45", "60", "80"],
  "semi-character-design": ["60", "100", "140", "180"],
  "semi-character-illustrations": ["300", "350"],
  "semi-ref-sheets": ["240", "300", "500"],
  "semi-environments": ["250", "350"],
  "semi-pets": ["70", "120"],
  "sty-covers": ["350", "500"],
  "sty-interior-illustration": ["50", "100", "150", "250"],
  "sty-icons": ["40", "40"],
  "sty-character-design": ["50", "60"],
  "sty-character-illustrations": ["150", "180"],
  "sty-pets": ["25", "45"],
  characters: ["20", "30"],
  custom: ["10", "25", "30", "50"],
};

function adjustmentDefinition(adjustment: {
  calculationBasis: CommissionPricingAdjustmentDefinitionInput["calculationBasis"];
  calculationType: CommissionPricingAdjustmentDefinitionInput["calculationType"];
  fixedAmount: string | null;
  kind: CommissionPricingAdjustmentDefinitionInput["kind"];
  maxQuantity: number | null;
  percentageRate: string | null;
}): CommissionPricingAdjustmentDefinitionInput {
  return adjustment;
}

function main(): void {
  equal(INITIAL_COMMISSION_PRICING_VERSION_NAME, "Fefierys catalog 2026.1");
  equal(INITIAL_COMMISSION_PRICING_SERVICES.length, 16);
  equal(
    INITIAL_COMMISSION_PRICING_SERVICES.reduce(
      (total, service) => total + service.options.length,
      0,
    ),
    43,
  );
  console.log("[OK] Initial catalog contains 16 services and 43 options");

  deepEqual(
    INITIAL_COMMISSION_PRICING_SERVICES.map((service) => service.code),
    Object.keys(EXPECTED_OPTION_AMOUNTS),
  );

  const serviceCodes = new Set<string>();

  for (const service of INITIAL_COMMISSION_PRICING_SERVICES) {
    ok(!serviceCodes.has(service.code));
    serviceCodes.add(service.code);
    ok(service.title.trim());
    ok(service.subtitle.trim());
    ok(service.heroImage.startsWith("/images/commissions/"));
    ok(service.cta.trim());

    deepEqual(
      service.options.map((pricingOption) => pricingOption.baseAmount),
      EXPECTED_OPTION_AMOUNTS[service.code],
    );

    const optionCodes = new Set<string>();
    for (const pricingOption of service.options) {
      ok(!optionCodes.has(pricingOption.code));
      optionCodes.add(pricingOption.code);
      ok(pricingOption.publicLabel.includes(" — "));
      equal(pricingOption.quoteLabel, pricingOption.publicLabel);
      ok(!pricingOption.description?.includes("Example:"));
    }

    const adjustmentCodes = new Set<string>();
    for (const adjustment of service.adjustments) {
      ok(!adjustmentCodes.has(adjustment.code));
      adjustmentCodes.add(adjustment.code);
      equal(
        validateCommissionPricingAdjustmentDefinition(
          adjustmentDefinition(adjustment),
        ).valid,
        true,
      );
      equal(adjustment.isValueEditable, false);
      equal(adjustment.minimumPercentageRate, null);
      equal(adjustment.maximumPercentageRate, null);
      ok(!adjustment.description.includes("Example:"));
    }
  }
  console.log("[OK] Service, option, and adjustment identifiers are unique");
  console.log("[OK] Every initial price matches the approved manual list");
  console.log("[OK] Initial adjustment definitions are valid");

  for (const code of [
    "semi-covers",
    "semi-interior-illustration",
    "sty-covers",
    "sty-interior-illustration",
  ]) {
    const service = INITIAL_COMMISSION_PRICING_SERVICES.find(
      (candidate) => candidate.code === code,
    );
    ok(service);
    equal(
      service.adjustments.some(
        (adjustment) => adjustment.code === "commercial-use",
      ),
      false,
    );
  }
  console.log("[OK] Book art includes commercial use without an extra fee");

  const chibis = INITIAL_COMMISSION_PRICING_SERVICES.find(
    (service) => service.code === "characters",
  );
  const simpleBackground = chibis?.adjustments.find(
    (adjustment) => adjustment.code === "simple-background",
  );
  ok(simpleBackground);
  equal(simpleBackground.fixedAmount, "25");
  equal(simpleBackground.maxQuantity, 1);

  const environments = INITIAL_COMMISSION_PRICING_SERVICES.find(
    (service) => service.code === "semi-environments",
  );
  equal(environments?.options[1]?.title, "Structures & Interiors");

  const emotes = INITIAL_COMMISSION_PRICING_SERVICES.find(
    (service) => service.code === "custom",
  );
  deepEqual(
    emotes?.options.map((pricingOption) => pricingOption.quoteLabel),
    [
      "1 Emote — Custom Emote",
      "3 Emotes — Custom Emote",
      "5 Emotes — Custom Emote",
      "10 Emotes — Custom Emote",
    ],
  );
  equal(emotes?.adjustments.length, 0);
  console.log("[OK] Special labels and Simple Background are preserved");

  equal(
    validateCommissionPricingAdjustmentDefinition(
      adjustmentDefinition(INITIAL_INDIE_AUTHOR_DISCOUNT),
    ).valid,
    true,
  );
  equal(INITIAL_INDIE_AUTHOR_DISCOUNT.isValueEditable, true);
  equal(INITIAL_INDIE_AUTHOR_DISCOUNT.minimumPercentageRate, "0");
  equal(INITIAL_INDIE_AUTHOR_DISCOUNT.maximumPercentageRate, "100");
  equal(
    INITIAL_INDIE_AUTHOR_DISCOUNT.calculationBasis,
    "pre_discount_subtotal",
  );
  equal(INITIAL_INDIE_AUTHOR_DISCOUNT.requiresInternalNote, true);
  equal(INITIAL_INDIE_AUTHOR_DISCOUNT.stackable, false);
  console.log("[OK] Indie Author Discount is editable from 0% to 100%");
  console.log("[OK] Initial commission pricing catalog verification passed");
}

main();
