import { equal, match, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

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
    getCommissionBySubmissionId,
  } = await import("../lib/repositories/commissionRepository");

  const fixedDate = new Date("2026-08-31T23:59:59.000Z");
  const generatedReference = generateCommissionReference(fixedDate);

  match(generatedReference, /^COM-20260831-[0-9A-F]{6}$/);
  console.log("[OK] Commission reference format is valid");

  const verificationId = randomUUID();
  const submissionId = randomUUID();
  const clientEmail = `commission-repository-${verificationId}@example.com`;

  const input = {
    submissionId,
    clientName: "Commission Repository Verification",
    clientEmail,
    clientCompanyName: null,
    clientCountry: "Test",
    styleSnapshot: "Verification Style",
    collectionSnapshot: "Verification Collection",
    categorySnapshot: "Verification Category",
    optionSnapshot: "Verification Option",
    initialMessage: `Temporary repository verification ${verificationId}`,
    termsVersion: "2026.1",
    agreementVersion: null,
  };

  let createdCommissionId: string | null = null;

  try {
    const createdCommission = await createCommission(input);
    createdCommissionId = createdCommission.id;

    equal(createdCommission.wasCreated, true);
    match(createdCommission.reference, /^COM-\d{8}-[0-9A-F]{6}$/);
    equal(createdCommission.status, "received");
    ok(createdCommission.submittedAt instanceof Date);

    console.log("[OK] Temporary commission was created");

    const retriedCommission = await createCommission(input);

    equal(retriedCommission.wasCreated, false);
    equal(retriedCommission.id, createdCommission.id);
    equal(retriedCommission.reference, createdCommission.reference);
    equal(
      retriedCommission.submittedAt.getTime(),
      createdCommission.submittedAt.getTime(),
    );

    console.log("[OK] Duplicate submission returned the existing commission");

    const commissionById = await getCommissionById(createdCommission.id);

    ok(commissionById, "Commission was not found by ID");
    equal(commissionById.reference, createdCommission.reference);
    equal(commissionById.clientEmail, clientEmail);
    equal(commissionById.status, "received");

    console.log("[OK] Commission lookup by ID is valid");

    const commissionByReference = await getCommissionByReference(
      `  ${createdCommission.reference.toLowerCase()}  `,
    );

    ok(commissionByReference, "Commission was not found by reference");
    equal(commissionByReference.id, createdCommission.id);

    console.log("[OK] Commission lookup by normalized reference is valid");

    const commissionBySubmissionId =
      await getCommissionBySubmissionId(submissionId);

    ok(commissionBySubmissionId, "Commission was not found by submission ID");
    equal(commissionBySubmissionId.id, createdCommission.id);

    console.log("[OK] Commission lookup by submission ID is valid");

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

    console.log("[OK] Initial status history was not duplicated");

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

    console.log("[OK] Initial commission event was not duplicated");
    console.log("[OK] Commission repository idempotency verification passed");
  } finally {
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
      console.log("[OK] Temporary verification data was removed");
    }
  }
}

main().catch((error: unknown) => {
  console.error("Commission repository verification failed:", error);
  process.exitCode = 1;
});
