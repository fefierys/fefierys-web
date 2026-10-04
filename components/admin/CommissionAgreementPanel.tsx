"use client";

import {
  type ReactNode,
  useActionState,
  useCallback,
  useState,
} from "react";

import {
  saveCommissionAgreementDraftDataAction,
  type CommissionAgreementDraftActionState,
} from "@/app/admin/(protected)/commissions/actions";

import {
  COMMISSION_AGREEMENT_LAYOUT_SECTIONS,
  DEFAULT_COMMISSION_AGREEMENT_LAYOUT,
  getCommissionAgreementLayout,
  type CommissionAgreementDraftData,
  type CommissionAgreementLayoutSection,
} from "@/lib/commissions/commissionAgreementData";

import CommissionAdminModal from "./CommissionAdminModal";
import CommissionAdminToast from "./CommissionAdminToast";
import CommissionSelect from "./CommissionSelect";

interface CommissionAgreementPanelProps {
  commissionId: string;
  quoteId: string;
  agreementId: string;
  agreementVersion: string;
  termsVersion: string;
  initialUpdatedAt: string;
  initialData: CommissionAgreementDraftData;
  preview?: ReactNode;
}

const INITIAL_ACTION_STATE: CommissionAgreementDraftActionState = {
  outcome: "idle",
  message: null,
};

const INPUT_CLASS =
  "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/15";

const LABEL_CLASS =
  "mb-2 block text-sm text-white/75";

const LAYOUT_SECTION_LABELS:
  Record<CommissionAgreementLayoutSection, string> = {
    parties: "Parties",
    project_details: "Project details",
    delivery: "Delivery specifications",
    pricing: "Project fees / pricing",
    payment_plan: "Payment plan",
    license: "License rights & usage",
    project_conditions:
      "Project-specific conditions",
    ai_policy: "No Generative AI Policy",
    acceptance: "Acceptance of terms",
  };

/*
 * These blocks may legitimately grow beyond one page.
 *
 * Forcing them into a single unbreakable View could produce
 * worse pagination or overflow, so we allow manual page starts
 * but intentionally do not expose "Keep together" for them.
 */
const LARGE_LAYOUT_SECTIONS =
  new Set<CommissionAgreementLayoutSection>([
    "pricing",
    "payment_plan",
  ]);

function createEditableDraft(
  data: CommissionAgreementDraftData,
): CommissionAgreementDraftData {
  return {
    ...data,

    layout:
      getCommissionAgreementLayout(
        data,
      ),
  };
}

export default function CommissionAgreementPanel({
  commissionId,
  quoteId,
  agreementId,
  agreementVersion,
  termsVersion,
  initialUpdatedAt,
  initialData,
  preview,
}: CommissionAgreementPanelProps) {
  const [open, setOpen] =
    useState(false);

  const closeModal =
    useCallback(() => {
      setOpen(false);
    }, []);

  /*
   * Existing Agreement drafts may predate the layout property.
   * Normalize them in client state so the editor always has
   * explicit effective layout settings.
   */
  const [draft, setDraft] =
    useState<CommissionAgreementDraftData>(
      () =>
        createEditableDraft(
          initialData,
        ),
    );

  const [
    updatedAt,
    setUpdatedAt,
  ] = useState(
    initialUpdatedAt,
  );

  const [
    toast,
    setToast,
  ] = useState<string | null>(
    null,
  );

  const [
    fileFormatsText,
    setFileFormatsText,
  ] = useState(
    initialData.delivery.fileFormats.join(
      ", ",
    ),
  );

  const runSaveAction =
    useCallback(
      async (
        previousState:
          CommissionAgreementDraftActionState,
        formData: FormData,
      ): Promise<CommissionAgreementDraftActionState> => {
        const result =
          await saveCommissionAgreementDraftDataAction(
            previousState,
            formData,
          );

        if (
          result.outcome ===
            "success" &&
          result.agreementUpdatedAt
        ) {
          /*
          * Use the version returned by the successful save,
          * not the version from the initial page render.
          */
          setUpdatedAt(
            result.agreementUpdatedAt,
          );

          setOpen(false);

          setToast(
            result.message,
          );
        }

        return result;
      },
      [],
    );

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    runSaveAction,
    INITIAL_ACTION_STATE,
  );

  function updateProject(
    field: keyof CommissionAgreementDraftData["project"],
    value: string,
  ) {
    setDraft(
      (current) => ({
        ...current,

        project: {
          ...current.project,
          [field]: value,
        },
      }),
    );
  }

  function updateDelivery(
    field:
      | "size"
      | "colorMode",
    value: string,
  ) {
    setDraft(
      (current) => ({
        ...current,

        delivery: {
          ...current.delivery,
          [field]: value,
        },
      }),
    );
  }

  function updateConditions(
    field:
      | "confidentialityRequirement"
      | "additionalTerms",
    value: string,
  ) {
    setDraft(
      (current) => ({
        ...current,

        projectConditions: {
          ...current.projectConditions,
          [field]: value,
        },
      }),
    );
  }

  function updateFileFormats(
    value: string,
  ) {
    setFileFormatsText(
      value,
    );

    setDraft(
      (current) => ({
        ...current,

        delivery: {
          ...current.delivery,

          fileFormats:
            value
              .split(",")
              .map(
                (format) =>
                  format.trim(),
              )
              .filter(Boolean),
        },
      }),
    );
  }

  function updateLayoutSection(
    field:
      | "pageBreakBefore"
      | "keepTogether",
    section:
      CommissionAgreementLayoutSection,
    enabled: boolean,
  ) {
    setDraft(
      (current) => {
        const currentLayout =
          getCommissionAgreementLayout(
            current,
          );

        const selected =
          new Set(
            currentLayout[
              field
            ],
          );

        if (enabled) {
          selected.add(
            section,
          );
        } else {
          selected.delete(
            section,
          );
        }

        /*
         * Rebuild using the canonical section order instead
         * of preserving checkbox click order. This makes the
         * stored JSON deterministic and easier to inspect.
         */
        const normalized =
          COMMISSION_AGREEMENT_LAYOUT_SECTIONS.filter(
            (candidate) =>
              selected.has(
                candidate,
              ),
          );

        return {
          ...current,

          layout: {
            ...currentLayout,

            [field]:
              normalized,
          },
        };
      },
    );
  }

  function resetPdfLayout() {
    setDraft(
      (current) => ({
        ...current,

        layout: {
          pageBreakBefore: [
            ...DEFAULT_COMMISSION_AGREEMENT_LAYOUT.pageBreakBefore,
          ],

          keepTogether: [
            ...DEFAULT_COMMISSION_AGREEMENT_LAYOUT.keepTogether,
          ],
        },
      }),
    );
  }

  const effectiveLayout =
    getCommissionAgreementLayout(
      draft,
    );

  return (
    <>
      <section className="glass-card p-6">
        <h2 className="text-xl font-light">
          Commission Agreement
        </h2>

        <p className="mt-2 text-sm text-white/60">
          Draft · Template{" "}
          {agreementVersion} · ToS{" "}
          {termsVersion}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-white/60">
          Prepare the project
          details, delivery
          specifications, license
          and project-specific
          conditions. Payment
          amounts and stages are
          managed separately.
        </p>

        <button
          className="mt-5 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15"
          onClick={() =>
            setOpen(true)
          }
          type="button"
        >
          Edit Agreement draft
        </button>

        {preview && (
          <div className="mt-3">
            {preview}
          </div>
        )}
      </section>

      <CommissionAdminModal
        description="Save your progress as a draft. This action does not sign or present the Agreement to the client."
        onClose={
          closeModal
        }
        open={open}
        title="Edit Commission Agreement"
      >
        <form
          action={
            formAction
          }
          className="space-y-6"
          noValidate
        >
          <input
            name="commissionId"
            type="hidden"
            value={
              commissionId
            }
          />

          <input
            name="quoteId"
            type="hidden"
            value={
              quoteId
            }
          />

          <input
            name="agreementId"
            type="hidden"
            value={
              agreementId
            }
          />

          <input
            name="expectedAgreementUpdatedAt"
            type="hidden"
            value={
              updatedAt
            }
          />

          <input
            name="agreementData"
            type="hidden"
            value={JSON.stringify(
              draft,
            )}
          />

          {/* ================================================
           * PROJECT DETAILS
           * ================================================ */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-light">
              Project details
            </legend>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-project-name"
              >
                Project name
              </label>

              <input
                className={
                  INPUT_CLASS
                }
                id="agreement-project-name"
                onChange={(
                  event,
                ) =>
                  updateProject(
                    "name",
                    event
                      .target
                      .value,
                  )
                }
                type="text"
                value={
                  draft
                    .project
                    .name
                }
              />
            </div>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-project-description"
              >
                Project
                description
              </label>

              <textarea
                className={`${INPUT_CLASS} min-h-28`}
                id="agreement-project-description"
                onChange={(
                  event,
                ) =>
                  updateProject(
                    "description",
                    event
                      .target
                      .value,
                  )
                }
                value={
                  draft
                    .project
                    .description
                }
              />
            </div>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-illustration-type"
              >
                Type of
                illustration
              </label>

              <input
                className={
                  INPUT_CLASS
                }
                id="agreement-illustration-type"
                onChange={(
                  event,
                ) =>
                  updateProject(
                    "illustrationType",
                    event
                      .target
                      .value,
                  )
                }
                type="text"
                value={
                  draft
                    .project
                    .illustrationType
                }
              />
            </div>
          </fieldset>

          <div className="border-t border-white/10" />

          {/* ================================================
           * DELIVERY
           * ================================================ */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-light">
              Delivery
              specifications
            </legend>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-size"
              >
                Size
              </label>

              <input
                className={
                  INPUT_CLASS
                }
                id="agreement-size"
                onChange={(
                  event,
                ) =>
                  updateDelivery(
                    "size",
                    event
                      .target
                      .value,
                  )
                }
                placeholder="e.g. 3000 × 4000 px"
                type="text"
                value={
                  draft
                    .delivery
                    .size
                }
              />
            </div>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-color-mode"
              >
                Color mode
              </label>

              <input
                className={
                  INPUT_CLASS
                }
                id="agreement-color-mode"
                onChange={(
                  event,
                ) =>
                  updateDelivery(
                    "colorMode",
                    event
                      .target
                      .value,
                  )
                }
                placeholder="e.g. RGB & CMYK"
                type="text"
                value={
                  draft
                    .delivery
                    .colorMode
                }
              />
            </div>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-file-formats"
              >
                File formats
              </label>

              <input
                className={
                  INPUT_CLASS
                }
                id="agreement-file-formats"
                onChange={(
                  event,
                ) =>
                  updateFileFormats(
                    event
                      .target
                      .value,
                  )
                }
                placeholder="e.g. PNG, PDF, TIFF"
                type="text"
                value={
                  fileFormatsText
                }
              />

              <p className="mt-2 text-xs text-white/50">
                Separate formats
                with commas.
              </p>
            </div>
          </fieldset>

          <div className="border-t border-white/10" />

          {/* ================================================
           * LICENSE
           * ================================================ */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-light">
              License and usage
            </legend>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-license"
              >
                Selected license
              </label>

              <CommissionSelect
                name="selectedLicense"
                onChange={(
                  value,
                ) => {
                  setDraft(
                    (
                      current,
                    ) => ({
                      ...current,

                      license: {
                        ...current.license,

                        selectedOption:
                          value ===
                            "personal_use" ||
                          value ===
                            "commercial_use"
                            ? value
                            : null,
                      },
                    }),
                  );
                }}
                options={[
                  {
                    label:
                      "Not selected",
                    value: "",
                  },
                  {
                    label:
                      "Personal use only",
                    value:
                      "personal_use",
                  },
                  {
                    label:
                      "Commercial use",
                    value:
                      "commercial_use",
                  },
                ]}
                value={
                  draft
                    .license
                    .selectedOption ??
                  ""
                }
              />
            </div>

            {draft
              .license
              .selectedOption ===
              "commercial_use" && (
              <div>
                <label
                  className={
                    LABEL_CLASS
                  }
                  htmlFor="agreement-commercial-scope"
                >
                  Commercial
                  scope
                </label>

                <textarea
                  className={`${INPUT_CLASS} min-h-32`}
                  id="agreement-commercial-scope"
                  onChange={(
                    event,
                  ) =>
                    setDraft(
                      (
                        current,
                      ) => ({
                        ...current,

                        license: {
                          ...current.license,

                          commercialScope:
                            event
                              .target
                              .value,
                        },
                      }),
                    )
                  }
                  value={
                    draft
                      .license
                      .commercialScope
                  }
                />
              </div>
            )}
          </fieldset>

          <div className="border-t border-white/10" />

          {/* ================================================
           * PROJECT CONDITIONS
           * ================================================ */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-light">
              Project-specific
              conditions
            </legend>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-confidentiality"
              >
                Confidentiality
                requirement
              </label>

              <textarea
                className={`${INPUT_CLASS} min-h-24`}
                id="agreement-confidentiality"
                onChange={(
                  event,
                ) =>
                  updateConditions(
                    "confidentialityRequirement",
                    event
                      .target
                      .value,
                  )
                }
                placeholder="Enter the requirement or N/A."
                value={
                  draft
                    .projectConditions
                    .confidentialityRequirement
                }
              />
            </div>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-hold-date"
              >
                Hold date
                (optional)
              </label>

              <input
                className={
                  INPUT_CLASS
                }
                id="agreement-hold-date"
                onChange={(
                  event,
                ) =>
                  setDraft(
                    (
                      current,
                    ) => ({
                      ...current,

                      projectConditions:
                        {
                          ...current.projectConditions,

                          holdDate:
                            event
                              .target
                              .value ||
                            null,
                        },
                    }),
                  )
                }
                type="date"
                value={
                  draft
                    .projectConditions
                    .holdDate ??
                  ""
                }
              />
            </div>

            <div>
              <label
                className={
                  LABEL_CLASS
                }
                htmlFor="agreement-additional-terms"
              >
                Additional terms
                (optional)
              </label>

              <textarea
                className={`${INPUT_CLASS} min-h-28`}
                id="agreement-additional-terms"
                onChange={(
                  event,
                ) =>
                  updateConditions(
                    "additionalTerms",
                    event
                      .target
                      .value,
                  )
                }
                value={
                  draft
                    .projectConditions
                    .additionalTerms
                }
              />
            </div>
          </fieldset>

          <div className="border-t border-white/10" />

          {/* ================================================
           * PDF LAYOUT
           * ================================================ */}
          <fieldset className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <legend className="text-lg font-light">
                  PDF layout
                </legend>

                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  Optional
                  presentation
                  controls for the
                  generated
                  Agreement. These
                  settings change
                  pagination only;
                  they do not alter
                  the contractual
                  text.
                </p>
              </div>

              <button
                className="rounded-xl border border-white/15 px-3 py-2 text-xs text-white/65 transition hover:bg-white/10 hover:text-white"
                onClick={
                  resetPdfLayout
                }
                type="button"
              >
                Reset layout
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10">
              <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem] gap-3 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-xs font-medium uppercase tracking-wide text-white/45">
                <span>
                  Section
                </span>

                <span className="text-center">
                  New page
                </span>

                <span className="text-center">
                  Keep together
                </span>
              </div>

              {COMMISSION_AGREEMENT_LAYOUT_SECTIONS.map(
                (
                  section,
                ) => {
                  const startsNewPage =
                    effectiveLayout.pageBreakBefore.includes(
                      section,
                    );

                  const keepTogether =
                    effectiveLayout.keepTogether.includes(
                      section,
                    );

                  const isLarge =
                    LARGE_LAYOUT_SECTIONS.has(
                      section,
                    );

                  return (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_8rem_8rem] items-center gap-3 border-b border-white/10 px-4 py-3 last:border-b-0"
                      key={
                        section
                      }
                    >
                      <div>
                        <p className="text-sm text-white/80">
                          {
                            LAYOUT_SECTION_LABELS[
                              section
                            ]
                          }
                        </p>

                        {isLarge && (
                          <p className="mt-1 text-xs leading-relaxed text-white/40">
                            This
                            section may
                            span
                            multiple
                            pages.
                          </p>
                        )}
                      </div>

                      <div className="flex justify-center">
                        <input
                          aria-label={`Start ${LAYOUT_SECTION_LABELS[section]} on a new page`}
                          checked={
                            startsNewPage
                          }
                          className="h-4 w-4 cursor-pointer accent-white"
                          onChange={(
                            event,
                          ) =>
                            updateLayoutSection(
                              "pageBreakBefore",
                              section,
                              event
                                .target
                                .checked,
                            )
                          }
                          type="checkbox"
                        />
                      </div>

                      <div className="flex justify-center">
                        {isLarge ? (
                          <span
                            className="text-xs text-white/30"
                            title="Large sections remain pageable to prevent overflow."
                          >
                            —
                          </span>
                        ) : (
                          <input
                            aria-label={`Keep ${LAYOUT_SECTION_LABELS[section]} together`}
                            checked={
                              keepTogether
                            }
                            className="h-4 w-4 cursor-pointer accent-white"
                            onChange={(
                              event,
                            ) =>
                              updateLayoutSection(
                                "keepTogether",
                                section,
                                event
                                  .target
                                  .checked,
                              )
                            }
                            type="checkbox"
                          />
                        )}
                      </div>
                    </div>
                  );
                },
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-medium text-white/75">
                How these controls
                work
              </p>

              <p className="text-xs leading-relaxed text-white/50">
                <span className="text-white/70">
                  New page:
                </span>{" "}
                forces the selected
                section to begin on
                the next PDF page.
              </p>

              <p className="text-xs leading-relaxed text-white/50">
                <span className="text-white/70">
                  Keep together:
                </span>{" "}
                prevents a short
                section from being
                split between two
                pages when
                possible.
              </p>

              <p className="text-xs leading-relaxed text-white/40">
                Pricing and payment
                plan remain
                pageable because
                they can grow
                beyond a single
                page. Their
                individual rows
                are still
                protected from
                awkward splits.
              </p>
            </div>
          </fieldset>

          {state.outcome ===
            "error" ||
          state.outcome ===
            "conflict" ? (
            <p
              className="text-sm text-rose-200"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
            <button
              className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={
                closeModal
              }
              type="button"
            >
              Close
            </button>

            <button
              className="rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-sm transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
              disabled={
                pending
              }
              type="submit"
            >
              {pending
                ? "Saving..."
                : "Save draft"}
            </button>
          </div>
        </form>
      </CommissionAdminModal>

      <CommissionAdminToast
        message={
          toast
        }
        onDismiss={() =>
          setToast(null)
        }
      />
    </>
  );
}