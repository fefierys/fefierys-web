import { randomUUID } from "node:crypto";

import {
  and,
  eq,
  sql,
} from "drizzle-orm";

import { db } from "../../db";

import {
  commissionAgreements,
  commissionEvents,
  commissionQuotes,
  commissions,
} from "../../db/schema/commissions";

type CommissionAgreement =
  typeof commissionAgreements.$inferSelect;

type CommissionEvent =
  typeof commissionEvents.$inferSelect;

type CommissionStatus =
  typeof commissions.$inferSelect.status;

type AgreementStatus =
  typeof commissionAgreements.$inferSelect.status;

type QuoteStatus =
  typeof commissionQuotes.$inferSelect.status;

export interface CreateCommissionAgreementRevisionInput {
  commissionId: string;
  agreementId: string;
  expectedUpdatedAt: Date;
  createdByAdminUserId: string;
}

export type CreateCommissionAgreementRevisionResult =
  | {
      outcome: "created";
      supersededAgreement: CommissionAgreement;
      agreement: CommissionAgreement;
      event: CommissionEvent;
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "not_sent";
      currentStatus: AgreementStatus;
    }
  | {
      outcome: "wrong_commission_status";
      currentStatus: CommissionStatus;
    }
  | {
      outcome: "on_hold";
    }
  | {
      outcome: "quote_not_accepted";
      currentStatus: QuoteStatus;
    }
  | {
      outcome: "conflict";
      currentUpdatedAt: Date;
    };

interface AgreementRevisionState {
  agreement: CommissionAgreement;
  commissionStatus: CommissionStatus;
  isOnHold: boolean;
  quoteStatus: QuoteStatus;
}

interface CreateAgreementRevisionWriteRow
  extends Record<string, unknown> {
  supersededAgreementId: string;
  agreementId: string;
  eventId: string;
}

function normalizeRequiredValue(
  value: string,
  fieldName: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

async function getAgreementRevisionState(
  commissionId: string,
  agreementId: string,
): Promise<AgreementRevisionState | null> {
  const rows =
    await db
      .select({
        agreement:
          commissionAgreements,

        commissionStatus:
          commissions.status,

        isOnHold:
          commissions.isOnHold,

        quoteStatus:
          commissionQuotes.status,
      })
      .from(
        commissionAgreements,
      )
      .innerJoin(
        commissions,
        eq(
          commissions.id,
          commissionAgreements.commissionId,
        ),
      )
      .innerJoin(
        commissionQuotes,
        and(
          eq(
            commissionQuotes.id,
            commissionAgreements.quoteId,
          ),
          eq(
            commissionQuotes.commissionId,
            commissionAgreements.commissionId,
          ),
        ),
      )
      .where(
        and(
          eq(
            commissionAgreements.id,
            agreementId,
          ),
          eq(
            commissionAgreements.commissionId,
            commissionId,
          ),
        ),
      )
      .limit(1);

  return (
    rows[0] ??
    null
  );
}

async function classifyAgreementRevisionFailure(
  commissionId: string,
  agreementId: string,
  expectedUpdatedAt: Date,
): Promise<
  Exclude<
    CreateCommissionAgreementRevisionResult,
    {
      outcome: "created";
    }
  >
> {
  const state =
    await getAgreementRevisionState(
      commissionId,
      agreementId,
    );

  if (!state) {
    return {
      outcome:
        "not_found",
    };
  }

  if (
    state.agreement.status !==
    "sent"
  ) {
    return {
      outcome:
        "not_sent",

      currentStatus:
        state.agreement.status,
    };
  }

  if (
    state.commissionStatus !==
    "awaiting_agreement"
  ) {
    return {
      outcome:
        "wrong_commission_status",

      currentStatus:
        state.commissionStatus,
    };
  }

  if (
    state.isOnHold
  ) {
    return {
      outcome:
        "on_hold",
    };
  }

  if (
    state.quoteStatus !==
    "accepted"
  ) {
    return {
      outcome:
        "quote_not_accepted",

      currentStatus:
        state.quoteStatus,
    };
  }

  return {
    outcome:
      "conflict",

    currentUpdatedAt:
      state.agreement.updatedAt,
  };
}

/*
 * Creates a new editable Agreement revision without mutating the
 * contractual contents of the previously-presented Agreement.
 *
 * The operation is atomic:
 *
 * 1. lock the Commission, accepted Quote and current sent Agreement;
 * 2. verify optimistic concurrency;
 * 3. supersede the current Agreement and revoke its public bearer;
 * 4. create the next Agreement revision as a draft from the exact
 *    persisted agreement_data snapshot;
 * 5. write one audit event for the new revision;
 * 6. touch the Commission updated_at.
 *
 * The immutable Presented PDF referenced by the superseded Agreement
 * is deliberately preserved. It remains historical contractual
 * evidence, but its public token can no longer resolve.
 */
export async function createCommissionAgreementRevision(
  input: CreateCommissionAgreementRevisionInput,
): Promise<CreateCommissionAgreementRevisionResult> {
  const createdByAdminUserId =
    normalizeRequiredValue(
      input.createdByAdminUserId,
      "createdByAdminUserId",
    );

  if (
    !(
      input.expectedUpdatedAt
      instanceof Date
    ) ||
    Number.isNaN(
      input.expectedUpdatedAt.getTime(),
    )
  ) {
    throw new Error(
      "expectedUpdatedAt must be a valid Date.",
    );
  }

  const initialState =
    await getAgreementRevisionState(
      input.commissionId,
      input.agreementId,
    );

  if (!initialState) {
    return {
      outcome:
        "not_found",
    };
  }

  if (
    initialState.agreement.status !==
    "sent"
  ) {
    return {
      outcome:
        "not_sent",

      currentStatus:
        initialState.agreement.status,
    };
  }

  if (
    initialState.commissionStatus !==
    "awaiting_agreement"
  ) {
    return {
      outcome:
        "wrong_commission_status",

      currentStatus:
        initialState.commissionStatus,
    };
  }

  if (
    initialState.isOnHold
  ) {
    return {
      outcome:
        "on_hold",
    };
  }

  if (
    initialState.quoteStatus !==
    "accepted"
  ) {
    return {
      outcome:
        "quote_not_accepted",

      currentStatus:
        initialState.quoteStatus,
    };
  }

  if (
    initialState.agreement.updatedAt.getTime() !==
    input.expectedUpdatedAt.getTime()
  ) {
    return {
      outcome:
        "conflict",

      currentUpdatedAt:
        initialState.agreement.updatedAt,
    };
  }

  const newAgreementId =
    randomUUID();

  const eventId =
    randomUUID();

  const revisedAt =
    new Date();

  try {
    const writeResult =
      await db.execute<CreateAgreementRevisionWriteRow>(
        sql`
          WITH
          locked_target AS MATERIALIZED (
            SELECT
              agreement.id
                AS agreement_id,

              agreement.commission_id
                AS commission_id,

              agreement.quote_id
                AS quote_id,

              agreement.version
                AS agreement_version_number,

              agreement.terms_version
                AS terms_version,

              agreement.agreement_version
                AS agreement_template_version,

              agreement.agreement_data
                AS agreement_data,

              agreement.updated_at
                AS agreement_updated_at

            FROM commission_agreements
              AS agreement

            INNER JOIN commissions
              AS commission
              ON commission.id =
                agreement.commission_id

            INNER JOIN commission_quotes
              AS quote
              ON quote.id =
                agreement.quote_id
              AND quote.commission_id =
                agreement.commission_id

            WHERE
              agreement.id =
                ${input.agreementId}::uuid

              AND agreement.commission_id =
                ${input.commissionId}::uuid

              AND agreement.status =
                'sent'

              AND agreement.updated_at =
                ${input.expectedUpdatedAt}

              AND agreement.document_id
                IS NOT NULL

              AND agreement.public_token_hash
                IS NOT NULL

              AND agreement.public_token_created_at
                IS NOT NULL

              AND agreement.public_token_revoked_at
                IS NULL

              AND agreement.sent_at
                IS NOT NULL

              AND agreement.executed_document_id
                IS NULL

              AND agreement.accepted_at
                IS NULL

              AND commission.status =
                'awaiting_agreement'

              AND commission.is_on_hold =
                false

              AND quote.status =
                'accepted'

            FOR UPDATE OF
              agreement,
              commission,
              quote
          ),

          superseded_agreement AS (
            UPDATE commission_agreements
              AS agreement

            SET
              status =
                'superseded'
                  ::agreement_status,

              public_token_revoked_at =
                ${revisedAt},

              updated_at =
                ${revisedAt}

            FROM locked_target

            WHERE
              agreement.id =
                locked_target.agreement_id

              AND agreement.status =
                'sent'

              AND agreement.updated_at =
                locked_target.agreement_updated_at

            RETURNING
              agreement.id,
              agreement.commission_id,
              agreement.quote_id,
              agreement.version,
              agreement.terms_version,
              agreement.agreement_version,
              agreement.agreement_data
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
              ${newAgreementId}::uuid,

              superseded_agreement.commission_id,

              superseded_agreement.quote_id,

              superseded_agreement.version +
                1,

              superseded_agreement.terms_version,

              superseded_agreement.agreement_version,

              superseded_agreement.agreement_data,

              'draft'
                ::agreement_status,

              ${revisedAt},

              ${revisedAt}

            FROM superseded_agreement

            WHERE NOT EXISTS (
              SELECT
                1

              FROM commission_agreements
                AS existing

              WHERE
                existing.commission_id =
                  superseded_agreement.commission_id

                AND existing.id !=
                  superseded_agreement.id

                AND existing.status
                  IN (
                    'draft',
                    'sent'
                  )
            )

            RETURNING
              id,
              commission_id,
              quote_id,
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

              'agreement_created'
                ::commission_event_type,

              'artist'
                ::commission_actor,

              'Agreement v'
                || created_agreement.version
                || ' revision created',

              'Agreement v'
                || superseded_agreement.version
                || ' was superseded and its public access was revoked.',

              jsonb_build_object(
                'agreementId',
                  created_agreement.id,

                'version',
                  created_agreement.version,

                'quoteId',
                  created_agreement.quote_id,

                'supersededAgreementId',
                  superseded_agreement.id,

                'supersededVersion',
                  superseded_agreement.version,

                'reason',
                  'agreement_revision_created'
              ),

              ${createdByAdminUserId},

              ${revisedAt}

            FROM created_agreement

            INNER JOIN superseded_agreement
              ON superseded_agreement.commission_id =
                created_agreement.commission_id

            RETURNING
              id
          ),

          updated_commission AS (
            UPDATE commissions
              AS commission

            SET
              updated_at =
                ${revisedAt}

            FROM created_agreement

            WHERE
              commission.id =
                created_agreement.commission_id

            RETURNING
              commission.id
          )

          SELECT
            superseded_agreement.id
              AS "supersededAgreementId",

            created_agreement.id
              AS "agreementId",

            created_event.id
              AS "eventId"

          FROM superseded_agreement

          CROSS JOIN created_agreement

          CROSS JOIN created_event

          CROSS JOIN updated_commission
        `,
      );

    const writeRow =
      writeResult.rows[0];

    if (!writeRow) {
      return classifyAgreementRevisionFailure(
        input.commissionId,
        input.agreementId,
        input.expectedUpdatedAt,
      );
    }

    const [
      supersededAgreementRows,
      agreementRows,
      eventRows,
    ] =
      await Promise.all([
        db
          .select()
          .from(
            commissionAgreements,
          )
          .where(
            eq(
              commissionAgreements.id,
              writeRow.supersededAgreementId,
            ),
          )
          .limit(1),

        db
          .select()
          .from(
            commissionAgreements,
          )
          .where(
            eq(
              commissionAgreements.id,
              writeRow.agreementId,
            ),
          )
          .limit(1),

        db
          .select()
          .from(
            commissionEvents,
          )
          .where(
            eq(
              commissionEvents.id,
              writeRow.eventId,
            ),
          )
          .limit(1),
      ]);

    const supersededAgreement =
      supersededAgreementRows[0];

    const agreement =
      agreementRows[0];

    const event =
      eventRows[0];

    if (
      !supersededAgreement ||
      !agreement ||
      !event
    ) {
      throw new Error(
        "Agreement revision creation returned incomplete persisted state.",
      );
    }

    return {
      outcome:
        "created",

      supersededAgreement,
      agreement,
      event,
    };
  } catch (error) {
    /*
     * Neon may commit the write but lose the response.
     *
     * The new Agreement and event IDs are pre-generated so the
     * exact operation can be reconciled without creating another
     * revision or revoking a different token.
     */
    try {
      const [
        agreementRows,
        eventRows,
      ] =
        await Promise.all([
          db
            .select()
            .from(
              commissionAgreements,
            )
            .where(
              eq(
                commissionAgreements.id,
                newAgreementId,
              ),
            )
            .limit(1),

          db
            .select()
            .from(
              commissionEvents,
            )
            .where(
              eq(
                commissionEvents.id,
                eventId,
              ),
            )
            .limit(1),
        ]);

      const agreement =
        agreementRows[0];

      const event =
        eventRows[0];

      if (
        agreement &&
        event
      ) {
        const supersededAgreementRows =
          await db
            .select()
            .from(
              commissionAgreements,
            )
            .where(
              and(
                eq(
                  commissionAgreements.id,
                  input.agreementId,
                ),
                eq(
                  commissionAgreements.commissionId,
                  input.commissionId,
                ),
                eq(
                  commissionAgreements.status,
                  "superseded",
                ),
              ),
            )
            .limit(1);

        const supersededAgreement =
          supersededAgreementRows[0];

        if (
          supersededAgreement &&
          supersededAgreement.publicTokenRevokedAt
        ) {
          return {
            outcome:
              "created",

            supersededAgreement,
            agreement,
            event,
          };
        }
      }
    } catch {
      /*
       * Preserve the original exception when reconciliation
       * cannot reach Neon.
       */
    }

    throw error;
  }
}
