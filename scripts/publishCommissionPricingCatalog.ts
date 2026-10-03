import { config } from "dotenv";

import { INITIAL_COMMISSION_PRICING_VERSION_NAME } from "../data/commissionPricingCatalog";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { commissionPricingVersions } =
    await import("../lib/db/schema/commissionPricing");
  const { publishCommissionPricingVersion } =
    await import("../lib/repositories/commissionPricingRepository");

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

  if (!version) {
    throw new Error(
      `Pricing catalog ${INITIAL_COMMISSION_PRICING_VERSION_NAME} was not found.`,
    );
  }

  const result = await publishCommissionPricingVersion({
    expectedUpdatedAt: version.updatedAt,
    versionId: version.id,
  });

  if (result.outcome === "published") {
    console.log(`[OK] Published pricing catalog ${result.version.id}`);
    console.log(
      `[OK] Effective from ${result.version.effectiveFrom?.toISOString()}`,
    );
    return;
  }

  if (result.outcome === "already_active") {
    console.log(
      `[OK] Pricing catalog is already active (${result.version.id})`,
    );
    return;
  }

  throw new Error(
    `Pricing catalog publication failed: ${JSON.stringify(result)}`,
  );
}

main().catch((error: unknown) => {
  console.error("Commission pricing catalog publication failed:", error);
  process.exitCode = 1;
});
