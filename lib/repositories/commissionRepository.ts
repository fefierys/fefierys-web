import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "../db";

import {
  commissionEvents,
  commissions,
  commissionStatusHistory,
} from "../db/schema/commissions";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

export type Commission = typeof commissions.$inferSelect;

export interface CreateCommissionInput {
  clientName: string;
  clientEmail: string;

  clientCompanyName?: string | null;
  clientCountry?: string | null;

  styleSnapshot?: string | null;
  collectionSnapshot?: string | null;
  categorySnapshot?: string | null;
  optionSnapshot?: string | null;

  initialMessage: string;

  termsVersion?: string | null;
  agreementVersion?: string | null;
}

export interface CreatedCommission {
  id: string;
  reference: string;
  status: Commission["status"];
  submittedAt: Date;
}

/*
 * ============================================================
 * COMMISSION REFERENCE
 * ============================================================
 *
 * Public format:
 *
 * COM-YYYYMMDD-XXXXXX
 *
 * - The date is generated in UTC.
 * - The suffix contains three cryptographically random bytes,
 *   represented as six uppercase hexadecimal characters.
 * - PostgreSQL's unique constraint remains the final
 *   protection against collisions.
 */

export function generateCommissionReference(date: Date = new Date()): string {
  const utcDate = date.toISOString().slice(0, 10).replaceAll("-", "");

  const randomSuffix = randomBytes(3).toString("hex").toUpperCase();

  return `COM-${utcDate}-${randomSuffix}`;
}

/*
 * ============================================================
 * CREATE COMMISSION
 * ============================================================
 *
 * A newly received commission must create three records:
 *
 * 1. The commission itself.
 * 2. Its initial status transition:
 *
 *      null -> received
 *
 * 3. Its initial timeline event:
 *
 *      commission_received
 *
 * Neon HTTP does not provide an interactive database session.
 * These independent statements are therefore sent together
 * through Drizzle's batch API.
 *
 * All identifiers and shared dates are generated before the
 * batch is executed, so no statement depends on the result of
 * another statement.
 */

export async function createCommission(
  input: CreateCommissionInput,
): Promise<CreatedCommission> {
  const commissionId = randomUUID();

  const reference = generateCommissionReference();

  const submittedAt = new Date();

  const [createdCommissionRows] = await db.batch([
    db
      .insert(commissions)
      .values({
        id: commissionId,

        reference,

        clientName: input.clientName,

        clientEmail: input.clientEmail,

        clientCompanyName: input.clientCompanyName ?? null,

        clientCountry: input.clientCountry ?? null,

        styleSnapshot: input.styleSnapshot ?? null,

        collectionSnapshot: input.collectionSnapshot ?? null,

        categorySnapshot: input.categorySnapshot ?? null,

        optionSnapshot: input.optionSnapshot ?? null,

        initialMessage: input.initialMessage,

        status: "received",

        termsVersion: input.termsVersion ?? null,

        agreementVersion: input.agreementVersion ?? null,

        submittedAt,

        createdAt: submittedAt,

        updatedAt: submittedAt,
      })
      .returning({
        id: commissions.id,

        reference: commissions.reference,

        status: commissions.status,

        submittedAt: commissions.submittedAt,
      }),

    db.insert(commissionStatusHistory).values({
      commissionId,

      fromStatus: null,

      toStatus: "received",

      initiatedBy: "client",

      reason: "initial_submission",

      createdAt: submittedAt,
    }),

    db.insert(commissionEvents).values({
      commissionId,

      type: "commission_received",

      actor: "client",

      title: "Commission request received",

      createdAt: submittedAt,
    }),
  ]);

  const createdCommission = createdCommissionRows[0];

  if (!createdCommission) {
    throw new Error("Commission creation returned no record");
  }

  return createdCommission;
}

/*
 * ============================================================
 * GET BY TECHNICAL ID
 * ============================================================
 */

export async function getCommissionById(
  id: string,
): Promise<Commission | null> {
  const rows = await db
    .select()
    .from(commissions)
    .where(eq(commissions.id, id))
    .limit(1);

  return rows[0] ?? null;
}

/*
 * ============================================================
 * GET BY PUBLIC REFERENCE
 * ============================================================
 */

export async function getCommissionByReference(
  reference: string,
): Promise<Commission | null> {
  const normalizedReference = reference.trim().toUpperCase();

  const rows = await db
    .select()
    .from(commissions)
    .where(eq(commissions.reference, normalizedReference))
    .limit(1);

  return rows[0] ?? null;
}
