import { randomUUID } from "node:crypto";

import { config } from "dotenv";

import {
  INITIAL_COMMISSION_PRICING_SERVICES,
  INITIAL_COMMISSION_PRICING_VERSION_NAME,
  INITIAL_INDIE_AUTHOR_DISCOUNT,
} from "../data/commissionPricingCatalog";

config({
  path: ".env.local",
});

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

  const existingVersionRows = await db
    .select({
      id: commissionPricingVersions.id,
      status: commissionPricingVersions.status,
    })
    .from(commissionPricingVersions)
    .where(
      eq(
        commissionPricingVersions.name,
        INITIAL_COMMISSION_PRICING_VERSION_NAME,
      ),
    )
    .limit(1);

  const existingVersion = existingVersionRows[0];

  if (existingVersion) {
    console.log(
      `[OK] Pricing catalog already exists (${existingVersion.id}, ${existingVersion.status})`,
    );
    return;
  }

  const categoryCodes = INITIAL_COMMISSION_PRICING_SERVICES.map(
    (service) => service.code,
  );
  const categoryRows = await db
    .select({
      code: portfolioCategories.code,
      id: portfolioCategories.id,
    })
    .from(portfolioCategories)
    .where(inArray(portfolioCategories.code, categoryCodes));

  const categoryIdByCode = new Map(
    categoryRows.map((category) => [category.code, category.id]),
  );
  const missingCategoryCodes = categoryCodes.filter(
    (code) => !categoryIdByCode.has(code),
  );

  if (missingCategoryCodes.length > 0) {
    throw new Error(
      `Portfolio categories are missing: ${missingCategoryCodes.join(", ")}`,
    );
  }

  const now = new Date();
  const versionId = randomUUID();
  const indieDiscountId = randomUUID();
  const serviceIdByCode = new Map(
    INITIAL_COMMISSION_PRICING_SERVICES.map((service) => [
      service.code,
      randomUUID(),
    ]),
  );
  const optionIdByKey = new Map<string, string>();
  const adjustmentIdByKey = new Map<string, string>();

  const versionValue: typeof commissionPricingVersions.$inferInsert = {
    createdAt: now,
    currency: "USD",
    id: versionId,
    name: INITIAL_COMMISSION_PRICING_VERSION_NAME,
    status: "draft",
    updatedAt: now,
  };

  const serviceValues: (typeof commissionPricingServices.$inferInsert)[] =
    INITIAL_COMMISSION_PRICING_SERVICES.map((service, serviceIndex) => ({
      code: service.code,
      createdAt: now,
      cta: service.cta,
      heroImage: service.heroImage,
      id: serviceIdByCode.get(service.code) as string,
      portfolioCategoryId: categoryIdByCode.get(service.code) as string,
      pricingVersionId: versionId,
      sortOrder: (serviceIndex + 1) * 10,
      subtitle: service.subtitle,
      title: service.title,
      updatedAt: now,
      visibility: "public",
    }));

  const optionValues: (typeof commissionPricingOptions.$inferInsert)[] = [];
  const adjustmentValues: (typeof commissionPricingAdjustments.$inferInsert)[] =
    [];
  const applicabilityValues: (typeof commissionPricingOptionAdjustments.$inferInsert)[] =
    [];

  for (const service of INITIAL_COMMISSION_PRICING_SERVICES) {
    const serviceId = serviceIdByCode.get(service.code) as string;

    for (const [optionIndex, pricingOption] of service.options.entries()) {
      const optionKey = `${service.code}:${pricingOption.code}`;
      const optionId = randomUUID();
      optionIdByKey.set(optionKey, optionId);
      optionValues.push({
        baseAmount: pricingOption.baseAmount,
        code: pricingOption.code,
        createdAt: now,
        description: pricingOption.description,
        id: optionId,
        publicLabel: pricingOption.publicLabel,
        quoteLabel: pricingOption.quoteLabel,
        requiresManualPriceConfirmation: false,
        serviceId,
        sortOrder: (optionIndex + 1) * 10,
        title: pricingOption.title,
        updatedAt: now,
        visibility: "public",
      });
    }

    for (const [adjustmentIndex, adjustment] of service.adjustments.entries()) {
      const adjustmentKey = `${service.code}:${adjustment.code}`;
      const adjustmentId = randomUUID();
      adjustmentIdByKey.set(adjustmentKey, adjustmentId);
      adjustmentValues.push({
        calculationBasis: adjustment.calculationBasis,
        calculationType: adjustment.calculationType,
        code: adjustmentKey,
        createdAt: now,
        description: adjustment.description,
        fixedAmount: adjustment.fixedAmount,
        id: adjustmentId,
        kind: adjustment.kind,
        isValueEditable: adjustment.isValueEditable,
        maxQuantity: adjustment.maxQuantity,
        maximumPercentageRate: adjustment.maximumPercentageRate,
        minimumPercentageRate: adjustment.minimumPercentageRate,
        name: adjustment.name,
        percentageRate: adjustment.percentageRate,
        pricingVersionId: versionId,
        requiresInternalNote: adjustment.requiresInternalNote,
        sortOrder: (adjustmentIndex + 1) * 10,
        stackable: adjustment.stackable,
        updatedAt: now,
        visibility: "public",
      });
    }
  }

  adjustmentValues.push({
    calculationBasis: INITIAL_INDIE_AUTHOR_DISCOUNT.calculationBasis,
    calculationType: INITIAL_INDIE_AUTHOR_DISCOUNT.calculationType,
    code: INITIAL_INDIE_AUTHOR_DISCOUNT.code,
    createdAt: now,
    description: INITIAL_INDIE_AUTHOR_DISCOUNT.description,
    fixedAmount: INITIAL_INDIE_AUTHOR_DISCOUNT.fixedAmount,
    id: indieDiscountId,
    kind: INITIAL_INDIE_AUTHOR_DISCOUNT.kind,
    isValueEditable: INITIAL_INDIE_AUTHOR_DISCOUNT.isValueEditable,
    maxQuantity: INITIAL_INDIE_AUTHOR_DISCOUNT.maxQuantity,
    maximumPercentageRate: INITIAL_INDIE_AUTHOR_DISCOUNT.maximumPercentageRate,
    minimumPercentageRate: INITIAL_INDIE_AUTHOR_DISCOUNT.minimumPercentageRate,
    name: INITIAL_INDIE_AUTHOR_DISCOUNT.name,
    percentageRate: INITIAL_INDIE_AUTHOR_DISCOUNT.percentageRate,
    pricingVersionId: versionId,
    requiresInternalNote: INITIAL_INDIE_AUTHOR_DISCOUNT.requiresInternalNote,
    sortOrder: 1000,
    stackable: INITIAL_INDIE_AUTHOR_DISCOUNT.stackable,
    updatedAt: now,
    visibility: "admin_only",
  });

  for (const service of INITIAL_COMMISSION_PRICING_SERVICES) {
    for (const pricingOption of service.options) {
      const optionId = optionIdByKey.get(
        `${service.code}:${pricingOption.code}`,
      ) as string;

      for (const adjustment of service.adjustments) {
        applicabilityValues.push({
          createdAt: now,
          id: randomUUID(),
          pricingAdjustmentId: adjustmentIdByKey.get(
            `${service.code}:${adjustment.code}`,
          ) as string,
          pricingOptionId: optionId,
        });
      }

      applicabilityValues.push({
        createdAt: now,
        id: randomUUID(),
        pricingAdjustmentId: indieDiscountId,
        pricingOptionId: optionId,
      });
    }
  }

  await db.batch([
    db.insert(commissionPricingVersions).values(versionValue),
    db.insert(commissionPricingServices).values(serviceValues),
    db.insert(commissionPricingOptions).values(optionValues),
    db.insert(commissionPricingAdjustments).values(adjustmentValues),
    db.insert(commissionPricingOptionAdjustments).values(applicabilityValues),
  ]);

  console.log(`[OK] Created draft pricing catalog ${versionId}`);
  console.log(`[OK] Services: ${serviceValues.length}`);
  console.log(`[OK] Options: ${optionValues.length}`);
  console.log(`[OK] Adjustments: ${adjustmentValues.length}`);
  console.log(`[OK] Applicability links: ${applicabilityValues.length}`);
}

main().catch((error: unknown) => {
  console.error("Commission pricing catalog seed failed:", error);
  process.exitCode = 1;
});
