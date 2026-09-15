import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "../db";

import {
  commissionEvents,
  commissions,
  commissionStatusHistory,
} from "../db/schema/commissions";
import {
  getActiveCommissionPricingCatalog,
  type CommissionPricingOption,
  type CommissionPricingService,
  type CommissionPricingVersion,
} from "./commissionPricingRepository";
import { resolveActiveCommissionPricingSnapshot } from "./commissionPricingSnapshotMatcherRepository";

export type Commission = typeof commissions.$inferSelect;

export interface CreateCommissionInput {
  submissionId: string;
  clientName: string;
  clientEmail: string;
  clientCompanyName?: string | null;
  clientCountry?: string | null;
  styleSnapshot?: string | null;
  collectionSnapshot?: string | null;
  categorySnapshot?: string | null;
  optionSnapshot?: string | null;
  pricingVersionId?: string | null;
  pricingServiceId?: string | null;
  pricingOptionId?: string | null;
  initialMessage: string;
  termsVersion?: string | null;
  agreementVersion?: string | null;
  requestSource?: Commission["requestSource"];
}

interface MatchedClientPricing {
  option: CommissionPricingOption;
  service: CommissionPricingService;
  version: CommissionPricingVersion;
}

type ClientPricingMatchSource =
  | "commissions_catalog_selection"
  | "commissions_snapshot_fallback";

async function resolveSubmittedCatalogSelection(
  input: CreateCommissionInput,
): Promise<MatchedClientPricing | null> {
  if (
    !input.pricingVersionId ||
    !input.pricingServiceId ||
    !input.pricingOptionId
  ) {
    return null;
  }

  const catalog =
    await getActiveCommissionPricingCatalog({
      audience: "public",
    });

  if (
    !catalog ||
    catalog.version.id !==
      input.pricingVersionId
  ) {
    return null;
  }

  const serviceEntry =
    catalog.services.find(
      (entry) =>
        entry.service.id ===
        input.pricingServiceId,
    );

  const optionEntry =
    serviceEntry?.options.find(
      (entry) =>
        entry.option.id ===
        input.pricingOptionId,
    );

  if (!serviceEntry || !optionEntry) {
    return null;
  }

  return {
    option: optionEntry.option,
    service: serviceEntry.service,
    version: catalog.version,
  };
}

export interface CreatedCommission {
  id: string;
  reference: string;
  status: Commission["status"];
  submittedAt: Date;
  wasCreated: boolean;
}

/*
 * Public format: COM-YYYYMMDD-XXXXXX
 */
export function generateCommissionReference(date: Date = new Date()): string {
  const utcDate = date.toISOString().slice(0, 10).replaceAll("-", "");
  const randomSuffix = randomBytes(3).toString("hex").toUpperCase();

  return `COM-${utcDate}-${randomSuffix}`;
}

function toCreatedCommission(
  commission: Pick<Commission, "id" | "reference" | "status" | "submittedAt">,
  wasCreated: boolean,
): CreatedCommission {
  return {
    id: commission.id,
    reference: commission.reference,
    status: commission.status,
    submittedAt: commission.submittedAt,
    wasCreated,
  };
}

/*
 * A new submission creates the commission, its initial status history,
 * and its initial timeline event in one Neon HTTP batch transaction.
 *
 * If submissionId already exists, the batch rolls back and the existing
 * commission is returned with wasCreated=false. This makes retries safe
 * and prevents duplicate history, events, and email side effects.
 */
export async function createCommission(
  input: CreateCommissionInput,
): Promise<CreatedCommission> {
  const commissionId = randomUUID();
  const reference = generateCommissionReference();
  const submittedAt = new Date();
  const requestSource =
    input.requestSource ??
    (input.pricingVersionId &&
    input.pricingServiceId &&
    input.pricingOptionId
      ? "commissions"
      : "contact");

  try {
    let matchedPricing:
      | MatchedClientPricing
      | null = null;

    let matchSource:
      | ClientPricingMatchSource
      | null = null;

    if (requestSource === "commissions") {
      matchedPricing =
        await resolveSubmittedCatalogSelection(
          input,
        );

      if (matchedPricing) {
        matchSource =
          "commissions_catalog_selection";
      } else {
        const snapshotMatch =
          await resolveActiveCommissionPricingSnapshot(
            {
              category:
                input.categorySnapshot,
              collection:
                input.collectionSnapshot,
              option:
                input.optionSnapshot,
              style:
                input.styleSnapshot,
            },
            {
              audience: "public",
            },
          );

        if (
          snapshotMatch.outcome ===
          "matched"
        ) {
          matchedPricing =
            snapshotMatch;

          matchSource =
            "commissions_snapshot_fallback";
        }
      }
    }

    const classificationNote =
      matchSource ===
      "commissions_catalog_selection"
        ? "Automatically validated from the submitted public commissions catalog selection."
        : matchSource ===
            "commissions_snapshot_fallback"
          ? "Automatically matched from the submitted public commissions snapshots."
          : null;

    const createCommissionQuery = db
      .insert(commissions)
      .values({
        id: commissionId,
        submissionId: input.submissionId,
        reference,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientCompanyName: input.clientCompanyName ?? null,
        clientCountry: input.clientCountry ?? null,
        styleSnapshot: input.styleSnapshot ?? null,
        collectionSnapshot: input.collectionSnapshot ?? null,
        categorySnapshot: input.categorySnapshot ?? null,
        optionSnapshot: input.optionSnapshot ?? null,
        requestSource,
        serviceClassification: matchedPricing ? "catalog" : "unclassified",
        pricingServiceId: matchedPricing?.service.id ?? null,
        pricingOptionId: matchedPricing?.option.id ?? null,
        classifiedAt: matchedPricing ? submittedAt : null,
        classifiedBy: matchedPricing ? "client" : null,
        classificationNote,
        initialMessage: input.initialMessage,
        status: "received",
        termsVersion: input.termsVersion ?? null,
        agreementVersion: input.agreementVersion ?? null,
        submittedAt,
        createdAt: submittedAt,
        updatedAt: submittedAt,
      })
      .returning({
        id: commissions.id,
        reference: commissions.reference,
        status: commissions.status,
        submittedAt: commissions.submittedAt,
      });
    const createHistoryQuery = db.insert(commissionStatusHistory).values({
      commissionId,
      fromStatus: null,
      toStatus: "received",
      initiatedBy: "client",
      reason: "initial_submission",
      createdAt: submittedAt,
    });
    const createReceivedEventQuery = db.insert(commissionEvents).values({
      commissionId,
      type: "commission_received",
      actor: "client",
      title: "Commission request received",
      createdAt: submittedAt,
    });

    const [createdCommissionRows] = matchedPricing
      ? await db.batch([
          createCommissionQuery,
          createHistoryQuery,
          createReceivedEventQuery,
          db.insert(commissionEvents).values({
            commissionId,
            type: "commission_service_classified",
            actor: "client",
            title: `Commission classified as ${matchedPricing.option.quoteLabel}`,
            description:
              classificationNote,
            metadata: {
              classification: "catalog",
              matchSource,
              pricingOptionId: matchedPricing.option.id,
              pricingServiceId: matchedPricing.service.id,
              pricingVersionId: matchedPricing.version.id,
            },
            createdAt: submittedAt,
          }),
        ])
      : await db.batch([
          createCommissionQuery,
          createHistoryQuery,
          createReceivedEventQuery,
        ]);

    const createdCommission = createdCommissionRows[0];

    if (!createdCommission) {
      throw new Error("Commission creation returned no record");
    }

    return toCreatedCommission(createdCommission, true);
  } catch (error) {
    /*
     * A lost response can cause the browser to retry a submission that
     * was already committed. Only treat the failure as idempotent when
     * the same submissionId now exists; otherwise preserve the error.
     */
    const existingCommission = await getCommissionBySubmissionId(
      input.submissionId,
    );

    if (!existingCommission) {
      throw error;
    }

    return toCreatedCommission(existingCommission, false);
  }
}

export async function getCommissionById(
  id: string,
): Promise<Commission | null> {
  const rows = await db
    .select()
    .from(commissions)
    .where(eq(commissions.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCommissionByReference(
  reference: string,
): Promise<Commission | null> {
  const normalizedReference = reference.trim().toUpperCase();

  const rows = await db
    .select()
    .from(commissions)
    .where(eq(commissions.reference, normalizedReference))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCommissionBySubmissionId(
  submissionId: string,
): Promise<Commission | null> {
  const rows = await db
    .select()
    .from(commissions)
    .where(eq(commissions.submissionId, submissionId))
    .limit(1);

  return rows[0] ?? null;
}
