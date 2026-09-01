import { deepEqual, equal, ok } from "node:assert/strict";

import {
  commissionStatusEnum,
  commissionCloseReasonEnum,
} from "../lib/db/schema/commissions";
import { COMMISSION_STATUSES } from "../lib/commissions/commissionStatus";
import {
  COMMISSION_STATUS_TRANSITIONS,
  getAllowedCommissionTransitions,
  isTerminalCommissionStatus,
  TERMINAL_COMMISSION_STATUSES,
  validateCommissionTransition,
  type CommissionTransitionErrorCode,
  type CommissionTransitionInput,
} from "../lib/commissions/commissionWorkflow";
import type { CommissionStatus } from "../lib/repositories/commissionAdminRepository";

function expectInvalid(
  input: CommissionTransitionInput,
  expectedCode: CommissionTransitionErrorCode,
): void {
  const result = validateCommissionTransition(input);

  equal(result.valid, false);

  if (!result.valid) {
    equal(result.code, expectedCode);
  }
}

function createValidInput(
  fromStatus: CommissionStatus,
  toStatus: CommissionStatus,
): CommissionTransitionInput {
  if (toStatus === "cancelled") {
    return {
      fromStatus,
      toStatus,
      initiatedBy: "artist",
      closeReason: "artist_cancelled",
    };
  }

  if (toStatus === "declined") {
    return {
      fromStatus,
      toStatus,
      initiatedBy: "artist",
      closeReason: "artist_declined_request",
    };
  }

  if (toStatus === "expired") {
    switch (fromStatus) {
      case "awaiting_client_details":
        return {
          fromStatus,
          toStatus,
          initiatedBy: "system",
          closeReason: "client_details_timeout",
        };

      case "awaiting_quote_response":
        return {
          fromStatus,
          toStatus,
          initiatedBy: "system",
          closeReason: "quote_expired",
        };

      case "awaiting_payment":
        return {
          fromStatus,
          toStatus,
          initiatedBy: "system",
          closeReason: "payment_timeout",
        };

      default:
        throw new Error(
          `No valid expiration fixture exists for ${fromStatus}.`,
        );
    }
  }

  return {
    fromStatus,
    toStatus,
    initiatedBy: "artist",
  };
}

function main(): void {
  deepEqual([...COMMISSION_STATUSES], [...commissionStatusEnum.enumValues]);

  deepEqual(
    Object.keys(COMMISSION_STATUS_TRANSITIONS).sort(),
    [...COMMISSION_STATUSES].sort(),
  );

  console.log("[OK] Workflow rules cover every database status");

  for (const fromStatus of COMMISSION_STATUSES) {
    const allowedTransitions = getAllowedCommissionTransitions(fromStatus);

    for (const toStatus of COMMISSION_STATUSES) {
      if (fromStatus === toStatus) {
        expectInvalid(
          {
            fromStatus,
            toStatus,
            initiatedBy: "artist",
          },
          "same_status",
        );

        continue;
      }

      if (allowedTransitions.includes(toStatus)) {
        const result = validateCommissionTransition(
          createValidInput(fromStatus, toStatus),
        );

        equal(
          result.valid,
          true,
          `${fromStatus} -> ${toStatus} should be valid`,
        );
      } else {
        expectInvalid(
          {
            fromStatus,
            toStatus,
            initiatedBy: "artist",
          },
          "transition_not_allowed",
        );
      }
    }
  }

  console.log("[OK] Allowed and forbidden transitions are valid");

  for (const status of TERMINAL_COMMISSION_STATUSES) {
    equal(isTerminalCommissionStatus(status), true);
    equal(getAllowedCommissionTransitions(status).length, 0);
  }

  console.log("[OK] Terminal statuses cannot transition");

  expectInvalid(
    {
      fromStatus: "received",
      toStatus: "under_review",
      initiatedBy: "artist",
      closeReason: "other",
      closeReasonNote: "Not applicable to an active status",
    },
    "close_reason_forbidden",
  );

  expectInvalid(
    {
      fromStatus: "final_review",
      toStatus: "completed",
      initiatedBy: "artist",
      closeReason: "other",
      closeReasonNote: "Completed does not use a close reason",
    },
    "close_reason_forbidden",
  );

  expectInvalid(
    {
      fromStatus: "received",
      toStatus: "cancelled",
      initiatedBy: "artist",
    },
    "close_reason_required",
  );

  expectInvalid(
    {
      fromStatus: "received",
      toStatus: "cancelled",
      initiatedBy: "artist",
      closeReason: "other",
    },
    "close_reason_note_required",
  );

  expectInvalid(
    {
      fromStatus: "received",
      toStatus: "cancelled",
      initiatedBy: "artist",
      closeReason: "client_cancelled",
    },
    "actor_not_allowed",
  );

  expectInvalid(
    {
      fromStatus: "awaiting_client_details",
      toStatus: "expired",
      initiatedBy: "system",
      closeReason: "quote_expired",
    },
    "close_reason_not_allowed",
  );

  expectInvalid(
    {
      fromStatus: "awaiting_payment",
      toStatus: "expired",
      initiatedBy: "system",
      closeReason: "client_details_timeout",
    },
    "close_reason_not_allowed",
  );

  expectInvalid(
    {
      fromStatus: "under_review",
      toStatus: "declined",
      initiatedBy: "client",
      closeReason: "client_declined_quote",
    },
    "close_reason_not_allowed",
  );

  const otherReasons = commissionCloseReasonEnum.enumValues.filter(
    (reason) => reason === "other",
  );

  equal(otherReasons.length, 1);

  const validOtherResult = validateCommissionTransition({
    fromStatus: "awaiting_payment",
    toStatus: "expired",
    initiatedBy: "artist",
    closeReason: "other",
    closeReasonNote: "A documented exceptional expiration.",
  });

  ok(validOtherResult.valid);

  console.log("[OK] Close reasons, notes, and actors are valid");
  console.log("[OK] Commission workflow verification passed");
}

main();
