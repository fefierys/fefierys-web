"use client";

import { useActionState, useCallback, useMemo, useState } from "react";

import {
  classifyCommissionAction,
  type CommissionClassificationActionState,
} from "@/app/admin/(protected)/commissions/actions";

import CommissionAdminModal from "./CommissionAdminModal";
import CommissionAdminToast from "./CommissionAdminToast";
import CommissionSelect from "./CommissionSelect";

interface PricingOptionSummary {
  baseAmount: string;
  id: string;
  quoteLabel: string;
  title: string;
}

interface PricingServiceSummary {
  code: string;
  id: string;
  options: PricingOptionSummary[];
  title: string;
}

interface CommissionClassificationPanelProps {
  classification: "unclassified" | "catalog" | "custom";
  classificationNote: string | null;
  commissionId: string;
  expectedUpdatedAt: string;
  hasQuotes: boolean;
  pricingOptionId: string | null;
  pricingServiceId: string | null;
  requestSource: "contact" | "commissions" | "admin";
  services: PricingServiceSummary[];
}

const INITIAL_STATE: CommissionClassificationActionState = {
  outcome: "idle",
  message: null,
};

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getServiceContext(code: string): string | null {
  if (code.startsWith("semi-")) {
    return "Semi-realism";
  }

  if (code.startsWith("sty-")) {
    return "Stylized";
  }

  if (code === "characters") {
    return "Chibis";
  }

  if (code === "custom") {
    return "Emotes";
  }

  return null;
}

function getServiceLabel(service: PricingServiceSummary): string {
  const context = getServiceContext(service.code);

  return context ? `${context} · ${service.title}` : service.title;
}

export default function CommissionClassificationPanel({
  classification,
  classificationNote,
  commissionId,
  expectedUpdatedAt,
  hasQuotes,
  pricingOptionId,
  pricingServiceId,
  requestSource,
  services,
}: CommissionClassificationPanelProps) {
  const initialServiceId =
    services.find((service) => service.id === pricingServiceId)?.id ??
    services[0]?.id ??
    "";
  const initialService = services.find(
    (service) => service.id === initialServiceId,
  );
  const initialOptionId =
    initialService?.options.find((option) => option.id === pricingOptionId)
      ?.id ??
    initialService?.options[0]?.id ??
    "";

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"catalog" | "custom">(
    classification === "custom" ? "custom" : "catalog",
  );
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [optionId, setOptionId] = useState(initialOptionId);
  const [toast, setToast] = useState<string | null>(null);
  const runClassificationAction = useCallback(
    async (
      previousState: CommissionClassificationActionState,
      formData: FormData,
    ): Promise<CommissionClassificationActionState> => {
      if (
        formData.get("classification") === "custom" &&
        !formData.get("note")?.toString().trim()
      ) {
        return {
          outcome: "error",
          message: "Describe the custom service before saving.",
        };
      }

      const result = await classifyCommissionAction(previousState, formData);

      if (result.outcome === "success" && result.message) {
        setOpen(false);
        setToast(result.message);
      }

      return result;
    },
    [],
  );
  const [state, formAction, pending] = useActionState(
    runClassificationAction,
    INITIAL_STATE,
  );

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId) ?? null,
    [serviceId, services],
  );
  const selectedOption =
    selectedService?.options.find((option) => option.id === optionId) ?? null;

  const closeModal = useCallback(() => setOpen(false), []);
  const dismissToast = useCallback(() => setToast(null), []);

  function changeService(nextServiceId: string): void {
    const nextService = services.find(
      (service) => service.id === nextServiceId,
    );
    setServiceId(nextServiceId);
    setOptionId(nextService?.options[0]?.id ?? "");
  }

  const currentService = services.find(
    (service) => service.id === pricingServiceId,
  );
  const currentOption = currentService?.options.find(
    (option) => option.id === pricingOptionId,
  );
  const classificationLocked = hasQuotes && classification !== "unclassified";
  const canClassify = !classificationLocked && services.length > 0;

  return (
    <>
      <section className="glass-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-light">Service classification</h2>
            <p className="mt-1 text-xs text-white/50">
              Source: {humanize(requestSource)}
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              classification === "unclassified"
                ? "border-amber-200/20 bg-amber-200/10 text-amber-50"
                : "border-emerald-200/20 bg-emerald-200/10 text-emerald-50"
            }`}
          >
            {humanize(classification)}
          </span>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          {classification === "catalog" && currentOption ? (
            <>
              <p className="font-medium">{currentOption.quoteLabel}</p>
              <p className="mt-1 text-sm text-white/60">
                {currentService?.title} · {currentOption.baseAmount} USD
              </p>
            </>
          ) : classification === "custom" ? (
            <>
              <p className="font-medium">Custom service</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/60">
                {classificationNote}
              </p>
            </>
          ) : (
            <p className="text-sm text-white/60">
              Review the request and assign a catalog option or a custom
              service.
            </p>
          )}
        </div>

        {classificationLocked ? (
          <p className="mt-4 text-xs leading-relaxed text-white/50">
            Classification is locked because this commission already has quote
            history.
          </p>
        ) : (
          <button
            className="mt-4 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canClassify}
            onClick={() => setOpen(true)}
            type="button"
          >
            {classification === "unclassified"
              ? "Classify service"
              : "Change classification"}
          </button>
        )}

        {!classificationLocked && services.length === 0 && (
          <p className="mt-3 text-xs text-amber-100/80">
            No active pricing catalog is available.
          </p>
        )}
      </section>

      <CommissionAdminModal
        description="Assign the request to the active pricing catalog or record it as a custom commission."
        onClose={closeModal}
        open={open}
        title="Classify commission service"
      >
        <form action={formAction} className="space-y-5" noValidate>
          <input name="commissionId" type="hidden" value={commissionId} />
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={expectedUpdatedAt}
          />
          <input name="classification" type="hidden" value={mode} />

          <div>
            <p className="mb-2 text-sm text-white/75">Classification</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                className={`rounded-xl border px-4 py-3 text-sm transition ${
                  mode === "catalog"
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                }`}
                onClick={() => setMode("catalog")}
                type="button"
              >
                Catalog
              </button>
              <button
                className={`rounded-xl border px-4 py-3 text-sm transition ${
                  mode === "custom"
                    ? "border-white/25 bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                }`}
                onClick={() => setMode("custom")}
                type="button"
              >
                Custom
              </button>
            </div>
          </div>

          {mode === "catalog" ? (
            <>
              <div>
                <label className="mb-2 block text-sm text-white/75">
                  Service
                </label>
                <CommissionSelect
                  name="pricingServiceId"
                  onChange={changeService}
                  options={services.map((service) => ({
                    label: getServiceLabel(service),
                    value: service.id,
                  }))}
                  value={serviceId}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-white/75">
                  Option
                </label>
                <CommissionSelect
                  name="pricingOptionId"
                  onChange={setOptionId}
                  options={(selectedService?.options ?? []).map((option) => ({
                    label: `${option.title} · ${option.baseAmount} USD`,
                    value: option.id,
                  }))}
                  value={optionId}
                />
              </div>

              {selectedOption && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-medium">{selectedOption.quoteLabel}</p>
                  <p className="mt-1 text-sm text-white/60">
                    Base price: {selectedOption.baseAmount} USD
                  </p>
                </div>
              )}
            </>
          ) : (
            <input name="pricingServiceId" type="hidden" value="" />
          )}

          {mode === "custom" && (
            <input name="pricingOptionId" type="hidden" value="" />
          )}

          <div>
            <label
              className="mb-2 block text-sm text-white/75"
              htmlFor="classification-note"
            >
              {mode === "custom"
                ? "Custom service details"
                : "Internal note (optional)"}
            </label>
            <textarea
              className="min-h-28 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/15"
              defaultValue={classificationNote ?? ""}
              id="classification-note"
              maxLength={2000}
              name="note"
              placeholder={
                mode === "custom"
                  ? "Describe the custom service requested by the client."
                  : "Why this catalog option was selected."
              }
            />
          </div>

          {state.outcome !== "idle" && state.outcome !== "success" && (
            <p className="text-sm text-rose-200" role="alert">
              {state.message}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
            <button
              className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={closeModal}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-sm transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
              disabled={pending || (mode === "catalog" && !selectedOption)}
              type="submit"
            >
              {pending ? "Saving…" : "Save classification"}
            </button>
          </div>
        </form>
      </CommissionAdminModal>

      <CommissionAdminToast message={toast} onDismiss={dismissToast} />
    </>
  );
}
