import {
  formatCommissionQuoteAmount,
  MAX_COMMISSION_QUOTE_ITEM_QUANTITY,
  parseCommissionQuoteAmount,
} from "./commissionQuote";

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

export interface CommissionQuoteCatalogOptionPricingSnapshot {
  adjustments: readonly CommissionQuoteCatalogAdjustmentSnapshot[];
  option: CommissionQuoteCatalogOptionSnapshot;
}

export interface CommissionQuoteSelectedAdjustment {
  adjustmentId: string;
  fixedAmount?: string | null;
  internalNote?: string | null;
  percentageRate?: string | null;
  quantity: number;
}

export interface CommissionQuoteIllustrationSelection {
  id: string;
  pricingOptionId?: string;
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
        | "catalog_option_not_allowed"
        | "catalog_version_required"
        | "custom_items_required"
        | "adjustment_not_allowed"
        | "duplicate_adjustment"
        | "editable_fixed_amount_required"
        | "fixed_amount_invalid"
        | "fixed_amount_not_editable"
        | "editable_percentage_required"
        | "percentage_not_editable"
        | "percentage_out_of_range"
        | "pricing_invalid"
        | "base_quantity_invalid"
        | "illustration_invalid";
      message: string;
    };

interface CatalogPricingInput {
  adjustments?: readonly CommissionQuoteCatalogAdjustmentSnapshot[];
  baseQuantity?: number;
  catalogOptions?: readonly CommissionQuoteCatalogOptionPricingSnapshot[];
  customItems?: readonly CommissionQuoteCustomItemSelection[];
  globalAdjustments?: readonly CommissionQuoteSelectedAdjustment[];
  illustrations?: readonly CommissionQuoteIllustrationSelection[];
  mode: "catalog";
  option?: CommissionQuoteCatalogOptionSnapshot;
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

  const catalogOptions: readonly CommissionQuoteCatalogOptionPricingSnapshot[] =
    input.catalogOptions?.length
      ? input.catalogOptions
      : input.option
        ? [
            {
              adjustments: input.adjustments ?? [],
              option: input.option,
            },
          ]
        : [];

  if (catalogOptions.length === 0) {
    return {
      valid: false,
      code: "catalog_option_required",
      message: "Select a catalog service before preparing the quote.",
    };
  }

  const catalogOptionById = new Map<
    string,
    CommissionQuoteCatalogOptionPricingSnapshot
  >();

  for (const catalogOption of catalogOptions) {
    const optionId = catalogOption.option.id.trim();

    if (!optionId || catalogOptionById.has(optionId)) {
      return {
        valid: false,
        code: "catalog_option_not_allowed",
        message: "The pricing catalog contains an invalid option.",
      };
    }

    catalogOptionById.set(optionId, catalogOption);
  }

  const defaultCatalogOption = input.option
    ? (catalogOptionById.get(input.option.id) ?? null)
    : catalogOptions.length === 1
      ? catalogOptions[0]
      : null;

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

  const catalogOptionByIllustrationId = new Map<
    string,
    CommissionQuoteCatalogOptionPricingSnapshot
  >();

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

      const pricingOptionId =
        illustration.pricingOptionId?.trim() ??
        defaultCatalogOption?.option.id ??
        "";

      if (!pricingOptionId) {
        return {
          valid: false,
          code: "catalog_option_required",
          message: "Select a catalog option for every illustration.",
        };
      }

      const catalogOption = catalogOptionById.get(pricingOptionId);

      if (!catalogOption) {
        return {
          valid: false,
          code: "catalog_option_not_allowed",
          message:
            "One of the selected illustration options is not available in this pricing catalog.",
        };
      }

      catalogOptionByIllustrationId.set(illustration.id, catalogOption);
    }
  } else if (!defaultCatalogOption) {
    return {
      valid: false,
      code: "catalog_option_required",
      message: "Select a catalog option before preparing the quote.",
    };
  }

  const normalizedAdjustments: CommissionPricingAdjustmentInput[] = [];

  if (input.illustrations && input.selectedAdjustments.length > 0) {
    return {
      valid: false,
      code: "adjustment_not_allowed",
      message:
        "Shared catalog adjustments cannot be used with per-illustration pricing.",
    };
  }

  if (!input.illustrations) {
    const adjustmentById = new Map(
      (defaultCatalogOption?.adjustments ?? []).map((adjustment) => [
        adjustment.id,
        adjustment,
      ]),
    );
    const selectedIds = new Set<string>();

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

      const fixedAmountValidation = resolveFixedAmount(adjustment, selection);

      if (!fixedAmountValidation.valid) {
        return fixedAmountValidation;
      }

      const percentageValidation = resolvePercentageRate(adjustment, selection);

      if (!percentageValidation.valid) {
        return percentageValidation;
      }

      normalizedAdjustments.push({
        baseItemKey:
          adjustment.kind === "discount"
            ? null
            : (defaultCatalogOption?.option.id ?? null),
        calculationBasis: adjustment.calculationBasis,
        calculationType: adjustment.calculationType,
        fixedAmount: fixedAmountValidation.fixedAmount,
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
  }

  if (input.illustrations) {
    for (const illustration of input.illustrations) {
      const catalogOption = catalogOptionByIllustrationId.get(illustration.id);

      if (!catalogOption) {
        return {
          valid: false,
          code: "catalog_option_required",
          message: "Select a catalog option for every illustration.",
        };
      }

      const adjustmentById = new Map(
        catalogOption.adjustments.map((adjustment) => [
          adjustment.id,
          adjustment,
        ]),
      );

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
            message:
              "Illustrations can only contain extras and licenses available for their selected option.",
          };
        }

        const fixedAmountValidation = resolveFixedAmount(adjustment, selection);

        if (!fixedAmountValidation.valid) {
          return fixedAmountValidation;
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
          fixedAmount: fixedAmountValidation.fixedAmount,
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

    const usedCatalogOptionById = new Map<
      string,
      CommissionQuoteCatalogOptionPricingSnapshot
    >();

    for (const catalogOption of catalogOptionByIllustrationId.values()) {
      usedCatalogOptionById.set(catalogOption.option.id, catalogOption);
    }

    const usedCatalogOptions = [...usedCatalogOptionById.values()];
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

      const matchingAdjustments = usedCatalogOptions.map((catalogOption) =>
        catalogOption.adjustments.find(
          (adjustment) => adjustment.id === selection.adjustmentId,
        ),
      );

      if (
        matchingAdjustments.length === 0 ||
        matchingAdjustments.some(
          (adjustment) => !adjustment || adjustment.kind !== "discount",
        )
      ) {
        return {
          valid: false,
          code: "adjustment_not_allowed",
          message:
            "A global discount must be available for every catalog option used in the quote.",
        };
      }

      const adjustment = matchingAdjustments[0];

      if (!adjustment || adjustment.kind !== "discount") {
        return {
          valid: false,
          code: "adjustment_not_allowed",
          message: "Only discounts can be applied globally.",
        };
      }

      const hasValidGlobalBasis =
        (adjustment.calculationType === "percentage" &&
          adjustment.calculationBasis === "pre_discount_subtotal") ||
        (adjustment.calculationType === "fixed" &&
          adjustment.calculationBasis === "none");

      if (!hasValidGlobalBasis) {
        return {
          valid: false,
          code: "adjustment_not_allowed",
          message:
            "The selected discount does not use a supported global calculation basis.",
        };
      }

      const fixedAmountValidation = resolveFixedAmount(adjustment, selection);

      if (!fixedAmountValidation.valid) {
        return fixedAmountValidation;
      }

      const percentageValidation = resolvePercentageRate(adjustment, selection);

      if (!percentageValidation.valid) {
        return percentageValidation;
      }

      normalizedAdjustments.push({
        baseItemKey: null,
        calculationBasis: adjustment.calculationBasis,
        calculationType: adjustment.calculationType,
        fixedAmount: fixedAmountValidation.fixedAmount,
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
    catalogOptions,
    customItems: input.customItems ?? [],
    defaultOptionId: defaultCatalogOption?.option.id ?? null,
    illustrations: input.illustrations,
    mode: "catalog",
    pricingVersionId: input.pricingVersionId.trim(),
  });
}

function calculateSnapshot(input: {
  adjustments?: readonly CommissionPricingAdjustmentInput[];
  baseQuantity?: number;
  catalogOptions?: readonly CommissionQuoteCatalogOptionPricingSnapshot[];
  customItems: readonly CommissionQuoteCustomItemSelection[];
  defaultOptionId?: string | null;
  illustrations?: readonly CommissionQuoteIllustrationSelection[];
  mode: "catalog" | "custom";
  pricingVersionId: string | null;
}): BuildCommissionQuotePricingSnapshotResult {
  const catalogOptionById = new Map(
    (input.catalogOptions ?? []).map(
      (catalogOption) => [catalogOption.option.id, catalogOption] as const,
    ),
  );

  const pricingOptionIdByIllustrationId = new Map<string, string>();

  for (const illustration of input.illustrations ?? []) {
    const pricingOptionId =
      illustration.pricingOptionId?.trim() || input.defaultOptionId || "";

    if (pricingOptionId) {
      pricingOptionIdByIllustrationId.set(illustration.id, pricingOptionId);
    }
  }

  const calculation = calculateCommissionPricing({
    adjustments: input.adjustments ?? [],
    baseItems: input.illustrations
      ? input.illustrations.map((illustration, index) => {
          const pricingOptionId =
            pricingOptionIdByIllustrationId.get(illustration.id) ?? "";
          const catalogOption = catalogOptionById.get(pricingOptionId);

          return {
            key: illustration.id,
            label: `Illustration ${index + 1} — ${
              catalogOption?.option.quoteLabel ?? "Catalog option"
            }`,
            quantity: 1,
            unitAmount: catalogOption?.option.baseAmount ?? "",
          };
        })
      : input.defaultOptionId
        ? (() => {
            const catalogOption = catalogOptionById.get(input.defaultOptionId);

            return catalogOption
              ? [
                  {
                    key: catalogOption.option.id,
                    label: catalogOption.option.quoteLabel,
                    quantity: input.baseQuantity ?? 1,
                    unitAmount: catalogOption.option.baseAmount,
                  },
                ]
              : [];
          })()
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

  const adjustmentById = new Map<
    string,
    CommissionQuoteCatalogAdjustmentSnapshot
  >();

  for (const catalogOption of input.catalogOptions ?? []) {
    for (const adjustment of catalogOption.adjustments) {
      adjustmentById.set(adjustment.id, adjustment);
    }
  }

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

        const illustrationId =
          item.kind === "base" && illustrationIds.has(item.key)
            ? item.key
            : item.kind === "extra" || item.kind === "license"
              ? adjustmentIllustrationId
              : null;

        const pricingOptionId =
          item.kind === "base" ||
          item.kind === "extra" ||
          item.kind === "license"
            ? illustrationId
              ? (pricingOptionIdByIllustrationId.get(illustrationId) ?? null)
              : (input.defaultOptionId ?? null)
            : null;

        const catalogOption = pricingOptionId
          ? catalogOptionById.get(pricingOptionId)
          : undefined;

        return {
          calculationBasis: item.calculationBasis,
          calculationType: item.calculationType,
          description:
            item.kind === "base"
              ? (catalogOption?.option.description ?? null)
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
          pricingOptionId,
          quantity: item.quantity,
          sequence: index + 1,
          unitAmount: item.unitAmount,
          illustrationId,
        };
      }),
      preDiscountSubtotal: calculation.preDiscountSubtotal,
      pricingMode: input.mode,
      pricingVersionId: input.pricingVersionId,
      totalAmount: calculation.totalAmount,
    },
  };
}

function resolveFixedAmount(
  adjustment: CommissionQuoteCatalogAdjustmentSnapshot,
  selection: CommissionQuoteSelectedAdjustment,
):
  | { valid: true; fixedAmount: string | null }
  | Extract<BuildCommissionQuotePricingSnapshotResult, { valid: false }> {
  if (adjustment.calculationType === "percentage") {
    return { valid: true, fixedAmount: null };
  }

  const catalogAmount = adjustment.fixedAmount?.trim() ?? "";
  const selectedAmount = selection.fixedAmount?.trim() ?? "";

  if (!adjustment.isValueEditable) {
    if (selectedAmount && selectedAmount !== catalogAmount) {
      return {
        valid: false,
        code: "fixed_amount_not_editable",
        message: `${adjustment.name} uses the catalog amount and cannot be changed.`,
      };
    }

    return {
      valid: true,
      fixedAmount: catalogAmount,
    };
  }

  if (!selectedAmount) {
    return {
      valid: false,
      code: "editable_fixed_amount_required",
      message: `Enter the amount for ${adjustment.name}.`,
    };
  }

  const minorUnits = parseCommissionQuoteAmount(selectedAmount);

  if (minorUnits === null || minorUnits < BigInt(0)) {
    return {
      valid: false,
      code: "fixed_amount_invalid",
      message: `${adjustment.name} must be a valid non-negative USD amount.`,
    };
  }

  return {
    valid: true,
    fixedAmount: formatCommissionQuoteAmount(minorUnits),
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
