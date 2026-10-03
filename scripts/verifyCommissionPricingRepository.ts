import { randomUUID } from "node:crypto";
import { deepEqual, equal, ok } from "node:assert/strict";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  const { inArray } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const {
    commissionPricingAdjustments,
    commissionPricingOptionAdjustments,
    commissionPricingOptions,
    commissionPricingServices,
    commissionPricingVersions,
  } = await import("../lib/db/schema/commissionPricing");
  const { getCommissionPricingCatalogByVersion } =
    await import("../lib/repositories/commissionPricingRepository");

  const versionId = randomUUID();
  const publicServiceId = randomUUID();
  const adminServiceId = randomUUID();
  const publicOptionId = randomUUID();
  const adminOptionId = randomUUID();
  const futureOptionId = randomUUID();
  const petAdjustmentId = randomUUID();
  const indieAdjustmentId = randomUUID();
  const inactiveAdjustmentId = randomUUID();
  const now = new Date("2030-06-15T12:00:00.000Z");

  const optionIds = [publicOptionId, adminOptionId, futureOptionId];
  const adjustmentIds = [
    petAdjustmentId,
    indieAdjustmentId,
    inactiveAdjustmentId,
  ];

  try {
    await db.batch([
      db.insert(commissionPricingVersions).values({
        id: versionId,
        name: `Repository verification ${versionId}`,
        status: "draft",
      }),
      db.insert(commissionPricingServices).values([
        {
          code: "character-design",
          id: publicServiceId,
          pricingVersionId: versionId,
          sortOrder: 10,
          title: "Character Design",
          visibility: "public",
        },
        {
          code: "christmas-special",
          id: adminServiceId,
          pricingVersionId: versionId,
          sortOrder: 20,
          title: "Christmas Special",
          visibility: "admin_only",
        },
      ]),
      db.insert(commissionPricingOptions).values([
        {
          baseAmount: "60.00",
          code: "lineart",
          id: publicOptionId,
          publicLabel: "Lineart",
          quoteLabel: "Lineart — Character Design",
          serviceId: publicServiceId,
          sortOrder: 10,
          title: "Lineart",
          visibility: "public",
        },
        {
          baseAmount: "125.00",
          code: "seasonal-full-render",
          id: adminOptionId,
          publicLabel: "Seasonal Full Render",
          quoteLabel: "Full Render — Christmas Special",
          serviceId: adminServiceId,
          sortOrder: 10,
          title: "Seasonal Full Render",
          visibility: "admin_only",
        },
        {
          availableFrom: new Date("2030-07-01T00:00:00.000Z"),
          baseAmount: "180.00",
          code: "future-full-render",
          id: futureOptionId,
          publicLabel: "Future Full Render",
          quoteLabel: "Future Full Render — Character Design",
          serviceId: publicServiceId,
          sortOrder: 20,
          title: "Future Full Render",
          visibility: "public",
        },
      ]),
      db.insert(commissionPricingAdjustments).values([
        {
          calculationBasis: "base_price",
          calculationType: "percentage",
          code: "pet",
          id: petAdjustmentId,
          kind: "extra",
          maxQuantity: null,
          name: "Pet",
          percentageRate: "20.00",
          pricingVersionId: versionId,
          sortOrder: 10,
          visibility: "public",
        },
        {
          calculationBasis: "pre_discount_subtotal",
          calculationType: "percentage",
          code: "indie-author-discount",
          id: indieAdjustmentId,
          kind: "discount",
          maxQuantity: 1,
          name: "Indie Author Discount",
          percentageRate: "20.00",
          pricingVersionId: versionId,
          requiresInternalNote: true,
          sortOrder: 20,
          stackable: false,
          visibility: "admin_only",
        },
        {
          calculationBasis: "none",
          calculationType: "fixed",
          code: "inactive-merchandising",
          fixedAmount: "100.00",
          id: inactiveAdjustmentId,
          isActive: false,
          kind: "license",
          maxQuantity: 1,
          name: "Inactive Merchandising",
          pricingVersionId: versionId,
          sortOrder: 30,
          visibility: "public",
        },
      ]),
      db.insert(commissionPricingOptionAdjustments).values([
        {
          pricingAdjustmentId: petAdjustmentId,
          pricingOptionId: publicOptionId,
        },
        {
          pricingAdjustmentId: indieAdjustmentId,
          pricingOptionId: publicOptionId,
        },
        {
          pricingAdjustmentId: inactiveAdjustmentId,
          pricingOptionId: publicOptionId,
        },
        {
          pricingAdjustmentId: indieAdjustmentId,
          pricingOptionId: adminOptionId,
        },
      ]),
    ]);
    console.log("[OK] Temporary pricing catalog was created");

    const publicCatalog = await getCommissionPricingCatalogByVersion({
      at: now,
      audience: "public",
      versionId,
    });

    ok(publicCatalog);
    equal(publicCatalog.version.id, versionId);
    deepEqual(
      publicCatalog.services.map((entry) => entry.service.code),
      ["character-design"],
    );
    deepEqual(
      publicCatalog.services[0]?.options.map((entry) => entry.option.code),
      ["lineart"],
    );
    deepEqual(
      publicCatalog.services[0]?.options[0]?.adjustments.map(
        (adjustment) => adjustment.code,
      ),
      ["pet"],
    );
    console.log("[OK] Public catalog hides admin, future, and inactive rows");

    const adminCatalog = await getCommissionPricingCatalogByVersion({
      at: now,
      audience: "admin",
      versionId,
    });

    ok(adminCatalog);
    deepEqual(
      adminCatalog.services.map((entry) => entry.service.code),
      ["character-design", "christmas-special"],
    );
    deepEqual(
      adminCatalog.services[0]?.options.map((entry) => entry.option.code),
      ["lineart"],
    );
    deepEqual(
      adminCatalog.services[0]?.options[0]?.adjustments.map(
        (adjustment) => adjustment.code,
      ),
      ["pet", "indie-author-discount"],
    );
    deepEqual(
      adminCatalog.services[1]?.options[0]?.adjustments.map(
        (adjustment) => adjustment.code,
      ),
      ["indie-author-discount"],
    );
    console.log("[OK] Admin catalog includes admin-only rows");

    equal(
      await getCommissionPricingCatalogByVersion({
        versionId: randomUUID(),
      }),
      null,
    );
    equal(
      await getCommissionPricingCatalogByVersion({
        at: new Date("invalid"),
        versionId,
      }),
      null,
    );
    console.log("[OK] Missing versions and invalid dates return null");

    console.log("[OK] Commission pricing repository verification passed");
  } finally {
    await db
      .delete(commissionPricingOptionAdjustments)
      .where(
        inArray(commissionPricingOptionAdjustments.pricingOptionId, optionIds),
      );
    await db
      .delete(commissionPricingOptions)
      .where(inArray(commissionPricingOptions.id, optionIds));
    await db
      .delete(commissionPricingAdjustments)
      .where(inArray(commissionPricingAdjustments.id, adjustmentIds));
    await db
      .delete(commissionPricingServices)
      .where(
        inArray(commissionPricingServices.id, [
          publicServiceId,
          adminServiceId,
        ]),
      );
    await db
      .delete(commissionPricingVersions)
      .where(inArray(commissionPricingVersions.id, [versionId]));
    console.log("[OK] Temporary pricing catalog was removed");
  }
}

main().catch((error: unknown) => {
  console.error("Commission pricing repository verification failed:", error);
  process.exitCode = 1;
});
