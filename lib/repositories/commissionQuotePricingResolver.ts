import { eq } from "drizzle-orm";

import {
  buildCommissionQuotePricingSnapshot,
  type BuildCommissionQuotePricingSnapshotResult,
  type CommissionQuoteCustomItemSelection,
  type CommissionQuotePricingSnapshot,
  type CommissionQuoteSelectedAdjustment,
} from "@/lib/commissions/commissionQuotePricing";
import { db } from "@/lib/db";
import { commissions } from "@/lib/db/schema/commissions";

import {
  getActiveCommissionPricingOptionWithAdjustments,
  getCommissionPricingCatalogByVersion,
} from "./commissionPricingRepository";
import { getCommissionQuoteById } from "./commissionQuotes/commissionQuoteShared";

export type CommissionQuotePricingSelection =
  | {
      customItems: CommissionQuoteCustomItemSelection[];
      mode: "custom";
    }
  | {
      customItems: CommissionQuoteCustomItemSelection[];
      mode: "catalog";
      selectedAdjustments: CommissionQuoteSelectedAdjustment[];
    };

export type ResolveCommissionQuotePricingResult =
  | {
      outcome: "resolved";
      snapshot: CommissionQuotePricingSnapshot;
    }
  | {
      outcome:
        | "not_found"
        | "classification_required"
        | "pricing_mode_mismatch"
        | "catalog_unavailable";
      message: string;
    }
  | {
      outcome: "invalid";
      validation: Extract<
        BuildCommissionQuotePricingSnapshotResult,
        { valid: false }
      >;
    };

export async function resolveCommissionQuotePricingForCreate(input: {
  commissionId: string;
  selection: CommissionQuotePricingSelection;
}): Promise<ResolveCommissionQuotePricingResult> {
  const commissionRows = await db
    .select({
      pricingOptionId: commissions.pricingOptionId,
      serviceClassification: commissions.serviceClassification,
    })
    .from(commissions)
    .where(eq(commissions.id, input.commissionId))
    .limit(1);
  const commission = commissionRows[0];

  if (!commission) {
    return {
      outcome: "not_found",
      message: "The commission no longer exists.",
    };
  }

  if (input.selection.mode !== commission.serviceClassification) {
    return {
      outcome: "pricing_mode_mismatch",
      message:
        "The quote type no longer matches the commission classification. Refresh the page and try again.",
    };
  }

  if (input.selection.mode === "custom") {
    return toResolutionResult(
      buildCommissionQuotePricingSnapshot({
        customItems: input.selection.customItems,
        mode: "custom",
      }),
    );
  }

  if (!commission.pricingOptionId) {
    return {
      outcome: "classification_required",
      message: "Select a catalog service before preparing its quote.",
    };
  }

  const catalogOption = await getActiveCommissionPricingOptionWithAdjustments({
    optionId: commission.pricingOptionId,
  });

  if (!catalogOption) {
    return {
      outcome: "catalog_unavailable",
      message:
        "The classified catalog option is no longer active. Review the service classification before creating a quote.",
    };
  }

  return toResolutionResult(
    buildCommissionQuotePricingSnapshot({
      adjustments: catalogOption.adjustments,
      customItems: input.selection.customItems,
      mode: "catalog",
      option: catalogOption.option,
      pricingVersionId: catalogOption.version.id,
      selectedAdjustments: input.selection.selectedAdjustments,
    }),
  );
}

export async function resolveCommissionQuotePricingForUpdate(input: {
  quoteId: string;
  selection: CommissionQuotePricingSelection;
}): Promise<ResolveCommissionQuotePricingResult> {
  const storedQuote = await getCommissionQuoteById(input.quoteId);

  if (!storedQuote) {
    return {
      outcome: "not_found",
      message: "The quote no longer exists.",
    };
  }

  if (storedQuote.quote.pricingMode !== input.selection.mode) {
    return {
      outcome: "pricing_mode_mismatch",
      message: "A quote draft cannot be converted to a different pricing type.",
    };
  }

  if (input.selection.mode === "custom") {
    return toResolutionResult(
      buildCommissionQuotePricingSnapshot({
        customItems: input.selection.customItems,
        mode: "custom",
      }),
    );
  }

  const pricingVersionId = storedQuote.quote.pricingVersionId;
  const pricingOptionId = storedQuote.items.find(
    (item) => item.kind === "base",
  )?.pricingOptionId;

  if (!pricingVersionId || !pricingOptionId) {
    return {
      outcome: "catalog_unavailable",
      message: "The quote catalog snapshot is incomplete and cannot be edited.",
    };
  }

  const catalog = await getCommissionPricingCatalogByVersion({
    at: storedQuote.quote.createdAt,
    audience: "admin",
    versionId: pricingVersionId,
  });
  const catalogOption = catalog?.services
    .flatMap((service) => service.options)
    .find((candidate) => candidate.option.id === pricingOptionId);

  if (!catalog || !catalogOption) {
    return {
      outcome: "catalog_unavailable",
      message: "The pricing catalog used by this quote is no longer available.",
    };
  }

  return toResolutionResult(
    buildCommissionQuotePricingSnapshot({
      adjustments: catalogOption.adjustments,
      customItems: input.selection.customItems,
      mode: "catalog",
      option: catalogOption.option,
      pricingVersionId: catalog.version.id,
      selectedAdjustments: input.selection.selectedAdjustments,
    }),
  );
}

function toResolutionResult(
  result: BuildCommissionQuotePricingSnapshotResult,
): ResolveCommissionQuotePricingResult {
  return result.valid
    ? {
        outcome: "resolved",
        snapshot: result.snapshot,
      }
    : {
        outcome: "invalid",
        validation: result,
      };
}
