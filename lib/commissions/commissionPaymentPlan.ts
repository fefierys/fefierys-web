import {
  formatCommissionQuoteAmount,
  parseCommissionQuoteAmount,
} from "./commissionQuote";

export interface CommissionPaymentPlanAmountInput {
  amount: string;
}

export type CommissionPaymentPlanAmountValidation =
  | {
      valid: true;
      totalAmount: string;
      amounts: string[];
    }
  | {
      valid: false;
      code:
        | "total_amount_invalid"
        | "zero_total_requires_separate_flow"
        | "installments_required"
        | "installment_amount_invalid"
        | "installment_total_mismatch";
      installmentIndex?: number;
      message: string;
    };

export function validateCommissionPaymentPlanAmounts(
  quoteTotalAmount: string,
  installments: readonly CommissionPaymentPlanAmountInput[],
): CommissionPaymentPlanAmountValidation {
  const quoteTotal = parseCommissionQuoteAmount(quoteTotalAmount);

  if (quoteTotal === null || quoteTotal < BigInt(0)) {
    return {
      valid: false,
      code: "total_amount_invalid",
      message: "The accepted quote total is invalid.",
    };
  }

  if (quoteTotal === BigInt(0)) {
    return {
      valid: false,
      code: "zero_total_requires_separate_flow",
      message:
        "A zero-total quote requires a flow without payment installments.",
    };
  }

  if (installments.length === 0) {
    return {
      valid: false,
      code: "installments_required",
      message: "At least one payment installment is required.",
    };
  }

  const normalizedAmounts: string[] = [];
  let installmentTotal = BigInt(0);

  for (const [index, installment] of installments.entries()) {
    const amount = parseCommissionQuoteAmount(installment.amount);

    if (amount === null || amount <= BigInt(0)) {
      return {
        valid: false,
        code: "installment_amount_invalid",
        installmentIndex: index,
        message: `Installment ${index + 1} must have a valid amount greater than zero.`,
      };
    }

    installmentTotal += amount;
    normalizedAmounts.push(formatCommissionQuoteAmount(amount));
  }

  if (installmentTotal !== quoteTotal) {
    return {
      valid: false,
      code: "installment_total_mismatch",
      message:
        "The sum of payment installments must equal the accepted quote total.",
    };
  }

  return {
    valid: true,
    totalAmount: formatCommissionQuoteAmount(quoteTotal),
    amounts: normalizedAmounts,
  };
}

export const COMMISSION_PAYMENT_STAGE_TRIGGERS = [
  "before_start",
  "after_sketch_approval",
  "before_final_delivery",
  "custom",
] as const;

export type CommissionPaymentStageTrigger =
  (typeof COMMISSION_PAYMENT_STAGE_TRIGGERS)[number];

export interface CommissionPaymentStageInput {
  label: string;
  amount: string;
  trigger: string;
  customTriggerNote?: string | null;
}

export interface NormalizedCommissionPaymentStage {
  sequence: number;
  label: string;
  amount: string;
  trigger: CommissionPaymentStageTrigger;
  customTriggerNote: string | null;
}

type CommissionPaymentPlanAmountErrorCode = Extract<
  CommissionPaymentPlanAmountValidation,
  { valid: false }
>["code"];

export type CommissionPaymentPlanValidation =
  | {
      valid: true;
      totalAmount: string;
      stages: NormalizedCommissionPaymentStage[];
    }
  | {
      valid: false;
      code:
        | CommissionPaymentPlanAmountErrorCode
        | "stage_label_invalid"
        | "stage_trigger_invalid"
        | "custom_trigger_note_required"
        | "custom_trigger_note_forbidden";
      stageIndex?: number;
      message: string;
    };

export function validateCommissionPaymentPlan(
  quoteTotalAmount: string,
  stages: readonly CommissionPaymentStageInput[],
): CommissionPaymentPlanValidation {
  const amountValidation = validateCommissionPaymentPlanAmounts(
    quoteTotalAmount,
    stages,
  );

  if (!amountValidation.valid) {
    return {
      valid: false,
      code: amountValidation.code,
      stageIndex: amountValidation.installmentIndex,
      message: amountValidation.message,
    };
  }

  const normalizedStages: NormalizedCommissionPaymentStage[] = [];

  for (const [index, stage] of stages.entries()) {
    const label = stage.label.trim();

    if (!label || label.length > 150) {
      return {
        valid: false,
        code: "stage_label_invalid",
        stageIndex: index,
        message: `Stage ${index + 1} must have a label between 1 and 150 characters.`,
      };
    }

    if (
      !(COMMISSION_PAYMENT_STAGE_TRIGGERS as readonly string[]).includes(
        stage.trigger,
      )
    ) {
      return {
        valid: false,
        code: "stage_trigger_invalid",
        stageIndex: index,
        message: `Stage ${index + 1} has an invalid payment trigger.`,
      };
    }

    const trigger = stage.trigger as CommissionPaymentStageTrigger;

    const customTriggerNote = stage.customTriggerNote?.trim() || null;

    if (trigger === "custom" && !customTriggerNote) {
      return {
        valid: false,
        code: "custom_trigger_note_required",
        stageIndex: index,
        message: `Stage ${index + 1} must explain its custom payment trigger.`,
      };
    }

    if (trigger !== "custom" && customTriggerNote) {
      return {
        valid: false,
        code: "custom_trigger_note_forbidden",
        stageIndex: index,
        message: `Stage ${index + 1} cannot have a custom trigger note unless its trigger is custom.`,
      };
    }

    normalizedStages.push({
      sequence: index + 1,
      label,
      amount: amountValidation.amounts[index],
      trigger,
      customTriggerNote,
    });
  }

  return {
    valid: true,
    totalAmount: amountValidation.totalAmount,
    stages: normalizedStages,
  };
}