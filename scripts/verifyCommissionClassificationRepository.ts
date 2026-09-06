import { randomUUID } from "node:crypto";
import { deepEqual, equal, ok } from "node:assert/strict";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  const { and, eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const {
    commissionEvents,
    commissionQuotes,
    commissions,
    commissionStatusHistory,
  } = await import("../lib/db/schema/commissions");
  const { createCommission, getCommissionById } =
    await import("../lib/repositories/commissionRepository");
  const { classifyCommission } =
    await import("../lib/repositories/commissionClassificationRepository");
  const { getActiveCommissionPricingCatalog } =
    await import("../lib/repositories/commissionPricingRepository");

  const portfolioSubmissionId = randomUUID();
  const contactSubmissionId = randomUUID();
  const commissionIds: string[] = [];

  try {
    const catalog = await getActiveCommissionPricingCatalog({
      audience: "admin",
    });

    ok(catalog, "An active pricing catalog is required");
    ok(catalog.services.length >= 2, "At least two services are required");

    const selectedService = catalog.services[0];
    const mismatchedService = catalog.services[1];
    ok(selectedService);
    ok(mismatchedService);

    const selectedOption = selectedService.options[0];
    ok(selectedOption, "The selected service requires at least one option");

    const portfolioCommission = await createCommission({
      clientEmail: "classification-portfolio@example.com",
      clientName: "Classification Portfolio Verification",
      initialMessage: "Temporary portfolio classification fixture",
      optionSnapshot: selectedOption.option.publicLabel,
      submissionId: portfolioSubmissionId,
    });
    const contactCommission = await createCommission({
      clientEmail: "classification-contact@example.com",
      clientName: "Classification Contact Verification",
      initialMessage: "Temporary contact classification fixture",
      submissionId: contactSubmissionId,
    });
    commissionIds.push(portfolioCommission.id, contactCommission.id);

    const createdPortfolio = await getCommissionById(portfolioCommission.id);
    const createdContact = await getCommissionById(contactCommission.id);
    ok(createdPortfolio);
    ok(createdContact);
    equal(createdPortfolio.requestSource, "portfolio");
    equal(createdContact.requestSource, "contact");
    equal(createdPortfolio.serviceClassification, "unclassified");
    equal(createdContact.serviceClassification, "unclassified");
    console.log(
      "[OK] Request source is inferred without classifying the service",
    );

    const invalidResult = await classifyCommission({
      classification: "custom",
      commissionId: portfolioCommission.id,
      expectedUpdatedAt: createdPortfolio.updatedAt,
      note: "   ",
      updatedByAdminUserId: "classification-verifier",
    });
    equal(invalidResult.outcome, "invalid");

    const afterInvalid = await getCommissionById(portfolioCommission.id);
    ok(afterInvalid);
    equal(afterInvalid.serviceClassification, "unclassified");
    equal(
      afterInvalid.updatedAt.getTime(),
      createdPortfolio.updatedAt.getTime(),
    );
    console.log("[OK] Invalid custom classification produced no writes");

    const mismatchResult = await classifyCommission({
      classification: "catalog",
      commissionId: portfolioCommission.id,
      expectedUpdatedAt: createdPortfolio.updatedAt,
      pricingOptionId: selectedOption.option.id,
      pricingServiceId: mismatchedService.service.id,
      updatedByAdminUserId: "classification-verifier",
    });
    equal(mismatchResult.outcome, "option_service_mismatch");
    console.log("[OK] An option cannot be assigned to the wrong service");

    const catalogResult = await classifyCommission({
      classification: "catalog",
      commissionId: portfolioCommission.id,
      expectedUpdatedAt: createdPortfolio.updatedAt,
      note: "  Confirmed from the submitted portfolio request.  ",
      pricingOptionId: selectedOption.option.id,
      pricingServiceId: selectedService.service.id,
      updatedByAdminUserId: "classification-verifier",
    });
    equal(catalogResult.outcome, "classified");

    if (catalogResult.outcome !== "classified") {
      throw new Error("Catalog classification did not return its records");
    }

    equal(catalogResult.commission.serviceClassification, "catalog");
    equal(
      catalogResult.commission.pricingServiceId,
      selectedService.service.id,
    );
    equal(catalogResult.commission.pricingOptionId, selectedOption.option.id);
    equal(
      catalogResult.commission.classificationNote,
      "Confirmed from the submitted portfolio request.",
    );
    equal(catalogResult.commission.classifiedBy, "artist");
    equal(
      catalogResult.commission.classifiedByAdminUserId,
      "classification-verifier",
    );
    equal(catalogResult.event.type, "commission_service_classified");
    equal(catalogResult.event.actor, "artist");
    equal(catalogResult.event.createdByAdminUserId, "classification-verifier");
    deepEqual(catalogResult.event.metadata, {
      classification: "catalog",
      previousClassification: "unclassified",
      previousPricingOptionId: null,
      previousPricingServiceId: null,
      pricingOptionId: selectedOption.option.id,
      pricingServiceId: selectedService.service.id,
    });
    console.log(
      "[OK] Catalog classification updated commission and event atomically",
    );

    const staleResult = await classifyCommission({
      classification: "custom",
      commissionId: portfolioCommission.id,
      expectedUpdatedAt: createdPortfolio.updatedAt,
      note: "This attempt uses the stale original timestamp.",
      updatedByAdminUserId: "classification-verifier",
    });
    equal(staleResult.outcome, "conflict");
    console.log(
      "[OK] Stale classification was rejected without partial writes",
    );

    const customResult = await classifyCommission({
      classification: "custom",
      commissionId: portfolioCommission.id,
      expectedUpdatedAt: catalogResult.commission.updatedAt,
      note: "  Client requested a fully custom service.  ",
      updatedByAdminUserId: "classification-verifier",
    });
    equal(customResult.outcome, "classified");

    if (customResult.outcome !== "classified") {
      throw new Error("Custom classification did not return its records");
    }

    equal(customResult.commission.serviceClassification, "custom");
    equal(customResult.commission.pricingServiceId, null);
    equal(customResult.commission.pricingOptionId, null);
    equal(
      customResult.commission.classificationNote,
      "Client requested a fully custom service.",
    );
    deepEqual(customResult.event.metadata, {
      classification: "custom",
      previousClassification: "catalog",
      previousPricingOptionId: selectedOption.option.id,
      previousPricingServiceId: selectedService.service.id,
      pricingOptionId: null,
      pricingServiceId: null,
    });
    console.log("[OK] Reclassification to custom cleared catalog references");

    const classificationEvents = await db
      .select({ id: commissionEvents.id })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, portfolioCommission.id),
          eq(commissionEvents.type, "commission_service_classified"),
        ),
      );
    equal(classificationEvents.length, 2);
    console.log("[OK] Failed attempts created no classification events");

    await db.insert(commissionQuotes).values({
      commissionId: contactCommission.id,
      currency: "USD",
      status: "draft",
      totalAmount: "0.00",
      version: 1,
    });

    const legacyClassificationResult = await classifyCommission({
      classification: "catalog",
      commissionId: contactCommission.id,
      expectedUpdatedAt: createdContact.updatedAt,
      pricingOptionId: selectedOption.option.id,
      pricingServiceId: selectedService.service.id,
      updatedByAdminUserId: "classification-verifier",
    });
    equal(legacyClassificationResult.outcome, "classified");

    if (legacyClassificationResult.outcome !== "classified") {
      throw new Error(
        "Legacy commission classification did not return its records",
      );
    }

    equal(
      legacyClassificationResult.commission.serviceClassification,
      "catalog",
    );
    console.log("[OK] A legacy quoted commission can be classified once");

    const quoteBlockedResult = await classifyCommission({
      classification: "custom",
      commissionId: contactCommission.id,
      expectedUpdatedAt: legacyClassificationResult.commission.updatedAt,
      note: "A second classification must remain blocked.",
      updatedByAdminUserId: "classification-verifier",
    });
    equal(quoteBlockedResult.outcome, "quote_exists");

    const afterQuoteBlock = await getCommissionById(contactCommission.id);
    ok(afterQuoteBlock);
    equal(afterQuoteBlock.serviceClassification, "catalog");
    console.log("[OK] Quote history locks a completed legacy classification");

    const missingResult = await classifyCommission({
      classification: "custom",
      commissionId: randomUUID(),
      expectedUpdatedAt: new Date(),
      note: "Missing commission verification",
      updatedByAdminUserId: "classification-verifier",
    });
    equal(missingResult.outcome, "not_found");
    console.log("[OK] Missing commission classification returns not_found");

    console.log(
      "[OK] Commission classification repository verification passed",
    );
  } finally {
    if (commissionIds.length > 0) {
      await db
        .delete(commissionQuotes)
        .where(inArray(commissionQuotes.commissionId, commissionIds));
      await db
        .delete(commissionEvents)
        .where(inArray(commissionEvents.commissionId, commissionIds));
      await db
        .delete(commissionStatusHistory)
        .where(inArray(commissionStatusHistory.commissionId, commissionIds));
      await db
        .delete(commissions)
        .where(inArray(commissions.id, commissionIds));
    }

    console.log("[OK] Temporary classification data was removed");
  }
}

main().catch((error: unknown) => {
  console.error(
    "Commission classification repository verification failed:",
    error,
  );
  process.exitCode = 1;
});
