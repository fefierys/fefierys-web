import {
  validateCommissionPaymentPlan,
  type CommissionPaymentPlanValidation,
  type CommissionPaymentStageInput,
  type NormalizedCommissionPaymentStage,
} from "./commissionPaymentPlan";

export interface CommissionPaymentDeliverableInput {
  title: string;
  description?: string | null;
  quantity: number;
  stages: readonly CommissionPaymentStageInput[];
}

export interface CommissionGroupedPaymentPlanInput {
  /*
   * Payments for the overall project, without a specific
   * deliverable. These appear first in the payment sequence.
   */
  projectStages: readonly CommissionPaymentStageInput[];

  /*
   * Each deliverable may have its own payment stages.
   *
   * A deliverable can have no individual stages when its
   * payments are covered by the overall project plan.
   */
  deliverables: readonly CommissionPaymentDeliverableInput[];
}

export interface CommissionPaymentStageEditInput
  extends CommissionPaymentStageInput {
  /**
   * Existing stage ID.
   * Omit only when adding a new stage.
   */
  id?: string;
}

export interface CommissionPaymentDeliverableEditInput
  extends Omit<CommissionPaymentDeliverableInput, "stages"> {
  /**
   * Existing deliverable ID.
   * Omit only when adding a new deliverable.
   */
  id?: string;
  stages: readonly CommissionPaymentStageEditInput[];
}

export interface CommissionGroupedPaymentPlanEditInput {
  projectStages: readonly CommissionPaymentStageEditInput[];
  deliverables: readonly CommissionPaymentDeliverableEditInput[];
}

export interface NormalizedCommissionPaymentDeliverable {
  sequence: number;
  title: string;
  description: string | null;
  quantity: number;
  stages: NormalizedCommissionPaymentStage[];
}

export interface NormalizedGroupedPaymentStage
  extends NormalizedCommissionPaymentStage {
  /*
   * null -> payment for the overall project
   * number -> sequence of the associated deliverable
   *
   * The repository will resolve this sequence to the
   * deliverable's database ID when saving the plan.
   */
  deliverableSequence: number | null;
}

type ExistingPaymentPlanError = Extract<
  CommissionPaymentPlanValidation,
  { valid: false }
>;

export type CommissionGroupedPaymentPlanValidation =
  | {
      valid: true;
      totalAmount: string;
      projectStages: NormalizedCommissionPaymentStage[];
      deliverables: NormalizedCommissionPaymentDeliverable[];
      stages: NormalizedGroupedPaymentStage[];
    }
  | {
      valid: false;
      code:
        | ExistingPaymentPlanError["code"]
        | "deliverable_title_invalid"
        | "deliverable_quantity_invalid"
        | "too_many_deliverables"
        | "too_many_stages";
      deliverableIndex?: number;
      stageIndex?: number;
      message: string;
    };

const MAX_DELIVERABLES = 100;
const MAX_PAYMENT_STAGES = 50;

export function validateCommissionGroupedPaymentPlan(
  quoteTotalAmount: string,
  input: CommissionGroupedPaymentPlanInput,
): CommissionGroupedPaymentPlanValidation {
  if (input.deliverables.length > MAX_DELIVERABLES) {
    return {
      valid: false,
      code: "too_many_deliverables",
      message: `A payment plan cannot contain more than ${MAX_DELIVERABLES} deliverables.`,
    };
  }

  const stageCount =
    input.projectStages.length +
    input.deliverables.reduce(
      (total, deliverable) => total + deliverable.stages.length,
      0,
    );

  if (stageCount > MAX_PAYMENT_STAGES) {
    return {
      valid: false,
      code: "too_many_stages",
      message: `A payment plan cannot contain more than ${MAX_PAYMENT_STAGES} payment stages.`,
    };
  }

  for (const [index, deliverable] of input.deliverables.entries()) {
    const title = deliverable.title.trim();

    if (!title || title.length > 150) {
      return {
        valid: false,
        code: "deliverable_title_invalid",
        deliverableIndex: index,
        message: `Deliverable ${index + 1} must have a title between 1 and 150 characters.`,
      };
    }

    if (
      !Number.isSafeInteger(deliverable.quantity) ||
      deliverable.quantity < 1
    ) {
      return {
        valid: false,
        code: "deliverable_quantity_invalid",
        deliverableIndex: index,
        message: `Deliverable ${index + 1} must have a positive whole-number quantity.`,
      };
    }
  }

  /*
   * The global payment order is:
   *
   * 1. Overall-project payment stages.
   * 2. Payment stages of deliverable 1.
   * 3. Payment stages of deliverable 2.
   * 4. And so on.
   *
   * We keep one global installment sequence so that
   * existing payment-plan ordering remains compatible.
   */
  const flatStages: CommissionPaymentStageInput[] = [
    ...input.projectStages,
    ...input.deliverables.flatMap(
      (deliverable) => deliverable.stages,
    ),
  ];

  /*
   * Reuse the existing validation for exact monetary totals,
   * labels, triggers and custom-trigger requirements.
   */
  const paymentValidation = validateCommissionPaymentPlan(
    quoteTotalAmount,
    flatStages,
  );

  if (!paymentValidation.valid) {
    return paymentValidation;
  }

  const projectStageCount = input.projectStages.length;

  const projectStages = paymentValidation.stages.slice(
    0,
    projectStageCount,
  );

  let nextStageIndex = projectStageCount;

  const deliverables = input.deliverables.map(
    (deliverable, index): NormalizedCommissionPaymentDeliverable => {
      const stages = paymentValidation.stages.slice(
        nextStageIndex,
        nextStageIndex + deliverable.stages.length,
      );

      nextStageIndex += deliverable.stages.length;

      return {
        sequence: index + 1,
        title: deliverable.title.trim(),
        description: deliverable.description?.trim() || null,
        quantity: deliverable.quantity,
        stages,
      };
    },
  );

  const stages: NormalizedGroupedPaymentStage[] = [
    ...projectStages.map((stage) => ({
      ...stage,
      deliverableSequence: null,
    })),

    ...deliverables.flatMap((deliverable) =>
      deliverable.stages.map((stage) => ({
        ...stage,
        deliverableSequence: deliverable.sequence,
      })),
    ),
  ];

  return {
    valid: true,
    totalAmount: paymentValidation.totalAmount,
    projectStages,
    deliverables,
    stages,
  };
}