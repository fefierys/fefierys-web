import { randomUUID } from "node:crypto";
import { equal, ok } from "node:assert/strict";

import { config } from "dotenv";

config({ path: ".env.local" });

async function main(): Promise<void> {
  const { and, eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { commissionEvents, commissions, commissionStatusHistory } =
    await import("../lib/db/schema/commissions");
  const { createCommission, getCommissionById } =
    await import("../lib/repositories/commissionRepository");

  const portfolioSubmissionId = randomUUID();
  const contactSubmissionId = randomUUID();
  const unmatchedSubmissionId = randomUUID();
  const commissionIds: string[] = [];

  try {
    const portfolioResult = await createCommission({
      categorySnapshot: "COVERS",
      clientEmail: "automatic-portfolio@example.com",
      clientName: "Automatic Portfolio Classification",
      collectionSnapshot: "BOOK ART",
      initialMessage: "Temporary automatic portfolio fixture",
      optionSnapshot: "Full Wrap",
      requestSource: "portfolio",
      styleSnapshot: "SEMIREALISM",
      submissionId: portfolioSubmissionId,
    });
    commissionIds.push(portfolioResult.id);

    const portfolioCommission = await getCommissionById(portfolioResult.id);
    ok(portfolioCommission);
    equal(portfolioCommission.requestSource, "portfolio");
    equal(portfolioCommission.serviceClassification, "catalog");
    ok(portfolioCommission.pricingServiceId);
    ok(portfolioCommission.pricingOptionId);
    ok(portfolioCommission.classifiedAt);
    equal(portfolioCommission.classifiedBy, "client");
    equal(portfolioCommission.classifiedByAdminUserId, null);
    equal(
      portfolioCommission.classificationNote,
      "Automatically matched from the submitted portfolio selection.",
    );
    console.log(
      "[OK] Portfolio submission was classified from the active catalog",
    );

    const classificationEvents = await db
      .select()
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, portfolioResult.id),
          eq(commissionEvents.type, "commission_service_classified"),
        ),
      );
    equal(classificationEvents.length, 1);
    equal(classificationEvents[0]?.actor, "client");

    const metadata = classificationEvents[0]?.metadata;
    ok(metadata && typeof metadata === "object" && !Array.isArray(metadata));
    const metadataRecord = metadata as Record<string, unknown>;
    equal(metadataRecord.matchSource, "portfolio_submission");
    equal(
      metadataRecord.pricingServiceId,
      portfolioCommission.pricingServiceId,
    );
    equal(metadataRecord.pricingOptionId, portfolioCommission.pricingOptionId);
    console.log(
      "[OK] Automatic classification event contains stable catalog IDs",
    );

    const retryResult = await createCommission({
      categorySnapshot: "COVERS",
      clientEmail: "automatic-portfolio@example.com",
      clientName: "Automatic Portfolio Classification",
      collectionSnapshot: "BOOK ART",
      initialMessage: "Temporary automatic portfolio fixture",
      optionSnapshot: "Full Wrap",
      requestSource: "portfolio",
      styleSnapshot: "SEMIREALISM",
      submissionId: portfolioSubmissionId,
    });
    equal(retryResult.id, portfolioResult.id);
    equal(retryResult.wasCreated, false);

    const eventsAfterRetry = await db
      .select({ id: commissionEvents.id })
      .from(commissionEvents)
      .where(
        and(
          eq(commissionEvents.commissionId, portfolioResult.id),
          eq(commissionEvents.type, "commission_service_classified"),
        ),
      );
    equal(eventsAfterRetry.length, 1);
    console.log(
      "[OK] Retried submission created no duplicate classification event",
    );

    const contactResult = await createCommission({
      categorySnapshot: "Not specified",
      clientEmail: "automatic-contact@example.com",
      clientName: "Automatic Contact Classification",
      collectionSnapshot: "Not specified",
      initialMessage: "Temporary direct contact fixture",
      optionSnapshot: "Not specified",
      requestSource: "contact",
      styleSnapshot: "Not specified",
      submissionId: contactSubmissionId,
    });
    commissionIds.push(contactResult.id);

    const contactCommission = await getCommissionById(contactResult.id);
    ok(contactCommission);
    equal(contactCommission.requestSource, "contact");
    equal(contactCommission.serviceClassification, "unclassified");
    equal(contactCommission.pricingServiceId, null);
    equal(contactCommission.pricingOptionId, null);
    equal(contactCommission.classifiedAt, null);
    console.log("[OK] Direct contact submission remains unclassified");

    const unmatchedResult = await createCommission({
      categorySnapshot: "ENVIRONMENTS",
      clientEmail: "automatic-unmatched@example.com",
      clientName: "Automatic Unmatched Classification",
      collectionSnapshot: "GENERAL",
      initialMessage: "Temporary unmatched portfolio fixture",
      optionSnapshot: "Unknown Historical Option",
      requestSource: "portfolio",
      styleSnapshot: "SEMIREALISM",
      submissionId: unmatchedSubmissionId,
    });
    commissionIds.push(unmatchedResult.id);

    const unmatchedCommission = await getCommissionById(unmatchedResult.id);
    ok(unmatchedCommission);
    equal(unmatchedCommission.requestSource, "portfolio");
    equal(unmatchedCommission.serviceClassification, "unclassified");
    equal(unmatchedCommission.pricingServiceId, null);
    equal(unmatchedCommission.pricingOptionId, null);
    console.log(
      "[OK] Unmatched portfolio submission remains safe for manual review",
    );

    console.log("[OK] Automatic commission classification verification passed");
  } finally {
    if (commissionIds.length > 0) {
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

    console.log("[OK] Temporary automatic classification data was removed");
  }
}

main().catch((error: unknown) => {
  console.error(
    "Automatic commission classification verification failed:",
    error,
  );
  process.exitCode = 1;
});
