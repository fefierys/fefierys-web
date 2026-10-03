import { deepEqual, equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

function createReference(): string {
  return `COM-20990102-${randomUUID()
    .replaceAll("-", "")
    .slice(0, 6)
    .toUpperCase()}`;
}

async function main() {
  const { eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { commissions, commissionEvents } =
    await import("../lib/db/schema/commissions");
  const { addCommissionNote, changeCommissionHold } =
    await import("../lib/repositories/commissionActivityRepository");

  const activeCommissionId = randomUUID();
  const concurrentCommissionId = randomUUID();
  const closedCommissionId = randomUUID();

  const createdIds = [
    activeCommissionId,
    concurrentCommissionId,
    closedCommissionId,
  ];

  const verificationId = randomUUID();
  const initialDate = new Date("2099-01-02T12:00:00.000Z");

  try {
    await db.insert(commissions).values([
      {
        id: activeCommissionId,
        submissionId: randomUUID(),
        reference: createReference(),
        clientName: "Activity Verification",
        clientEmail: `activity-${verificationId}@example.com`,
        initialMessage: "Temporary commission activity verification",
        status: "in_progress",
        submittedAt: initialDate,
        createdAt: initialDate,
        updatedAt: initialDate,
      },
      {
        id: concurrentCommissionId,
        submissionId: randomUUID(),
        reference: createReference(),
        clientName: "Concurrent Activity Verification",
        clientEmail: `activity-concurrent-${verificationId}@example.com`,
        initialMessage: "Temporary concurrent hold verification",
        status: "under_review",
        submittedAt: initialDate,
        createdAt: initialDate,
        updatedAt: initialDate,
      },
      {
        id: closedCommissionId,
        submissionId: randomUUID(),
        reference: createReference(),
        clientName: "Closed Activity Verification",
        clientEmail: `activity-closed-${verificationId}@example.com`,
        initialMessage: "Temporary closed activity verification",
        status: "completed",
        submittedAt: initialDate,
        createdAt: initialDate,
        updatedAt: initialDate,
      },
    ]);

    console.log("[OK] Temporary activity commissions were created");

    const pauseResult = await changeCommissionHold({
      commissionId: activeCommissionId,
      expectedStatus: "in_progress",
      action: "pause",
      actor: "client",
      description: "  Waiting for client feedback.  ",
      createdByAdminUserId: "activity-verification-admin",
    });

    equal(pauseResult.outcome, "updated");

    if (pauseResult.outcome !== "updated") {
      throw new Error("Pause operation did not return its event.");
    }

    equal(pauseResult.event.type, "commission_paused");
    equal(pauseResult.event.actor, "client");
    equal(pauseResult.event.description, "Waiting for client feedback.");

    const pausedRows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, activeCommissionId));

    const pausedCommission = pausedRows[0];

    ok(pausedCommission);
    equal(pausedCommission.isOnHold, true);
    equal(pausedCommission.holdReason, "Waiting for client feedback.");
    ok(pausedCommission.holdStartedAt instanceof Date);

    console.log("[OK] Pause updated the commission and created its event");

    const duplicatePauseResult = await changeCommissionHold({
      commissionId: activeCommissionId,
      expectedStatus: "in_progress",
      action: "pause",
      actor: "artist",
      description: "Duplicate pause",
      createdByAdminUserId: "activity-verification-admin",
    });

    equal(duplicatePauseResult.outcome, "conflict");

    console.log("[OK] Duplicate pause returned a conflict");

    const resumeResult = await changeCommissionHold({
      commissionId: activeCommissionId,
      expectedStatus: "in_progress",
      action: "resume",
      actor: "artist",
      description: "  Client replied.  ",
      createdByAdminUserId: "activity-verification-admin",
    });

    equal(resumeResult.outcome, "updated");

    if (resumeResult.outcome !== "updated") {
      throw new Error("Resume operation did not return its event.");
    }

    equal(resumeResult.event.type, "commission_resumed");
    equal(resumeResult.event.actor, "artist");
    equal(resumeResult.event.description, "Client replied.");

    const resumedRows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, activeCommissionId));

    const resumedCommission = resumedRows[0];

    ok(resumedCommission);
    equal(resumedCommission.isOnHold, false);
    equal(resumedCommission.holdReason, null);
    equal(resumedCommission.holdStartedAt, null);

    console.log("[OK] Resume cleared hold data and created its event");

    const concurrentResults = await Promise.all([
      changeCommissionHold({
        commissionId: concurrentCommissionId,
        expectedStatus: "under_review",
        action: "pause",
        actor: "artist",
        description: "Concurrent pause",
        createdByAdminUserId: "activity-verification-admin",
      }),
      changeCommissionHold({
        commissionId: concurrentCommissionId,
        expectedStatus: "under_review",
        action: "pause",
        actor: "artist",
        description: "Concurrent pause",
        createdByAdminUserId: "activity-verification-admin",
      }),
    ]);

    deepEqual(concurrentResults.map((result) => result.outcome).sort(), [
      "conflict",
      "updated",
    ]);

    console.log("[OK] Concurrent pause produced one update and one conflict");

    const terminalHoldResult = await changeCommissionHold({
      commissionId: closedCommissionId,
      expectedStatus: "completed",
      action: "pause",
      actor: "artist",
      description: "Invalid closed pause",
      createdByAdminUserId: "activity-verification-admin",
    });

    equal(terminalHoldResult.outcome, "invalid");

    console.log("[OK] Closed commission rejected hold changes");

    const noteResult = await addCommissionNote({
      commissionId: closedCommissionId,
      actor: "artist",
      description: "  Final archive note.  ",
      createdByAdminUserId: "activity-verification-admin",
    });

    equal(noteResult.outcome, "added");

    if (noteResult.outcome !== "added") {
      throw new Error("Note operation did not return its event.");
    }

    equal(noteResult.event.type, "note_added");
    equal(noteResult.event.actor, "artist");
    equal(noteResult.event.description, "Final archive note.");

    console.log("[OK] Note was added to a closed commission");

    const eventRows = await db
      .select()
      .from(commissionEvents)
      .where(inArray(commissionEvents.commissionId, createdIds));

    equal(eventRows.length, 4);
    equal(
      eventRows.filter((event) => event.type === "commission_paused").length,
      2,
    );
    equal(
      eventRows.filter((event) => event.type === "commission_resumed").length,
      1,
    );
    equal(eventRows.filter((event) => event.type === "note_added").length, 1);

    console.log("[OK] Activity events contain no concurrent duplicates");

    const missingHoldResult = await changeCommissionHold({
      commissionId: randomUUID(),
      expectedStatus: "under_review",
      action: "pause",
      actor: "artist",
      description: "Missing commission",
      createdByAdminUserId: "activity-verification-admin",
    });

    equal(missingHoldResult.outcome, "not_found");

    const missingNoteResult = await addCommissionNote({
      commissionId: randomUUID(),
      actor: "artist",
      description: "Missing commission note",
      createdByAdminUserId: "activity-verification-admin",
    });

    equal(missingNoteResult.outcome, "not_found");

    console.log("[OK] Missing commission activity returns not_found");
    console.log("[OK] Commission activity repository verification passed");
  } finally {
    await db
      .delete(commissionEvents)
      .where(inArray(commissionEvents.commissionId, createdIds));

    await db.delete(commissions).where(inArray(commissions.id, createdIds));

    const remainingRows = await db
      .select({
        id: commissions.id,
      })
      .from(commissions)
      .where(inArray(commissions.id, createdIds));

    equal(remainingRows.length, 0);
    console.log("[OK] Temporary activity data was removed");
  }
}

main().catch((error: unknown) => {
  console.error("Commission activity repository verification failed:", error);
  process.exitCode = 1;
});
