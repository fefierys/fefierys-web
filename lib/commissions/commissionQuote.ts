import type { quoteStatusEnum } from "@/lib/db/schema/commissions";

export type CommissionQuoteStatus = (typeof quoteStatusEnum.enumValues)[number];

export const COMMISSION_QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "superseded",
] as const satisfies readonly CommissionQuoteStatus[];

export const TERMINAL_COMMISSION_QUOTE_STATUSES = [
  "accepted",
  "declined",
  "expired",
  "superseded",
] as const satisfies readonly CommissionQuoteStatus[];

export const COMMISSION_QUOTE_STATUS_TRANSITIONS = {
  draft: ["sent"],
  sent: ["accepted", "declined", "expired", "superseded"],
  accepted: [],
  declined: [],
  expired: [],
  superseded: [],
} as const satisfies Record<
  CommissionQuoteStatus,
  readonly CommissionQuoteStatus[]
>;

export const MAX_COMMISSION_QUOTE_ITEMS = 50;
export const MAX_COMMISSION_QUOTE_ITEM_QUANTITY = 10_000;
export const MAX_COMMISSION_QUOTE_TEXT_LENGTH = 5000;

const ZERO_MINOR_UNITS = BigInt(0);
const MINOR_UNITS_PER_MAJOR_UNIT = BigInt(100);
const MAX_MONEY_MINOR_UNITS = BigInt("999999999999");

const MONEY_PATTERN = /^-?(?:0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/;

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export interface CommissionQuoteItemInput {
  label: string;
  description?: string | null;
  quantity: number;
  unitAmount: string;
}

export interface NormalizedCommissionQuoteItem {
  sequence: number;
  label: string;
  description: string | null;
  quantity: number;
  unitAmount: string;
  lineAmount: string;
}

export interface CommissionQuoteDraftInput {
  currency: string;
  description?: string | null;
  notes?: string | null;
  validUntil?: Date | null;
  items: readonly CommissionQuoteItemInput[];
}

export type CommissionQuoteDraftValidation =
  | {
      valid: true;
      currency: string;
      description: string | null;
      notes: string | null;
      validUntil: Date | null;
      items: NormalizedCommissionQuoteItem[];
      totalAmount: string;
    }
  | {
      valid: false;
      code:
        | "currency_invalid"
        | "description_too_long"
        | "notes_too_long"
        | "valid_until_invalid"
        | "items_required"
        | "too_many_items"
        | "item_label_required"
        | "item_label_too_long"
        | "item_description_too_long"
        | "item_quantity_invalid"
        | "item_amount_invalid"
        | "item_total_too_large"
        | "quote_total_negative"
        | "quote_total_too_large";
      message: string;
    };

export type CommissionQuoteTransitionValidation =
  | {
      valid: true;
    }
  | {
      valid: false;
      code:
        | "quote_status_unchanged"
        | "quote_transition_not_allowed"
        | "valid_until_required"
        | "valid_until_not_future"
        | "quote_expired"
        | "quote_not_expired";
      message: string;
    };

export function isCommissionQuoteStatus(
  value: string,
): value is CommissionQuoteStatus {
  return (COMMISSION_QUOTE_STATUSES as readonly string[]).includes(value);
}

export function isTerminalCommissionQuoteStatus(
  status: CommissionQuoteStatus,
): status is (typeof TERMINAL_COMMISSION_QUOTE_STATUSES)[number] {
  return (
    TERMINAL_COMMISSION_QUOTE_STATUSES as readonly CommissionQuoteStatus[]
  ).includes(status);
}

export function getAllowedCommissionQuoteTransitions(
  status: CommissionQuoteStatus,
): readonly CommissionQuoteStatus[] {
  return COMMISSION_QUOTE_STATUS_TRANSITIONS[status];
}

export function parseCommissionQuoteAmount(value: string): bigint | null {
  const normalizedValue = value.trim();

  if (!MONEY_PATTERN.test(normalizedValue)) {
    return null;
  }

  const negative = normalizedValue.startsWith("-");

  const unsignedValue = negative ? normalizedValue.slice(1) : normalizedValue;

  const [wholePart, fractionPart = ""] = unsignedValue.split(".");

  const minorUnits =
    BigInt(wholePart) * MINOR_UNITS_PER_MAJOR_UNIT +
    BigInt(fractionPart.padEnd(2, "0") || "0");

  if (minorUnits > MAX_MONEY_MINOR_UNITS) {
    return null;
  }

  return negative ? -minorUnits : minorUnits;
}

export function formatCommissionQuoteAmount(minorUnits: bigint): string {
  const negative = minorUnits < ZERO_MINOR_UNITS;
  const absoluteValue = negative ? -minorUnits : minorUnits;

  const wholePart = absoluteValue / MINOR_UNITS_PER_MAJOR_UNIT;

  const fractionPart = (absoluteValue % MINOR_UNITS_PER_MAJOR_UNIT)
    .toString()
    .padStart(2, "0");

  return `${negative ? "-" : ""}${wholePart}.${fractionPart}`;
}

export function validateCommissionQuoteDraft(
  input: CommissionQuoteDraftInput,
): CommissionQuoteDraftValidation {
  const currency = input.currency.trim().toUpperCase();
  const description = input.description?.trim() || null;
  const notes = input.notes?.trim() || null;
  const validUntil = input.validUntil ?? null;

  if (!CURRENCY_PATTERN.test(currency)) {
    return {
      valid: false,
      code: "currency_invalid",
      message: "Currency must be a three-letter ISO-style code.",
    };
  }

  if (description && description.length > MAX_COMMISSION_QUOTE_TEXT_LENGTH) {
    return {
      valid: false,
      code: "description_too_long",
      message: `The quote description cannot exceed ${MAX_COMMISSION_QUOTE_TEXT_LENGTH} characters.`,
    };
  }

  if (notes && notes.length > MAX_COMMISSION_QUOTE_TEXT_LENGTH) {
    return {
      valid: false,
      code: "notes_too_long",
      message: `The quote notes cannot exceed ${MAX_COMMISSION_QUOTE_TEXT_LENGTH} characters.`,
    };
  }

  if (
    validUntil &&
    (!(validUntil instanceof Date) || Number.isNaN(validUntil.getTime()))
  ) {
    return {
      valid: false,
      code: "valid_until_invalid",
      message: "The quote validity date is invalid.",
    };
  }

  if (input.items.length === 0) {
    return {
      valid: false,
      code: "items_required",
      message: "At least one quote item is required.",
    };
  }

  if (input.items.length > MAX_COMMISSION_QUOTE_ITEMS) {
    return {
      valid: false,
      code: "too_many_items",
      message: `A quote cannot contain more than ${MAX_COMMISSION_QUOTE_ITEMS} items.`,
    };
  }

  const items: NormalizedCommissionQuoteItem[] = [];
  let totalMinorUnits = ZERO_MINOR_UNITS;

  for (const [index, item] of input.items.entries()) {
    const itemNumber = index + 1;
    const label = item.label.trim();
    const itemDescription = item.description?.trim() || null;

    if (!label) {
      return {
        valid: false,
        code: "item_label_required",
        message: `Quote item ${itemNumber} requires a label.`,
      };
    }

    if (label.length > 250) {
      return {
        valid: false,
        code: "item_label_too_long",
        message: `The label for quote item ${itemNumber} cannot exceed 250 characters.`,
      };
    }

    if (
      itemDescription &&
      itemDescription.length > MAX_COMMISSION_QUOTE_TEXT_LENGTH
    ) {
      return {
        valid: false,
        code: "item_description_too_long",
        message: `The description for quote item ${itemNumber} cannot exceed ${MAX_COMMISSION_QUOTE_TEXT_LENGTH} characters.`,
      };
    }

    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > MAX_COMMISSION_QUOTE_ITEM_QUANTITY
    ) {
      return {
        valid: false,
        code: "item_quantity_invalid",
        message: `The quantity for quote item ${itemNumber} must be an integer between 1 and ${MAX_COMMISSION_QUOTE_ITEM_QUANTITY}.`,
      };
    }

    const unitAmountMinorUnits = parseCommissionQuoteAmount(item.unitAmount);

    if (unitAmountMinorUnits === null) {
      return {
        valid: false,
        code: "item_amount_invalid",
        message: `The unit amount for quote item ${itemNumber} is invalid.`,
      };
    }

    const lineMinorUnits = unitAmountMinorUnits * BigInt(item.quantity);

    if (
      lineMinorUnits > MAX_MONEY_MINOR_UNITS ||
      lineMinorUnits < -MAX_MONEY_MINOR_UNITS
    ) {
      return {
        valid: false,
        code: "item_total_too_large",
        message: `The total for quote item ${itemNumber} exceeds the supported amount.`,
      };
    }

    totalMinorUnits += lineMinorUnits;

    items.push({
      sequence: itemNumber,
      label,
      description: itemDescription,
      quantity: item.quantity,
      unitAmount: formatCommissionQuoteAmount(unitAmountMinorUnits),
      lineAmount: formatCommissionQuoteAmount(lineMinorUnits),
    });
  }

  if (totalMinorUnits < ZERO_MINOR_UNITS) {
    return {
      valid: false,
      code: "quote_total_negative",
      message: "The quote total cannot be negative.",
    };
  }

  if (totalMinorUnits > MAX_MONEY_MINOR_UNITS) {
    return {
      valid: false,
      code: "quote_total_too_large",
      message: "The quote total exceeds the supported amount.",
    };
  }

  return {
    valid: true,
    currency,
    description,
    notes,
    validUntil,
    items,
    totalAmount: formatCommissionQuoteAmount(totalMinorUnits),
  };
}

export function validateCommissionQuoteTransition(input: {
  fromStatus: CommissionQuoteStatus;
  toStatus: CommissionQuoteStatus;
  validUntil: Date | null;
  now?: Date;
}): CommissionQuoteTransitionValidation {
  const now = input.now ?? new Date();

  if (input.fromStatus === input.toStatus) {
    return {
      valid: false,
      code: "quote_status_unchanged",
      message: "The quote already has the selected status.",
    };
  }

  if (
    !getAllowedCommissionQuoteTransitions(input.fromStatus).includes(
      input.toStatus,
    )
  ) {
    return {
      valid: false,
      code: "quote_transition_not_allowed",
      message: `Transition from ${input.fromStatus} to ${input.toStatus} is not allowed.`,
    };
  }

  if (input.toStatus === "sent") {
    if (!input.validUntil) {
      return {
        valid: false,
        code: "valid_until_required",
        message: "A validity date is required before sending a quote.",
      };
    }

    if (input.validUntil.getTime() <= now.getTime()) {
      return {
        valid: false,
        code: "valid_until_not_future",
        message: "The quote validity date must be in the future.",
      };
    }
  }

  if (
    input.toStatus === "accepted" &&
    (!input.validUntil || input.validUntil.getTime() <= now.getTime())
  ) {
    return {
      valid: false,
      code: "quote_expired",
      message: "An expired quote cannot be accepted.",
    };
  }

  if (
    input.toStatus === "expired" &&
    (!input.validUntil || input.validUntil.getTime() > now.getTime())
  ) {
    return {
      valid: false,
      code: "quote_not_expired",
      message: "A quote cannot expire before its validity date.",
    };
  }

  return {
    valid: true,
  };
}
