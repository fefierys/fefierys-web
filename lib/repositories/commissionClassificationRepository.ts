import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import {
  validateCommissionClassification,
  type CommissionClassificationValidation,
} from "@/lib/commissions/commissionClassification";
import { db } from "@/lib/db";
import {
  commissionEvents,
  commissionQuotes,
  commissions,
} from "@/lib/db/schema/commissions";
import { getActiveCommissionPricingOptionWithAdjustments } from "@/lib/repositories/commissionPricingRepository";

export type ClassifiedCommission = typeof commissions.$inferSelect;
export type CommissionClassificationEvent =
  typeof commissionEvents.$inferSelect;

type InvalidClassificationValidation = Extract<
  CommissionClassificationValidation,
  { valid: false }
>;

export type ClassifyCommissionInput =
  | {
      classification: "catalog";
      commissionId: string;
      expectedUpdatedAt: Date;
      note?: string | null;
      pricingOptionId: string;
      pricingServiceId: string;
      updatedByAdminUserId: string;
    }
  | {
      classification: "custom";
      commissionId: string;
      expectedUpdatedAt: Date;
      note: string;
      pricingOptionId?: null;
      pricingServiceId?: null;
      updatedByAdminUserId: string;
    };

export type ClassifyCommissionResult =
  | {
      outcome: "classified";
      commission: ClassifiedCommission;
      event: CommissionClassificationEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidClassificationValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "catalog_option_not_found";
    }
  | {
      outcome: "option_service_mismatch";
    }
  | {
      outcome: "quote_exists";
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

interface ClassificationWriteRow extends Record<string, unknown> {
  commission_id: string;
  event_id: string;
}

export async function classifyCommission(
  input: ClassifyCommissionInput,
): Promise<ClassifyCommissionResult> {
  const validation = validateCommissionClassification({
    classification: input.classification,
    note: input.note,
  });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  let pricingServiceId: string | null = null;
  let pricingOptionId: string | null = null;
  let classificationTitle = "Custom commission classified";

  if (input.classification === "catalog") {
    const selection = await getActiveCommissionPricingOptionWithAdjustments({
      optionId: input.pricingOptionId,
    });

    if (!selection) {
      return { outcome: "catalog_option_not_found" };
    }

    if (selection.service.id !== input.pricingServiceId) {
      return { outcome: "option_service_mismatch" };
    }

    pricingServiceId = selection.service.id;
    pricingOptionId = selection.option.id;
    classificationTitle = `Commission classified as ${selection.option.quoteLabel}`;
  }

  const classifiedAt = new Date();
  const eventId = randomUUID();
  let writeResult;

  try {
    writeResult = await db.execute<ClassificationWriteRow>(sql`
    WITH current_commission AS MATERIALIZED (
      SELECT
        ${commissions.id} AS id,
        ${commissions.serviceClassification} AS previous_classification,
        ${commissions.pricingServiceId} AS previous_pricing_service_id,
        ${commissions.pricingOptionId} AS previous_pricing_option_id
      FROM ${commissions}
      WHERE ${commissions.id} = ${input.commissionId}
        AND ${commissions.updatedAt} = ${input.expectedUpdatedAt}
        AND (
          ${commissions.serviceClassification} = 'unclassified'
          OR NOT EXISTS (
            SELECT 1
            FROM ${commissionQuotes}
            WHERE ${commissionQuotes.commissionId} = ${input.commissionId}
          )
        )
    ),
    updated_commission AS (
      UPDATE ${commissions}
      SET
        "service_classification" = ${input.classification},
        "pricing_service_id" = ${pricingServiceId},
        "pricing_option_id" = ${pricingOptionId},
        "classified_at" = ${classifiedAt},
        "classified_by" = 'artist',
        "classified_by_admin_user_id" = ${input.updatedByAdminUserId},
        "classification_note" = ${validation.note},
        "updated_at" = ${classifiedAt}
      WHERE ${commissions.id} IN (SELECT id FROM current_commission)
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
        "created_by_admin_user_id",
        "created_at"
      )
      SELECT
        ${eventId},
        updated_commission.id,
        'commission_service_classified',
        'artist',
        ${classificationTitle},
        ${validation.note},
        jsonb_build_object(
          'previousClassification', current_commission.previous_classification,
          'previousPricingServiceId', current_commission.previous_pricing_service_id,
          'previousPricingOptionId', current_commission.previous_pricing_option_id,
          'classification', ${input.classification}::text,
          'pricingServiceId', ${pricingServiceId}::uuid,
          'pricingOptionId', ${pricingOptionId}::uuid
        ),
        ${input.updatedByAdminUserId},
        ${classifiedAt}
      FROM updated_commission
      INNER JOIN current_commission
        ON current_commission.id = updated_commission.id
      RETURNING ${commissionEvents.id} AS event_id,
        ${commissionEvents.commissionId} AS commission_id
    )
    SELECT commission_id, event_id FROM inserted_event
  `);
  } catch (error) {
    try {
      const recoveredResult = await getClassificationResultByEventId(eventId);

      if (recoveredResult) {
        return recoveredResult;
      }
    } catch {
      // Preserve the original write error if reconciliation cannot reach Neon.
    }

    throw error;
  }
  const writeRow = writeResult.rows[0];

  if (writeRow) {
    const classificationResult = await getClassificationResultByEventId(
      writeRow.event_id,
    );

    if (!classificationResult) {
      throw new Error("Commission classification could not be reloaded.");
    }

    return classificationResult;
  }

  const commissionRows = await db
    .select({
      id: commissions.id,
      serviceClassification: commissions.serviceClassification,
      updatedAt: commissions.updatedAt,
    })
    .from(commissions)
    .where(eq(commissions.id, input.commissionId))
    .limit(1);
  const commission = commissionRows[0];

  if (!commission) {
    return { outcome: "not_found" };
  }

  const quoteRows = await db
    .select({ id: commissionQuotes.id })
    .from(commissionQuotes)
    .where(eq(commissionQuotes.commissionId, input.commissionId))
    .limit(1);

  if (quoteRows[0] && commission.serviceClassification !== "unclassified") {
    return { outcome: "quote_exists" };
  }

  return {
    outcome: "conflict",
    currentUpdatedAt: commission.updatedAt,
  };
}

async function getClassificationResultByEventId(
  eventId: string,
): Promise<Extract<
  ClassifyCommissionResult,
  { outcome: "classified" }
> | null> {
  const eventRows = await db
    .select()
    .from(commissionEvents)
    .where(eq(commissionEvents.id, eventId))
    .limit(1);
  const event = eventRows[0];

  if (!event) {
    return null;
  }

  const commissionRows = await db
    .select()
    .from(commissions)
    .where(eq(commissions.id, event.commissionId))
    .limit(1);
  const commission = commissionRows[0];

  if (!commission) {
    return null;
  }

  return {
    outcome: "classified",
    commission,
    event,
  };
}
