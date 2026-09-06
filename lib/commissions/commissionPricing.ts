import {
  formatCommissionQuoteAmount,
  parseCommissionQuoteAmount,
} from "@/lib/commissions/commissionQuote";
import type {
  commissionPricingAdjustmentKindEnum,
  commissionPricingCalculationBasisEnum,
  commissionPricingCalculationTypeEnum,
  commissionPricingVersionStatusEnum,
  commissionPricingVisibilityEnum,
} from "@/lib/db/schema/commissionPricing";

export type CommissionPricingVersionStatus =
  (typeof commissionPricingVersionStatusEnum.enumValues)[number];

export type CommissionPricingVisibility =
  (typeof commissionPricingVisibilityEnum.enumValues)[number];

export type CommissionPricingAdjustmentKind =
  (typeof commissionPricingAdjustmentKindEnum.enumValues)[number];

export type CommissionPricingCalculationType =
  (typeof commissionPricingCalculationTypeEnum.enumValues)[number];

export type CommissionPricingCalculationBasis =
  (typeof commissionPricingCalculationBasisEnum.enumValues)[number];

export const COMMISSION_PRICING_VERSION_STATUSES = [
  "draft",
  "active",
  "archived",
] as const satisfies readonly CommissionPricingVersionStatus[];

export const COMMISSION_PRICING_VISIBILITIES = [
  "public",
  "admin_only",
] as const satisfies readonly CommissionPricingVisibility[];

export const COMMISSION_PRICING_ADJUSTMENT_KINDS = [
  "extra",
  "license",
  "discount",
] as const satisfies readonly CommissionPricingAdjustmentKind[];

export const COMMISSION_PRICING_CALCULATION_TYPES = [
  "fixed",
  "percentage",
] as const satisfies readonly CommissionPricingCalculationType[];

export const COMMISSION_PRICING_CALCULATION_BASES = [
  "none",
  "base_price",
  "base_plus_extras",
  "base_items",
  "pre_discount_subtotal",
] as const satisfies readonly CommissionPricingCalculationBasis[];

const ZERO = BigInt(0);
const ONE_HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10_000);
const HALF_OF_TEN_THOUSAND = BigInt(5_000);
const MAX_PERCENTAGE_BASIS_POINTS = BigInt(10_000);
const PERCENTAGE_PATTERN = /^(?:0|[1-9]\d?)(?:\.\d{1,2})?$|^100(?:\.0{1,2})?$/;

export interface CommissionPricingAvailabilityInput {
  availableFrom?: Date | null;
  availableUntil?: Date | null;
  isActive: boolean;
}

export interface CommissionPricingAdjustmentDefinitionInput {
  calculationBasis: CommissionPricingCalculationBasis;
  calculationType: CommissionPricingCalculationType;
  fixedAmount?: string | null;
  kind: CommissionPricingAdjustmentKind;
  maxQuantity?: number | null;
  percentageRate?: string | null;
}

export type CommissionPricingAdjustmentDefinitionValidation =
  | {
      valid: true;
      fixedAmount: string | null;
      percentageRate: string | null;
    }
  | {
      valid: false;
      code:
        | "fixed_amount_invalid"
        | "percentage_rate_invalid"
        | "calculation_basis_invalid"
        | "quantity_limit_invalid";
      message: string;
    };

export interface CommissionPricingBaseItemInput {
  key: string;
  label: string;
  quantity: number;
  unitAmount: string;
}

export interface CommissionPricingAdjustmentInput extends CommissionPricingAdjustmentDefinitionInput {
  baseItemKey?: string | null;
  internalNote?: string | null;
  key: string;
  label: string;
  quantity: number;
  requiresInternalNote: boolean;
  stackable: boolean;
}

export interface CalculatedCommissionPricingItem {
  calculationBasis: CommissionPricingCalculationBasis;
  calculationType: CommissionPricingCalculationType;
  key: string;
  kind: "base" | CommissionPricingAdjustmentKind;
  label: string;
  lineAmount: string;
  quantity: number;
  unitAmount: string;
}

export type CommissionPricingCalculationResult =
  | {
      valid: true;
      baseSubtotal: string;
      discountTotal: string;
      items: CalculatedCommissionPricingItem[];
      preDiscountSubtotal: string;
      totalAmount: string;
    }
  | {
      valid: false;
      code:
        | "base_item_required"
        | "duplicate_key"
        | "base_item_invalid"
        | "adjustment_invalid"
        | "adjustment_quantity_invalid"
        | "base_item_link_required"
        | "base_item_not_found"
        | "internal_note_required"
        | "multiple_discounts_not_allowed"
        | "non_stackable_discount_conflict"
        | "quote_total_negative";
      message: string;
    };

interface NormalizedBaseItem {
  input: CommissionPricingBaseItemInput;
  lineMinorUnits: bigint;
  unitMinorUnits: bigint;
}

interface NormalizedAdjustment {
  input: CommissionPricingAdjustmentInput;
  percentageBasisPoints: bigint | null;
}

export function isCommissionPricingVersionStatus(
  value: string,
): value is CommissionPricingVersionStatus {
  return (COMMISSION_PRICING_VERSION_STATUSES as readonly string[]).includes(
    value,
  );
}

export function isCommissionPricingVisibility(
  value: string,
): value is CommissionPricingVisibility {
  return (COMMISSION_PRICING_VISIBILITIES as readonly string[]).includes(value);
}

export function isCommissionPricingAdjustmentKind(
  value: string,
): value is CommissionPricingAdjustmentKind {
  return (COMMISSION_PRICING_ADJUSTMENT_KINDS as readonly string[]).includes(
    value,
  );
}

export function isCommissionPricingCalculationType(
  value: string,
): value is CommissionPricingCalculationType {
  return (COMMISSION_PRICING_CALCULATION_TYPES as readonly string[]).includes(
    value,
  );
}

export function isCommissionPricingCalculationBasis(
  value: string,
): value is CommissionPricingCalculationBasis {
  return (COMMISSION_PRICING_CALCULATION_BASES as readonly string[]).includes(
    value,
  );
}

export function isCommissionPricingAvailable(
  input: CommissionPricingAvailabilityInput,
  at: Date = new Date(),
): boolean {
  if (!input.isActive || Number.isNaN(at.getTime())) {
    return false;
  }

  if (
    input.availableFrom &&
    (Number.isNaN(input.availableFrom.getTime()) || input.availableFrom > at)
  ) {
    return false;
  }

  if (
    input.availableUntil &&
    (Number.isNaN(input.availableUntil.getTime()) || input.availableUntil <= at)
  ) {
    return false;
  }

  return true;
}

export function validateCommissionPricingAdjustmentDefinition(
  input: CommissionPricingAdjustmentDefinitionInput,
): CommissionPricingAdjustmentDefinitionValidation {
  if (
    input.maxQuantity !== null &&
    input.maxQuantity !== undefined &&
    (!Number.isInteger(input.maxQuantity) || input.maxQuantity < 1)
  ) {
    return {
      valid: false,
      code: "quantity_limit_invalid",
      message: "The adjustment quantity limit must be a positive integer.",
    };
  }

  if (input.kind === "discount" && input.maxQuantity !== 1) {
    return {
      valid: false,
      code: "quantity_limit_invalid",
      message: "A discount must have a maximum quantity of one.",
    };
  }

  if (input.calculationType === "fixed") {
    const fixedMinorUnits = input.fixedAmount
      ? parseCommissionQuoteAmount(input.fixedAmount)
      : null;

    if (fixedMinorUnits === null || fixedMinorUnits < ZERO) {
      return {
        valid: false,
        code: "fixed_amount_invalid",
        message: "A fixed adjustment requires a non-negative USD amount.",
      };
    }

    if (input.percentageRate) {
      return {
        valid: false,
        code: "percentage_rate_invalid",
        message: "A fixed adjustment cannot contain a percentage rate.",
      };
    }

    if (input.calculationBasis !== "none") {
      return {
        valid: false,
        code: "calculation_basis_invalid",
        message: "A fixed adjustment must use the none calculation basis.",
      };
    }

    return {
      valid: true,
      fixedAmount: formatCommissionQuoteAmount(fixedMinorUnits),
      percentageRate: null,
    };
  }

  const percentageBasisPoints = parsePercentageBasisPoints(
    input.percentageRate ?? "",
  );

  if (percentageBasisPoints === null) {
    return {
      valid: false,
      code: "percentage_rate_invalid",
      message: "A percentage adjustment requires a rate from 0 to 100.",
    };
  }

  if (input.fixedAmount) {
    return {
      valid: false,
      code: "fixed_amount_invalid",
      message: "A percentage adjustment cannot contain a fixed amount.",
    };
  }

  const allowedBasesByKind = {
    extra: ["base_price"],
    license: ["base_plus_extras"],
    discount: ["base_items", "pre_discount_subtotal"],
  } as const satisfies Record<
    CommissionPricingAdjustmentKind,
    readonly CommissionPricingCalculationBasis[]
  >;

  if (
    !(allowedBasesByKind[input.kind] as readonly string[]).includes(
      input.calculationBasis,
    )
  ) {
    return {
      valid: false,
      code: "calculation_basis_invalid",
      message: `${input.kind} cannot use the ${input.calculationBasis} calculation basis.`,
    };
  }

  return {
    valid: true,
    fixedAmount: null,
    percentageRate: formatPercentageBasisPoints(percentageBasisPoints),
  };
}

export function calculateCommissionPricing(input: {
  adjustments: readonly CommissionPricingAdjustmentInput[];
  baseItems: readonly CommissionPricingBaseItemInput[];
}): CommissionPricingCalculationResult {
  if (input.baseItems.length === 0) {
    return {
      valid: false,
      code: "base_item_required",
      message: "At least one catalog base item is required.",
    };
  }

  const seenKeys = new Set<string>();
  const normalizedBaseItems: NormalizedBaseItem[] = [];

  for (const baseItem of input.baseItems) {
    const key = baseItem.key.trim();
    const label = baseItem.label.trim();
    const unitMinorUnits = parseCommissionQuoteAmount(baseItem.unitAmount);

    if (!key || seenKeys.has(key)) {
      return {
        valid: false,
        code: "duplicate_key",
        message: "Every pricing item requires a unique non-empty key.",
      };
    }

    seenKeys.add(key);

    if (
      !label ||
      unitMinorUnits === null ||
      unitMinorUnits < ZERO ||
      !Number.isInteger(baseItem.quantity) ||
      baseItem.quantity < 1
    ) {
      return {
        valid: false,
        code: "base_item_invalid",
        message: `Base item ${key} is invalid.`,
      };
    }

    normalizedBaseItems.push({
      input: {
        ...baseItem,
        key,
        label,
      },
      lineMinorUnits: unitMinorUnits * BigInt(baseItem.quantity),
      unitMinorUnits,
    });
  }

  const baseItemByKey = new Map(
    normalizedBaseItems.map((item) => [item.input.key, item]),
  );
  const normalizedAdjustments: NormalizedAdjustment[] = [];

  for (const adjustment of input.adjustments) {
    const key = adjustment.key.trim();
    const label = adjustment.label.trim();

    if (!key || seenKeys.has(key)) {
      return {
        valid: false,
        code: "duplicate_key",
        message: "Every pricing item requires a unique non-empty key.",
      };
    }

    seenKeys.add(key);

    const validation =
      validateCommissionPricingAdjustmentDefinition(adjustment);

    if (!validation.valid || !label) {
      return {
        valid: false,
        code: "adjustment_invalid",
        message: validation.valid
          ? `Adjustment ${key} requires a label.`
          : validation.message,
      };
    }

    if (
      !Number.isInteger(adjustment.quantity) ||
      adjustment.quantity < 1 ||
      (adjustment.maxQuantity !== null &&
        adjustment.maxQuantity !== undefined &&
        adjustment.quantity > adjustment.maxQuantity)
    ) {
      return {
        valid: false,
        code: "adjustment_quantity_invalid",
        message: `Adjustment ${key} has an invalid quantity.`,
      };
    }

    if (adjustment.requiresInternalNote && !adjustment.internalNote?.trim()) {
      return {
        valid: false,
        code: "internal_note_required",
        message: `Adjustment ${key} requires an internal note.`,
      };
    }

    if (adjustment.kind !== "discount") {
      if (!adjustment.baseItemKey) {
        return {
          valid: false,
          code: "base_item_link_required",
          message: `Adjustment ${key} must reference its base item.`,
        };
      }

      if (!baseItemByKey.has(adjustment.baseItemKey)) {
        return {
          valid: false,
          code: "base_item_not_found",
          message: `The base item for adjustment ${key} was not found.`,
        };
      }
    }

    normalizedAdjustments.push({
      input: {
        ...adjustment,
        key,
        label,
      },
      percentageBasisPoints:
        adjustment.calculationType === "percentage"
          ? parsePercentageBasisPoints(adjustment.percentageRate ?? "")
          : null,
    });
  }

  const discounts = normalizedAdjustments.filter(
    (adjustment) => adjustment.input.kind === "discount",
  );

  if (discounts.length > 1) {
    return {
      valid: false,
      code: discounts.some((discount) => !discount.input.stackable)
        ? "non_stackable_discount_conflict"
        : "multiple_discounts_not_allowed",
      message: "Only one discount may be applied to a quote.",
    };
  }

  const calculatedItems: CalculatedCommissionPricingItem[] =
    normalizedBaseItems.map((baseItem) => ({
      calculationBasis: "none",
      calculationType: "fixed",
      key: baseItem.input.key,
      kind: "base",
      label: baseItem.input.label,
      lineAmount: formatCommissionQuoteAmount(baseItem.lineMinorUnits),
      quantity: baseItem.input.quantity,
      unitAmount: formatCommissionQuoteAmount(baseItem.unitMinorUnits),
    }));

  const baseSubtotalMinorUnits = normalizedBaseItems.reduce(
    (total, item) => total + item.lineMinorUnits,
    ZERO,
  );

  const extraTotalsByBaseItem = new Map<string, bigint>();
  let preDiscountSubtotalMinorUnits = baseSubtotalMinorUnits;

  for (const adjustment of normalizedAdjustments.filter(
    (item) => item.input.kind === "extra",
  )) {
    const line = calculateAdjustmentLine({
      adjustment,
      baseItemByKey,
      baseSubtotalMinorUnits,
      extraTotalsByBaseItem,
      preDiscountSubtotalMinorUnits,
    });

    calculatedItems.push(line.item);
    preDiscountSubtotalMinorUnits += line.lineMinorUnits;

    const baseItemKey = adjustment.input.baseItemKey as string;
    extraTotalsByBaseItem.set(
      baseItemKey,
      (extraTotalsByBaseItem.get(baseItemKey) ?? ZERO) + line.lineMinorUnits,
    );
  }

  for (const adjustment of normalizedAdjustments.filter(
    (item) => item.input.kind === "license",
  )) {
    const line = calculateAdjustmentLine({
      adjustment,
      baseItemByKey,
      baseSubtotalMinorUnits,
      extraTotalsByBaseItem,
      preDiscountSubtotalMinorUnits,
    });

    calculatedItems.push(line.item);
    preDiscountSubtotalMinorUnits += line.lineMinorUnits;
  }

  let discountTotalMinorUnits = ZERO;

  for (const adjustment of discounts) {
    const line = calculateAdjustmentLine({
      adjustment,
      baseItemByKey,
      baseSubtotalMinorUnits,
      extraTotalsByBaseItem,
      preDiscountSubtotalMinorUnits,
    });

    discountTotalMinorUnits += line.lineMinorUnits;
    calculatedItems.push({
      ...line.item,
      lineAmount: formatCommissionQuoteAmount(-line.lineMinorUnits),
      unitAmount: formatCommissionQuoteAmount(-line.unitMinorUnits),
    });
  }

  const totalMinorUnits =
    preDiscountSubtotalMinorUnits - discountTotalMinorUnits;

  if (totalMinorUnits < ZERO) {
    return {
      valid: false,
      code: "quote_total_negative",
      message: "Pricing adjustments cannot produce a negative quote total.",
    };
  }

  return {
    valid: true,
    baseSubtotal: formatCommissionQuoteAmount(baseSubtotalMinorUnits),
    discountTotal: formatCommissionQuoteAmount(discountTotalMinorUnits),
    items: calculatedItems,
    preDiscountSubtotal: formatCommissionQuoteAmount(
      preDiscountSubtotalMinorUnits,
    ),
    totalAmount: formatCommissionQuoteAmount(totalMinorUnits),
  };
}

function calculateAdjustmentLine(input: {
  adjustment: NormalizedAdjustment;
  baseItemByKey: ReadonlyMap<string, NormalizedBaseItem>;
  baseSubtotalMinorUnits: bigint;
  extraTotalsByBaseItem: ReadonlyMap<string, bigint>;
  preDiscountSubtotalMinorUnits: bigint;
}): {
  item: CalculatedCommissionPricingItem;
  lineMinorUnits: bigint;
  unitMinorUnits: bigint;
} {
  const { adjustment } = input;
  let unitMinorUnits: bigint;

  if (adjustment.input.calculationType === "fixed") {
    unitMinorUnits = parseCommissionQuoteAmount(
      adjustment.input.fixedAmount ?? "",
    ) as bigint;
  } else {
    const basisMinorUnits = resolvePercentageBasis(input);
    unitMinorUnits = calculatePercentageAmount(
      basisMinorUnits,
      adjustment.percentageBasisPoints as bigint,
    );
  }

  const lineMinorUnits = unitMinorUnits * BigInt(adjustment.input.quantity);

  return {
    item: {
      calculationBasis: adjustment.input.calculationBasis,
      calculationType: adjustment.input.calculationType,
      key: adjustment.input.key,
      kind: adjustment.input.kind,
      label: adjustment.input.label,
      lineAmount: formatCommissionQuoteAmount(lineMinorUnits),
      quantity: adjustment.input.quantity,
      unitAmount: formatCommissionQuoteAmount(unitMinorUnits),
    },
    lineMinorUnits,
    unitMinorUnits,
  };
}

function resolvePercentageBasis(input: {
  adjustment: NormalizedAdjustment;
  baseItemByKey: ReadonlyMap<string, NormalizedBaseItem>;
  baseSubtotalMinorUnits: bigint;
  extraTotalsByBaseItem: ReadonlyMap<string, bigint>;
  preDiscountSubtotalMinorUnits: bigint;
}): bigint {
  const { adjustment } = input;

  if (adjustment.input.calculationBasis === "base_items") {
    return input.baseSubtotalMinorUnits;
  }

  if (adjustment.input.calculationBasis === "pre_discount_subtotal") {
    return input.preDiscountSubtotalMinorUnits;
  }

  const baseItem = input.baseItemByKey.get(
    adjustment.input.baseItemKey as string,
  ) as NormalizedBaseItem;

  if (adjustment.input.calculationBasis === "base_plus_extras") {
    return (
      baseItem.lineMinorUnits +
      (input.extraTotalsByBaseItem.get(baseItem.input.key) ?? ZERO)
    );
  }

  return baseItem.unitMinorUnits;
}

function parsePercentageBasisPoints(value: string): bigint | null {
  const normalizedValue = value.trim();

  if (!PERCENTAGE_PATTERN.test(normalizedValue)) {
    return null;
  }

  const [wholePart, fractionPart = ""] = normalizedValue.split(".");
  const basisPoints =
    BigInt(wholePart) * ONE_HUNDRED +
    BigInt(fractionPart.padEnd(2, "0") || "0");

  return basisPoints <= MAX_PERCENTAGE_BASIS_POINTS ? basisPoints : null;
}

function formatPercentageBasisPoints(basisPoints: bigint): string {
  const wholePart = basisPoints / ONE_HUNDRED;
  const fractionPart = (basisPoints % ONE_HUNDRED).toString().padStart(2, "0");

  return `${wholePart}.${fractionPart}`;
}

function calculatePercentageAmount(
  basisMinorUnits: bigint,
  percentageBasisPoints: bigint,
): bigint {
  return (
    (basisMinorUnits * percentageBasisPoints + HALF_OF_TEN_THOUSAND) /
    TEN_THOUSAND
  );
}
