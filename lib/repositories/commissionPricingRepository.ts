import { and, asc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  commissionPricingAdjustments,
  commissionPricingOptionAdjustments,
  commissionPricingOptions,
  commissionPricingServices,
  commissionPricingVersions,
} from "@/lib/db/schema/commissionPricing";

export type CommissionPricingVersion =
  typeof commissionPricingVersions.$inferSelect;
export type CommissionPricingService =
  typeof commissionPricingServices.$inferSelect;
export type CommissionPricingOption =
  typeof commissionPricingOptions.$inferSelect;
export type CommissionPricingAdjustment =
  typeof commissionPricingAdjustments.$inferSelect;

export type CommissionPricingAudience = "admin" | "public";

export interface CommissionPricingOptionWithAdjustments {
  option: CommissionPricingOption;
  adjustments: CommissionPricingAdjustment[];
}

export interface CommissionPricingServiceWithOptions {
  service: CommissionPricingService;
  options: CommissionPricingOptionWithAdjustments[];
}

export interface CommissionPricingCatalog {
  version: CommissionPricingVersion;
  services: CommissionPricingServiceWithOptions[];
}

export interface GetCommissionPricingCatalogInput {
  at?: Date;
  audience?: CommissionPricingAudience;
}

export interface GetCommissionPricingCatalogByVersionInput extends GetCommissionPricingCatalogInput {
  versionId: string;
}

export type PublishCommissionPricingVersionResult =
  | {
      outcome: "published";
      version: CommissionPricingVersion;
    }
  | {
      outcome: "already_active";
      version: CommissionPricingVersion;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_draft";
      currentStatus: CommissionPricingVersion["status"];
    }
  | {
      outcome: "incomplete";
      message: string;
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

interface PublishedPricingVersionWriteRow extends Record<string, unknown> {
  id: string;
}

type AvailabilityTable =
  | typeof commissionPricingServices
  | typeof commissionPricingOptions
  | typeof commissionPricingAdjustments;

function availabilityConditions(table: AvailabilityTable, at: Date) {
  return sql`
    ${table.isActive} = true
    AND (${table.availableFrom} IS NULL OR ${table.availableFrom} <= ${at})
    AND (${table.availableUntil} IS NULL OR ${table.availableUntil} > ${at})
  `;
}

function visibilityCondition(
  column:
    | typeof commissionPricingServices.visibility
    | typeof commissionPricingOptions.visibility
    | typeof commissionPricingAdjustments.visibility,
  audience: CommissionPricingAudience,
) {
  return audience === "public" ? sql`${column} = 'public'` : undefined;
}

export async function getActiveCommissionPricingCatalog(
  input: GetCommissionPricingCatalogInput = {},
): Promise<CommissionPricingCatalog | null> {
  const at = input.at ?? new Date();

  if (Number.isNaN(at.getTime())) {
    return null;
  }

  const versionRows = await db
    .select()
    .from(commissionPricingVersions)
    .where(
      and(
        eq(commissionPricingVersions.status, "active"),
        lte(commissionPricingVersions.effectiveFrom, at),
        or(
          isNull(commissionPricingVersions.effectiveUntil),
          gt(commissionPricingVersions.effectiveUntil, at),
        ),
      ),
    )
    .limit(1);

  const version = versionRows[0];

  if (!version) {
    return null;
  }

  return getCommissionPricingCatalogByVersion({
    ...input,
    at,
    versionId: version.id,
  });
}

export async function getCommissionPricingCatalogByVersion(
  input: GetCommissionPricingCatalogByVersionInput,
): Promise<CommissionPricingCatalog | null> {
  const at = input.at ?? new Date();
  const audience = input.audience ?? "admin";

  if (Number.isNaN(at.getTime())) {
    return null;
  }

  const versionRows = await db
    .select()
    .from(commissionPricingVersions)
    .where(eq(commissionPricingVersions.id, input.versionId))
    .limit(1);

  const version = versionRows[0];

  if (!version) {
    return null;
  }

  const serviceRows = await db
    .select()
    .from(commissionPricingServices)
    .where(
      and(
        eq(commissionPricingServices.pricingVersionId, version.id),
        visibilityCondition(commissionPricingServices.visibility, audience),
        availabilityConditions(commissionPricingServices, at),
      ),
    )
    .orderBy(
      asc(commissionPricingServices.sortOrder),
      asc(commissionPricingServices.title),
      asc(commissionPricingServices.id),
    );

  if (serviceRows.length === 0) {
    return {
      version,
      services: [],
    };
  }

  const serviceIds = serviceRows.map((service) => service.id);

  const optionRows = await db
    .select()
    .from(commissionPricingOptions)
    .where(
      and(
        inArray(commissionPricingOptions.serviceId, serviceIds),
        visibilityCondition(commissionPricingOptions.visibility, audience),
        availabilityConditions(commissionPricingOptions, at),
      ),
    )
    .orderBy(
      asc(commissionPricingOptions.sortOrder),
      asc(commissionPricingOptions.title),
      asc(commissionPricingOptions.id),
    );

  const optionIds = optionRows.map((option) => option.id);
  const adjustmentRows =
    optionIds.length === 0
      ? []
      : await db
          .select({
            adjustment: commissionPricingAdjustments,
            pricingOptionId: commissionPricingOptionAdjustments.pricingOptionId,
          })
          .from(commissionPricingOptionAdjustments)
          .innerJoin(
            commissionPricingAdjustments,
            eq(
              commissionPricingOptionAdjustments.pricingAdjustmentId,
              commissionPricingAdjustments.id,
            ),
          )
          .where(
            and(
              inArray(
                commissionPricingOptionAdjustments.pricingOptionId,
                optionIds,
              ),
              eq(commissionPricingAdjustments.pricingVersionId, version.id),
              visibilityCondition(
                commissionPricingAdjustments.visibility,
                audience,
              ),
              availabilityConditions(commissionPricingAdjustments, at),
            ),
          )
          .orderBy(
            asc(commissionPricingAdjustments.sortOrder),
            asc(commissionPricingAdjustments.name),
            asc(commissionPricingAdjustments.id),
          );

  const adjustmentsByOptionId = new Map<
    string,
    CommissionPricingAdjustment[]
  >();

  for (const row of adjustmentRows) {
    const adjustments = adjustmentsByOptionId.get(row.pricingOptionId) ?? [];
    adjustments.push(row.adjustment);
    adjustmentsByOptionId.set(row.pricingOptionId, adjustments);
  }

  const optionsByServiceId = new Map<
    string,
    CommissionPricingOptionWithAdjustments[]
  >();

  for (const option of optionRows) {
    const options = optionsByServiceId.get(option.serviceId) ?? [];
    options.push({
      option,
      adjustments: adjustmentsByOptionId.get(option.id) ?? [],
    });
    optionsByServiceId.set(option.serviceId, options);
  }

  return {
    version,
    services: serviceRows.map((service) => ({
      service,
      options: optionsByServiceId.get(service.id) ?? [],
    })),
  };
}

export async function getActiveCommissionPricingOptionWithAdjustments(input: {
  at?: Date;
  optionId: string;
}): Promise<{
  adjustments: CommissionPricingAdjustment[];
  option: CommissionPricingOption;
  service: CommissionPricingService;
  version: CommissionPricingVersion;
} | null> {
  const catalog = await getActiveCommissionPricingCatalog({
    at: input.at,
    audience: "admin",
  });

  if (!catalog) {
    return null;
  }

  for (const service of catalog.services) {
    const option = service.options.find(
      (candidate) => candidate.option.id === input.optionId,
    );

    if (option) {
      return {
        adjustments: option.adjustments,
        option: option.option,
        service: service.service,
        version: catalog.version,
      };
    }
  }

  return null;
}

export async function publishCommissionPricingVersion(input: {
  expectedUpdatedAt: Date;
  publishedAt?: Date;
  versionId: string;
}): Promise<PublishCommissionPricingVersionResult> {
  const publishedAt = input.publishedAt ?? new Date();
  const versionRows = await db
    .select()
    .from(commissionPricingVersions)
    .where(eq(commissionPricingVersions.id, input.versionId))
    .limit(1);
  const version = versionRows[0];

  if (!version) {
    return { outcome: "not_found" };
  }

  if (version.status === "active") {
    return {
      outcome: "already_active",
      version,
    };
  }

  if (version.status !== "draft") {
    return {
      outcome: "not_draft",
      currentStatus: version.status,
    };
  }

  if (version.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) {
    return {
      outcome: "conflict",
      currentUpdatedAt: version.updatedAt,
    };
  }

  const catalog = await getCommissionPricingCatalogByVersion({
    at: publishedAt,
    audience: "admin",
    versionId: version.id,
  });
  const incompleteMessage = getPricingCatalogPublicationError(catalog);

  if (incompleteMessage) {
    return {
      outcome: "incomplete",
      message: incompleteMessage,
    };
  }

  const writeResult = await db.execute<PublishedPricingVersionWriteRow>(sql`
    WITH publication_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(20260905)
    ),
    target_version AS MATERIALIZED (
      SELECT ${commissionPricingVersions.id} AS id
      FROM ${commissionPricingVersions}, publication_lock
      WHERE ${commissionPricingVersions.id} = ${version.id}
        AND ${commissionPricingVersions.status} = 'draft'
        AND ${commissionPricingVersions.updatedAt} = ${input.expectedUpdatedAt}
    ),
    archived_version AS (
      UPDATE ${commissionPricingVersions}
      SET
        "status" = 'archived',
        "effective_until" = ${publishedAt},
        "updated_at" = ${publishedAt}
      WHERE ${commissionPricingVersions.status} = 'active'
        AND ${commissionPricingVersions.id} != ${version.id}
        AND EXISTS (SELECT 1 FROM target_version)
      RETURNING ${commissionPricingVersions.id}
    ),
    activated_version AS (
      UPDATE ${commissionPricingVersions}
      SET
        "status" = 'active',
        "effective_from" = ${publishedAt},
        "effective_until" = NULL,
        "published_at" = ${publishedAt},
        "updated_at" = ${publishedAt}
      WHERE ${commissionPricingVersions.id} IN (SELECT id FROM target_version)
        AND (SELECT count(*) FROM archived_version) >= 0
      RETURNING ${commissionPricingVersions.id} AS id
    )
    SELECT id FROM activated_version
  `);

  if (writeResult.rows[0]) {
    const publishedVersionRows = await db
      .select()
      .from(commissionPricingVersions)
      .where(eq(commissionPricingVersions.id, version.id))
      .limit(1);
    const publishedVersion = publishedVersionRows[0];

    if (!publishedVersion) {
      return { outcome: "not_found" };
    }

    return {
      outcome: "published",
      version: publishedVersion,
    };
  }

  const currentVersionRows = await db
    .select()
    .from(commissionPricingVersions)
    .where(eq(commissionPricingVersions.id, version.id))
    .limit(1);
  const currentVersion = currentVersionRows[0];

  if (!currentVersion) {
    return { outcome: "not_found" };
  }

  if (currentVersion.status === "active") {
    return {
      outcome: "already_active",
      version: currentVersion,
    };
  }

  if (currentVersion.status !== "draft") {
    return {
      outcome: "not_draft",
      currentStatus: currentVersion.status,
    };
  }

  return {
    outcome: "conflict",
    currentUpdatedAt: currentVersion.updatedAt,
  };
}

function getPricingCatalogPublicationError(
  catalog: CommissionPricingCatalog | null,
): string | null {
  if (!catalog || catalog.services.length === 0) {
    return "The pricing catalog must contain at least one available service.";
  }

  for (const service of catalog.services) {
    if (service.options.length === 0) {
      return `Service ${service.service.code} must contain at least one available option.`;
    }

    for (const option of service.options) {
      const hasDiscount = option.adjustments.some(
        (adjustment) =>
          adjustment.kind === "discount" &&
          adjustment.calculationBasis === "pre_discount_subtotal",
      );

      if (!hasDiscount) {
        return `Option ${service.service.code}:${option.option.code} must include the catalog discount.`;
      }
    }
  }

  return null;
}
