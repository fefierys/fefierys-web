import type {
  commissionRequestSourceEnum,
  commissionServiceClassificationEnum,
} from "@/lib/db/schema/commissions";

export type CommissionRequestSource =
  (typeof commissionRequestSourceEnum.enumValues)[number];
export type CommissionServiceClassification =
  (typeof commissionServiceClassificationEnum.enumValues)[number];

export const COMMISSION_REQUEST_SOURCES = [
  "contact",
  "commissions",
  "admin",
] as const satisfies readonly CommissionRequestSource[];

export const COMMISSION_SERVICE_CLASSIFICATIONS = [
  "unclassified",
  "catalog",
  "custom",
] as const satisfies readonly CommissionServiceClassification[];

export const MAX_COMMISSION_CLASSIFICATION_NOTE_LENGTH = 2_000;

export type CommissionClassificationValidation =
  | {
      valid: true;
      note: string | null;
    }
  | {
      valid: false;
      code: "custom_note_required" | "classification_note_too_long";
      message: string;
    };

export function isCommissionRequestSource(
  value: string,
): value is CommissionRequestSource {
  return (COMMISSION_REQUEST_SOURCES as readonly string[]).includes(value);
}

export function isCommissionServiceClassification(
  value: string,
): value is CommissionServiceClassification {
  return (COMMISSION_SERVICE_CLASSIFICATIONS as readonly string[]).includes(
    value,
  );
}

export function validateCommissionClassification(input: {
  classification: Exclude<CommissionServiceClassification, "unclassified">;
  note?: string | null;
}): CommissionClassificationValidation {
  const note = input.note?.trim() || null;

  if (note && note.length > MAX_COMMISSION_CLASSIFICATION_NOTE_LENGTH) {
    return {
      valid: false,
      code: "classification_note_too_long",
      message: `The classification note cannot exceed ${MAX_COMMISSION_CLASSIFICATION_NOTE_LENGTH} characters.`,
    };
  }

  if (input.classification === "custom" && !note) {
    return {
      valid: false,
      code: "custom_note_required",
      message: "A custom commission classification requires a note.",
    };
  }

  return {
    valid: true,
    note,
  };
}
