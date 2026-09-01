import { equal, match, ok } from "node:assert/strict";

import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

/*
 * ============================================================
 * COMMISSION REPOSITORY VERIFICATION
 * ============================================================
 *
 * This script:
 *
 * 1. Validates the public reference format.
 * 2. Creates one temporary commission.
 * 3. Verifies lookup by UUID.
 * 4. Verifies lookup by normalized public reference.
 * 5. Verifies the initial status history.
 * 6. Verifies the initial timeline event.
 * 7. Removes only the records created by this execution.
 */

async function main() {
  const { eq } = await import("drizzle-orm");

  const { db } = await import("../lib/db");

  const { commissionEvents, commissions, commissionStatusHistory } =
    await import("../lib/db/schema/commissions");

  const {
    createCommission,
    generateCommissionReference,
    getCommissionById,
    getCommissionByReference,
  } = await import("../lib/repositories/commissionRepository");

  /*
   * ==========================================================
   * REFERENCE FORMAT
   * ==========================================================
   */

  const fixedDate = new Date("2026-08-31T23:59:59.000Z");

  const generatedReference = generateCommissionReference(fixedDate);

  match(generatedReference, /^COM-20260831-[0-9A-F]{6}$/);

  console.log("✓ Commission reference format is valid");

  /*
   * A unique marker lets us prove that the returned commission
   * is exactly the temporary record created by this execution.
   */

  const verificationId = randomUUID();

  const clientEmail = `commission-repository-${verificationId}@example.com`;

  let createdCommissionId: string | null = null;

  try {
    /*
     * ========================================================
     * CREATE
     * ========================================================
     */

    const createdCommission = await createCommission({
      clientName: "Commission Repository Verification",

      clientEmail,

      clientCompanyName: null,

      clientCountry: "Test",

      styleSnapshot: "Verification Style",

      collectionSnapshot: "Verification Collection",

      categorySnapshot: "Verification Category",

      optionSnapshot: "Verification Option",

      initialMessage: `Temporary repository verification ${verificationId}`,

      termsVersion: null,

      agreementVersion: null,
    });

    createdCommissionId = createdCommission.id;

    match(createdCommission.reference, /^COM-\d{8}-[0-9A-F]{6}$/);

    equal(createdCommission.status, "received");

    ok(createdCommission.submittedAt instanceof Date);

    console.log("✓ Temporary commission was created");

    /*
     * ========================================================
     * GET BY UUID
     * ========================================================
     */

    const commissionById = await getCommissionById(createdCommission.id);

    ok(commissionById, "Commission was not found by ID");

    equal(commissionById.reference, createdCommission.reference);

    equal(commissionById.clientEmail, clientEmail);

    equal(commissionById.status, "received");

    console.log("✓ Commission lookup by ID is valid");

    /*
     * ========================================================
     * GET BY PUBLIC REFERENCE
     * ========================================================
     */

    const commissionByReference = await getCommissionByReference(
      `  ${createdCommission.reference.toLowerCase()}  `,
    );

    ok(commissionByReference, "Commission was not found by reference");

    equal(commissionByReference.id, createdCommission.id);

    console.log("✓ Commission lookup by normalized reference is valid");

    /*
     * ========================================================
     * INITIAL STATUS HISTORY
     * ========================================================
     */

    const statusHistoryRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(eq(commissionStatusHistory.commissionId, createdCommission.id));

    equal(statusHistoryRows.length, 1);

    const initialStatus = statusHistoryRows[0];

    ok(initialStatus, "Initial status history was not created");

    equal(initialStatus.fromStatus, null);

    equal(initialStatus.toStatus, "received");

    equal(initialStatus.initiatedBy, "client");

    equal(initialStatus.reason, "initial_submission");

    console.log("✓ Initial status history is valid");

    /*
     * ========================================================
     * INITIAL EVENT
     * ========================================================
     */

    const eventRows = await db
      .select()
      .from(commissionEvents)
      .where(eq(commissionEvents.commissionId, createdCommission.id));

    equal(eventRows.length, 1);

    const initialEvent = eventRows[0];

    ok(initialEvent, "Initial commission event was not created");

    equal(initialEvent.type, "commission_received");

    equal(initialEvent.actor, "client");

    equal(initialEvent.title, "Commission request received");

    console.log("✓ Initial commission event is valid");

    console.log("✓ Commission repository verification passed");
  } finally {
    /*
     * ========================================================
     * SAFE CLEANUP
     * ========================================================
     *
     * Only records linked to the UUID created by this execution
     * are removed.
     *
     * Children must be deleted before the commission because
     * the foreign keys intentionally use ON DELETE RESTRICT.
     */

    if (createdCommissionId) {
      await db.batch([
        db
          .delete(commissionEvents)
          .where(eq(commissionEvents.commissionId, createdCommissionId)),

        db
          .delete(commissionStatusHistory)
          .where(eq(commissionStatusHistory.commissionId, createdCommissionId)),

        db.delete(commissions).where(eq(commissions.id, createdCommissionId)),
      ]);

      const remainingRows = await db
        .select({
          id: commissions.id,
        })
        .from(commissions)
        .where(eq(commissions.id, createdCommissionId));

      equal(remainingRows.length, 0);

      console.log("✓ Temporary verification data was removed");
    }
  }
}

main().catch((error: unknown) => {
  console.error("Commission repository verification failed:", error);

  process.exitCode = 1;
});
