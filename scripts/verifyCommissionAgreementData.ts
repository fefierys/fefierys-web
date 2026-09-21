import { equal, ok } from "node:assert/strict";

import {
  createEmptyCommissionAgreementDraftData,
  validateCommissionAgreementDraftData,
  validateCommissionAgreementReadyToPresent,
} from "../lib/commissions/commissionAgreementData";

function expectInvalidField(
  result:
    | ReturnType<typeof validateCommissionAgreementDraftData>
    | ReturnType<typeof validateCommissionAgreementReadyToPresent>,
  field: string,
): void {
  equal(result.valid, false);

  if (!result.valid) {
    equal(result.field, field);
  }
}

/*
 * An empty draft may be saved, but it must not be
 * presented to the Client.
 */
const emptyDraft = createEmptyCommissionAgreementDraftData();

equal(emptyDraft.schemaVersion, 1);
equal(emptyDraft.license.selectedOption, null);

equal(
  validateCommissionAgreementDraftData(emptyDraft).valid,
  true,
);

expectInvalidField(
  validateCommissionAgreementReadyToPresent(emptyDraft),
  "project.name",
);

console.log("[OK] Empty draft is valid for saving but not for presentation");

/*
 * Reject malformed data before storing it.
 */
expectInvalidField(
  validateCommissionAgreementDraftData({
    ...emptyDraft,
    schemaVersion: 2,
  }),
  "schemaVersion",
);

expectInvalidField(
  validateCommissionAgreementDraftData({
    ...emptyDraft,
    delivery: {
      ...emptyDraft.delivery,
      fileFormats: ["PNG", 123],
    },
  }),
  "delivery.fileFormats",
);

expectInvalidField(
  validateCommissionAgreementDraftData({
    ...emptyDraft,
    license: {
      ...emptyDraft.license,
      selectedOption: "unknown",
    },
  }),
  "license.selectedOption",
);

console.log("[OK] Invalid draft structure was rejected");

/*
 * A complete personal-use Agreement does not require
 * a commercial license scope.
 */
const completePersonalUseDraft = {
  ...emptyDraft,
  project: {
    name: "Verification illustration",
    description: "A custom illustration for verification.",
    illustrationType: "Character illustration",
  },
  delivery: {
    size: "3000 × 4000 px",
    colorMode: "RGB",
    fileFormats: ["PNG", "PDF"],
  },
  license: {
    selectedOption: "personal_use" as const,
    commercialScope: "",
  },
  projectConditions: {
    confidentialityRequirement: "N/A",
    holdDate: null,
    additionalTerms: "",
  },
};

equal(
  validateCommissionAgreementReadyToPresent(
    completePersonalUseDraft,
  ).valid,
  true,
);

console.log("[OK] Complete personal-use Agreement passed validation");

/*
 * Commercial use requires an explicit scope.
 */
const commercialDraftWithoutScope = {
  ...completePersonalUseDraft,
  license: {
    selectedOption: "commercial_use" as const,
    commercialScope: "",
  },
};

expectInvalidField(
  validateCommissionAgreementReadyToPresent(
    commercialDraftWithoutScope,
  ),
  "license.commercialScope",
);

const completeCommercialDraft = {
  ...commercialDraftWithoutScope,
  license: {
    ...commercialDraftWithoutScope.license,
    commercialScope: "Book publication and related promotion.",
  },
};

ok(
  validateCommissionAgreementReadyToPresent(
    completeCommercialDraft,
  ).valid,
);

console.log("[OK] Commercial-use Agreement requires a license scope");

/*
 * Delivery formats cannot be empty when presenting
 * the Agreement.
 */
expectInvalidField(
  validateCommissionAgreementReadyToPresent({
    ...completePersonalUseDraft,
    delivery: {
      ...completePersonalUseDraft.delivery,
      fileFormats: [],
    },
  }),
  "delivery.fileFormats",
);

console.log("[OK] Missing delivery formats were rejected");

console.log("[OK] Commission Agreement data verification passed");