/*
 * Editable, project-specific content for a Commission Agreement draft.
 *
 * Quote amounts and payment stages are intentionally excluded.
 * They come from the accepted Quote and its payment plan.
 *
 * This object is draft data, NOT the immutable document
 * presented to the Client.
 */

export const COMMISSION_AGREEMENT_LAYOUT_SECTIONS = [
  "parties",
  "project_details",
  "delivery",
  "pricing",
  "payment_plan",
  "license",
  "project_conditions",
  "ai_policy",
  "acceptance",
] as const;

export type CommissionAgreementLayoutSection =
  (typeof COMMISSION_AGREEMENT_LAYOUT_SECTIONS)[number];

export interface CommissionAgreementLayoutData {
  pageBreakBefore: CommissionAgreementLayoutSection[];

  keepTogether: CommissionAgreementLayoutSection[];
}

export const DEFAULT_COMMISSION_AGREEMENT_LAYOUT:
  CommissionAgreementLayoutData = {
    pageBreakBefore: [],

    keepTogether: [
      "parties",
      "license",
      "acceptance",
    ],
  };

export interface CommissionAgreementDraftData {
  schemaVersion: 1;

  project: {
    name: string;
    description: string;
    illustrationType: string;
  };

  delivery: {
    size: string;
    colorMode: string;
    fileFormats: string[];
  };

  license: {
    selectedOption: "personal_use" | "commercial_use" | null;
    commercialScope: string;
  };

  projectConditions: {
    confidentialityRequirement: string;
    holdDate: string | null;
    additionalTerms: string;
  };

    /*
   * Presentation-only preferences for the generated PDF.
   *
   * This is optional for backwards compatibility with Agreement
   * drafts created before manual layout controls existed.
   */
  layout?: CommissionAgreementLayoutData;
}

export function createEmptyCommissionAgreementDraftData():
  CommissionAgreementDraftData {
  return {
    schemaVersion: 1,

    project: {
      name: "",
      description: "",
      illustrationType: "",
    },

    delivery: {
      size: "",
      colorMode: "",
      fileFormats: [],
    },

    license: {
      selectedOption: null,
      commercialScope: "",
    },

    projectConditions: {
      confidentialityRequirement: "",
      holdDate: null,
      additionalTerms: "",
    },

    layout: {
      pageBreakBefore: [
        ...DEFAULT_COMMISSION_AGREEMENT_LAYOUT.pageBreakBefore,
      ],

      keepTogether: [
        ...DEFAULT_COMMISSION_AGREEMENT_LAYOUT.keepTogether,
      ],
    },
  };
}

export type CommissionAgreementDraftDataValidation =
  | {
      valid: true;
      data: CommissionAgreementDraftData;
    }
  | {
      valid: false;
      field: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isCommissionAgreementLayoutSection(
  value: unknown,
): value is CommissionAgreementLayoutSection {
  return (
    typeof value === "string" &&
    (
      COMMISSION_AGREEMENT_LAYOUT_SECTIONS as readonly string[]
    ).includes(value)
  );
}

function validateLayoutSectionList(
  value: unknown,
): value is CommissionAgreementLayoutSection[] {
  return (
    Array.isArray(value) &&
    value.every(isCommissionAgreementLayoutSection) &&
    new Set(value).size === value.length
  );
}

export function getCommissionAgreementLayout(
  data: CommissionAgreementDraftData,
): CommissionAgreementLayoutData {
  if (!data.layout) {
    return {
      pageBreakBefore: [
        ...DEFAULT_COMMISSION_AGREEMENT_LAYOUT.pageBreakBefore,
      ],

      keepTogether: [
        ...DEFAULT_COMMISSION_AGREEMENT_LAYOUT.keepTogether,
      ],
    };
  }

  return {
    pageBreakBefore: [
      ...data.layout.pageBreakBefore,
    ],

    keepTogether: [
      ...data.layout.keepTogether,
    ],
  };
}

export function validateCommissionAgreementDraftData(
  value: unknown,
): CommissionAgreementDraftDataValidation {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    return { valid: false, field: "schemaVersion" };
  }

  const {
    project,
    delivery,
    license,
    projectConditions,
    layout,
  } = value;

  if (!isRecord(project)) {
    return { valid: false, field: "project" };
  }

  for (const field of [
    "name",
    "description",
    "illustrationType",
  ] as const) {
    if (typeof project[field] !== "string") {
      return { valid: false, field: `project.${field}` };
    }
  }

  if (!isRecord(delivery)) {
    return { valid: false, field: "delivery" };
  }

  for (const field of ["size", "colorMode"] as const) {
    if (typeof delivery[field] !== "string") {
      return { valid: false, field: `delivery.${field}` };
    }
  }

  if (
    !Array.isArray(delivery.fileFormats) ||
    !delivery.fileFormats.every(
      (format: unknown) => typeof format === "string",
    )
  ) {
    return { valid: false, field: "delivery.fileFormats" };
  }

  if (!isRecord(license)) {
    return { valid: false, field: "license" };
  }

  if (
    license.selectedOption !== null &&
    license.selectedOption !== "personal_use" &&
    license.selectedOption !== "commercial_use"
  ) {
    return { valid: false, field: "license.selectedOption" };
  }

  if (typeof license.commercialScope !== "string") {
    return { valid: false, field: "license.commercialScope" };
  }

  if (!isRecord(projectConditions)) {
    return { valid: false, field: "projectConditions" };
  }

  for (const field of [
    "confidentialityRequirement",
    "additionalTerms",
  ] as const) {
    if (typeof projectConditions[field] !== "string") {
      return {
        valid: false,
        field: `projectConditions.${field}`,
      };
    }
  }

  if (
    projectConditions.holdDate !== null &&
    typeof projectConditions.holdDate !== "string"
  ) {
    return {
      valid: false,
      field: "projectConditions.holdDate",
    };
  }

  /*
   * layout is optional so Agreement drafts created before this
   * feature remain valid.
   */
  if (layout !== undefined) {
    if (!isRecord(layout)) {
      return {
        valid: false,
        field: "layout",
      };
    }

    if (
      !validateLayoutSectionList(
        layout.pageBreakBefore,
      )
    ) {
      return {
        valid: false,
        field: "layout.pageBreakBefore",
      };
    }

    if (
      !validateLayoutSectionList(
        layout.keepTogether,
      )
    ) {
      return {
        valid: false,
        field: "layout.keepTogether",
      };
    }
  }

  return {
    valid: true,
    data: value as unknown as CommissionAgreementDraftData,
  };
}

export function validateCommissionAgreementReadyToPresent(
  value: unknown,
): CommissionAgreementDraftDataValidation {
  const draftValidation = validateCommissionAgreementDraftData(value);

  if (!draftValidation.valid) {
    return draftValidation;
  }

  const { data } = draftValidation;

  const requiredTextFields = [
    ["project.name", data.project.name],
    ["project.description", data.project.description],
    ["project.illustrationType", data.project.illustrationType],
    ["delivery.size", data.delivery.size],
    ["delivery.colorMode", data.delivery.colorMode],
    [
      "projectConditions.confidentialityRequirement",
      data.projectConditions.confidentialityRequirement,
    ],
  ] as const;

  for (const [field, text] of requiredTextFields) {
    if (!text.trim()) {
      return { valid: false, field };
    }
  }

  if (
    data.delivery.fileFormats.length === 0 ||
    data.delivery.fileFormats.some((format) => !format.trim())
  ) {
    return {
      valid: false,
      field: "delivery.fileFormats",
    };
  }

  if (data.license.selectedOption === null) {
    return {
      valid: false,
      field: "license.selectedOption",
    };
  }

  if (
    data.license.selectedOption === "commercial_use" &&
    !data.license.commercialScope.trim()
  ) {
    return {
      valid: false,
      field: "license.commercialScope",
    };
  }

  return {
    valid: true,
    data,
  };
}