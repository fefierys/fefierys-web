import { equal } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({ path: ".env.local" });

async function main(): Promise<void> {
  const { inArray } = await import("drizzle-orm");
  const { buildCommissionQuotePricingSnapshot } =
    await import("../lib/commissions/commissionQuotePricing");
  const { db } = await import("../lib/db");
  const {
    commissionEvents,
    commissionQuoteItems,
    commissionQuotes,
    commissions,
    commissionStatusHistory,
  } = await import("../lib/db/schema/commissions");
  const { createCommission } =
    await import("../lib/repositories/commissionRepository");
  const { getActiveCommissionPricingCatalog } =
    await import("../lib/repositories/commissionPricingRepository");
  const {
    createCommissionQuoteDraft,
    getCommissionQuoteById,
    updateCommissionQuoteDraft,
  } = await import("../lib/repositories/commissionQuoteRepository");
  const { transitionCommissionStatus } =
    await import("../lib/repositories/commissionWorkflowRepository");

  const verificationId = randomUUID();
  const commissionIds: string[] = [];

  async function createQuotingCommission(label: string): Promise<string> {
    const commission = await createCommission({
      clientEmail: `quote-pricing-${label}-${verificationId}@example.com`,
      clientName: `Quote Pricing ${label}`,
      initialMessage: `Temporary quote pricing verification ${verificationId}`,
      submissionId: randomUUID(),
      termsVersion: "2026.1",
    });
    commissionIds.push(commission.id);

    const review = await transitionCommissionStatus({
      changedByAdminUserId: "quote-pricing-verifier",
      commissionId: commission.id,
      fromStatus: "received",
      initiatedBy: "artist",
      toStatus: "under_review",
    });
    equal(review.outcome, "updated");

    const quoting = await transitionCommissionStatus({
      changedByAdminUserId: "quote-pricing-verifier",
      commissionId: commission.id,
      fromStatus: "under_review",
      initiatedBy: "artist",
      toStatus: "quoting",
    });
    equal(quoting.outcome, "updated");

    return commission.id;
  }

  try {
    const customCommissionId = await createQuotingCommission("Custom");
    const initialCustomSnapshot = buildCommissionQuotePricingSnapshot({
      mode: "custom",
      customItems: [
        {
          description: "Initial custom scope",
          key: "custom-service",
          label: "Custom illustration service",
          quantity: 1,
          unitAmount: "325.00",
        },
      ],
    });
    if (!initialCustomSnapshot.valid) {
      throw new Error(
        `Initial custom snapshot failed: ${initialCustomSnapshot.message}`,
      );
    }

    const createdCustom = await createCommissionQuoteDraft({
      commissionId: customCommissionId,
      createdByAdminUserId: "quote-pricing-verifier",
      description: "Custom quote snapshot",
      pricingSnapshot: initialCustomSnapshot.snapshot,
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    equal(createdCustom.outcome, "created");
    if (createdCustom.outcome !== "created") {
      throw new Error("The custom pricing draft was not created.");
    }

    equal(createdCustom.quote.pricingMode, "custom");
    equal(createdCustom.quote.pricingVersionId, null);
    equal(createdCustom.quote.baseSubtotal, "0.00");
    equal(createdCustom.quote.preDiscountSubtotal, "325.00");
    equal(createdCustom.quote.discountTotal, "0.00");
    equal(createdCustom.quote.totalAmount, "325.00");
    equal(createdCustom.items[0]?.kind, "custom");
    equal(createdCustom.items[0]?.calculationType, "fixed");
    equal(createdCustom.items[0]?.calculationBasis, "none");
    equal(createdCustom.items[0]?.pricingOptionId, null);
    console.log("[OK] Custom quote snapshot was stored atomically");

    const updatedCustomSnapshot = buildCommissionQuotePricingSnapshot({
      mode: "custom",
      customItems: [
        {
          description: "Expanded custom scope",
          key: "custom-service",
          label: "Expanded custom illustration service",
          quantity: 2,
          unitAmount: "200.00",
        },
      ],
    });
    if (!updatedCustomSnapshot.valid) {
      throw new Error(
        `Updated custom snapshot failed: ${updatedCustomSnapshot.message}`,
      );
    }

    const updatedCustom = await updateCommissionQuoteDraft({
      description: "Updated custom quote snapshot",
      expectedUpdatedAt: createdCustom.quote.updatedAt,
      pricingSnapshot: updatedCustomSnapshot.snapshot,
      quoteId: createdCustom.quote.id,
      updatedByAdminUserId: "quote-pricing-verifier",
      validUntil: createdCustom.quote.validUntil,
    });
    equal(updatedCustom.outcome, "updated");
    if (updatedCustom.outcome !== "updated") {
      throw new Error("The custom pricing draft was not updated.");
    }
    equal(updatedCustom.quote.totalAmount, "400.00");
    equal(updatedCustom.items[0]?.quantity, 2);
    equal(updatedCustom.items[0]?.unitAmount, "200.00");
    console.log("[OK] Custom quote snapshot and items were updated atomically");

    const legacyDowngrade = await updateCommissionQuoteDraft({
      currency: "USD",
      description: "This legacy update must be rejected",
      expectedUpdatedAt: updatedCustom.quote.updatedAt,
      items: [
        {
          label: "Legacy replacement",
          quantity: 1,
          unitAmount: "1.00",
        },
      ],
      quoteId: updatedCustom.quote.id,
      updatedByAdminUserId: "quote-pricing-verifier",
    });
    equal(legacyDowngrade.outcome, "conflict");

    const customAfterDowngrade = await getCommissionQuoteById(
      updatedCustom.quote.id,
    );
    equal(customAfterDowngrade?.quote.pricingMode, "custom");
    equal(customAfterDowngrade?.quote.totalAmount, "400.00");
    console.log("[OK] A priced draft cannot be downgraded to legacy");

    const catalog = await getActiveCommissionPricingCatalog({
      audience: "admin",
    });
    const catalogOption = catalog?.services
      .flatMap((service) => service.options)
      .find((candidate) => !candidate.option.requiresManualPriceConfirmation);

    if (!catalog || !catalogOption) {
      throw new Error("An active catalog option is required for verification.");
    }

    const catalogSnapshot = buildCommissionQuotePricingSnapshot({
      adjustments: catalogOption.adjustments,
      mode: "catalog",
      option: catalogOption.option,
      pricingVersionId: catalog.version.id,
      selectedAdjustments: [],
    });
    if (!catalogSnapshot.valid) {
      throw new Error(`Catalog snapshot failed: ${catalogSnapshot.message}`);
    }

    const catalogCommissionId = await createQuotingCommission("Catalog");
    const createdCatalog = await createCommissionQuoteDraft({
      commissionId: catalogCommissionId,
      createdByAdminUserId: "quote-pricing-verifier",
      description: "Catalog quote snapshot",
      pricingSnapshot: catalogSnapshot.snapshot,
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    equal(createdCatalog.outcome, "created");
    if (createdCatalog.outcome !== "created") {
      throw new Error("The catalog pricing draft was not created.");
    }
    equal(createdCatalog.quote.pricingMode, "catalog");
    equal(createdCatalog.quote.pricingVersionId, catalog.version.id);
    equal(createdCatalog.items[0]?.kind, "base");
    equal(createdCatalog.items[0]?.pricingOptionId, catalogOption.option.id);
    console.log("[OK] Catalog quote preserved its version and option IDs");

    const incompatibleUpdate = await updateCommissionQuoteDraft({
      expectedUpdatedAt: createdCatalog.quote.updatedAt,
      pricingSnapshot: initialCustomSnapshot.snapshot,
      quoteId: createdCatalog.quote.id,
      updatedByAdminUserId: "quote-pricing-verifier",
    });
    equal(incompatibleUpdate.outcome, "conflict");
    console.log("[OK] Draft pricing mode and catalog version are immutable");

    console.log("[OK] Commission quote pricing repository verification passed");
  } finally {
    if (commissionIds.length > 0) {
      await db
        .delete(commissionEvents)
        .where(inArray(commissionEvents.commissionId, commissionIds));

      const quoteRows = await db
        .select({ id: commissionQuotes.id })
        .from(commissionQuotes)
        .where(inArray(commissionQuotes.commissionId, commissionIds));
      const quoteIds = quoteRows.map((quote) => quote.id);

      if (quoteIds.length > 0) {
        await db
          .delete(commissionQuoteItems)
          .where(inArray(commissionQuoteItems.quoteId, quoteIds));
        await db
          .delete(commissionQuotes)
          .where(inArray(commissionQuotes.id, quoteIds));
      }

      await db
        .delete(commissionStatusHistory)
        .where(inArray(commissionStatusHistory.commissionId, commissionIds));
      await db
        .delete(commissions)
        .where(inArray(commissions.id, commissionIds));
    }

    console.log("[OK] Temporary quote pricing data was removed");
  }
}

main().catch((error: unknown) => {
  console.error(
    "Commission quote pricing repository verification failed:",
    error,
  );
  process.exitCode = 1;
});
