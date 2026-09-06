import { deepEqual, equal } from "node:assert/strict";

import {
  COMMISSION_REQUEST_SOURCES,
  COMMISSION_SERVICE_CLASSIFICATIONS,
  MAX_COMMISSION_CLASSIFICATION_NOTE_LENGTH,
  isCommissionRequestSource,
  isCommissionServiceClassification,
  validateCommissionClassification,
} from "../lib/commissions/commissionClassification";
import {
  commissionRequestSourceEnum,
  commissionServiceClassificationEnum,
} from "../lib/db/schema/commissions";

function pass(message: string): void {
  console.log(`[OK] ${message}`);
}

deepEqual(COMMISSION_REQUEST_SOURCES, commissionRequestSourceEnum.enumValues);
deepEqual(
  COMMISSION_SERVICE_CLASSIFICATIONS,
  commissionServiceClassificationEnum.enumValues,
);
pass("Classification rules cover every database enum value");

for (const source of COMMISSION_REQUEST_SOURCES) {
  equal(isCommissionRequestSource(source), true);
}
equal(isCommissionRequestSource("social_media"), false);

for (const classification of COMMISSION_SERVICE_CLASSIFICATIONS) {
  equal(isCommissionServiceClassification(classification), true);
}
equal(isCommissionServiceClassification("manual"), false);
pass("Request sources and service classifications are validated");

deepEqual(
  validateCommissionClassification({
    classification: "catalog",
    note: "  Confirmed from the client brief.  ",
  }),
  {
    valid: true,
    note: "Confirmed from the client brief.",
  },
);
deepEqual(
  validateCommissionClassification({
    classification: "catalog",
    note: "   ",
  }),
  {
    valid: true,
    note: null,
  },
);
pass("Catalog classification notes are normalized");

deepEqual(
  validateCommissionClassification({
    classification: "custom",
    note: "   ",
  }),
  {
    valid: false,
    code: "custom_note_required",
    message: "A custom commission classification requires a note.",
  },
);
deepEqual(
  validateCommissionClassification({
    classification: "custom",
    note: "Custom request discussed through social media.",
  }),
  {
    valid: true,
    note: "Custom request discussed through social media.",
  },
);
pass("Custom classifications require an explanatory note");

const oversizedNote = "x".repeat(MAX_COMMISSION_CLASSIFICATION_NOTE_LENGTH + 1);
deepEqual(
  validateCommissionClassification({
    classification: "catalog",
    note: oversizedNote,
  }),
  {
    valid: false,
    code: "classification_note_too_long",
    message: `The classification note cannot exceed ${MAX_COMMISSION_CLASSIFICATION_NOTE_LENGTH} characters.`,
  },
);
pass("Classification note length is enforced");

console.log("[OK] Commission classification verification passed");
