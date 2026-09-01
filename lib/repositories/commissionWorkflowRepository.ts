import { and, eq, sql } from "drizzle-orm";

import {
  validateCommissionTransition,
  type CommissionTransitionInput,
  type CommissionTransitionValidation,
} from "../commissions/commissionWorkflow";
import { db } from "../db";
import { commissions, commissionStatusHistory } from "../db/schema/commissions";
import type { CommissionStatus } from "./commissionAdminRepository";

import { randomUUID } from "node:crypto";

type StatusHistoryEntry = typeof commissionStatusHistory.$inferSelect;

type InvalidTransitionValidation = Extract<
  CommissionTransitionValidation,
  { valid: false }
>;

export interface TransitionCommissionInput extends CommissionTransitionInput {
  commissionId: string;
  changedByAdminUserId: string;
  reason?: string | null;
  note?: string | null;
}

export type TransitionCommissionResult =
  | {
      outcome: "updated";
      transition: StatusHistoryEntry;
    }
  | {
      outcome: "invalid";
      validation: InvalidTransitionValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "conflict";
      currentStatus: CommissionStatus;
    };

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

export async function transitionCommissionStatus(
  input: TransitionCommissionInput,
): Promise<TransitionCommissionResult> {
  const validation = validateCommissionTransition(input);

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  const changedByAdminUserId = input.changedByAdminUserId.trim();

  if (!changedByAdminUserId) {
    throw new Error(
      "changedByAdminUserId is required to transition a commission.",
    );
  }

  const changedAt = new Date();

  const statusHistoryId = randomUUID();

  const isTerminal = ["completed", "cancelled", "declined", "expired"].includes(
    input.toStatus,
  );

  const closesWithReason = ["cancelled", "declined", "expired"].includes(
    input.toStatus,
  );

  const closeReasonNote = normalizeOptionalText(input.closeReasonNote);

  const historyReason =
    input.closeReason ?? normalizeOptionalText(input.reason);

  const historyNote = closeReasonNote ?? normalizeOptionalText(input.note);

  const updatedCommission = db.$with("updated_commission").as(
    db
      .update(commissions)
      .set({
        status: input.toStatus,
        updatedAt: changedAt,

        ...(input.toStatus === "in_progress"
          ? {
              startedAt: sql<Date>`
                  coalesce(
                    ${commissions.startedAt},
                    ${changedAt}
                  )
                `,
            }
          : {}),

        ...(isTerminal
          ? {
              isOnHold: false,
              holdReason: null,
              holdStartedAt: null,
              closedAt: changedAt,
              closedBy: input.initiatedBy,
              closeReason: closesWithReason ? input.closeReason : null,
              closeReasonNote: closesWithReason ? closeReasonNote : null,
            }
          : {}),

        ...(input.toStatus === "completed"
          ? {
              completedAt: changedAt,
            }
          : {}),
      })
      .where(
        and(
          eq(commissions.id, input.commissionId),
          eq(commissions.status, input.fromStatus),
        ),
      )
      .returning({
        id: commissions.id,
      }),
  );

  let transitionRows: StatusHistoryEntry[];

  try {
    transitionRows = await db
      .with(updatedCommission)
      .insert(commissionStatusHistory)
      .select(
        db
          .select({
            id: sql<string>`
                ${statusHistoryId}::uuid
                `.as("id"),

            commissionId: updatedCommission.id,

            fromStatus: sql<CommissionStatus>`
                        ${input.fromStatus}::commission_status
                    `.as("from_status"),

            toStatus: sql<CommissionStatus>`
                        ${input.toStatus}::commission_status
                    `.as("to_status"),

            initiatedBy: sql<StatusHistoryEntry["initiatedBy"]>`
                        ${input.initiatedBy}::commission_actor
                    `.as("initiated_by"),

            reason: sql<string | null>`
                        ${historyReason}
                    `.as("reason"),

            note: sql<string | null>`
                        ${historyNote}
                    `.as("note"),

            changedByAdminUserId: sql<string>`
                        ${changedByAdminUserId}
                    `.as("changed_by_admin_user_id"),

            createdAt: sql<Date>`
                        ${changedAt}
                    `.as("created_at"),
          })
          .from(updatedCommission),
      )
      .returning();
  } catch (error) {
    /*
     * Neon may commit the statement but lose the HTTP response.
     * The pre-generated history ID lets us verify that exact write
     * without repeating the transition.
     */
    try {
      const committedRows = await db
        .select()
        .from(commissionStatusHistory)
        .where(eq(commissionStatusHistory.id, statusHistoryId))
        .limit(1);

      const committedTransition = committedRows[0];

      if (committedTransition) {
        return {
          outcome: "updated",
          transition: committedTransition,
        };
      }
    } catch {
      /*
       * Preserve the original write error when reconciliation
       * cannot reach Neon either.
       */
    }

    throw error;
  }

  const transition = transitionRows[0];

  if (transition) {
    return {
      outcome: "updated",
      transition,
    };
  }

  const currentRows = await db
    .select({
      status: commissions.status,
    })
    .from(commissions)
    .where(eq(commissions.id, input.commissionId))
    .limit(1);

  const currentCommission = currentRows[0];

  if (!currentCommission) {
    return {
      outcome: "not_found",
    };
  }

  return {
    outcome: "conflict",
    currentStatus: currentCommission.status,
  };
}
