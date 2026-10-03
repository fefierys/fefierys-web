import { equal, ok } from "node:assert/strict";

import {
  isCommissionManualActor,
  MAX_COMMISSION_ACTIVITY_TEXT_LENGTH,
  validateCommissionHoldAction,
  validateCommissionNote,
} from "../lib/commissions/commissionActivity";

function main(): void {
  equal(isCommissionManualActor("client"), true);
  equal(isCommissionManualActor("artist"), true);
  equal(isCommissionManualActor("system"), false);

  console.log("[OK] Manual commission actors are valid");

  const validPause = validateCommissionHoldAction({
    action: "pause",
    status: "in_progress",
    isOnHold: false,
    description: "  Waiting for client feedback.  ",
  });

  ok(validPause.valid);
  equal(validPause.description, "Waiting for client feedback.");

  const pauseWithoutReason = validateCommissionHoldAction({
    action: "pause",
    status: "in_progress",
    isOnHold: false,
    description: "   ",
  });

  equal(pauseWithoutReason.valid, false);

  if (!pauseWithoutReason.valid) {
    equal(pauseWithoutReason.code, "description_required");
  }

  console.log("[OK] Pausing requires a normalized reason");

  const alreadyPaused = validateCommissionHoldAction({
    action: "pause",
    status: "sketch_review",
    isOnHold: true,
    description: "Another reason",
  });

  equal(alreadyPaused.valid, false);

  if (!alreadyPaused.valid) {
    equal(alreadyPaused.code, "already_on_hold");
  }

  const validResume = validateCommissionHoldAction({
    action: "resume",
    status: "sketch_review",
    isOnHold: true,
    description: "  Client replied.  ",
  });

  ok(validResume.valid);
  equal(validResume.description, "Client replied.");

  const resumeWithoutPause = validateCommissionHoldAction({
    action: "resume",
    status: "sketch_review",
    isOnHold: false,
  });

  equal(resumeWithoutPause.valid, false);

  if (!resumeWithoutPause.valid) {
    equal(resumeWithoutPause.code, "not_on_hold");
  }

  console.log("[OK] Hold state conflicts are rejected");

  const closedCommission = validateCommissionHoldAction({
    action: "pause",
    status: "completed",
    isOnHold: false,
    description: "Invalid terminal pause",
  });

  equal(closedCommission.valid, false);

  if (!closedCommission.valid) {
    equal(closedCommission.code, "commission_closed");
  }

  console.log("[OK] Closed commissions cannot change hold state");

  const validNote = validateCommissionNote("  Internal follow-up note.  ");

  ok(validNote.valid);
  equal(validNote.description, "Internal follow-up note.");

  const emptyNote = validateCommissionNote("   ");

  equal(emptyNote.valid, false);

  if (!emptyNote.valid) {
    equal(emptyNote.code, "description_required");
  }

  const longNote = validateCommissionNote(
    "x".repeat(MAX_COMMISSION_ACTIVITY_TEXT_LENGTH + 1),
  );

  equal(longNote.valid, false);

  if (!longNote.valid) {
    equal(longNote.code, "description_too_long");
  }

  console.log("[OK] Commission note validation is valid");
  console.log("[OK] Commission activity verification passed");
}

main();
