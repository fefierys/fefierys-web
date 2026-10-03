import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../../db";
import {
  commissionAgreements,
  commissionEvents,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";

type CommissionAgreement = typeof commissionAgreements.$inferSelect;
type CommissionStatus = typeof commissions.$inferSelect.status;

export interface CreateCommissionAgreementDraftInput {
  commissionId: string;
  quoteId: string;
  termsVersion: string;
  agreementVersion: string;
  createdByAdminUserId: string;
}

export type CreateCommissionAgreementDraftResult =
  | {
      outcome: "created";
      agreement: CommissionAgreement;
    }
  | {
      outcome: "invalid";
      field: "termsVersion" | "agreementVersion";
      message: string;
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
      outcome: "active_agreement_exists";
      agreement: CommissionAgreement;
    }
  | {
      outcome: "conflict";
    };

function validateDocumentVersion(
  value: string,
  field: "termsVersion" | "agreementVersion",
):
  | { valid: true; version: string }
  | {
      valid: false;
      field: "termsVersion" | "agreementVersion";
      message: string;
    } {
  const version = value.trim();

  if (!version || version.length > 50) {
    return {
      valid: false,
      field,
      message: `${field} must contain between 1 and 50 characters.`,
    };
  }

  return {
    valid: true,
    version,
  };
}

interface CreateAgreementDraftWriteRow extends Record<string, unknown> {
  agreementId: string;
  eventId: string;
}

export async function createCommissionAgreementDraft(
  input: CreateCommissionAgreementDraftInput,
): Promise<CreateCommissionAgreementDraftResult> {
  const termsValidation = validateDocumentVersion(
    input.termsVersion,
    "termsVersion",
  );

  if (!termsValidation.valid) {
    return {
      outcome: "invalid",
      field: termsValidation.field,
      message: termsValidation.message,
    };
  }

  const agreementValidation = validateDocumentVersion(
    input.agreementVersion,
    "agreementVersion",
  );

  if (!agreementValidation.valid) {
    return {
      outcome: "invalid",
      field: agreementValidation.field,
      message: agreementValidation.message,
    };
  }

  const createdByAdminUserId = input.createdByAdminUserId.trim();

  if (!createdByAdminUserId) {
    throw new Error("createdByAdminUserId is required.");
  }

  const [commissionRows, quoteRows, activeAgreementRows, latestAgreementRows] =
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
          id: commissionQuotes.id,
          status: commissionQuotes.status,
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
        .select()
        .from(commissionAgreements)
        .where(
          and(
            eq(commissionAgreements.commissionId, input.commissionId),
            inArray(commissionAgreements.status, ["draft", "sent"]),
          ),
        )
        .limit(1),

      db
        .select({
          version: commissionAgreements.version,
        })
        .from(commissionAgreements)
        .where(eq(commissionAgreements.commissionId, input.commissionId))
        .orderBy(desc(commissionAgreements.version))
        .limit(1),
    ]);

  const commission = commissionRows[0];

  if (!commission) {
    return {
      outcome: "not_found",
    };
  }

  if (commission.status !== "awaiting_agreement") {
    return {
      outcome: "wrong_status",
      currentStatus: commission.status,
    };
  }

  if (commission.isOnHold) {
    return {
      outcome: "on_hold",
    };
  }

  if (quoteRows[0]?.status !== "accepted") {
    return {
      outcome: "quote_not_accepted",
    };
  }

  const activeAgreement = activeAgreementRows[0];

  if (activeAgreement) {
    return {
      outcome: "active_agreement_exists",
      agreement: activeAgreement,
    };
  }

  const agreementId = randomUUID();
  const eventId = randomUUID();
  const version = (latestAgreementRows[0]?.version ?? 0) + 1;
  const createdAt = new Date();

  try {
    const writeResult = await db.execute<CreateAgreementDraftWriteRow>(
      sql`
        WITH
        locked_target AS MATERIALIZED (
          SELECT
            commission.id AS commission_id,
            quote.id AS quote_id
          FROM commissions AS commission
          INNER JOIN commission_quotes AS quote
            ON quote.commission_id = commission.id
          WHERE
            commission.id = ${input.commissionId}::uuid
            AND commission.status = 'awaiting_agreement'
            AND commission.is_on_hold = false
            AND quote.id = ${input.quoteId}::uuid
            AND quote.status = 'accepted'
          FOR UPDATE OF commission, quote
        ),

        created_agreement AS (
          INSERT INTO commission_agreements (
            id,
            commission_id,
            quote_id,
            version,
            terms_version,
            agreement_version,
            agreement_data,
            status,
            created_at,
            updated_at
          )
          SELECT
            ${agreementId}::uuid,
            locked_target.commission_id,
            locked_target.quote_id,
            ${version}::integer,
            ${termsValidation.version},
            ${agreementValidation.version},
            null::jsonb,
            'draft'::agreement_status,
            ${createdAt},
            ${createdAt}
          FROM locked_target
          WHERE NOT EXISTS (
            SELECT 1
            FROM commission_agreements AS existing
            WHERE
              existing.commission_id = locked_target.commission_id
              AND existing.status IN ('draft', 'sent')
          )
          RETURNING
            id,
            commission_id,
            version
        ),

        created_event AS (
          INSERT INTO commission_events (
            id,
            commission_id,
            type,
            actor,
            title,
            description,
            metadata,
            created_by_admin_user_id,
            created_at
          )
          SELECT
            ${eventId}::uuid,
            created_agreement.commission_id,
            'agreement_created'::commission_event_type,
            'artist'::commission_actor,
            'Agreement v'
              || created_agreement.version
              || ' created',
            null,
            jsonb_build_object(
              'agreementId',
              created_agreement.id,
              'quoteId',
              ${input.quoteId}::uuid,
              'version',
              created_agreement.version
            ),
            ${createdByAdminUserId},
            ${createdAt}
          FROM created_agreement
          RETURNING id
        ),

        updated_commission AS (
          UPDATE commissions AS commission
          SET updated_at = ${createdAt}
          FROM created_agreement
          WHERE commission.id = created_agreement.commission_id
          RETURNING commission.id
        )

        SELECT
          created_agreement.id AS "agreementId",
          created_event.id AS "eventId"
        FROM created_agreement
        CROSS JOIN created_event
        CROSS JOIN updated_commission
      `,
    );

    if (!writeResult.rows[0]) {
      return {
        outcome: "conflict",
      };
    }

    const agreementRows = await db
      .select()
      .from(commissionAgreements)
      .where(eq(commissionAgreements.id, agreementId))
      .limit(1);

    const agreement = agreementRows[0];

    if (!agreement) {
      throw new Error("Agreement draft creation returned no agreement.");
    }

    return {
      outcome: "created",
      agreement,
    };
  } catch (error) {
    /*
     * Neon may commit the write but lose the response.
     * Check the pre-generated IDs before attempting another creation.
     */
    try {
      const [agreementRows, eventRows] = await Promise.all([
        db
          .select()
          .from(commissionAgreements)
          .where(eq(commissionAgreements.id, agreementId))
          .limit(1),

        db
          .select({
            id: commissionEvents.id,
          })
          .from(commissionEvents)
          .where(eq(commissionEvents.id, eventId))
          .limit(1),
      ]);

      if (agreementRows[0] && eventRows[0]) {
        return {
          outcome: "created",
          agreement: agreementRows[0],
        };
      }

      const currentActiveAgreementRows = await db
        .select()
        .from(commissionAgreements)
        .where(
          and(
            eq(commissionAgreements.commissionId, input.commissionId),
            inArray(commissionAgreements.status, ["draft", "sent"]),
          ),
        )
        .limit(1);

      if (currentActiveAgreementRows[0]) {
        return {
          outcome: "active_agreement_exists",
          agreement: currentActiveAgreementRows[0],
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