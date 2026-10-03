import { eq } from "drizzle-orm";

import {
  buildCommissionQuotePricingSnapshot,
  type BuildCommissionQuotePricingSnapshotResult,
  type CommissionQuoteCustomItemSelection,
  type CommissionQuoteIllustrationSelection,
  type CommissionQuotePricingSnapshot,
  type CommissionQuoteSelectedAdjustment,
} from "@/lib/commissions/commissionQuotePricing";
import { db } from "@/lib/db";
import { commissions } from "@/lib/db/schema/commissions";

import {
  getActiveCommissionPricingCatalog,
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
      baseQuantity?: number;
      customItems: CommissionQuoteCustomItemSelection[];
      globalAdjustments?: CommissionQuoteSelectedAdjustment[];
      illustrations?: CommissionQuoteIllustrationSelection[];
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

  if (commission.serviceClassification === "unclassified") {
    return {
      outcome: "classification_required",
      message: "Classify the commission before preparing its quote.",
    };
  }

  const expectedPricingMode =
    commission.serviceClassification === "custom" ? "custom" : "catalog";

  if (input.selection.mode !== expectedPricingMode) {
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

  if (commission.serviceClassification === "bulk") {
    const illustrationValidation = validateBulkIllustrations(
      input.selection.illustrations,
    );

    if (illustrationValidation) {
      return illustrationValidation;
    }

    const catalog = await getActiveCommissionPricingCatalog({
      audience: "admin",
    });

    if (!catalog) {
      return {
        outcome: "catalog_unavailable",
        message:
          "The active pricing catalog is not available. Review the pricing catalog before creating this quote.",
      };
    }

    const catalogOptions = catalog.services.flatMap((service) =>
      service.options.map(({ adjustments, option }) => ({
        adjustments,
        option,
      })),
    );

    if (catalogOptions.length === 0) {
      return {
        outcome: "catalog_unavailable",
        message:
          "The active pricing catalog does not contain any available options.",
      };
    }

    return toResolutionResult(
      buildCommissionQuotePricingSnapshot({
        baseQuantity: input.selection.baseQuantity ?? 1,
        catalogOptions,
        customItems: input.selection.customItems,
        globalAdjustments: input.selection.globalAdjustments,
        illustrations: input.selection.illustrations,
        mode: "catalog",
        pricingVersionId: catalog.version.id,
        selectedAdjustments: input.selection.selectedAdjustments,
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
      baseQuantity: input.selection.baseQuantity ?? 1,
      customItems: input.selection.customItems,
      globalAdjustments: input.selection.globalAdjustments,
      illustrations: input.selection.illustrations,
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

  const commissionRows = await db
    .select({
      serviceClassification: commissions.serviceClassification,
    })
    .from(commissions)
    .where(eq(commissions.id, storedQuote.quote.commissionId))
    .limit(1);

  const commission = commissionRows[0];

  if (!commission) {
    return {
      outcome: "not_found",
      message: "The commission no longer exists.",
    };
  }

  if (commission.serviceClassification === "unclassified") {
    return {
      outcome: "classification_required",
      message: "Classify the commission before editing its quote.",
    };
  }

  const expectedPricingMode =
    commission.serviceClassification === "custom" ? "custom" : "catalog";

  if (
    storedQuote.quote.pricingMode !== input.selection.mode ||
    storedQuote.quote.pricingMode !== expectedPricingMode
  ) {
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

  if (!pricingVersionId) {
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

  if (!catalog) {
    return {
      outcome: "catalog_unavailable",
      message: "The pricing catalog used by this quote is no longer available.",
    };
  }

  const catalogOptions = catalog.services.flatMap((service) =>
    service.options.map(({ adjustments, option }) => ({
      adjustments,
      option,
    })),
  );

  if (commission.serviceClassification === "bulk") {
    const illustrationValidation = validateBulkIllustrations(
      input.selection.illustrations,
    );

    if (illustrationValidation) {
      return illustrationValidation;
    }

    if (catalogOptions.length === 0) {
      return {
        outcome: "catalog_unavailable",
        message:
          "The pricing catalog used by this quote does not contain any available options.",
      };
    }

    return toResolutionResult(
      buildCommissionQuotePricingSnapshot({
        baseQuantity: input.selection.baseQuantity ?? 1,
        catalogOptions,
        customItems: input.selection.customItems,
        globalAdjustments: input.selection.globalAdjustments,
        illustrations: input.selection.illustrations,
        mode: "catalog",
        pricingVersionId: catalog.version.id,
        selectedAdjustments: input.selection.selectedAdjustments,
      }),
    );
  }

  const storedPricingOptionIds = new Set(
    storedQuote.items
      .filter((item) => item.kind === "base" && item.pricingOptionId)
      .map((item) => item.pricingOptionId as string),
  );

  if (storedPricingOptionIds.size !== 1) {
    return {
      outcome: "catalog_unavailable",
      message: "The quote catalog snapshot is incomplete and cannot be edited.",
    };
  }

  const pricingOptionId = [...storedPricingOptionIds][0];

  const catalogOption = catalogOptions.find(
    (candidate) => candidate.option.id === pricingOptionId,
  );

  if (!catalogOption) {
    return {
      outcome: "catalog_unavailable",
      message: "The pricing option used by this quote is no longer available.",
    };
  }

  return toResolutionResult(
    buildCommissionQuotePricingSnapshot({
      adjustments: catalogOption.adjustments,
      baseQuantity: input.selection.baseQuantity ?? 1,
      customItems: input.selection.customItems,
      globalAdjustments: input.selection.globalAdjustments,
      illustrations: input.selection.illustrations,
      mode: "catalog",
      option: catalogOption.option,
      pricingVersionId: catalog.version.id,
      selectedAdjustments: input.selection.selectedAdjustments,
    }),
  );
}

function validateBulkIllustrations(
  illustrations: CommissionQuoteIllustrationSelection[] | undefined,
): ResolveCommissionQuotePricingResult | null {
  if (!illustrations || illustrations.length === 0) {
    return {
      outcome: "invalid",
      validation: {
        valid: false,
        code: "illustration_invalid",
        message: "Add at least one illustration to the Bulk quote.",
      },
    };
  }

  if (
    illustrations.some((illustration) => !illustration.pricingOptionId?.trim())
  ) {
    return {
      outcome: "invalid",
      validation: {
        valid: false,
        code: "catalog_option_required",
        message: "Select a catalog option for every Bulk illustration.",
      },
    };
  }

  const distinctPricingOptionIds = new Set(
    illustrations.map((illustration) => illustration.pricingOptionId!.trim()),
  );

  if (distinctPricingOptionIds.size < 2) {
    return {
      outcome: "invalid",
      validation: {
        valid: false,
        code: "catalog_option_required",
        message:
          "A Bulk quote must include at least two different catalog options.",
      },
    };
  }

  return null;
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
