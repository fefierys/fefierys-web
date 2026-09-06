import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  portfolioCategories,
  portfolioGroups,
  portfolioSections,
} from "@/lib/db/schema/portfolio";
import {
  getActiveCommissionPricingCatalog,
  type CommissionPricingCatalog,
  type CommissionPricingOption,
  type CommissionPricingService,
  type CommissionPricingVersion,
} from "@/lib/repositories/commissionPricingRepository";

export interface CommissionPricingSnapshotPath {
  category: string | null | undefined;
  collection: string | null | undefined;
  option: string | null | undefined;
  style: string | null | undefined;
}

export type CommissionPricingSnapshotMatchResult =
  | {
      outcome: "matched";
      option: CommissionPricingOption;
      service: CommissionPricingService;
      version: CommissionPricingVersion;
    }
  | {
      outcome: "incomplete";
    }
  | {
      outcome: "catalog_unavailable";
    }
  | {
      outcome: "no_match";
    }
  | {
      outcome: "ambiguous";
      matches: Array<{
        optionId: string;
        serviceId: string;
      }>;
    };

interface PortfolioPricingContext {
  categoryCode: string;
  categoryId: string;
  categorySlug: string;
  categoryTitle: string;
  collectionSlug: string;
  collectionTitle: string;
  styleLabel: string;
  styleSlug: string;
  styleTitle: string;
}

const EMPTY_SNAPSHOT_VALUES = new Set([
  "",
  "na",
  "none",
  "notapplicable",
  "notprovided",
  "notspecified",
  "unclassified",
]);

export function normalizeCommissionPricingSnapshot(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeRequiredSnapshot(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeCommissionPricingSnapshot(value?.trim() ?? "");

  return EMPTY_SNAPSHOT_VALUES.has(normalized) ? null : normalized;
}

function matchesAny(snapshot: string, values: string[]): boolean {
  return values.some(
    (value) => normalizeCommissionPricingSnapshot(value) === snapshot,
  );
}

type LoadedSnapshotMatchResult = Exclude<
  CommissionPricingSnapshotMatchResult,
  { outcome: "catalog_unavailable" }
>;

export type CommissionPricingSnapshotMatcher = (
  input: CommissionPricingSnapshotPath,
) => LoadedSnapshotMatchResult;

function resolveLoadedCommissionPricingSnapshot(
  input: CommissionPricingSnapshotPath,
  catalog: CommissionPricingCatalog,
  contextByCategoryId: ReadonlyMap<string, PortfolioPricingContext>,
): LoadedSnapshotMatchResult {
  const style = normalizeRequiredSnapshot(input.style);
  const collection = normalizeRequiredSnapshot(input.collection);
  const category = normalizeRequiredSnapshot(input.category);
  const option = normalizeRequiredSnapshot(input.option);

  if (!style || !collection || !category || !option) {
    return { outcome: "incomplete" };
  }

  const matches: Array<{
    option: CommissionPricingOption;
    service: CommissionPricingService;
  }> = [];

  for (const serviceEntry of catalog.services) {
    const categoryId = serviceEntry.service.portfolioCategoryId;
    const context = categoryId
      ? contextByCategoryId.get(categoryId)
      : undefined;

    if (
      !context ||
      !matchesAny(style, [
        context.styleLabel,
        context.styleSlug,
        context.styleTitle,
      ]) ||
      !matchesAny(collection, [
        context.collectionSlug,
        context.collectionTitle,
      ]) ||
      !matchesAny(category, [
        context.categoryCode,
        context.categorySlug,
        context.categoryTitle,
      ])
    ) {
      continue;
    }

    for (const optionEntry of serviceEntry.options) {
      if (
        matchesAny(option, [
          optionEntry.option.code,
          optionEntry.option.publicLabel,
          optionEntry.option.title,
        ])
      ) {
        matches.push({
          option: optionEntry.option,
          service: serviceEntry.service,
        });
      }
    }
  }

  if (matches.length === 0) {
    return { outcome: "no_match" };
  }

  if (matches.length > 1) {
    return {
      outcome: "ambiguous",
      matches: matches.map((match) => ({
        optionId: match.option.id,
        serviceId: match.service.id,
      })),
    };
  }

  const match = matches[0];

  return {
    outcome: "matched",
    option: match.option,
    service: match.service,
    version: catalog.version,
  };
}

export async function createActiveCommissionPricingSnapshotMatcher(): Promise<CommissionPricingSnapshotMatcher | null> {
  const catalog = await getActiveCommissionPricingCatalog({
    audience: "admin",
  });

  if (!catalog) {
    return null;
  }

  const categoryIds = catalog.services.flatMap((entry) =>
    entry.service.portfolioCategoryId
      ? [entry.service.portfolioCategoryId]
      : [],
  );
  const contextRows: PortfolioPricingContext[] =
    categoryIds.length === 0
      ? []
      : await db
          .select({
            categoryCode: portfolioCategories.code,
            categoryId: portfolioCategories.id,
            categorySlug: portfolioCategories.slug,
            categoryTitle: portfolioCategories.title,
            collectionSlug: portfolioGroups.slug,
            collectionTitle: portfolioGroups.title,
            styleLabel: portfolioSections.navLabel,
            styleSlug: portfolioSections.slug,
            styleTitle: portfolioSections.title,
          })
          .from(portfolioCategories)
          .innerJoin(
            portfolioGroups,
            eq(portfolioCategories.groupId, portfolioGroups.id),
          )
          .innerJoin(
            portfolioSections,
            eq(portfolioGroups.sectionId, portfolioSections.id),
          )
          .where(inArray(portfolioCategories.id, categoryIds));
  const contextByCategoryId = new Map(
    contextRows.map((context) => [context.categoryId, context]),
  );

  return (input) =>
    resolveLoadedCommissionPricingSnapshot(input, catalog, contextByCategoryId);
}

export async function resolveActiveCommissionPricingSnapshot(
  input: CommissionPricingSnapshotPath,
): Promise<CommissionPricingSnapshotMatchResult> {
  const matcher = await createActiveCommissionPricingSnapshotMatcher();

  return matcher ? matcher(input) : { outcome: "catalog_unavailable" };
}
