import { equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main() {
  const { asc, eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { commissionEvents, commissions, commissionStatusHistory } =
    await import("../lib/db/schema/commissions");
  const { createCommission } =
    await import("../lib/repositories/commissionRepository");
  const { transitionCommissionStatus } =
    await import("../lib/repositories/commissionWorkflowRepository");

  const verificationId = randomUUID();
  const createdIds: string[] = [];

  try {
    const workflowCommission = await createCommission({
      submissionId: randomUUID(),
      clientName: "Commission Workflow Verification",
      clientEmail: `commission-workflow-${verificationId}@example.com`,
      clientCountry: "Test",
      styleSnapshot: "Verification Style",
      collectionSnapshot: "Verification Collection",
      categorySnapshot: "Verification Category",
      optionSnapshot: "Verification Option",
      initialMessage: `Temporary workflow verification ${verificationId}`,
      termsVersion: "2026.1",
    });

    createdIds.push(workflowCommission.id);

    const invalidResult = await transitionCommissionStatus({
      commissionId: workflowCommission.id,
      fromStatus: "received",
      toStatus: "completed",
      initiatedBy: "artist",
      changedByAdminUserId: "workflow-verifier",
    });

    equal(invalidResult.outcome, "invalid");

    if (invalidResult.outcome === "invalid") {
      equal(invalidResult.validation.code, "transition_not_allowed");
    }

    const rowsAfterInvalid = await db
      .select({
        status: commissions.status,
      })
      .from(commissions)
      .where(eq(commissions.id, workflowCommission.id));

    equal(rowsAfterInvalid[0]?.status, "received");

    console.log("[OK] Invalid transition did not modify the commission");

    const reviewResult = await transitionCommissionStatus({
      commissionId: workflowCommission.id,
      fromStatus: "received",
      toStatus: "under_review",
      initiatedBy: "artist",
      changedByAdminUserId: "workflow-verifier",
      reason: "initial_review_started",
    });

    equal(reviewResult.outcome, "updated");

    console.log("[OK] Valid transition updated commission and history");

    const concurrentResults = await Promise.all([
      transitionCommissionStatus({
        commissionId: workflowCommission.id,
        fromStatus: "under_review",
        toStatus: "quoting",
        initiatedBy: "artist",
        changedByAdminUserId: "workflow-verifier-a",
      }),
      transitionCommissionStatus({
        commissionId: workflowCommission.id,
        fromStatus: "under_review",
        toStatus: "quoting",
        initiatedBy: "artist",
        changedByAdminUserId: "workflow-verifier-b",
      }),
    ]);

    equal(
      concurrentResults.filter((result) => result.outcome === "updated").length,
      1,
    );

    equal(
      concurrentResults.filter((result) => result.outcome === "conflict")
        .length,
      1,
    );

    console.log(
      "[OK] Concurrent transition produced one update and one conflict",
    );

    const route = [
      ["quoting", "awaiting_quote_response"],
      ["awaiting_quote_response", "awaiting_payment"],
      ["awaiting_payment", "in_progress"],
      ["in_progress", "final_preview"],
      ["final_preview", "awaiting_payment"],
      ["awaiting_payment", "final_review"],
      ["final_review", "completed"],
    ] as const;

    for (const [fromStatus, toStatus] of route) {
      const result = await transitionCommissionStatus({
        commissionId: workflowCommission.id,
        fromStatus,
        toStatus,
        initiatedBy: "artist",
        changedByAdminUserId: "workflow-verifier",
      });

      equal(
        result.outcome,
        "updated",
        `${fromStatus} -> ${toStatus} should update`,
      );
    }

    const completedRows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, workflowCommission.id));

    const completedCommission = completedRows[0];

    ok(completedCommission);
    equal(completedCommission.status, "completed");
    ok(completedCommission.startedAt instanceof Date);
    ok(completedCommission.completedAt instanceof Date);
    ok(completedCommission.closedAt instanceof Date);
    equal(completedCommission.closedBy, "artist");
    equal(completedCommission.closeReason, null);
    equal(completedCommission.closeReasonNote, null);
    equal(completedCommission.isOnHold, false);
    equal(completedCommission.holdReason, null);
    equal(completedCommission.holdStartedAt, null);

    console.log("[OK] Workflow dates and completed closure are valid");

    const historyRows = await db
      .select()
      .from(commissionStatusHistory)
      .where(eq(commissionStatusHistory.commissionId, workflowCommission.id))
      .orderBy(
        asc(commissionStatusHistory.createdAt),
        asc(commissionStatusHistory.id),
      );

    equal(historyRows.length, 10);
    equal(historyRows[0]?.fromStatus, null);
    equal(historyRows[0]?.toStatus, "received");
    equal(historyRows.at(-1)?.fromStatus, "final_review");
    equal(historyRows.at(-1)?.toStatus, "completed");

    const quotingTransitions = historyRows.filter(
      (entry) =>
        entry.fromStatus === "under_review" && entry.toStatus === "quoting",
    );

    equal(quotingTransitions.length, 1);

    console.log(
      "[OK] Status history is complete and has no concurrent duplicate",
    );

    const terminalRetry = await transitionCommissionStatus({
      commissionId: workflowCommission.id,
      fromStatus: "completed",
      toStatus: "cancelled",
      initiatedBy: "artist",
      changedByAdminUserId: "workflow-verifier",
      closeReason: "artist_cancelled",
    });

    equal(terminalRetry.outcome, "invalid");

    console.log("[OK] Completed commission cannot be reopened or cancelled");

    const missingResult = await transitionCommissionStatus({
      commissionId: randomUUID(),
      fromStatus: "received",
      toStatus: "under_review",
      initiatedBy: "artist",
      changedByAdminUserId: "workflow-verifier",
    });

    equal(missingResult.outcome, "not_found");

    console.log("[OK] Missing commission returns not_found");

    const cancellationCommission = await createCommission({
      submissionId: randomUUID(),
      clientName: "Commission Cancellation Verification",
      clientEmail: `commission-cancellation-${verificationId}@example.com`,
      initialMessage: `Temporary cancellation verification ${verificationId}`,
      termsVersion: "2026.1",
    });

    createdIds.push(cancellationCommission.id);

    const cancellationResult = await transitionCommissionStatus({
      commissionId: cancellationCommission.id,
      fromStatus: "received",
      toStatus: "cancelled",
      initiatedBy: "client",
      changedByAdminUserId: "workflow-verifier",
      closeReason: "client_cancelled",
      closeReasonNote: "Client withdrew the temporary request.",
    });

    equal(cancellationResult.outcome, "updated");

    const cancelledRows = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, cancellationCommission.id));

    const cancelledCommission = cancelledRows[0];

    ok(cancelledCommission);
    equal(cancelledCommission.status, "cancelled");
    equal(cancelledCommission.closeReason, "client_cancelled");
    equal(cancelledCommission.closedBy, "client");
    ok(cancelledCommission.closedAt instanceof Date);
    equal(
      cancelledCommission.closeReasonNote,
      "Client withdrew the temporary request.",
    );

    console.log("[OK] Cancellation closure metadata is valid");

    const heldCommission = await createCommission({
      submissionId: randomUUID(),
      clientName: "Held Commission Workflow Verification",
      clientEmail: `commission-held-${verificationId}@example.com`,
      initialMessage: `Temporary held workflow verification ${verificationId}`,
      termsVersion: "2026.1",
    });

    createdIds.push(heldCommission.id);

    const holdStartedAt = new Date();

    await db
      .update(commissions)
      .set({
        isOnHold: true,
        holdReason: "Client is temporarily unavailable.",
        holdStartedAt,
      })
      .where(eq(commissions.id, heldCommission.id));

    const blockedHeldTransition = await transitionCommissionStatus({
      commissionId: heldCommission.id,
      fromStatus: "received",
      toStatus: "under_review",
      initiatedBy: "artist",
      changedByAdminUserId: "workflow-verifier",
    });

    equal(blockedHeldTransition.outcome, "on_hold");

    const heldRowsAfterBlockedTransition = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, heldCommission.id));

    const commissionAfterBlockedTransition = heldRowsAfterBlockedTransition[0];

    ok(commissionAfterBlockedTransition);
    equal(commissionAfterBlockedTransition.status, "received");
    equal(commissionAfterBlockedTransition.isOnHold, true);
    equal(
      commissionAfterBlockedTransition.holdReason,
      "Client is temporarily unavailable.",
    );
    ok(commissionAfterBlockedTransition.holdStartedAt instanceof Date);

    const historyAfterBlockedTransition = await db
      .select()
      .from(commissionStatusHistory)
      .where(eq(commissionStatusHistory.commissionId, heldCommission.id));

    equal(historyAfterBlockedTransition.length, 1);

    console.log("[OK] Held commission rejected an operational transition");

    const heldTerminalTransition = await transitionCommissionStatus({
      commissionId: heldCommission.id,
      fromStatus: "received",
      toStatus: "cancelled",
      initiatedBy: "client",
      changedByAdminUserId: "workflow-verifier",
      closeReason: "client_cancelled",
      closeReasonNote: "Client cancelled while the commission was on hold.",
    });

    equal(heldTerminalTransition.outcome, "updated");

    const heldRowsAfterClosure = await db
      .select()
      .from(commissions)
      .where(eq(commissions.id, heldCommission.id));

    const closedHeldCommission = heldRowsAfterClosure[0];

    ok(closedHeldCommission);
    equal(closedHeldCommission.status, "cancelled");
    equal(closedHeldCommission.isOnHold, false);
    equal(closedHeldCommission.holdReason, null);
    equal(closedHeldCommission.holdStartedAt, null);
    equal(closedHeldCommission.closeReason, "client_cancelled");
    equal(closedHeldCommission.closedBy, "client");

    const heldCommissionHistory = await db
      .select()
      .from(commissionStatusHistory)
      .where(eq(commissionStatusHistory.commissionId, heldCommission.id));

    equal(heldCommissionHistory.length, 2);

    console.log(
      "[OK] Terminal transition closed and resumed the held commission",
    );

    console.log("[OK] Commission workflow repository verification passed");
  } finally {
    if (createdIds.length > 0) {
      await db.batch([
        db
          .delete(commissionEvents)
          .where(inArray(commissionEvents.commissionId, createdIds)),
        db
          .delete(commissionStatusHistory)
          .where(inArray(commissionStatusHistory.commissionId, createdIds)),
        db.delete(commissions).where(inArray(commissions.id, createdIds)),
      ]);

      const remainingRows = await db
        .select({
          id: commissions.id,
        })
        .from(commissions)
        .where(inArray(commissions.id, createdIds));

      equal(remainingRows.length, 0);
      console.log("[OK] Temporary workflow data was removed");
    }
  }
}

main().catch((error: unknown) => {
  console.error("Commission workflow repository verification failed:", error);
  process.exitCode = 1;
});
