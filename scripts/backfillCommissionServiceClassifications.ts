import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({ path: ".env.local" });

type BackfillMode = "apply" | "dry-run";

interface BackfillWriteRow extends Record<string, unknown> {
  commission_id: string;
  event_id: string;
}

function getMode(): BackfillMode {
  const argumentsList = process.argv.slice(2);

  if (argumentsList.length === 0) {
    return "dry-run";
  }

  if (argumentsList.length === 1 && argumentsList[0] === "--apply") {
    return "apply";
  }

  throw new Error(
    "Usage: tsx scripts/backfillCommissionServiceClassifications.ts [--apply]",
  );
}

async function main(): Promise<void> {
  const mode = getMode();
  const { and, asc, eq, sql } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { commissionEvents, commissions } =
    await import("../lib/db/schema/commissions");
  const {
    createActiveCommissionPricingSnapshotMatcher,
    normalizeCommissionPricingSnapshot,
  } =
    await import("../lib/repositories/commissionPricingSnapshotMatcherRepository");

  const matcher = await createActiveCommissionPricingSnapshotMatcher();

  if (!matcher) {
    throw new Error("No active commission pricing catalog is available.");
  }

  const candidates = await db
    .select({
      categorySnapshot: commissions.categorySnapshot,
      collectionSnapshot: commissions.collectionSnapshot,
      id: commissions.id,
      optionSnapshot: commissions.optionSnapshot,
      reference: commissions.reference,
      requestSource: commissions.requestSource,
      styleSnapshot: commissions.styleSnapshot,
    })
    .from(commissions)
    .where(eq(commissions.serviceClassification, "unclassified"))
    .orderBy(asc(commissions.submittedAt), asc(commissions.id));

  const totals = {
    ambiguous: 0,
    classified: 0,
    conflicts: 0,
    incomplete: 0,
    noMatch: 0,
    sourceCorrections: 0,
  };

  console.log(`[INFO] Mode: ${mode}`);
  console.log(`[INFO] Unclassified commissions found: ${candidates.length}`);

  for (const candidate of candidates) {
    const normalizedOption = normalizeCommissionPricingSnapshot(
      candidate.optionSnapshot ?? "",
    );
    const hasCatalogSelectionSnapshot =
      normalizedOption !== "" && normalizedOption !== "notspecified";

    const desiredSource = hasCatalogSelectionSnapshot
      ? "commissions"
      : "contact";
    const needsSourceCorrection = candidate.requestSource !== desiredSource;
    const result = matcher({
      category: candidate.categorySnapshot,
      collection: candidate.collectionSnapshot,
      option: candidate.optionSnapshot,
      style: candidate.styleSnapshot,
    });

    if (result.outcome === "matched") {
      console.log(
        `[MATCH] ${candidate.reference}: ${result.service.code} / ${result.option.code}`,
      );

      if (mode === "dry-run") {
        totals.classified += 1;
        if (needsSourceCorrection) {
          totals.sourceCorrections += 1;
        }
        continue;
      }

      const classifiedAt = new Date();
      const eventId = randomUUID();
      const writeResult = await db.execute<BackfillWriteRow>(sql`
        WITH updated_commission AS (
          UPDATE ${commissions}
          SET
            "request_source" = 'commissions',
            "service_classification" = 'catalog',
            "pricing_service_id" = ${result.service.id},
            "pricing_option_id" = ${result.option.id},
            "classified_at" = ${classifiedAt},
            "classified_by" = 'system',
            "classified_by_admin_user_id" = NULL,
            "classification_note" = 'Automatically matched from the historical commissions request snapshot.',
            "updated_at" = ${classifiedAt}
          WHERE ${commissions.id} = ${candidate.id}
            AND ${commissions.serviceClassification} = 'unclassified'
          RETURNING ${commissions.id} AS id
        ),
        inserted_event AS (
          INSERT INTO ${commissionEvents} (
            "id",
            "commission_id",
            "type",
            "actor",
            "title",
            "description",
            "metadata",
            "created_at"
          )
          SELECT
            ${eventId},
            updated_commission.id,
            'commission_service_classified',
            'system',
            ${`Commission classified as ${result.option.quoteLabel}`},
            'Automatically matched from the historical commission request snapshot.',
            jsonb_build_object(
              'classification', 'catalog',
              'matchSource', 'historical_snapshot_backfill',
              'pricingServiceId', ${result.service.id}::uuid,
              'pricingOptionId', ${result.option.id}::uuid,
              'pricingVersionId', ${result.version.id}::uuid
            ),
            ${classifiedAt}
          FROM updated_commission
          RETURNING ${commissionEvents.id} AS event_id,
            ${commissionEvents.commissionId} AS commission_id
        )
        SELECT commission_id, event_id FROM inserted_event
      `);

      if (writeResult.rows[0]) {
        totals.classified += 1;
        if (needsSourceCorrection) {
          totals.sourceCorrections += 1;
        }
      } else {
        totals.conflicts += 1;
        console.log(
          `[CONFLICT] ${candidate.reference}: changed during backfill`,
        );
      }

      continue;
    }

    if (needsSourceCorrection) {
      console.log(
        `[SOURCE] ${candidate.reference}: ${candidate.requestSource} -> ${desiredSource}`,
      );

      if (mode === "apply") {
        await db
          .update(commissions)
          .set({ requestSource: desiredSource })
          .where(
            and(
              eq(commissions.id, candidate.id),
              eq(commissions.serviceClassification, "unclassified"),
            ),
          );
      }

      totals.sourceCorrections += 1;
    }

    switch (result.outcome) {
      case "incomplete":
        totals.incomplete += 1;
        console.log(`[SKIP] ${candidate.reference}: incomplete catalog snapshot path`);
        break;
      case "no_match":
        totals.noMatch += 1;
        console.log(`[SKIP] ${candidate.reference}: no catalog match`);
        break;
      case "ambiguous":
        totals.ambiguous += 1;
        console.log(
          `[SKIP] ${candidate.reference}: ${result.matches.length} catalog matches`,
        );
        break;
    }
  }

  console.log("");
  console.log(`[SUMMARY] Would classify / classified: ${totals.classified}`);
  console.log(`[SUMMARY] Source corrections: ${totals.sourceCorrections}`);
  console.log(`[SUMMARY] Incomplete: ${totals.incomplete}`);
  console.log(`[SUMMARY] No match: ${totals.noMatch}`);
  console.log(`[SUMMARY] Ambiguous: ${totals.ambiguous}`);
  console.log(`[SUMMARY] Conflicts: ${totals.conflicts}`);

  if (mode === "dry-run") {
    console.log("[OK] Dry run completed. No commission data was modified.");
  } else {
    console.log(
      "[OK] Historical commission classification backfill completed.",
    );
  }
}

main().catch((error: unknown) => {
  console.error("Commission classification backfill failed:", error);
  process.exitCode = 1;
});
