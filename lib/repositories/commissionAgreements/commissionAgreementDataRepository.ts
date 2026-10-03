import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  validateCommissionAgreementDraftData,
} from "../../commissions/commissionAgreementData";

import { db } from "../../db";

import {
  commissionAgreements,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";

type CommissionAgreement = typeof commissionAgreements.$inferSelect;
type CommissionStatus = typeof commissions.$inferSelect.status;

export interface SaveCommissionAgreementDraftDataInput {
  commissionId: string;
  quoteId: string;
  agreementId: string;
  expectedAgreementUpdatedAt: Date;
  agreementData: unknown;
}

export type SaveCommissionAgreementDraftDataResult =
  | {
      outcome: "saved";
      agreement: CommissionAgreement;
    }
  | {
      outcome: "invalid";
      field: string;
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
      outcome: "conflict";
    };

export async function saveCommissionAgreementDraftData(
  input: SaveCommissionAgreementDraftDataInput,
): Promise<SaveCommissionAgreementDraftDataResult> {
  const validation = validateCommissionAgreementDraftData(
    input.agreementData,
  );

  if (!validation.valid) {
    return {
      outcome: "invalid",
      field: validation.field,
    };
  }

  if (
    !(input.expectedAgreementUpdatedAt instanceof Date) ||
    Number.isNaN(input.expectedAgreementUpdatedAt.getTime())
  ) {
    throw new Error(
      "expectedAgreementUpdatedAt must be a valid Date.",
    );
  }

  /*
   * One conditional UPDATE:
   * - preserves the accepted Quote and draft-only workflow;
   * - rejects a stale Agreement version;
   * - saves only the editable agreement_data field.
   *
   * The updatedAt change also invalidates a concurrent
   * payment-plan edit using the previous Agreement version.
   */
  const savedRows = await db
    .update(commissionAgreements)
    .set({
      agreementData: validation.data,
      updatedAt: sql`
        GREATEST(
          date_trunc('milliseconds', clock_timestamp()),
          ${commissionAgreements.updatedAt} + INTERVAL '1 millisecond'
        )
      `,
    })
    .where(
      and(
        eq(commissionAgreements.id, input.agreementId),
        eq(
          commissionAgreements.commissionId,
          input.commissionId,
        ),
        eq(commissionAgreements.quoteId, input.quoteId),
        eq(commissionAgreements.status, "draft"),
        eq(
          commissionAgreements.updatedAt,
          input.expectedAgreementUpdatedAt,
        ),

        sql`
          EXISTS (
            SELECT 1
            FROM commissions AS commission
            WHERE
              commission.id = ${commissionAgreements.commissionId}
              AND commission.status = 'awaiting_agreement'
              AND commission.is_on_hold = false
          )
        `,

        sql`
          EXISTS (
            SELECT 1
            FROM commission_quotes AS quote
            WHERE
              quote.id = ${commissionAgreements.quoteId}
              AND quote.commission_id =
                ${commissionAgreements.commissionId}
              AND quote.status = 'accepted'
          )
        `,
      ),
    )
    .returning();

  const savedAgreement = savedRows[0];

  if (savedAgreement) {
    return {
      outcome: "saved",
      agreement: savedAgreement,
    };
  }

  /*
   * The UPDATE affected no rows. Read the current state
   * to identify which condition prevented the save.
   */
  const [commissionRows, quoteRows, agreementRows] = await db.batch([
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
      })
      .from(commissionQuotes)
      .where(
        and(
          eq(commissionQuotes.id, input.quoteId),
          eq(
            commissionQuotes.commissionId,
            input.commissionId,
          ),
        ),
      )
      .limit(1),

    db
      .select({
        status: commissionAgreements.status,
        updatedAt: commissionAgreements.updatedAt,
      })
      .from(commissionAgreements)
      .where(
        and(
          eq(commissionAgreements.id, input.agreementId),
          eq(
            commissionAgreements.commissionId,
            input.commissionId,
          ),
          eq(commissionAgreements.quoteId, input.quoteId),
        ),
      )
      .limit(1),
  ]);

  const commission = commissionRows[0];

  if (!commission) {
    return { outcome: "not_found" };
  }

  if (commission.status !== "awaiting_agreement") {
    return {
      outcome: "wrong_status",
      currentStatus: commission.status,
    };
  }

  if (commission.isOnHold) {
    return { outcome: "on_hold" };
  }

  if (quoteRows[0]?.status !== "accepted") {
    return { outcome: "quote_not_accepted" };
  }

  const agreement = agreementRows[0];

  if (!agreement) {
    return { outcome: "not_found" };
  }

  if (agreement.status !== "draft") {
    return { outcome: "agreement_not_draft" };
  }

  return { outcome: "conflict" };
}

export async function getActiveCommissionAgreement(
  commissionId: string,
): Promise<CommissionAgreement | null> {
  const rows = await db
    .select()
    .from(commissionAgreements)
    .where(
      and(
        eq(commissionAgreements.commissionId, commissionId),
        inArray(commissionAgreements.status, ["draft", "sent"]),
      ),
    )
    .orderBy(desc(commissionAgreements.version))
    .limit(1);

  return rows[0] ?? null;
}