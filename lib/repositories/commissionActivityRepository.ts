import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import {
  isCommissionManualActor,
  validateCommissionHoldAction,
  validateCommissionNote,
  type CommissionActivityValidation,
  type CommissionHoldAction,
  type CommissionManualActor,
} from "../commissions/commissionActivity";
import { db } from "../db";
import { commissions, commissionEvents } from "../db/schema/commissions";
import type { CommissionStatus } from "./commissionAdminRepository";

type CommissionEvent = typeof commissionEvents.$inferSelect;

type InvalidActivityValidation = Extract<
  CommissionActivityValidation,
  { valid: false }
>;

export interface ChangeCommissionHoldInput {
  commissionId: string;
  expectedStatus: CommissionStatus;
  action: CommissionHoldAction;
  actor: CommissionManualActor;
  description?: string | null;
  createdByAdminUserId: string;
}

export type ChangeCommissionHoldResult =
  | {
      outcome: "updated";
      event: CommissionEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidActivityValidation;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "conflict";
      currentStatus: CommissionStatus;
      isOnHold: boolean;
    };

export async function changeCommissionHold(
  input: ChangeCommissionHoldInput,
): Promise<ChangeCommissionHoldResult> {
  const validation = validateCommissionHoldAction({
    action: input.action,
    status: input.expectedStatus,
    isOnHold: input.action === "resume",
    description: input.description,
  });

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  if (!isCommissionManualActor(input.actor)) {
    throw new Error("A valid manual actor is required.");
  }

  const createdByAdminUserId = input.createdByAdminUserId.trim();

  if (!createdByAdminUserId) {
    throw new Error("createdByAdminUserId is required.");
  }

  const eventId = randomUUID();
  const changedAt = new Date();
  const pausing = input.action === "pause";

  const updatedCommission = db.$with("updated_commission").as(
    db
      .update(commissions)
      .set({
        isOnHold: pausing,
        holdReason: pausing ? validation.description : null,
        holdStartedAt: pausing ? changedAt : null,
        updatedAt: changedAt,
      })
      .where(
        and(
          eq(commissions.id, input.commissionId),
          eq(commissions.status, input.expectedStatus),
          eq(commissions.isOnHold, !pausing),
        ),
      )
      .returning({
        id: commissions.id,
      }),
  );

  let eventRows: CommissionEvent[];

  try {
    eventRows = await db
      .with(updatedCommission)
      .insert(commissionEvents)
      .select(
        db
          .select({
            id: sql<string>`
              ${eventId}::uuid
            `.as("id"),

            commissionId: updatedCommission.id,

            type: sql<CommissionEvent["type"]>`
              ${pausing ? "commission_paused" : "commission_resumed"}
                ::commission_event_type
            `.as("type"),

            actor: sql<CommissionEvent["actor"]>`
              ${input.actor}::commission_actor
            `.as("actor"),

            title: sql<string>`
              ${pausing ? "Commission paused" : "Commission resumed"}
            `.as("title"),

            description: sql<string | null>`
              ${validation.description}
            `.as("description"),

            metadata: sql<CommissionEvent["metadata"]>`
              null::jsonb
            `.as("metadata"),

            createdByAdminUserId: sql<string>`
              ${createdByAdminUserId}
            `.as("created_by_admin_user_id"),

            createdAt: sql<Date>`
              ${changedAt}
            `.as("created_at"),
          })
          .from(updatedCommission),
      )
      .returning();
  } catch (error) {
    try {
      const committedRows = await db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, eventId))
        .limit(1);

      const committedEvent = committedRows[0];

      if (committedEvent) {
        return {
          outcome: "updated",
          event: committedEvent,
        };
      }
    } catch {
      // Preserve the original write error if reconciliation also fails.
    }

    throw error;
  }

  const event = eventRows[0];

  if (event) {
    return {
      outcome: "updated",
      event,
    };
  }

  const currentRows = await db
    .select({
      status: commissions.status,
      isOnHold: commissions.isOnHold,
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
    isOnHold: currentCommission.isOnHold,
  };
}

export interface AddCommissionNoteInput {
  commissionId: string;
  actor: CommissionManualActor;
  description: string;
  createdByAdminUserId: string;
}

export type AddCommissionNoteResult =
  | {
      outcome: "added";
      event: CommissionEvent;
    }
  | {
      outcome: "invalid";
      validation: InvalidActivityValidation;
    }
  | {
      outcome: "not_found";
    };

export async function addCommissionNote(
  input: AddCommissionNoteInput,
): Promise<AddCommissionNoteResult> {
  const validation = validateCommissionNote(input.description);

  if (!validation.valid) {
    return {
      outcome: "invalid",
      validation,
    };
  }

  if (!isCommissionManualActor(input.actor)) {
    throw new Error("A valid manual actor is required.");
  }

  const createdByAdminUserId = input.createdByAdminUserId.trim();

  if (!createdByAdminUserId) {
    throw new Error("createdByAdminUserId is required.");
  }

  const eventId = randomUUID();
  const createdAt = new Date();

  const updatedCommission = db.$with("updated_commission").as(
    db
      .update(commissions)
      .set({
        updatedAt: createdAt,
      })
      .where(eq(commissions.id, input.commissionId))
      .returning({
        id: commissions.id,
      }),
  );

  let eventRows: CommissionEvent[];

  try {
    eventRows = await db
      .with(updatedCommission)
      .insert(commissionEvents)
      .select(
        db
          .select({
            id: sql<string>`
              ${eventId}::uuid
            `.as("id"),

            commissionId: updatedCommission.id,

            type: sql<CommissionEvent["type"]>`
              ${"note_added"}::commission_event_type
            `.as("type"),

            actor: sql<CommissionEvent["actor"]>`
              ${input.actor}::commission_actor
            `.as("actor"),

            title: sql<string>`
              ${"Commission note"}
            `.as("title"),

            description: sql<string>`
              ${validation.description}
            `.as("description"),

            metadata: sql<CommissionEvent["metadata"]>`
              null::jsonb
            `.as("metadata"),

            createdByAdminUserId: sql<string>`
              ${createdByAdminUserId}
            `.as("created_by_admin_user_id"),

            createdAt: sql<Date>`
              ${createdAt}
            `.as("created_at"),
          })
          .from(updatedCommission),
      )
      .returning();
  } catch (error) {
    try {
      const committedRows = await db
        .select()
        .from(commissionEvents)
        .where(eq(commissionEvents.id, eventId))
        .limit(1);

      const committedEvent = committedRows[0];

      if (committedEvent) {
        return {
          outcome: "added",
          event: committedEvent,
        };
      }
    } catch {
      // Preserve the original write error if reconciliation also fails.
    }

    throw error;
  }

  const event = eventRows[0];

  if (event) {
    return {
      outcome: "added",
      event,
    };
  }

  return {
    outcome: "not_found",
  };
}
