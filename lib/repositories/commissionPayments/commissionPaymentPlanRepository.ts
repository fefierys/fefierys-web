import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  validateCommissionPaymentPlan,
  type CommissionPaymentPlanValidation,
  type CommissionPaymentStageInput,
} from "../../commissions/commissionPaymentPlan";

import {
  validateCommissionGroupedPaymentPlan,
  type CommissionGroupedPaymentPlanEditInput,
  type CommissionGroupedPaymentPlanInput,
  type CommissionGroupedPaymentPlanValidation,
} from "../../commissions/commissionGroupedPaymentPlan";

import { db } from "../../db";

import {
  commissionAgreements,
  commissionDeliverables,
  commissionPaymentInstallments,
  commissionPayments,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";

type CommissionPaymentInstallment =
  typeof commissionPaymentInstallments.$inferSelect;

type CommissionDeliverable =
  typeof commissionDeliverables.$inferSelect;

type CommissionStatus = typeof commissions.$inferSelect.status;

type InvalidPaymentPlanValidation = Extract<
  CommissionPaymentPlanValidation,
  { valid: false }
>;

export interface CreateCommissionGroupedPaymentPlanInput
  extends Omit<CreateCommissionPaymentPlanInput, "stages"> {
  plan: CommissionGroupedPaymentPlanInput;
}

export type CreateCommissionGroupedPaymentPlanResult =
  | {
      outcome: "created";
      deliverables: CommissionDeliverable[];
      installments: CommissionPaymentInstallment[];
    }
  | {
      outcome: "invalid";
      validation: Extract<
        CommissionGroupedPaymentPlanValidation,
        { valid: false }
      >;
    }
  | Exclude<
      CreateCommissionPaymentPlanResult,
      { outcome: "created" | "invalid" }
    >;

export interface CreateCommissionPaymentPlanInput {
  commissionId: string;
  quoteId: string;
  agreementId: string;
  stages: readonly CommissionPaymentStageInput[];
  createdByAdminUserId: string;
}

export type CreateCommissionPaymentPlanResult =
  | {
      outcome: "created";
      installments: CommissionPaymentInstallment[];
    }
  | {
      outcome: "invalid";
      validation: InvalidPaymentPlanValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "wrong_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "quote_not_accepted";
    }
  | {
      outcome: "agreement_not_draft";
    }
  | {
      outcome: "plan_already_exists";
    }
  | {
      outcome: "conflict";
    };

export interface UpdateCommissionPaymentStageInput
  extends CommissionPaymentStageInput {
  id?: string;
}

export interface UpdateCommissionPaymentPlanInput {
  commissionId: string;
  quoteId: string;
  agreementId: string;
  expectedAgreementUpdatedAt: Date;
  stages: readonly UpdateCommissionPaymentStageInput[];
  updatedByAdminUserId: string;
}

export type UpdateCommissionPaymentPlanResult =
  | {
      outcome: "updated";
      installments: CommissionPaymentInstallment[];
    }
  | {
      outcome: "invalid";
      validation: InvalidPaymentPlanValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "wrong_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "quote_not_accepted";
    }
  | {
      outcome: "agreement_not_draft";
    }
  | {
      outcome: "plan_not_found";
    }
  | {
      outcome: "plan_locked";
    }
  | {
      outcome: "conflict";
    };

export interface UpdateCommissionGroupedPaymentPlanInput
  extends Omit<UpdateCommissionPaymentPlanInput, "stages"> {
  plan: CommissionGroupedPaymentPlanEditInput;
}

export type UpdateCommissionGroupedPaymentPlanResult =
  | {
      outcome: "updated";
      deliverables: CommissionDeliverable[];
      installments: CommissionPaymentInstallment[];
    }
  | {
      outcome: "invalid";
      validation: Extract<
        CommissionGroupedPaymentPlanValidation,
        { valid: false }
      >;
    }
  | Exclude<
      UpdateCommissionPaymentPlanResult,
      { outcome: "updated" | "invalid" }
    >;

async function getCommissionPaymentPlanPreparationState(
  input: Pick<
    CreateCommissionPaymentPlanInput,
    "commissionId" | "quoteId" | "agreementId"
  >,
) {
  const [
    commissionRows,
    quoteRows,
    agreementRows,
    existingInstallmentRows,
    existingDeliverableRows,
  ] = await db.batch([
      db
        .select({
          status: commissions.status,
          isOnHold: commissions.isOnHold,
        })
        .from(commissions)
        .where(eq(commissions.id, input.commissionId))
        .limit(1),

      db
        .select({
          status: commissionQuotes.status,
          totalAmount: commissionQuotes.totalAmount,
          currency: commissionQuotes.currency,
        })
        .from(commissionQuotes)
        .where(
          and(
            eq(commissionQuotes.id, input.quoteId),
            eq(commissionQuotes.commissionId, input.commissionId),
          ),
        )
        .limit(1),

      db
        .select({
          status: commissionAgreements.status,
        })
        .from(commissionAgreements)
        .where(
          and(
            eq(commissionAgreements.id, input.agreementId),
            eq(commissionAgreements.commissionId, input.commissionId),
            eq(commissionAgreements.quoteId, input.quoteId),
          ),
        )
        .limit(1),

      db
        .select({
          id: commissionPaymentInstallments.id,
        })
        .from(commissionPaymentInstallments)
        .where(
          and(
            eq(commissionPaymentInstallments.commissionId, input.commissionId),
            eq(commissionPaymentInstallments.quoteId, input.quoteId),
          ),
        )
        .limit(1),

        db
        .select({
          id: commissionDeliverables.id,
        })
        .from(commissionDeliverables)
        .where(
          and(
            eq(commissionDeliverables.commissionId, input.commissionId),
            eq(commissionDeliverables.quoteId, input.quoteId),
          ),
        )
        .limit(1),      
    ]);

  return {
    commission: commissionRows[0] ?? null,
    quote: quoteRows[0] ?? null,
    agreement: agreementRows[0] ?? null,
    planAlreadyExists:
      existingInstallmentRows.length > 0 ||
      existingDeliverableRows.length > 0,
  };
}

type ValidPaymentPlan = Extract<
  CommissionPaymentPlanValidation,
  { valid: true }
>;

type PaymentPlanPreparationResult =
  | {
      outcome: "ready";
      plan: ValidPaymentPlan;
      currency: string;
    }
  | Exclude<
      CreateCommissionPaymentPlanResult,
      { outcome: "created" | "conflict" }
    >;

async function prepareCommissionPaymentPlan(
  input: CreateCommissionPaymentPlanInput,
): Promise<PaymentPlanPreparationResult> {
  const createdByAdminUserId = input.createdByAdminUserId.trim();

  if (!createdByAdminUserId) {
    throw new Error("createdByAdminUserId is required.");
  }

  const state = await getCommissionPaymentPlanPreparationState(input);

  if (!state.commission) {
    return {
      outcome: "not_found",
    };
  }

  if (state.commission.status !== "awaiting_agreement") {
    return {
      outcome: "wrong_status",
      currentStatus: state.commission.status,
    };
  }

  if (state.commission.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (state.quote?.status !== "accepted") {
    return {
      outcome: "quote_not_accepted",
    };
  }

  if (state.agreement?.status !== "draft") {
    return {
      outcome: "agreement_not_draft",
    };
  }

  if (state.planAlreadyExists) {
    return {
      outcome: "plan_already_exists",
    };
  }

  const validation = validateCommissionPaymentPlan(
    state.quote.totalAmount,
    input.stages,
  );

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  return {
    outcome: "ready",
    plan: validation,
    currency: state.quote.currency,
  };
}

type ValidGroupedPaymentPlan = Extract<
  CommissionGroupedPaymentPlanValidation,
  { valid: true }
>;

interface GroupedDeliverableWriteData {
  id: string;
  sequence: number;
  title: string;
  description: string | null;
  quantity: number;
}

interface GroupedPaymentStageWriteData {
  id: string;
  sequence: number;
  deliverableId: string | null;
  label: string;
  amount: string;
  trigger: string;
  customTriggerNote: string | null;
}

interface GroupedPaymentPlanWriteData {
  deliverables: GroupedDeliverableWriteData[];
  stages: GroupedPaymentStageWriteData[];
}

function buildGroupedPaymentPlanWriteData(
  plan: ValidGroupedPaymentPlan,
): GroupedPaymentPlanWriteData {
  const deliverables = plan.deliverables.map((deliverable) => ({
    id: randomUUID(),
    sequence: deliverable.sequence,
    title: deliverable.title,
    description: deliverable.description,
    quantity: deliverable.quantity,
  }));

  const deliverableIdsBySequence = new Map(
    deliverables.map((deliverable) => [
      deliverable.sequence,
      deliverable.id,
    ]),
  );

  const stages = plan.stages.map((stage) => {
    let deliverableId: string | null = null;

    if (stage.deliverableSequence !== null) {
      const associatedDeliverableId = deliverableIdsBySequence.get(
        stage.deliverableSequence,
      );

      if (!associatedDeliverableId) {
        throw new Error(
          "A payment stage references an unknown deliverable.",
        );
      }

      deliverableId = associatedDeliverableId;
    }

    return {
      id: randomUUID(),
      sequence: stage.sequence,
      deliverableId,
      label: stage.label,
      amount: stage.amount,
      trigger: stage.trigger,
      customTriggerNote: stage.customTriggerNote,
    };
  });

  return {
    deliverables,
    stages,
  };
}

type GroupedPaymentPlanPreparationResult =
  | {
      outcome: "ready";
      plan: ValidGroupedPaymentPlan;
      currency: string;
    }
  | Exclude<
      CreateCommissionGroupedPaymentPlanResult,
      { outcome: "created" | "conflict" }
    >;

async function prepareCommissionGroupedPaymentPlan(
  input: CreateCommissionGroupedPaymentPlanInput,
): Promise<GroupedPaymentPlanPreparationResult> {
  const createdByAdminUserId = input.createdByAdminUserId.trim();

  if (!createdByAdminUserId) {
    throw new Error("createdByAdminUserId is required.");
  }

  const state = await getCommissionPaymentPlanPreparationState(input);

  if (!state.commission) {
    return {
      outcome: "not_found",
    };
  }

  if (state.commission.status !== "awaiting_agreement") {
    return {
      outcome: "wrong_status",
      currentStatus: state.commission.status,
    };
  }

  if (state.commission.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (state.quote?.status !== "accepted") {
    return {
      outcome: "quote_not_accepted",
    };
  }

  if (state.agreement?.status !== "draft") {
    return {
      outcome: "agreement_not_draft",
    };
  }

  if (state.planAlreadyExists) {
    return {
      outcome: "plan_already_exists",
    };
  }

  const validation = validateCommissionGroupedPaymentPlan(
    state.quote.totalAmount,
    input.plan,
  );

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  return {
    outcome: "ready",
    plan: validation,
    currency: state.quote.currency,
  };
}

interface CreateCommissionPaymentPlanWriteRow
  extends Record<string, unknown> {
  insertedCount: number;
  updatedCount: number;
}

export async function createCommissionPaymentPlan(
  input: CreateCommissionPaymentPlanInput,
): Promise<CreateCommissionPaymentPlanResult> {
  const preparation = await prepareCommissionPaymentPlan(input);

  if (preparation.outcome !== "ready") {
    return preparation;
  }

  const { plan, currency } = preparation;

  const createdAt = new Date();

  const stagesToInsert = plan.stages.map((stage) => ({
    id: randomUUID(),
    sequence: stage.sequence,
    label: stage.label,
    amount: stage.amount,
    trigger: stage.trigger,
    customTriggerNote: stage.customTriggerNote,
  }));

  const installmentIds = stagesToInsert.map((stage) => stage.id);

  async function getCreatedInstallments() {
    return db
      .select()
      .from(commissionPaymentInstallments)
      .where(
        and(
          eq(
            commissionPaymentInstallments.commissionId,
            input.commissionId,
          ),
          eq(
            commissionPaymentInstallments.quoteId,
            input.quoteId,
          ),
          inArray(commissionPaymentInstallments.id, installmentIds),
        ),
      )
      .orderBy(asc(commissionPaymentInstallments.sequence));
  }

  try {
    const writeResult =
      await db.execute<CreateCommissionPaymentPlanWriteRow>(
        sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              commission.id AS commission_id,
              quote.id AS quote_id,
              quote.currency AS currency
            FROM commissions AS commission
            INNER JOIN commission_quotes AS quote
              ON quote.commission_id = commission.id
            INNER JOIN commission_agreements AS agreement
              ON agreement.commission_id = commission.id
              AND agreement.quote_id = quote.id
            WHERE
              commission.id = ${input.commissionId}::uuid
              AND commission.status = 'awaiting_agreement'
              AND commission.is_on_hold = false
              AND quote.id = ${input.quoteId}::uuid
              AND quote.status = 'accepted'
              AND quote.total_amount = ${plan.totalAmount}::numeric
              AND quote.currency = ${currency}
              AND agreement.id = ${input.agreementId}::uuid
              AND agreement.status = 'draft'
            FOR UPDATE OF commission, quote, agreement
          ),

          created_installments AS (
            INSERT INTO commission_payment_installments (
              id,
              commission_id,
              quote_id,
              sequence,
              label,
              amount,
              currency,
              trigger,
              custom_trigger_note,
              status,
              created_at,
              updated_at
            )
            SELECT
              stage.id::uuid,
              locked_target.commission_id,
              locked_target.quote_id,
              stage.sequence,
              stage.label,
              stage.amount,
              locked_target.currency,
              stage.trigger::installment_trigger,
              stage."customTriggerNote",
              'pending'::installment_status,
              ${createdAt},
              ${createdAt}
            FROM locked_target
            CROSS JOIN jsonb_to_recordset(
              ${JSON.stringify(stagesToInsert)}::jsonb
            ) AS stage (
              id text,
              sequence integer,
              label text,
              amount numeric,
              trigger text,
              "customTriggerNote" text
            )
            WHERE NOT EXISTS (
              SELECT 1
              FROM commission_payment_installments AS existing
              WHERE
                existing.commission_id = locked_target.commission_id
                AND existing.quote_id = locked_target.quote_id
            )
            RETURNING id, commission_id
          ),

          updated_commission AS (
            UPDATE commissions AS commission
            SET updated_at = ${createdAt}
            FROM (
              SELECT DISTINCT commission_id
              FROM created_installments
            ) AS inserted
            WHERE commission.id = inserted.commission_id
            RETURNING commission.id
          )

          SELECT
            (
              SELECT COUNT(*)::integer
              FROM created_installments
            ) AS "insertedCount",
            (
              SELECT COUNT(*)::integer
              FROM updated_commission
            ) AS "updatedCount"
        `,
      );

    const writeRow = writeResult.rows[0];

    if (
      writeRow?.insertedCount === stagesToInsert.length &&
      writeRow.updatedCount === 1
    ) {
      const installments = await getCreatedInstallments();

      if (installments.length !== stagesToInsert.length) {
        throw new Error(
          "Payment plan creation returned incomplete installments.",
        );
      }

      return {
        outcome: "created",
        installments,
      };
    }

    const currentState = await getCommissionPaymentPlanPreparationState(input);

    if (!currentState.commission) {
      return {
        outcome: "not_found",
      };
    }

    if (currentState.commission.status !== "awaiting_agreement") {
      return {
        outcome: "wrong_status",
        currentStatus: currentState.commission.status,
      };
    }

    if (currentState.commission.isOnHold) {
      return {
        outcome: "on_hold",
      };
    }

    if (currentState.quote?.status !== "accepted") {
      return {
        outcome: "quote_not_accepted",
      };
    }

    if (currentState.agreement?.status !== "draft") {
      return {
        outcome: "agreement_not_draft",
      };
    }

    if (currentState.planAlreadyExists) {
      return {
        outcome: "plan_already_exists",
      };
    }

    return {
      outcome: "conflict",
    };
  } catch (error) {
    /*
     * Neon may commit the write but lose its response.
     * The pre-generated installment IDs identify this
     * exact creation attempt.
     */
    try {
      const committedInstallments = await getCreatedInstallments();

      if (committedInstallments.length === stagesToInsert.length) {
        return {
          outcome: "created",
          installments: committedInstallments,
        };
      }

      const currentState = await getCommissionPaymentPlanPreparationState(
        input,
      );

      if (currentState.planAlreadyExists) {
        return {
          outcome: "plan_already_exists",
        };
      }
    } catch {
      /*
       * Preserve the original error if reconciliation
       * cannot reach Neon.
       */
    }

    throw error;
  }
}

export async function getCommissionPaymentPlan(
  commissionId: string,
  quoteId: string,
): Promise<CommissionPaymentInstallment[]> {
  return db
    .select()
    .from(commissionPaymentInstallments)
    .where(
      and(
        eq(commissionPaymentInstallments.commissionId, commissionId),
        eq(commissionPaymentInstallments.quoteId, quoteId),
      ),
    )
    .orderBy(
      asc(commissionPaymentInstallments.sequence),
      asc(commissionPaymentInstallments.id),
    );
}

export async function getCommissionDeliverables(
  commissionId: string,
  quoteId: string,
): Promise<CommissionDeliverable[]> {
  return db
    .select()
    .from(commissionDeliverables)
    .where(
      and(
        eq(commissionDeliverables.commissionId, commissionId),
        eq(commissionDeliverables.quoteId, quoteId),
      ),
    )
    .orderBy(
      asc(commissionDeliverables.sequence),
      asc(commissionDeliverables.id),
    );
}

async function getCommissionPaymentPlanEditState(
  input: Pick<
    UpdateCommissionPaymentPlanInput,
    "commissionId" | "quoteId" | "agreementId"
  >,
) {
  const [agreementRows, installments, deliverables] = await Promise.all([
    db
      .select({
        status: commissionAgreements.status,
        updatedAt: commissionAgreements.updatedAt,
      })
      .from(commissionAgreements)
      .where(
        and(
          eq(commissionAgreements.id, input.agreementId),
          eq(commissionAgreements.commissionId, input.commissionId),
          eq(commissionAgreements.quoteId, input.quoteId),
        ),
      )
      .limit(1),

    getCommissionPaymentPlan(input.commissionId, input.quoteId),
    getCommissionDeliverables(input.commissionId, input.quoteId),
  ]);

  const installmentIds = installments.map((installment) => installment.id);

  const linkedPaymentRows =
    installmentIds.length > 0
      ? await db
          .select({
            id: commissionPayments.id,
          })
          .from(commissionPayments)
          .where(
            inArray(commissionPayments.installmentId, installmentIds),
          )
          .limit(1)
      : [];

  return {
    agreement: agreementRows[0] ?? null,
    installments,
    deliverables,
    planLocked:
      installments.some((installment) => installment.status !== "pending") ||
      linkedPaymentRows.length > 0,
  };
}

type PaymentPlanUpdatePreparationResult =
  | {
      outcome: "ready";
      plan: ValidPaymentPlan;
      currency: string;
      existingInstallments: CommissionPaymentInstallment[];
    }
  | Exclude<
      UpdateCommissionPaymentPlanResult,
      { outcome: "updated" }
    >;

type PaymentPlanStageIdValidation =
  | { valid: true }
  | {
      valid: false;
      message: string;
    };

function validatePaymentPlanStageIds(
  stages: readonly UpdateCommissionPaymentStageInput[],
  existingInstallments: readonly CommissionPaymentInstallment[],
): PaymentPlanStageIdValidation {
  const existingIds = new Set(
    existingInstallments.map((installment) => installment.id),
  );

  const receivedIds = new Set<string>();

  for (const stage of stages) {
    if (stage.id === undefined) {
      continue;
    }

    if (!existingIds.has(stage.id)) {
      return {
        valid: false,
        message: "A payment stage does not belong to this payment plan.",
      };
    }

    if (receivedIds.has(stage.id)) {
      return {
        valid: false,
        message: "A payment stage was submitted more than once.",
      };
    }

    receivedIds.add(stage.id);
  }

  if (receivedIds.size !== existingIds.size) {
    return {
      valid: false,
      message: "All existing payment stages must be included in the update.",
    };
  }

  return { valid: true };
}

type GroupedPaymentPlanIdsValidation =
  | { valid: true }
  | { valid: false; message: string };

export function validateCommissionGroupedPaymentPlanEditIds(
  plan: CommissionGroupedPaymentPlanEditInput,
  existingDeliverables: readonly CommissionDeliverable[],
  existingInstallments: readonly CommissionPaymentInstallment[],
): GroupedPaymentPlanIdsValidation {
  const existingDeliverableIds = new Set(
    existingDeliverables.map((deliverable) => deliverable.id),
  );

  const existingStagesById = new Map(
    existingInstallments.map((stage) => [stage.id, stage]),
  );

  const receivedDeliverableIds = new Set<string>();
  const receivedStageIds = new Set<string>();

  for (const deliverable of plan.deliverables) {
    if (deliverable.id === undefined) {
      continue;
    }

    if (!existingDeliverableIds.has(deliverable.id)) {
      return {
        valid: false,
        message: "A deliverable does not belong to this payment plan.",
      };
    }

    if (receivedDeliverableIds.has(deliverable.id)) {
      return {
        valid: false,
        message: "A deliverable was submitted more than once.",
      };
    }

    receivedDeliverableIds.add(deliverable.id);
  }

  if (receivedDeliverableIds.size !== existingDeliverableIds.size) {
    return {
      valid: false,
      message: "All existing deliverables must be included in the update.",
    };
  }

  const validateStage = (
    stageId: string | undefined,
    submittedDeliverableId: string | null,
  ): GroupedPaymentPlanIdsValidation => {
    // An omitted ID represents a new payment stage.
    if (stageId === undefined) {
      return { valid: true };
    }

    const existingStage = existingStagesById.get(stageId);

    if (!existingStage) {
      return {
        valid: false,
        message: "A payment stage does not belong to this payment plan.",
      };
    }

    if (receivedStageIds.has(stageId)) {
      return {
        valid: false,
        message: "A payment stage was submitted more than once.",
      };
    }

    if (existingStage.deliverableId !== submittedDeliverableId) {
      return {
        valid: false,
        message:
          "An existing payment stage cannot be moved to another deliverable.",
      };
    }

    receivedStageIds.add(stageId);

    return { valid: true };
  };

  for (const stage of plan.projectStages) {
    const result = validateStage(stage.id, null);

    if (!result.valid) {
      return result;
    }
  }

  for (const deliverable of plan.deliverables) {
    for (const stage of deliverable.stages) {
      // A project-wide stage has deliverableId = null. A new
      // deliverable has no ID yet, so comparing against null alone
      // would accidentally allow moving that existing stage here.
      if (deliverable.id === undefined && stage.id !== undefined) {
        return {
          valid: false,
          message: "An existing payment stage cannot be moved into a new deliverable.",
        };
      }

      const result = validateStage(
        stage.id,
        deliverable.id ?? null,
      );

      if (!result.valid) {
        return result;
      }
    }
  }

  if (receivedStageIds.size !== existingStagesById.size) {
    return {
      valid: false,
      message: "All existing payment stages must be included in the update.",
    };
  }

  return { valid: true };
}

function validateCommissionGroupedPaymentPlanEditOrder(
  plan: CommissionGroupedPaymentPlanEditInput,
  existingDeliverables: readonly CommissionDeliverable[],
  existingInstallments: readonly CommissionPaymentInstallment[],
): GroupedPaymentPlanIdsValidation {
  const existingDeliverableIdsInOrder = existingDeliverables.map(
    (deliverable) => deliverable.id,
  );

  const submittedExistingDeliverableIdsInOrder = plan.deliverables
    .filter((deliverable) => deliverable.id !== undefined)
    .map((deliverable) => deliverable.id);

  const existingDeliverableOrderChanged =
    existingDeliverableIdsInOrder.some(
      (id, index) => id !== submittedExistingDeliverableIdsInOrder[index],
    );

  const firstNewDeliverableIndex = plan.deliverables.findIndex(
    (deliverable) => deliverable.id === undefined,
  );

  const newDeliverableInsertedBeforeExisting =
    firstNewDeliverableIndex !== -1 &&
    plan.deliverables
      .slice(firstNewDeliverableIndex)
      .some((deliverable) => deliverable.id !== undefined);

  if (
    existingDeliverableOrderChanged ||
    newDeliverableInsertedBeforeExisting
  ) {
    return {
      valid: false,
      message:
        "Existing deliverables must keep their order. New deliverables must be added at the end.",
    };
  }

  function validateGroupStageOrder(
    submittedStageIds: readonly (string | undefined)[],
    existingStageIds: readonly string[],
  ): GroupedPaymentPlanIdsValidation {
    const submittedExistingIds = submittedStageIds.filter(
      (id): id is string => id !== undefined,
    );

    const existingOrderChanged = existingStageIds.some(
      (id, index) => id !== submittedExistingIds[index],
    );

    const firstNewStageIndex = submittedStageIds.findIndex(
      (id) => id === undefined,
    );

    const newStageInsertedBeforeExisting =
      firstNewStageIndex !== -1 &&
      submittedStageIds
        .slice(firstNewStageIndex)
        .some((id) => id !== undefined);

    if (existingOrderChanged || newStageInsertedBeforeExisting) {
      return {
        valid: false,
        message:
          "Existing payment stages must keep their order within each group. New stages must be added at the end of their group.",
      };
    }

    return { valid: true };
  }

  const projectStageOrder = validateGroupStageOrder(
    plan.projectStages.map((stage) => stage.id),
    existingInstallments
      .filter((stage) => stage.deliverableId === null)
      .map((stage) => stage.id),
  );

  if (!projectStageOrder.valid) {
    return projectStageOrder;
  }

  for (const deliverable of plan.deliverables) {
    const stageOrder = validateGroupStageOrder(
      deliverable.stages.map((stage) => stage.id),
      deliverable.id === undefined
        ? []
        : existingInstallments
            .filter(
              (stage) => stage.deliverableId === deliverable.id,
            )
            .map((stage) => stage.id),
    );

    if (!stageOrder.valid) {
      return stageOrder;
    }
  }

  return { valid: true };
}

type GroupedPaymentPlanUpdatePreparationResult =
  | {
      outcome: "ready";
      plan: ValidGroupedPaymentPlan;
      currency: string;
      existingDeliverables: CommissionDeliverable[];
      existingInstallments: CommissionPaymentInstallment[];
    }
  | Exclude<
      UpdateCommissionGroupedPaymentPlanResult,
      { outcome: "updated" | "invalid" }
    >
  | {
      outcome: "invalid";
      validation: Extract<
        CommissionGroupedPaymentPlanValidation,
        { valid: false }
      >;
    };

async function prepareCommissionGroupedPaymentPlanUpdate(
  input: UpdateCommissionGroupedPaymentPlanInput,
): Promise<GroupedPaymentPlanUpdatePreparationResult> {
  if (!input.updatedByAdminUserId.trim()) {
    throw new Error("updatedByAdminUserId is required.");
  }

  if (
    !(input.expectedAgreementUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedAgreementUpdatedAt.getTime())
  ) {
    throw new Error("expectedAgreementUpdatedAt must be a valid Date.");
  }

  const [state, editState] = await Promise.all([
    getCommissionPaymentPlanPreparationState(input),
    getCommissionPaymentPlanEditState(input),
  ]);

  if (!state.commission) {
    return { outcome: "not_found" };
  }

  if (state.commission.status !== "awaiting_agreement") {
    return {
      outcome: "wrong_status",
      currentStatus: state.commission.status,
    };
  }

  if (state.commission.isOnHold) {
    return { outcome: "on_hold" };
  }

  if (state.quote?.status !== "accepted") {
    return { outcome: "quote_not_accepted" };
  }

  if (editState.agreement?.status !== "draft") {
    return { outcome: "agreement_not_draft" };
  }

  if (
    editState.agreement.updatedAt.getTime() !==
    input.expectedAgreementUpdatedAt.getTime()
  ) {
    return { outcome: "conflict" };
  }

  if (editState.installments.length === 0) {
    return { outcome: "plan_not_found" };
  }

  if (editState.planLocked) {
    return { outcome: "plan_locked" };
  }

  const idsValidation = validateCommissionGroupedPaymentPlanEditIds(
    input.plan,
    editState.deliverables,
    editState.installments,
  );

  if (!idsValidation.valid) {
    return { outcome: "conflict" };
  }

  const orderValidation = validateCommissionGroupedPaymentPlanEditOrder(
    input.plan,
    editState.deliverables,
    editState.installments,
  );

  if (!orderValidation.valid) {
    return { outcome: "conflict" };
  }

  const validation = validateCommissionGroupedPaymentPlan(
    state.quote.totalAmount,
    input.plan,
  );

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  return {
    outcome: "ready",
    plan: validation,
    currency: state.quote.currency,
    existingDeliverables: editState.deliverables,
    existingInstallments: editState.installments,
  };
}

interface GroupedPaymentPlanUpdateWriteData {
  deliverables: Array<
    GroupedDeliverableWriteData & {
      isNew: boolean;
    }
  >;
  stages: Array<
    GroupedPaymentStageWriteData & {
      isNew: boolean;
    }
  >;
}

function buildGroupedPaymentPlanUpdateWriteData(
  input: UpdateCommissionGroupedPaymentPlanInput,
  plan: ValidGroupedPaymentPlan,
): GroupedPaymentPlanUpdateWriteData {
  const deliverables = plan.deliverables.map((deliverable, index) => {
    const submittedDeliverable = input.plan.deliverables[index];

    if (!submittedDeliverable) {
      throw new Error(
        "Grouped payment plan validation returned an unexpected deliverable count.",
      );
    }

    return {
      id: submittedDeliverable.id ?? randomUUID(),
      isNew: submittedDeliverable.id === undefined,
      sequence: deliverable.sequence,
      title: deliverable.title,
      description: deliverable.description,
      quantity: deliverable.quantity,
    };
  });

  const deliverableIdsBySequence = new Map(
    deliverables.map((deliverable) => [
      deliverable.sequence,
      deliverable.id,
    ]),
  );

  const submittedStages = [
    ...input.plan.projectStages,
    ...input.plan.deliverables.flatMap(
      (deliverable) => deliverable.stages,
    ),
  ];

  const stages = plan.stages.map((stage, index) => {
    const submittedStage = submittedStages[index];

    if (!submittedStage) {
      throw new Error(
        "Grouped payment plan validation returned an unexpected stage count.",
      );
    }

    const deliverableId =
      stage.deliverableSequence === null
        ? null
        : deliverableIdsBySequence.get(stage.deliverableSequence);

    if (deliverableId === undefined) {
      throw new Error(
        "A payment stage references an unknown deliverable.",
      );
    }

    return {
      id: submittedStage.id ?? randomUUID(),
      isNew: submittedStage.id === undefined,
      sequence: stage.sequence,
      deliverableId,
      label: stage.label,
      amount: stage.amount,
      trigger: stage.trigger,
      customTriggerNote: stage.customTriggerNote,
    };
  });

  return {
    deliverables,
    stages,
  };
}

async function prepareCommissionPaymentPlanUpdate(
  input: UpdateCommissionPaymentPlanInput,
): Promise<PaymentPlanUpdatePreparationResult> {
  const updatedByAdminUserId = input.updatedByAdminUserId.trim();

  if (!updatedByAdminUserId) {
    throw new Error("updatedByAdminUserId is required.");
  }

  if (
    !(input.expectedAgreementUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedAgreementUpdatedAt.getTime())
  ) {
    throw new Error("expectedAgreementUpdatedAt must be a valid Date.");
  }

  const [state, editState] = await Promise.all([
    getCommissionPaymentPlanPreparationState(input),
    getCommissionPaymentPlanEditState(input),
  ]);

  if (!state.commission) {
    return { outcome: "not_found" };
  }

  if (state.commission.status !== "awaiting_agreement") {
    return {
      outcome: "wrong_status",
      currentStatus: state.commission.status,
    };
  }

  if (state.commission.isOnHold) {
    return { outcome: "on_hold" };
  }

  if (state.quote?.status !== "accepted") {
    return { outcome: "quote_not_accepted" };
  }

  if (editState.agreement?.status !== "draft") {
    return { outcome: "agreement_not_draft" };
  }

  if (
    editState.agreement.updatedAt.getTime() !==
    input.expectedAgreementUpdatedAt.getTime()
  ) {
    return { outcome: "conflict" };
  }

  if (editState.installments.length === 0) {
    return { outcome: "plan_not_found" };
  }

  if (editState.planLocked) {
    return { outcome: "plan_locked" };
  }

  // The legacy flat editor does not persist deliverable associations.
  // Never let it update a grouped plan, even via a direct server action.
  if (
    editState.deliverables.length > 0 ||
    editState.installments.some((stage) => stage.deliverableId !== null)
  ) {
    return { outcome: "conflict" };
  }

  const stageIdValidation = validatePaymentPlanStageIds(
    input.stages,
    editState.installments,
  );

  if (!stageIdValidation.valid) {
    return {
      outcome: "conflict",
    };
  }

  const existingIdsInOrder = editState.installments.map(
    (installment) => installment.id,
  );

  const submittedExistingIdsInOrder = input.stages
    .filter((stage) => stage.id !== undefined)
    .map((stage) => stage.id);

  const existingOrderChanged = existingIdsInOrder.some(
    (id, index) => id !== submittedExistingIdsInOrder[index],
  );

  const firstNewStageIndex = input.stages.findIndex(
    (stage) => stage.id === undefined,
  );

  const newStageInsertedBeforeExisting =
    firstNewStageIndex !== -1 &&
    input.stages
      .slice(firstNewStageIndex)
      .some((stage) => stage.id !== undefined);

  if (existingOrderChanged || newStageInsertedBeforeExisting) {
    return {
      outcome: "conflict",
    };
  }

  const validation = validateCommissionPaymentPlan(
    state.quote.totalAmount,
    input.stages,
  );

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  return {
    outcome: "ready",
    plan: validation,
    currency: state.quote.currency,
    existingInstallments: editState.installments,
  };
}

interface PaymentPlanStageWriteData {
  id: string;
  isNew: boolean;
  sequence: number;
  label: string;
  amount: string;
  trigger: string;
  customTriggerNote: string | null;
}

function buildPaymentPlanUpdateStages(
  input: UpdateCommissionPaymentPlanInput,
  plan: ValidPaymentPlan,
): PaymentPlanStageWriteData[] {
  return plan.stages.map((stage, index) => {
    const submittedStage = input.stages[index];

    if (!submittedStage) {
      throw new Error(
        "Payment plan validation returned an unexpected stage count.",
      );
    }

    return {
      id: submittedStage.id ?? randomUUID(),
      isNew: submittedStage.id === undefined,
      sequence: stage.sequence,
      label: stage.label,
      amount: stage.amount,
      trigger: stage.trigger,
      customTriggerNote: stage.customTriggerNote,
    };
  });
}

interface UpdateCommissionPaymentPlanWriteRow
  extends Record<string, unknown> {
  writeComplete: number;
}

export async function updateCommissionPaymentPlan(
  input: UpdateCommissionPaymentPlanInput,
): Promise<UpdateCommissionPaymentPlanResult> {
  const preparation = await prepareCommissionPaymentPlanUpdate(input);

  if (preparation.outcome !== "ready") {
    return preparation;
  }

  const { plan, currency } = preparation;

  const stagesToWrite = buildPaymentPlanUpdateStages(input, plan);

  /*
   * Advance the Agreement's version even when two edits happen
   * within the same millisecond.
   */
  const updatedAt = new Date(
    Math.max(
      Date.now(),
      input.expectedAgreementUpdatedAt.getTime() + 1,
    ),
  );

  const writeResult =
    await db.execute<UpdateCommissionPaymentPlanWriteRow>(
      sql`
        WITH
        stage_input AS MATERIALIZED (
          SELECT
            stage.id::uuid AS id,
            stage."isNew" AS is_new,
            stage.sequence,
            stage.label,
            stage.amount,
            stage.trigger,
            stage."customTriggerNote" AS custom_trigger_note
          FROM jsonb_to_recordset(
            ${JSON.stringify(stagesToWrite)}::jsonb
          ) AS stage (
            id text,
            "isNew" boolean,
            sequence integer,
            label text,
            amount numeric,
            trigger text,
            "customTriggerNote" text
          )
        ),

        locked_target AS MATERIALIZED (
          SELECT
            commission.id AS commission_id,
            quote.id AS quote_id,
            quote.currency,
            quote.total_amount,
            agreement.id AS agreement_id
          FROM commissions AS commission
          INNER JOIN commission_quotes AS quote
            ON quote.commission_id = commission.id
          INNER JOIN commission_agreements AS agreement
            ON agreement.commission_id = commission.id
            AND agreement.quote_id = quote.id
          WHERE
            commission.id = ${input.commissionId}::uuid
            AND commission.status = 'awaiting_agreement'
            AND commission.is_on_hold = false
            AND quote.id = ${input.quoteId}::uuid
            AND quote.status = 'accepted'
            AND quote.total_amount = ${plan.totalAmount}::numeric
            AND quote.currency = ${currency}
            AND agreement.id = ${input.agreementId}::uuid
            AND agreement.status = 'draft'
            AND agreement.updated_at =
              ${input.expectedAgreementUpdatedAt}
          FOR UPDATE OF commission, quote, agreement
        ),

        locked_existing AS MATERIALIZED (
          SELECT
            installment.id,
            installment.sequence,
            installment.status
          FROM commission_payment_installments AS installment
          INNER JOIN locked_target
            ON locked_target.commission_id =
              installment.commission_id
            AND locked_target.quote_id = installment.quote_id
          FOR UPDATE OF installment
        ),

        eligible_target AS MATERIALIZED (
          SELECT locked_target.*
          FROM locked_target
          WHERE
            (
              SELECT COUNT(*)
              FROM locked_existing
            ) > 0

            AND (
              SELECT COUNT(*)
              FROM locked_existing
            ) = (
              SELECT COUNT(*)
              FROM stage_input
              WHERE is_new = false
            )

            AND NOT EXISTS (
              SELECT 1
              FROM locked_existing AS existing
              WHERE
                existing.status <> 'pending'::installment_status
                OR NOT EXISTS (
                  SELECT 1
                  FROM stage_input AS stage
                  WHERE
                    stage.is_new = false
                    AND stage.id = existing.id
                    AND stage.sequence = existing.sequence
                )
            )

            AND NOT EXISTS (
              SELECT 1
              FROM stage_input AS stage
              WHERE
                stage.is_new = false
                AND NOT EXISTS (
                  SELECT 1
                  FROM locked_existing AS existing
                  WHERE
                    existing.id = stage.id
                    AND existing.sequence = stage.sequence
                )
            )

            AND NOT EXISTS (
              SELECT 1
              FROM commission_payments AS payment
              INNER JOIN locked_existing AS existing
                ON existing.id = payment.installment_id
            )

            AND (
              SELECT COALESCE(SUM(amount), 0)
              FROM stage_input
            ) = locked_target.total_amount
        ),

        updated_existing AS (
          UPDATE commission_payment_installments AS installment
          SET
            label = stage.label,
            amount = stage.amount,
            trigger = stage.trigger::installment_trigger,
            custom_trigger_note = stage.custom_trigger_note,
            updated_at = ${updatedAt}
          FROM eligible_target, stage_input AS stage
          WHERE
            stage.is_new = false
            AND installment.id = stage.id
            AND installment.commission_id =
              eligible_target.commission_id
            AND installment.quote_id = eligible_target.quote_id
            AND installment.sequence = stage.sequence
            AND installment.status = 'pending'::installment_status
          RETURNING installment.id
        ),

        inserted_new AS (
          INSERT INTO commission_payment_installments (
            id,
            commission_id,
            quote_id,
            sequence,
            label,
            amount,
            currency,
            trigger,
            custom_trigger_note,
            status,
            created_at,
            updated_at
          )
          SELECT
            stage.id,
            eligible_target.commission_id,
            eligible_target.quote_id,
            stage.sequence,
            stage.label,
            stage.amount,
            eligible_target.currency,
            stage.trigger::installment_trigger,
            stage.custom_trigger_note,
            'pending'::installment_status,
            ${updatedAt},
            ${updatedAt}
          FROM eligible_target
          INNER JOIN stage_input AS stage
            ON stage.is_new = true
          WHERE
            (
              SELECT COUNT(*)
              FROM updated_existing
            ) = (
              SELECT COUNT(*)
              FROM stage_input
              WHERE is_new = false
            )
          RETURNING id
        ),

        bumped_agreement AS (
          UPDATE commission_agreements AS agreement
          SET updated_at = ${updatedAt}
          FROM eligible_target
          WHERE
            agreement.id = eligible_target.agreement_id
            AND agreement.status = 'draft'
            AND agreement.updated_at =
              ${input.expectedAgreementUpdatedAt}
            AND (
              SELECT COUNT(*)
              FROM updated_existing
            ) = (
              SELECT COUNT(*)
              FROM stage_input
              WHERE is_new = false
            )
            AND (
              SELECT COUNT(*)
              FROM inserted_new
            ) = (
              SELECT COUNT(*)
              FROM stage_input
              WHERE is_new = true
            )
          RETURNING agreement.id
        )

        SELECT
          CASE
            WHEN (
              SELECT COUNT(*)
              FROM eligible_target
            ) = 0
              THEN 0
            ELSE
              /*
               * An incomplete write must raise a SQL error,
               * rolling back the entire statement rather
               * than committing a partially edited plan.
               */
              1 / (
                CASE
                  WHEN
                    (
                      SELECT COUNT(*)
                      FROM updated_existing
                    ) = (
                      SELECT COUNT(*)
                      FROM stage_input
                      WHERE is_new = false
                    )
                    AND (
                      SELECT COUNT(*)
                      FROM inserted_new
                    ) = (
                      SELECT COUNT(*)
                      FROM stage_input
                      WHERE is_new = true
                    )
                    AND (
                      SELECT COUNT(*)
                      FROM bumped_agreement
                    ) = 1
                    THEN 1
                  ELSE 0
                END
              )
          END::integer AS "writeComplete"
      `,
    );

  if (writeResult.rows[0]?.writeComplete === 1) {
    const installments = await getCommissionPaymentPlan(
      input.commissionId,
      input.quoteId,
    );

    if (installments.length !== stagesToWrite.length) {
      throw new Error(
        "Payment plan update returned an unexpected installment count.",
      );
    }

    return {
      outcome: "updated",
      installments,
    };
  }

  /*
   * No eligible target means that a precondition changed
   * or the submitted plan no longer matches the database.
   */
  const currentPreparation = await prepareCommissionPaymentPlanUpdate(input);

  if (currentPreparation.outcome !== "ready") {
    return currentPreparation;
  }

  return {
    outcome: "conflict",
  };
}

interface CreateCommissionGroupedPaymentPlanWriteRow
  extends Record<string, unknown> {
  writeComplete: number;
}

export async function createCommissionGroupedPaymentPlan(
  input: CreateCommissionGroupedPaymentPlanInput,
): Promise<CreateCommissionGroupedPaymentPlanResult> {
  const preparation = await prepareCommissionGroupedPaymentPlan(input);

  if (preparation.outcome !== "ready") {
    return preparation;
  }

  const { plan, currency } = preparation;

  const writeData = buildGroupedPaymentPlanWriteData(plan);

  const deliverableIds = writeData.deliverables.map(
    (deliverable) => deliverable.id,
  );

  const installmentIds = writeData.stages.map(
    (stage) => stage.id,
  );

  const createdAt = new Date();

  async function getCreatedRecords() {
    const [deliverables, installments] = await Promise.all([
      deliverableIds.length > 0
        ? db
            .select()
            .from(commissionDeliverables)
            .where(
              and(
                eq(
                  commissionDeliverables.commissionId,
                  input.commissionId,
                ),
                eq(commissionDeliverables.quoteId, input.quoteId),
                inArray(commissionDeliverables.id, deliverableIds),
              ),
            )
            .orderBy(asc(commissionDeliverables.sequence))
        : Promise.resolve([] as CommissionDeliverable[]),

      db
        .select()
        .from(commissionPaymentInstallments)
        .where(
          and(
            eq(
              commissionPaymentInstallments.commissionId,
              input.commissionId,
            ),
            eq(
              commissionPaymentInstallments.quoteId,
              input.quoteId,
            ),
            inArray(commissionPaymentInstallments.id, installmentIds),
          ),
        )
        .orderBy(asc(commissionPaymentInstallments.sequence)),
    ]);

    return {
      deliverables,
      installments,
    };
  }

  try {
    const writeResult =
      await db.execute<CreateCommissionGroupedPaymentPlanWriteRow>(
        sql`
          WITH
            locked_target AS MATERIALIZED (
              SELECT
                commission.id AS commission_id,
                quote.id AS quote_id,
                quote.currency
              FROM commissions AS commission
              INNER JOIN commission_quotes AS quote
                ON quote.commission_id = commission.id
              INNER JOIN commission_agreements AS agreement
                ON agreement.commission_id = commission.id
                AND agreement.quote_id = quote.id
              WHERE
                commission.id = ${input.commissionId}::uuid
                AND commission.status = 'awaiting_agreement'
                AND commission.is_on_hold = false
                AND quote.id = ${input.quoteId}::uuid
                AND quote.status = 'accepted'
                AND quote.total_amount = ${plan.totalAmount}::numeric
                AND quote.currency = ${currency}
                AND agreement.id = ${input.agreementId}::uuid
                AND agreement.status = 'draft'
              FOR UPDATE OF commission, quote, agreement
            ),

            eligible_target AS MATERIALIZED (
              SELECT locked_target.*
              FROM locked_target
              WHERE NOT EXISTS (
                SELECT 1
                FROM commission_payment_installments AS existing
                WHERE
                  existing.commission_id =
                    locked_target.commission_id
                  AND existing.quote_id = locked_target.quote_id
              )
              AND NOT EXISTS (
                SELECT 1
                FROM commission_deliverables AS existing
                WHERE
                  existing.commission_id =
                    locked_target.commission_id
                  AND existing.quote_id = locked_target.quote_id
              )
            ),

            deliverable_input AS MATERIALIZED (
              SELECT
                deliverable.id::uuid AS id,
                deliverable.sequence,
                deliverable.title,
                deliverable.description,
                deliverable.quantity
              FROM jsonb_to_recordset(
                ${JSON.stringify(writeData.deliverables)}::jsonb
              ) AS deliverable (
                id text,
                sequence integer,
                title text,
                description text,
                quantity integer
              )
            ),

            created_deliverables AS (
              INSERT INTO commission_deliverables (
                id,
                commission_id,
                quote_id,
                sequence,
                title,
                description,
                quantity,
                created_at,
                updated_at
              )
              SELECT
                deliverable.id,
                eligible_target.commission_id,
                eligible_target.quote_id,
                deliverable.sequence,
                deliverable.title,
                deliverable.description,
                deliverable.quantity,
                ${createdAt},
                ${createdAt}
              FROM eligible_target
              CROSS JOIN deliverable_input AS deliverable
              RETURNING id
            ),

            stage_input AS MATERIALIZED (
              SELECT
                stage.id::uuid AS id,
                stage.sequence,
                stage."deliverableId"::uuid AS deliverable_id,
                stage.label,
                stage.amount,
                stage.trigger,
                stage."customTriggerNote" AS custom_trigger_note
              FROM jsonb_to_recordset(
                ${JSON.stringify(writeData.stages)}::jsonb
              ) AS stage (
                id text,
                sequence integer,
                "deliverableId" text,
                label text,
                amount numeric,
                trigger text,
                "customTriggerNote" text
              )
            ),

            created_installments AS (
              INSERT INTO commission_payment_installments (
                id,
                commission_id,
                quote_id,
                deliverable_id,
                sequence,
                label,
                amount,
                currency,
                trigger,
                custom_trigger_note,
                status,
                created_at,
                updated_at
              )
              SELECT
                stage.id,
                eligible_target.commission_id,
                eligible_target.quote_id,
                stage.deliverable_id,
                stage.sequence,
                stage.label,
                stage.amount,
                eligible_target.currency,
                stage.trigger::installment_trigger,
                stage.custom_trigger_note,
                'pending'::installment_status,
                ${createdAt},
                ${createdAt}
              FROM eligible_target
              CROSS JOIN stage_input AS stage
              WHERE
                (
                  SELECT COUNT(*)
                  FROM created_deliverables
                ) = ${writeData.deliverables.length}
                AND (
                  stage.deliverable_id IS NULL
                  OR EXISTS (
                    SELECT 1
                    FROM created_deliverables AS deliverable
                    WHERE deliverable.id = stage.deliverable_id
                  )
                )
              RETURNING id
            ),

            updated_commission AS (
              UPDATE commissions AS commission
              SET updated_at = ${createdAt}
              FROM eligible_target
              WHERE
                commission.id = eligible_target.commission_id
                AND (
                  SELECT COUNT(*)
                  FROM created_deliverables
                ) = ${writeData.deliverables.length}
                AND (
                  SELECT COUNT(*)
                  FROM created_installments
                ) = ${writeData.stages.length}
              RETURNING commission.id
            )

          SELECT
            CASE
              WHEN (
                SELECT COUNT(*)
                FROM eligible_target
              ) = 0
                THEN 0
              ELSE
                /*
                 * Raise a SQL error if only part of the plan
                 * was written. PostgreSQL will roll back the
                 * entire statement.
                 */
                1 / (
                  CASE
                    WHEN
                      (
                        SELECT COUNT(*)
                        FROM created_deliverables
                      ) = ${writeData.deliverables.length}
                      AND (
                        SELECT COUNT(*)
                        FROM created_installments
                      ) = ${writeData.stages.length}
                      AND (
                        SELECT COUNT(*)
                        FROM updated_commission
                      ) = 1
                        THEN 1
                      ELSE 0
                  END
                )
            END::integer AS "writeComplete"
        `,
      );

    if (writeResult.rows[0]?.writeComplete === 1) {
      const createdRecords = await getCreatedRecords();

      if (
        createdRecords.deliverables.length !==
          writeData.deliverables.length ||
        createdRecords.installments.length !== writeData.stages.length
      ) {
        throw new Error(
          "Grouped payment plan creation returned incomplete records.",
        );
      }

      return {
        outcome: "created",
        deliverables: createdRecords.deliverables,
        installments: createdRecords.installments,
      };
    }

    const currentState =
      await getCommissionPaymentPlanPreparationState(input);

    if (!currentState.commission) {
      return { outcome: "not_found" };
    }

    if (currentState.commission.status !== "awaiting_agreement") {
      return {
        outcome: "wrong_status",
        currentStatus: currentState.commission.status,
      };
    }

    if (currentState.commission.isOnHold) {
      return { outcome: "on_hold" };
    }

    if (currentState.quote?.status !== "accepted") {
      return { outcome: "quote_not_accepted" };
    }

    if (currentState.agreement?.status !== "draft") {
      return { outcome: "agreement_not_draft" };
    }

    if (currentState.planAlreadyExists) {
      return { outcome: "plan_already_exists" };
    }

    return { outcome: "conflict" };
  } catch (error) {
    /*
     * Neon may commit the statement but lose its response.
     * The pre-generated IDs identify records belonging to
     * this specific creation attempt.
     */
    try {
      const createdRecords = await getCreatedRecords();

      if (
        createdRecords.deliverables.length ===
          writeData.deliverables.length &&
        createdRecords.installments.length === writeData.stages.length
      ) {
        return {
          outcome: "created",
          deliverables: createdRecords.deliverables,
          installments: createdRecords.installments,
        };
      }

      const currentState =
        await getCommissionPaymentPlanPreparationState(input);

      if (currentState.planAlreadyExists) {
        return { outcome: "plan_already_exists" };
      }
    } catch {
      // Preserve the original error if reconciliation fails.
    }

    throw error;
  }
}


/**
 * Edit a grouped plan with the existing Neon HTTP connection.
 *
 * All SQL commands run as one non-interactive HTTP transaction. Every
 * precondition and affected-row count is checked inside PostgreSQL;
 * a failed guard raises SQLSTATE 22012 and rolls the transaction back.
 * No multi-statement db.execute() calls or WebSocket connection are used.
 */
export async function updateCommissionGroupedPaymentPlan(
  input: UpdateCommissionGroupedPaymentPlanInput,
): Promise<UpdateCommissionGroupedPaymentPlanResult> {
  const preparation = await prepareCommissionGroupedPaymentPlanUpdate(input);

  if (preparation.outcome !== "ready") {
    return preparation;
  }

  const { plan, currency, existingDeliverables, existingInstallments } =
    preparation;

  // Only contiguous sequences are eligible for the temporary offset.
  // The validator has already checked their ordering and all IDs.
  if (
    existingDeliverables.some((row, index) => row.sequence !== index + 1) ||
    existingInstallments.some((row, index) => row.sequence !== index + 1)
  ) {
    return { outcome: "conflict" };
  }

  const writeData = buildGroupedPaymentPlanUpdateWriteData(input, plan);
  const existingDeliverablesToWrite = writeData.deliverables.filter(
    (row) => !row.isNew,
  );
  const newDeliverablesToWrite = writeData.deliverables.filter(
    (row) => row.isNew,
  );
  const existingStagesToWrite = writeData.stages.filter((row) => !row.isNew);
  const newStagesToWrite = writeData.stages.filter((row) => row.isNew);

  // Locks are acquired before the database-side checks. Comparing complete
  // ID/order/association snapshots catches stale plans, even if a different
  // code path forgot to advance Agreement.updatedAt.
  const expectedDeliverables = existingDeliverables.map((row) => ({
    id: row.id,
    sequence: row.sequence,
  }));
  const expectedStages = existingInstallments.map((row) => ({
    id: row.id,
    sequence: row.sequence,
    deliverableId: row.deliverableId,
    status: row.status,
  }));

  const updatedAt = new Date(
    Math.max(Date.now(), input.expectedAgreementUpdatedAt.getTime() + 1),
  );

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not configured");
  }

  const httpSql = neon(databaseUrl);
  const guardErrorCode = "22012"; // division by zero: deliberate rollback

  try {
    await httpSql.transaction(
      [
        // 1. Lock the commission, quote, agreement and all existing plan
        // records. Do not rely solely on the earlier TypeScript checks.
        httpSql`
          WITH
            locked_target AS MATERIALIZED (
              SELECT
                c.id AS commission_id,
                q.id AS quote_id
              FROM commissions AS c
              INNER JOIN commission_quotes AS q
                ON q.commission_id = c.id
              INNER JOIN commission_agreements AS a
                ON a.commission_id = c.id AND a.quote_id = q.id
              WHERE c.id = ${input.commissionId}::uuid
                AND c.status = 'awaiting_agreement'
                AND c.is_on_hold = false
                AND q.id = ${input.quoteId}::uuid
                AND q.status = 'accepted'
                AND q.total_amount = ${plan.totalAmount}::numeric
                AND q.currency = ${currency}
                AND a.id = ${input.agreementId}::uuid
                AND a.status = 'draft'
                AND a.updated_at = ${input.expectedAgreementUpdatedAt}
              FOR UPDATE OF c, q, a
            ),
            locked_deliverables AS MATERIALIZED (
              SELECT d.id, d.sequence
              FROM commission_deliverables AS d
              INNER JOIN locked_target AS t
                ON d.commission_id = t.commission_id
               AND d.quote_id = t.quote_id
              FOR UPDATE OF d
            ),
            locked_stages AS MATERIALIZED (
              SELECT i.id, i.sequence, i.deliverable_id, i.status
              FROM commission_payment_installments AS i
              INNER JOIN locked_target AS t
                ON i.commission_id = t.commission_id
               AND i.quote_id = t.quote_id
              FOR UPDATE OF i
            )
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM locked_target) = 1
            AND (
              SELECT COALESCE(
                jsonb_agg(
                  jsonb_build_object('id', id::text, 'sequence', sequence)
                  ORDER BY sequence, id
                ),
                '[]'::jsonb
              )
              FROM locked_deliverables
            ) = ${JSON.stringify(expectedDeliverables)}::jsonb
            AND (
              SELECT COALESCE(
                jsonb_agg(
                  jsonb_build_object(
                    'id', id::text,
                    'sequence', sequence,
                    'deliverableId', deliverable_id::text,
                    'status', status::text
                  )
                  ORDER BY sequence, id
                ),
                '[]'::jsonb
              )
              FROM locked_stages
            ) = ${JSON.stringify(expectedStages)}::jsonb
            AND NOT EXISTS (
              SELECT 1
              FROM locked_stages
              WHERE status <> 'pending'::installment_status
            )
            THEN 1 ELSE 0 END AS "guardPassed"
        `,

        // 2. Separate statement, after all stage FOR UPDATE locks have been
        // acquired. A payment FK cannot be inserted concurrently while those
        // parent rows are locked; checking in this later statement also gets
        // a fresh READ COMMITTED snapshot after any earlier lock wait.
        httpSql`
          SELECT 1 / CASE WHEN NOT EXISTS (
            SELECT 1
            FROM commission_payments AS p
            INNER JOIN commission_payment_installments AS i
              ON i.id = p.installment_id
            WHERE i.commission_id = ${input.commissionId}::uuid
              AND i.quote_id = ${input.quoteId}::uuid
          ) THEN 1 ELSE 0 END AS "noLinkedPayments"
        `,

        // 3. Move only the current stages to a disjoint positive range.
        // The first guard guarantees contiguous 1..N sequences (N <= 50).
        // This is a separate SQL statement from the final renumbering.
        httpSql`
          WITH moved AS (
            UPDATE commission_payment_installments
            SET sequence = sequence + 1000,
                updated_at = ${updatedAt}
            WHERE commission_id = ${input.commissionId}::uuid
              AND quote_id = ${input.quoteId}::uuid
            RETURNING id
          )
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM moved) = ${existingInstallments.length}
          THEN 1 ELSE 0 END AS "stagesReserved"
        `,

        // 4. Update existing deliverable metadata. Existing deliverable
        // order is immutable in this version of the editor.
        httpSql`
          WITH incoming AS (
            SELECT * FROM jsonb_to_recordset(
              ${JSON.stringify(existingDeliverablesToWrite)}::jsonb
            ) AS row (
              id uuid,
              "isNew" boolean,
              sequence integer,
              title text,
              description text,
              quantity integer
            )
          ), changed AS (
            UPDATE commission_deliverables AS d
            SET title = row.title,
                description = row.description,
                quantity = row.quantity,
                updated_at = ${updatedAt}
            FROM incoming AS row
            WHERE d.id = row.id
              AND d.commission_id = ${input.commissionId}::uuid
              AND d.quote_id = ${input.quoteId}::uuid
              AND d.sequence = row.sequence
              AND row."isNew" = false
            RETURNING d.id
          )
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM changed) = ${existingDeliverablesToWrite.length}
          THEN 1 ELSE 0 END AS "deliverablesUpdated"
        `,

        // 5. Append new deliverables, if any, before their stages are inserted.
        httpSql`
          WITH incoming AS (
            SELECT * FROM jsonb_to_recordset(
              ${JSON.stringify(newDeliverablesToWrite)}::jsonb
            ) AS row (
              id uuid,
              "isNew" boolean,
              sequence integer,
              title text,
              description text,
              quantity integer
            )
          ), inserted AS (
            INSERT INTO commission_deliverables (
              id, commission_id, quote_id, sequence, title,
              description, quantity, created_at, updated_at
            )
            SELECT row.id, ${input.commissionId}::uuid,
              ${input.quoteId}::uuid, row.sequence, row.title,
              row.description, row.quantity, ${updatedAt}, ${updatedAt}
            FROM incoming AS row
            WHERE row."isNew" = true
            RETURNING id
          )
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM inserted) = ${newDeliverablesToWrite.length}
          THEN 1 ELSE 0 END AS "deliverablesAdded"
        `,

        // 6. All final positions 1..50 are now unoccupied by old stages.
        // Keep existing stage IDs and deliverable associations unchanged.
        httpSql`
          WITH incoming AS (
            SELECT * FROM jsonb_to_recordset(
              ${JSON.stringify(existingStagesToWrite)}::jsonb
            ) AS row (
              id uuid,
              "isNew" boolean,
              sequence integer,
              "deliverableId" uuid,
              label text,
              amount numeric,
              trigger text,
              "customTriggerNote" text
            )
          ), changed AS (
            UPDATE commission_payment_installments AS i
            SET sequence = row.sequence,
                label = row.label,
                amount = row.amount,
                trigger = row.trigger::installment_trigger,
                custom_trigger_note = row."customTriggerNote",
                updated_at = ${updatedAt}
            FROM incoming AS row
            WHERE i.id = row.id
              AND i.commission_id = ${input.commissionId}::uuid
              AND i.quote_id = ${input.quoteId}::uuid
              AND i.deliverable_id IS NOT DISTINCT FROM row."deliverableId"
              AND i.status = 'pending'::installment_status
              AND i.sequence >= 1001
              AND row."isNew" = false
            RETURNING i.id
          )
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM changed) = ${existingStagesToWrite.length}
          THEN 1 ELSE 0 END AS "stagesUpdated"
        `,

        // 7. Insert only genuinely new stages, scoped to this commission and
        // quote; the schema's composite FK verifies their deliverable scope.
        httpSql`
          WITH incoming AS (
            SELECT * FROM jsonb_to_recordset(
              ${JSON.stringify(newStagesToWrite)}::jsonb
            ) AS row (
              id uuid,
              "isNew" boolean,
              sequence integer,
              "deliverableId" uuid,
              label text,
              amount numeric,
              trigger text,
              "customTriggerNote" text
            )
          ), inserted AS (
            INSERT INTO commission_payment_installments (
              id, commission_id, quote_id, deliverable_id,
              sequence, label, amount, currency, trigger,
              custom_trigger_note, status, created_at, updated_at
            )
            SELECT row.id, ${input.commissionId}::uuid,
              ${input.quoteId}::uuid, row."deliverableId", row.sequence,
              row.label, row.amount, ${currency},
              row.trigger::installment_trigger, row."customTriggerNote",
              'pending'::installment_status, ${updatedAt}, ${updatedAt}
            FROM incoming AS row
            WHERE row."isNew" = true
            RETURNING id
          )
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM inserted) = ${newStagesToWrite.length}
          THEN 1 ELSE 0 END AS "stagesAdded"
        `,

        // 8. Validate the final stored plan before version advancement.
        httpSql`
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM commission_deliverables
             WHERE commission_id = ${input.commissionId}::uuid
               AND quote_id = ${input.quoteId}::uuid)
              = ${writeData.deliverables.length}
            AND (SELECT COUNT(*) FROM commission_payment_installments
                 WHERE commission_id = ${input.commissionId}::uuid
                   AND quote_id = ${input.quoteId}::uuid)
              = ${writeData.stages.length}
            AND (SELECT COALESCE(SUM(amount), 0)
                 FROM commission_payment_installments
                 WHERE commission_id = ${input.commissionId}::uuid
                   AND quote_id = ${input.quoteId}::uuid)
              = ${plan.totalAmount}::numeric
            AND NOT EXISTS (
              SELECT 1 FROM commission_payment_installments
              WHERE commission_id = ${input.commissionId}::uuid
                AND quote_id = ${input.quoteId}::uuid
                AND status <> 'pending'::installment_status
            )
            THEN 1 ELSE 0 END AS "finalPlanValid"
        `,

        // 9. Advance the Agreement's concurrency token only after every
        // preceding statement has passed. All changes roll back together.
        httpSql`
          WITH changed AS (
            UPDATE commission_agreements
            SET updated_at = ${updatedAt}
            WHERE id = ${input.agreementId}::uuid
              AND commission_id = ${input.commissionId}::uuid
              AND quote_id = ${input.quoteId}::uuid
              AND status = 'draft'
              AND updated_at = ${input.expectedAgreementUpdatedAt}
            RETURNING id
          )
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM changed) = 1
          THEN 1 ELSE 0 END AS "agreementVersionAdvanced"
        `,

        httpSql`
          WITH changed AS (
            UPDATE commissions
            SET updated_at = ${updatedAt}
            WHERE id = ${input.commissionId}::uuid
              AND status = 'awaiting_agreement'
              AND is_on_hold = false
            RETURNING id
          )
          SELECT 1 / CASE WHEN
            (SELECT COUNT(*) FROM changed) = 1
          THEN 1 ELSE 0 END AS "commissionUpdated"
        `,
      ],
    );
  } catch (error) {
    // A failed guard rolls back all commands and indicates that the request
    // is stale or that the plan became ineligible while the page was open.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === guardErrorCode
    ) {
      const current = await prepareCommissionGroupedPaymentPlanUpdate(input);
      return current.outcome === "ready" ? { outcome: "conflict" } : current;
    }

    // Unknown network failures must not be mistaken for confirmed success.
    throw error;
  }

  const [deliverables, installments] = await Promise.all([
    getCommissionDeliverables(input.commissionId, input.quoteId),
    getCommissionPaymentPlan(input.commissionId, input.quoteId),
  ]);

  if (
    deliverables.length !== writeData.deliverables.length ||
    installments.length !== writeData.stages.length ||
    deliverables.some((row, index) => row.id !== writeData.deliverables[index].id) ||
    installments.some((row, index) => row.id !== writeData.stages[index].id)
  ) {
    throw new Error("Grouped payment plan update returned unexpected records.");
  }

  return { outcome: "updated", deliverables, installments };
}
