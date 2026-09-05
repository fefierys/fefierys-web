import { deepEqual, equal, ok } from "node:assert/strict";

import { config } from "dotenv";

import {
  INITIAL_COMMISSION_PRICING_SERVICES,
  INITIAL_COMMISSION_PRICING_VERSION_NAME,
  INITIAL_INDIE_AUTHOR_DISCOUNT,
} from "../data/commissionPricingCatalog";
import {
  formatCommissionQuoteAmount,
  parseCommissionQuoteAmount,
} from "../lib/commissions/commissionQuote";
import type {
  CommissionPricingAdjustment,
  CommissionPricingOptionWithAdjustments,
  CommissionPricingServiceWithOptions,
} from "../lib/repositories/commissionPricingRepository";

config({
  path: ".env.local",
});

function normalizeAmount(value: string): string {
  const minorUnits = parseCommissionQuoteAmount(value);
  ok(minorUnits !== null);
  return formatCommissionQuoteAmount(minorUnits);
}

async function main(): Promise<void> {
  const { eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { portfolioCategories } = await import("../lib/db/schema/portfolio");
  const {
    commissionPricingAdjustments,
    commissionPricingOptionAdjustments,
    commissionPricingOptions,
    commissionPricingServices,
    commissionPricingVersions,
  } = await import("../lib/db/schema/commissionPricing");
  const {
    getActiveCommissionPricingCatalog,
    getCommissionPricingCatalogByVersion,
  } = await import("../lib/repositories/commissionPricingRepository");

  const versionRows = await db
    .select()
    .from(commissionPricingVersions)
    .where(
      eq(
        commissionPricingVersions.name,
        INITIAL_COMMISSION_PRICING_VERSION_NAME,
      ),
    )
    .limit(1);
  const version = versionRows[0];

  ok(version, "The initial pricing catalog has not been seeded.");
  equal(version.status, "active");
  equal(version.currency, "USD");
  ok(version.publishedAt);
  ok(version.effectiveFrom);
  equal(version.effectiveUntil, null);
  equal(version.publishedAt.getTime(), version.effectiveFrom.getTime());
  console.log("[OK] Initial pricing version is active and published");

  const activeCatalog = await getActiveCommissionPricingCatalog({
    audience: "admin",
  });
  ok(activeCatalog);
  equal(activeCatalog.version.id, version.id);
  console.log("[OK] Active catalog lookup resolves the published version");

  const catalog = await getCommissionPricingCatalogByVersion({
    audience: "admin",
    versionId: version.id,
  });
  ok(catalog);

  equal(catalog.services.length, 16);
  equal(
    catalog.services.reduce(
      (total, service) => total + service.options.length,
      0,
    ),
    43,
  );
  console.log("[OK] Seeded catalog contains 16 services and 43 options");

  const categoryIds = catalog.services
    .map((service) => service.service.portfolioCategoryId)
    .filter((id): id is string => id !== null);
  equal(categoryIds.length, catalog.services.length);
  const categoryRows = await db
    .select({
      code: portfolioCategories.code,
      id: portfolioCategories.id,
    })
    .from(portfolioCategories)
    .where(inArray(portfolioCategories.id, categoryIds));
  const categoryCodeById = new Map(
    categoryRows.map((category) => [category.id, category.code]),
  );

  for (const [
    serviceIndex,
    expectedService,
  ] of INITIAL_COMMISSION_PRICING_SERVICES.entries()) {
    const actualService: CommissionPricingServiceWithOptions | undefined =
      catalog.services[serviceIndex];
    ok(actualService);
    equal(actualService.service.code, expectedService.code);
    equal(actualService.service.title, expectedService.title);
    equal(actualService.service.subtitle, expectedService.subtitle);
    equal(actualService.service.heroImage, expectedService.heroImage);
    equal(actualService.service.cta, expectedService.cta);
    equal(actualService.service.visibility, "public");
    equal(actualService.service.isActive, true);
    equal(
      categoryCodeById.get(actualService.service.portfolioCategoryId as string),
      expectedService.code,
    );

    equal(actualService.options.length, expectedService.options.length);

    for (const [
      optionIndex,
      expectedOption,
    ] of expectedService.options.entries()) {
      const actualOption: CommissionPricingOptionWithAdjustments | undefined =
        actualService.options[optionIndex];
      ok(actualOption);
      equal(actualOption.option.code, expectedOption.code);
      equal(actualOption.option.title, expectedOption.title);
      equal(actualOption.option.publicLabel, expectedOption.publicLabel);
      equal(actualOption.option.quoteLabel, expectedOption.quoteLabel);
      equal(actualOption.option.description, expectedOption.description);
      equal(
        actualOption.option.baseAmount,
        normalizeAmount(expectedOption.baseAmount),
      );
      equal(actualOption.option.visibility, "public");
      equal(actualOption.option.isActive, true);

      deepEqual(
        actualOption.adjustments.map(
          (adjustment: CommissionPricingAdjustment) => adjustment.code,
        ),
        [
          ...expectedService.adjustments.map(
            (adjustment) => `${expectedService.code}:${adjustment.code}`,
          ),
          INITIAL_INDIE_AUTHOR_DISCOUNT.code,
        ],
      );
    }
  }
  console.log("[OK] Every service is linked to its portfolio category");
  console.log("[OK] Every option, price, label, and description matches");
  console.log("[OK] Every option exposes exactly its allowed adjustments");

  const adjustmentRows = await db
    .select()
    .from(commissionPricingAdjustments)
    .where(eq(commissionPricingAdjustments.pricingVersionId, version.id));
  equal(adjustmentRows.length, 48);

  const indieDiscount = adjustmentRows.find(
    (adjustment) => adjustment.code === INITIAL_INDIE_AUTHOR_DISCOUNT.code,
  );
  ok(indieDiscount);
  equal(indieDiscount.kind, "discount");
  equal(indieDiscount.calculationType, "percentage");
  equal(indieDiscount.calculationBasis, "pre_discount_subtotal");
  equal(indieDiscount.percentageRate, "0.00");
  equal(indieDiscount.isValueEditable, true);
  equal(indieDiscount.minimumPercentageRate, "0.00");
  equal(indieDiscount.maximumPercentageRate, "100.00");
  equal(indieDiscount.maxQuantity, 1);
  equal(indieDiscount.requiresInternalNote, true);
  equal(indieDiscount.stackable, false);
  equal(indieDiscount.visibility, "admin_only");
  console.log("[OK] All 48 adjustments were stored correctly");
  console.log("[OK] Indie Author Discount rules were stored correctly");

  const optionRows = await db
    .select({ id: commissionPricingOptions.id })
    .from(commissionPricingOptions)
    .innerJoin(
      commissionPricingServices,
      eq(commissionPricingOptions.serviceId, commissionPricingServices.id),
    )
    .where(eq(commissionPricingServices.pricingVersionId, version.id));
  const optionIds = optionRows.map((pricingOption) => pricingOption.id);
  const applicabilityRows = await db
    .select({ id: commissionPricingOptionAdjustments.id })
    .from(commissionPricingOptionAdjustments)
    .where(
      inArray(commissionPricingOptionAdjustments.pricingOptionId, optionIds),
    );
  equal(applicabilityRows.length, 168);
  console.log("[OK] All 168 option-adjustment links were stored correctly");
  console.log("[OK] Seeded commission pricing catalog verification passed");
}

main().catch((error: unknown) => {
  console.error(
    "Seeded commission pricing catalog verification failed:",
    error,
  );
  process.exitCode = 1;
});
