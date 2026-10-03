import { MAX_COMMISSION_QUOTE_ITEM_QUANTITY } from "./commissionQuote";

import {
  calculateCommissionPricing,
  type CommissionPricingAdjustmentInput,
  type CommissionPricingAdjustmentKind,
  type CommissionPricingCalculationBasis,
  type CommissionPricingCalculationType,
  type CommissionPricingCustomItemInput,
} from "./commissionPricing";

export interface CommissionQuoteCatalogOptionSnapshot {
  baseAmount: string;
  description: string | null;
  id: string;
  quoteLabel: string;
}

export interface CommissionQuoteCatalogAdjustmentSnapshot {
  calculationBasis: CommissionPricingCalculationBasis;
  calculationType: CommissionPricingCalculationType;
  description: string | null;
  fixedAmount: string | null;
  id: string;
  isValueEditable: boolean;
  kind: CommissionPricingAdjustmentKind;
  maxQuantity: number | null;
  maximumPercentageRate: string | null;
  minimumPercentageRate: string | null;
  name: string;
  percentageRate: string | null;
  requiresInternalNote: boolean;
  stackable: boolean;
}

export interface CommissionQuoteSelectedAdjustment {
  adjustmentId: string;
  internalNote?: string | null;
  percentageRate?: string | null;
  quantity: number;
}

export interface CommissionQuoteIllustrationSelection {
  id: string;
  selectedAdjustments: CommissionQuoteSelectedAdjustment[];
}

export interface CommissionQuoteCustomItemSelection extends CommissionPricingCustomItemInput {
  description?: string | null;
}

export interface CommissionQuotePricingSnapshotItem {
  calculationBasis: CommissionPricingCalculationBasis;
  calculationType: CommissionPricingCalculationType;
  description: string | null;
  internalNote: string | null;
  kind: "base" | "custom" | CommissionPricingAdjustmentKind;
  label: string;
  lineAmount: string;
  percentageRate: string | null;
  pricingAdjustmentId: string | null;
  pricingOptionId: string | null;
  quantity: number;
  sequence: number;
  unitAmount: string;
  illustrationId: string | null;
}

export interface CommissionQuotePricingSnapshot {
  baseSubtotal: string;
  currency: "USD";
  discountTotal: string;
  items: CommissionQuotePricingSnapshotItem[];
  preDiscountSubtotal: string;
  pricingMode: "catalog" | "custom";
  pricingVersionId: string | null;
  totalAmount: string;
  illustrations: {
    id: string;
    sequence: number;
  }[];
}

export type BuildCommissionQuotePricingSnapshotResult =
  | {
      valid: true;
      snapshot: CommissionQuotePricingSnapshot;
    }
  | {
      valid: false;
      code:
        | "catalog_option_required"
        | "catalog_version_required"
        | "custom_items_required"
        | "adjustment_not_allowed"
        | "duplicate_adjustment"
        | "editable_percentage_required"
        | "percentage_not_editable"
        | "percentage_out_of_range"
        | "pricing_invalid"
        | "base_quantity_invalid"
        | "illustration_invalid";
      message: string;
    };

interface CatalogPricingInput {
  adjustments: readonly CommissionQuoteCatalogAdjustmentSnapshot[];
  baseQuantity?: number;
  customItems?: readonly CommissionQuoteCustomItemSelection[];
  globalAdjustments?: readonly CommissionQuoteSelectedAdjustment[];
  illustrations?: readonly CommissionQuoteIllustrationSelection[];
  mode: "catalog";
  option: CommissionQuoteCatalogOptionSnapshot;
  pricingVersionId: string;
  selectedAdjustments: readonly CommissionQuoteSelectedAdjustment[];
}

interface CustomPricingInput {
  customItems: readonly CommissionQuoteCustomItemSelection[];
  mode: "custom";
}

export function buildCommissionQuotePricingSnapshot(
  input: CatalogPricingInput | CustomPricingInput,
): BuildCommissionQuotePricingSnapshotResult {
  if (input.mode === "custom") {
    if (input.customItems.length === 0) {
      return {
        valid: false,
        code: "custom_items_required",
        message: "Add at least one custom service to prepare this quote.",
      };
    }

    return calculateSnapshot({
      customItems: input.customItems,
      mode: "custom",
      pricingVersionId: null,
    });
  }

  if (!input.pricingVersionId.trim()) {
    return {
      valid: false,
      code: "catalog_version_required",
      message: "The pricing catalog version could not be identified.",
    };
  }

  if (!input.option.id.trim()) {
    return {
      valid: false,
      code: "catalog_option_required",
      message: "Select a catalog service before preparing the quote.",
    };
  }

  const baseQuantity = input.illustrations?.length ?? input.baseQuantity ?? 1;

  if (
    !Number.isInteger(baseQuantity) ||
    baseQuantity < 1 ||
    baseQuantity > MAX_COMMISSION_QUOTE_ITEM_QUANTITY
  ) {
    return {
      valid: false,
      code: "base_quantity_invalid",
      message: `Enter a whole quantity between 1 and ${MAX_COMMISSION_QUOTE_ITEM_QUANTITY} for the main service.`,
    };
  }

  if (input.illustrations) {
    const illustrationIds = new Set<string>();

    for (const illustration of input.illustrations) {
      if (!illustration.id.trim() || illustrationIds.has(illustration.id)) {
        return {
          valid: false,
          code: "illustration_invalid",
          message: "Each illustration must have a unique, non-empty ID.",
        };
      }

      illustrationIds.add(illustration.id);
    }
  }

  const adjustmentById = new Map(
    input.adjustments.map((adjustment) => [adjustment.id, adjustment]),
  );
  const selectedIds = new Set<string>();
  const normalizedAdjustments: CommissionPricingAdjustmentInput[] = [];

  for (const selection of input.selectedAdjustments) {
    if (selectedIds.has(selection.adjustmentId)) {
      return {
        valid: false,
        code: "duplicate_adjustment",
        message: "The same pricing adjustment cannot be added twice.",
      };
    }

    selectedIds.add(selection.adjustmentId);
    const adjustment = adjustmentById.get(selection.adjustmentId);

    if (!adjustment) {
      return {
        valid: false,
        code: "adjustment_not_allowed",
        message: "A selected adjustment is not available for this service.",
      };
    }

    const percentageValidation = resolvePercentageRate(adjustment, selection);

    if (!percentageValidation.valid) {
      return percentageValidation;
    }

    normalizedAdjustments.push({
      baseItemKey: adjustment.kind === "discount" ? null : input.option.id,
      calculationBasis: adjustment.calculationBasis,
      calculationType: adjustment.calculationType,
      fixedAmount: adjustment.fixedAmount,
      internalNote: selection.internalNote,
      key: adjustment.id,
      kind: adjustment.kind,
      label: adjustment.name,
      maxQuantity: adjustment.maxQuantity,
      percentageRate: percentageValidation.percentageRate,
      quantity: selection.quantity,
      requiresInternalNote: adjustment.requiresInternalNote,
      stackable: adjustment.stackable,
    });
  }

  if (input.illustrations) {
    for (const illustration of input.illustrations) {
      const selectedAdjustmentIds = new Set<string>();

      for (const selection of illustration.selectedAdjustments) {
        if (selectedAdjustmentIds.has(selection.adjustmentId)) {
          return {
            valid: false,
            code: "duplicate_adjustment",
            message:
              "The same adjustment cannot be selected twice for one illustration.",
          };
        }

        selectedAdjustmentIds.add(selection.adjustmentId);

        const adjustment = adjustmentById.get(selection.adjustmentId);

        if (!adjustment || adjustment.kind === "discount") {
          return {
            valid: false,
            code: "adjustment_not_allowed",
            message: "Illustrations can only contain extras and licenses.",
          };
        }

        const percentageValidation = resolvePercentageRate(
          adjustment,
          selection,
        );

        if (!percentageValidation.valid) {
          return percentageValidation;
        }

        normalizedAdjustments.push({
          baseItemKey: illustration.id,
          calculationBasis: adjustment.calculationBasis,
          calculationType: adjustment.calculationType,
          fixedAmount: adjustment.fixedAmount,
          internalNote: selection.internalNote,
          key: `${illustration.id}:${adjustment.id}`,
          kind: adjustment.kind,
          label: adjustment.name,
          maxQuantity: adjustment.maxQuantity,
          percentageRate: percentageValidation.percentageRate,
          quantity: selection.quantity,
          requiresInternalNote: adjustment.requiresInternalNote,
          stackable: adjustment.stackable,
        });
      }
    }

    const selectedGlobalAdjustmentIds = new Set<string>();

    for (const selection of input.globalAdjustments ?? []) {
      if (selectedGlobalAdjustmentIds.has(selection.adjustmentId)) {
        return {
          valid: false,
          code: "duplicate_adjustment",
          message: "The same global discount cannot be selected twice.",
        };
      }

      selectedGlobalAdjustmentIds.add(selection.adjustmentId);

      const adjustment = adjustmentById.get(selection.adjustmentId);

      if (!adjustment || adjustment.kind !== "discount") {
        return {
          valid: false,
          code: "adjustment_not_allowed",
          message: "Only discounts can be applied globally.",
        };
      }

      if (adjustment.calculationBasis !== "pre_discount_subtotal") {
        return {
          valid: false,
          code: "adjustment_not_allowed",
          message:
            "A global discount must be calculated from the full pre-discount subtotal.",
        };
      }

      const percentageValidation = resolvePercentageRate(adjustment, selection);

      if (!percentageValidation.valid) {
        return percentageValidation;
      }

      normalizedAdjustments.push({
        baseItemKey: null,
        calculationBasis: adjustment.calculationBasis,
        calculationType: adjustment.calculationType,
        fixedAmount: adjustment.fixedAmount,
        internalNote: selection.internalNote,
        key: `global:${adjustment.id}`,
        kind: adjustment.kind,
        label: adjustment.name,
        maxQuantity: adjustment.maxQuantity,
        percentageRate: percentageValidation.percentageRate,
        quantity: selection.quantity,
        requiresInternalNote: adjustment.requiresInternalNote,
        stackable: adjustment.stackable,
      });
    }
  }

  return calculateSnapshot({
    adjustments: normalizedAdjustments,
    baseQuantity,
    catalogAdjustments: input.adjustments,
    customItems: input.customItems ?? [],
    illustrations: input.illustrations,
    mode: "catalog",
    option: input.option,
    pricingVersionId: input.pricingVersionId.trim(),
  });
}

function calculateSnapshot(input: {
  adjustments?: readonly CommissionPricingAdjustmentInput[];
  baseQuantity?: number;
  catalogAdjustments?: readonly CommissionQuoteCatalogAdjustmentSnapshot[];
  customItems: readonly CommissionQuoteCustomItemSelection[];
  mode: "catalog" | "custom";
  option?: CommissionQuoteCatalogOptionSnapshot;
  pricingVersionId: string | null;
  illustrations?: readonly CommissionQuoteIllustrationSelection[];
}): BuildCommissionQuotePricingSnapshotResult {
  const calculation = calculateCommissionPricing({
    adjustments: input.adjustments ?? [],
    baseItems: input.option
      ? input.illustrations
        ? input.illustrations.map((illustration, index) => ({
            key: illustration.id,
            label: `Illustration ${index + 1} — ${input.option!.quoteLabel}`,
            quantity: 1,
            unitAmount: input.option!.baseAmount,
          }))
        : [
            {
              key: input.option.id,
              label: input.option.quoteLabel,
              quantity: input.baseQuantity ?? 1,
              unitAmount: input.option.baseAmount,
            },
          ]
      : [],
    customItems: input.customItems,
  });

  if (!calculation.valid) {
    return {
      valid: false,
      code: "pricing_invalid",
      message: calculation.message,
    };
  }

  const customItemByKey = new Map(
    input.customItems.map((item) => [item.key.trim(), item]),
  );
  const adjustmentById = new Map(
    (input.catalogAdjustments ?? []).map((adjustment) => [
      adjustment.id,
      adjustment,
    ]),
  );
  const selectedAdjustmentById = new Map(
    (input.adjustments ?? []).map((adjustment) => [adjustment.key, adjustment]),
  );

  const illustrationIds = new Set(
    input.illustrations?.map((illustration) => illustration.id) ?? [],
  );

  return {
    valid: true,
    snapshot: {
      baseSubtotal: calculation.baseSubtotal,
      currency: "USD",
      illustrations:
        input.illustrations?.map((illustration, index) => ({
          id: illustration.id,
          sequence: index + 1,
        })) ?? [],
      discountTotal: calculation.discountTotal,
      items: calculation.items.map((item, index) => {
        const customItem = customItemByKey.get(item.key);

        const catalogAdjustmentId = item.key.split(":").at(-1) ?? item.key;

        const adjustment = adjustmentById.get(catalogAdjustmentId);
        const selectedAdjustment = selectedAdjustmentById.get(item.key);

        const adjustmentIllustrationId =
          input.illustrations?.find((illustration) =>
            item.key.startsWith(`${illustration.id}:`),
          )?.id ?? null;

        return {
          calculationBasis: item.calculationBasis,
          calculationType: item.calculationType,
          description:
            item.kind === "base"
              ? (input.option?.description ?? null)
              : item.kind === "custom"
                ? customItem?.description?.trim() || null
                : (adjustment?.description ?? null),
          internalNote: selectedAdjustment?.internalNote?.trim() || null,
          kind: item.kind,
          label: item.label,
          lineAmount: item.lineAmount,
          percentageRate:
            item.calculationType === "percentage"
              ? (selectedAdjustment?.percentageRate ?? null)
              : null,
          pricingAdjustmentId: adjustment?.id ?? null,
          pricingOptionId:
            item.kind === "base" || adjustment
              ? (input.option?.id ?? null)
              : null,
          quantity: item.quantity,
          sequence: index + 1,
          unitAmount: item.unitAmount,
          illustrationId:
            item.kind === "base" && illustrationIds.has(item.key)
              ? item.key
              : item.kind === "extra" || item.kind === "license"
                ? adjustmentIllustrationId
                : null,
        };
      }),
      preDiscountSubtotal: calculation.preDiscountSubtotal,
      pricingMode: input.mode,
      pricingVersionId: input.pricingVersionId,
      totalAmount: calculation.totalAmount,
    },
  };
}

function resolvePercentageRate(
  adjustment: CommissionQuoteCatalogAdjustmentSnapshot,
  selection: CommissionQuoteSelectedAdjustment,
):
  | { valid: true; percentageRate: string | null }
  | Extract<BuildCommissionQuotePricingSnapshotResult, { valid: false }> {
  if (adjustment.calculationType === "fixed") {
    return { valid: true, percentageRate: null };
  }

  const catalogRate = adjustment.percentageRate?.trim() ?? "";
  const selectedRate = selection.percentageRate?.trim() ?? "";

  if (!adjustment.isValueEditable) {
    if (selectedRate && selectedRate !== catalogRate) {
      return {
        valid: false,
        code: "percentage_not_editable",
        message: `${adjustment.name} uses the catalog percentage and cannot be changed.`,
      };
    }

    return { valid: true, percentageRate: catalogRate };
  }

  if (!selectedRate) {
    return {
      valid: false,
      code: "editable_percentage_required",
      message: `Enter the percentage for ${adjustment.name}.`,
    };
  }

  const numericRate = Number(selectedRate);
  const minimum = Number(adjustment.minimumPercentageRate ?? "0");
  const maximum = Number(adjustment.maximumPercentageRate ?? "100");

  if (
    !Number.isFinite(numericRate) ||
    numericRate < minimum ||
    numericRate > maximum
  ) {
    return {
      valid: false,
      code: "percentage_out_of_range",
      message: `${adjustment.name} must be between ${minimum}% and ${maximum}%.`,
    };
  }

  return { valid: true, percentageRate: selectedRate };
}
