import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  validateCommissionPaymentPlan,
  type CommissionPaymentPlanValidation,
  type CommissionPaymentStageInput,
} from "../../commissions/commissionPaymentPlan";

import { db } from "../../db";

import {
  commissionAgreements,
  commissionPaymentInstallments,
  commissionPayments,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";

type CommissionPaymentInstallment =
  typeof commissionPaymentInstallments.$inferSelect;

type CommissionStatus = typeof commissions.$inferSelect.status;

type InvalidPaymentPlanValidation = Extract<
  CommissionPaymentPlanValidation,
  { valid: false }
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

async function getCommissionPaymentPlanPreparationState(
  input: Pick<
    CreateCommissionPaymentPlanInput,
    "commissionId" | "quoteId" | "agreementId"
  >,
) {
  const [commissionRows, quoteRows, agreementRows, existingInstallmentRows] =
    await db.batch([
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
    ]);

  return {
    commission: commissionRows[0] ?? null,
    quote: quoteRows[0] ?? null,
    agreement: agreementRows[0] ?? null,
    planAlreadyExists: existingInstallmentRows.length > 0,
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

async function getCommissionPaymentPlanEditState(
  input: UpdateCommissionPaymentPlanInput,
) {
  const [agreementRows, installments] = await Promise.all([
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