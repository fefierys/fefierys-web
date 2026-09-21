"use client";

import {
  useActionState,
  useCallback,
  useState,
} from "react";

import {
  saveCommissionAgreementDraftDataAction,
  type CommissionAgreementDraftActionState,
} from "@/app/admin/(protected)/commissions/actions";

import type {
  CommissionAgreementDraftData,
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
}

const INITIAL_ACTION_STATE: CommissionAgreementDraftActionState = {
  outcome: "idle",
  message: null,
};

const INPUT_CLASS =
  "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/15";

const LABEL_CLASS = "mb-2 block text-sm text-white/75";

export default function CommissionAgreementPanel({
  commissionId,
  quoteId,
  agreementId,
  agreementVersion,
  termsVersion,
  initialUpdatedAt,
  initialData,
}: CommissionAgreementPanelProps) {
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => {
    setOpen(false);
    }, []);
  const [draft, setDraft] =
    useState<CommissionAgreementDraftData>(initialData);

  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [toast, setToast] = useState<string | null>(null);

  const [fileFormatsText, setFileFormatsText] = useState(
    initialData.delivery.fileFormats.join(", "),
  );

  const runSaveAction = useCallback(
    async (
      previousState: CommissionAgreementDraftActionState,
      formData: FormData,
    ): Promise<CommissionAgreementDraftActionState> => {
      const result = await saveCommissionAgreementDraftDataAction(
        previousState,
        formData,
      );

      if (
        result.outcome === "success" &&
        result.agreementUpdatedAt
      ) {
        /*
         * Use the version returned by the successful save,
         * not the version from the initial page render.
         */
        setUpdatedAt(result.agreementUpdatedAt);
        setToast(result.message);
      }

      return result;
    },
    [],
  );

  const [state, formAction, pending] = useActionState(
    runSaveAction,
    INITIAL_ACTION_STATE,
  );

  function updateProject(
    field: keyof CommissionAgreementDraftData["project"],
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      project: {
        ...current.project,
        [field]: value,
      },
    }));
  }

  function updateDelivery(
    field: "size" | "colorMode",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      delivery: {
        ...current.delivery,
        [field]: value,
      },
    }));
  }

  function updateConditions(
    field: "confidentialityRequirement" | "additionalTerms",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      projectConditions: {
        ...current.projectConditions,
        [field]: value,
      },
    }));
  }

  function updateFileFormats(value: string) {
    setFileFormatsText(value);

    setDraft((current) => ({
      ...current,
      delivery: {
        ...current.delivery,
        fileFormats: value
          .split(",")
          .map((format) => format.trim())
          .filter(Boolean),
      },
    }));
  }

  return (
    <>
      <section className="glass-card p-6">
        <h2 className="text-xl font-light">Commission Agreement</h2>

        <p className="mt-2 text-sm text-white/60">
          Draft · Template {agreementVersion} · ToS {termsVersion}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-white/60">
          Prepare the project details, delivery specifications,
          license and project-specific conditions. Payment
          amounts and stages are managed separately.
        </p>

        <button
          className="mt-5 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15"
          onClick={() => setOpen(true)}
          type="button"
        >
          Edit Agreement draft
        </button>
      </section>

      <CommissionAdminModal
        description="Save your progress as a draft. This action does not sign or present the Agreement to the client."
        onClose={closeModal}
        open={open}
        title="Edit Commission Agreement"
      >
        <form action={formAction} className="space-y-6" noValidate>
          <input name="commissionId" type="hidden" value={commissionId} />
          <input name="quoteId" type="hidden" value={quoteId} />
          <input name="agreementId" type="hidden" value={agreementId} />

          <input
            name="expectedAgreementUpdatedAt"
            type="hidden"
            value={updatedAt}
          />

          <input
            name="agreementData"
            type="hidden"
            value={JSON.stringify(draft)}
          />

          <fieldset className="space-y-4">
            <legend className="text-lg font-light">
              Project details
            </legend>

            <div>
              <label className={LABEL_CLASS} htmlFor="agreement-project-name">
                Project name
              </label>
              <input
                className={INPUT_CLASS}
                id="agreement-project-name"
                onChange={(event) =>
                  updateProject("name", event.target.value)
                }
                type="text"
                value={draft.project.name}
              />
            </div>

            <div>
              <label
                className={LABEL_CLASS}
                htmlFor="agreement-project-description"
              >
                Project description
              </label>
              <textarea
                className={`${INPUT_CLASS} min-h-28`}
                id="agreement-project-description"
                onChange={(event) =>
                  updateProject("description", event.target.value)
                }
                value={draft.project.description}
              />
            </div>

            <div>
              <label
                className={LABEL_CLASS}
                htmlFor="agreement-illustration-type"
              >
                Type of illustration
              </label>
              <input
                className={INPUT_CLASS}
                id="agreement-illustration-type"
                onChange={(event) =>
                  updateProject("illustrationType", event.target.value)
                }
                type="text"
                value={draft.project.illustrationType}
              />
            </div>
          </fieldset>

          <div className="border-t border-white/10" />

          <fieldset className="space-y-4">
            <legend className="text-lg font-light">
              Delivery specifications
            </legend>

            <div>
              <label className={LABEL_CLASS} htmlFor="agreement-size">
                Size
              </label>
              <input
                className={INPUT_CLASS}
                id="agreement-size"
                onChange={(event) =>
                  updateDelivery("size", event.target.value)
                }
                placeholder="e.g. 3000 × 4000 px"
                type="text"
                value={draft.delivery.size}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="agreement-color-mode">
                Color mode
              </label>
              <input
                className={INPUT_CLASS}
                id="agreement-color-mode"
                onChange={(event) =>
                  updateDelivery("colorMode", event.target.value)
                }
                placeholder="e.g. RGB & CMYK"
                type="text"
                value={draft.delivery.colorMode}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="agreement-file-formats">
                File formats
              </label>
              <input
                className={INPUT_CLASS}
                id="agreement-file-formats"
                onChange={(event) =>
                  updateFileFormats(event.target.value)
                }
                placeholder="e.g. PNG, PDF, TIFF"
                type="text"
                value={fileFormatsText}
              />
              <p className="mt-2 text-xs text-white/50">
                Separate formats with commas.
              </p>
            </div>
          </fieldset>

          <div className="border-t border-white/10" />

          <fieldset className="space-y-4">
            <legend className="text-lg font-light">
              License and usage
            </legend>

            <div>
              <label className={LABEL_CLASS} htmlFor="agreement-license">
                Selected license
              </label>
              <CommissionSelect
                name="selectedLicense"
                onChange={(value) => {
                    setDraft((current) => ({
                    ...current,
                    license: {
                        ...current.license,
                        selectedOption:
                        value === "personal_use" || value === "commercial_use"
                            ? value
                            : null,
                    },
                    }));
                }}
                options={[
                    { label: "Not selected", value: "" },
                    { label: "Personal use only", value: "personal_use" },
                    { label: "Commercial use", value: "commercial_use" },
                ]}
                value={draft.license.selectedOption ?? ""}
                />
            </div>

            {draft.license.selectedOption === "commercial_use" && (
              <div>
                <label
                  className={LABEL_CLASS}
                  htmlFor="agreement-commercial-scope"
                >
                  Commercial scope
                </label>
                <textarea
                  className={`${INPUT_CLASS} min-h-32`}
                  id="agreement-commercial-scope"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      license: {
                        ...current.license,
                        commercialScope: event.target.value,
                      },
                    }))
                  }
                  value={draft.license.commercialScope}
                />
              </div>
            )}
          </fieldset>

          <div className="border-t border-white/10" />

          <fieldset className="space-y-4">
            <legend className="text-lg font-light">
              Project-specific conditions
            </legend>

            <div>
              <label
                className={LABEL_CLASS}
                htmlFor="agreement-confidentiality"
              >
                Confidentiality requirement
              </label>
              <textarea
                className={`${INPUT_CLASS} min-h-24`}
                id="agreement-confidentiality"
                onChange={(event) =>
                  updateConditions(
                    "confidentialityRequirement",
                    event.target.value,
                  )
                }
                placeholder="Enter the requirement or N/A."
                value={draft.projectConditions.confidentialityRequirement}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="agreement-hold-date">
                Hold date (optional)
              </label>
              <input
                className={INPUT_CLASS}
                id="agreement-hold-date"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    projectConditions: {
                      ...current.projectConditions,
                      holdDate: event.target.value || null,
                    },
                  }))
                }
                type="date"
                value={draft.projectConditions.holdDate ?? ""}
              />
            </div>

            <div>
              <label
                className={LABEL_CLASS}
                htmlFor="agreement-additional-terms"
              >
                Additional terms (optional)
              </label>
              <textarea
                className={`${INPUT_CLASS} min-h-28`}
                id="agreement-additional-terms"
                onChange={(event) =>
                  updateConditions("additionalTerms", event.target.value)
                }
                value={draft.projectConditions.additionalTerms}
              />
            </div>
          </fieldset>

          {state.outcome === "error" || state.outcome === "conflict" ? (
            <p className="text-sm text-rose-200" role="alert">
              {state.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
            <button
              className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={closeModal}
              type="button"
            >
              Close
            </button>

            <button
              className="rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-sm transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              {pending ? "Saving..." : "Save draft"}
            </button>
          </div>
        </form>
      </CommissionAdminModal>

      <CommissionAdminToast
        message={toast}
        onDismiss={() => setToast(null)}
      />
    </>
  );
}