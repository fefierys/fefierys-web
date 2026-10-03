"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  updateCommissionGroupedPaymentPlanAction,
  type CommissionPaymentPlanActionState,
} from "@/app/admin/(protected)/commissions/actions";
import type {
  getCommissionDeliverables,
  getCommissionPaymentPlan,
} from "@/lib/repositories/commissionPayments/commissionPaymentPlanRepository";

import CommissionAdminModal from "./CommissionAdminModal";
import CommissionAdminToast from "./CommissionAdminToast";
import CommissionSelect from "./CommissionSelect";

type ExistingDeliverable = Awaited<ReturnType<typeof getCommissionDeliverables>>[number];
type ExistingStage = Awaited<ReturnType<typeof getCommissionPaymentPlan>>[number];

interface CommissionPaymentPlanEditPanelProps {
  commissionId: string;
  agreementId: string;
  expectedAgreementUpdatedAt: string;
  quoteTotalAmount: string;
  currency: string;
  initialDeliverables: ExistingDeliverable[];
  initialStages: ExistingStage[];
}

interface PaymentStage {
  clientKey: string;
  id?: string;
  label: string;
  amount: string;
  trigger: string;
  customTriggerNote: string;
}

interface PaymentDeliverable {
  clientKey: string;
  id?: string;
  title: string;
  description: string;
  quantity: string;
  stages: PaymentStage[];
}

const INITIAL_STATE: CommissionPaymentPlanActionState = {
  outcome: "idle",
  message: null,
};

const INPUT_CLASS =
  "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/15";

const SECONDARY_BUTTON_CLASS =
  "rounded-xl border border-white/15 px-4 py-3 text-sm text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

const ADD_BUTTON_CLASS =
  "w-full rounded-xl border border-dashed border-white/25 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";

const TRIGGER_OPTIONS = [
  { label: "Before work begins", value: "before_start" },
  { label: "After sketch approval", value: "after_sketch_approval" },
  { label: "Before final delivery", value: "before_final_delivery" },
  { label: "Custom payment stage", value: "custom" },
];

const MAX_DELIVERABLES = 100;
const MAX_PAYMENT_STAGES = 50;

function toEditableStage(stage: ExistingStage): PaymentStage {
  return {
    clientKey: `existing-stage-${stage.id}`,
    id: stage.id,
    label: stage.label,
    amount: stage.amount,
    trigger: stage.trigger,
    customTriggerNote: stage.customTriggerNote ?? "",
  };
}

function initialProjectStages(stages: ExistingStage[]): PaymentStage[] {
  return stages
    .filter((stage) => stage.deliverableId === null)
    .map(toEditableStage);
}

function initialDeliverableGroups(
  deliverables: ExistingDeliverable[],
  stages: ExistingStage[],
): PaymentDeliverable[] {
  return deliverables.map((deliverable) => ({
    clientKey: `existing-deliverable-${deliverable.id}`,
    id: deliverable.id,
    title: deliverable.title,
    description: deliverable.description ?? "",
    quantity: String(deliverable.quantity),
    stages: stages
      .filter((stage) => stage.deliverableId === deliverable.id)
      .map(toEditableStage),
  }));
}

function toStagePayload(stage: PaymentStage) {
  return {
    ...(stage.id ? { id: stage.id } : {}),
    label: stage.label,
    amount: stage.amount,
    trigger: stage.trigger,
    customTriggerNote: stage.customTriggerNote,
  };
}

function PaymentStageEditor({
  stage,
  stageNumber,
  currency,
  pending,
  onChange,
  onRemove,
}: {
  stage: PaymentStage;
  stageNumber: number;
  currency: string;
  pending: boolean;
  onChange: (changes: Partial<PaymentStage>) => void;
  onRemove: () => void;
}) {
  const idPrefix = `edit-payment-${stage.clientKey}`;

  return (
    <fieldset
      className="space-y-4 rounded-2xl border border-white/15 bg-white/[0.03] p-4"
      disabled={pending}
    >
      <legend className="px-1 text-sm font-medium text-white/85">
        Payment stage {stageNumber}
      </legend>

      <div className="flex justify-end">
        <button
          className="text-xs text-rose-100/75 transition hover:text-rose-100 disabled:opacity-50"
          onClick={onRemove}
          type="button"
        >
          Remove stage
        </button>
      </div>

      <div>
        <label className="mb-2 block text-sm text-white/75" htmlFor={`${idPrefix}-label`}>
          Stage label
        </label>
        <input
          className={INPUT_CLASS}
          id={`${idPrefix}-label`}
          maxLength={150}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="e.g. Initial payment"
          type="text"
          value={stage.label}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-white/75" htmlFor={`${idPrefix}-amount`}>
          Amount ({currency})
        </label>
        <input
          className={INPUT_CLASS}
          id={`${idPrefix}-amount`}
          inputMode="decimal"
          onChange={(event) => onChange({ amount: event.target.value })}
          placeholder="0.00"
          type="text"
          value={stage.amount}
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-white/75">Payment trigger</p>
        <CommissionSelect
          name={`${idPrefix}-trigger`}
          onChange={(value) =>
            onChange({
              trigger: value,
              customTriggerNote: value === "custom" ? stage.customTriggerNote : "",
            })
          }
          options={TRIGGER_OPTIONS}
          value={stage.trigger}
        />
      </div>

      {stage.trigger === "custom" && (
        <div>
          <label className="mb-2 block text-sm text-white/75" htmlFor={`${idPrefix}-custom`}>
            When should this payment be requested?
          </label>
          <textarea
            className={`${INPUT_CLASS} min-h-24`}
            id={`${idPrefix}-custom`}
            onChange={(event) => onChange({ customTriggerNote: event.target.value })}
            placeholder="Describe the condition for requesting this payment."
            value={stage.customTriggerNote}
          />
        </div>
      )}
    </fieldset>
  );
}

export default function CommissionPaymentPlanEditPanel({
  commissionId,
  agreementId,
  expectedAgreementUpdatedAt,
  quoteTotalAmount,
  currency,
  initialDeliverables,
  initialStages,
}: CommissionPaymentPlanEditPanelProps) {
  const router = useRouter();
  const nextClientKey = useRef(1);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [projectStages, setProjectStages] = useState<PaymentStage[]>(() =>
    initialProjectStages(initialStages),
  );
  const [deliverables, setDeliverables] = useState<PaymentDeliverable[]>(() =>
    initialDeliverableGroups(initialDeliverables, initialStages),
  );

  const closeModal = useCallback(() => setOpen(false), []);

  const runUpdateAction = useCallback(
    async (
      previousState: CommissionPaymentPlanActionState,
      formData: FormData,
    ): Promise<CommissionPaymentPlanActionState> => {
      const result = await updateCommissionGroupedPaymentPlanAction(previousState, formData);

      if (result.outcome === "success") {
        setToast(result.message);
        closeModal();
        router.refresh();
      }

      return result;
    },
    [closeModal, router],
  );

  const [state, formAction, pending] = useActionState(runUpdateAction, INITIAL_STATE);

  function openEditor(): void {
    // Discard any unsaved changes from a previous opening of the modal.
    setProjectStages(initialProjectStages(initialStages));
    setDeliverables(initialDeliverableGroups(initialDeliverables, initialStages));
    setOpen(true);
  }

  function createClientKey(prefix: string): string {
    const key = `new-${prefix}-${nextClientKey.current}`;
    nextClientKey.current += 1;
    return key;
  }

  function createEmptyStage(trigger = "before_start"): PaymentStage {
    return {
      clientKey: createClientKey("stage"),
      label: "",
      amount: "",
      trigger,
      customTriggerNote: "",
    };
  }

  function updateProjectStage(clientKey: string, changes: Partial<PaymentStage>): void {
    setProjectStages((current) =>
      current.map((stage) =>
        stage.clientKey === clientKey ? { ...stage, ...changes } : stage,
      ),
    );
  }

  function addProjectStage(): void {
    setProjectStages((current) => [...current, createEmptyStage()]);
  }

  function removeProjectStage(clientKey: string): void {
    setProjectStages((current) =>
      current.filter(
        (stage) => stage.clientKey !== clientKey,
      ),
    );
  }

  function updateDeliverable(
    clientKey: string,
    changes: Partial<PaymentDeliverable>,
  ): void {
    setDeliverables((current) =>
      current.map((deliverable) =>
        deliverable.clientKey === clientKey ? { ...deliverable, ...changes } : deliverable,
      ),
    );
  }

  function addDeliverable(): void {
    setDeliverables((current) => [
      ...current,
      {
        clientKey: createClientKey("deliverable"),
        title: "",
        description: "",
        quantity: "1",
        stages: [{ ...createEmptyStage(), label: "Initial payment" }],
      },
    ]);
  }

  function removeDeliverable(clientKey: string): void {
    setDeliverables((current) =>
      current.filter(
        (deliverable) =>
          deliverable.clientKey !== clientKey || deliverable.id !== undefined,
      ),
    );
  }

  function updateDeliverableStage(
    deliverableKey: string,
    stageKey: string,
    changes: Partial<PaymentStage>,
  ): void {
    setDeliverables((current) =>
      current.map((deliverable) =>
        deliverable.clientKey !== deliverableKey
          ? deliverable
          : {
              ...deliverable,
              stages: deliverable.stages.map((stage) =>
                stage.clientKey === stageKey ? { ...stage, ...changes } : stage,
              ),
            },
      ),
    );
  }

  function addDeliverableStage(deliverableKey: string): void {
    setDeliverables((current) =>
      current.map((deliverable) =>
        deliverable.clientKey !== deliverableKey
          ? deliverable
          : {
              ...deliverable,
              stages: [...deliverable.stages, createEmptyStage("before_final_delivery")],
            },
      ),
    );
  }

  function removeDeliverableStage(
    deliverableKey: string,
    stageKey: string,
  ): void {
    setDeliverables((current) =>
      current.map((deliverable) =>
        deliverable.clientKey !== deliverableKey
          ? deliverable
          : {
              ...deliverable,
              stages: deliverable.stages.filter(
                (stage) => stage.clientKey !== stageKey,
              ),
            },
      ),
    );
  }

  const paymentStageCount =
    projectStages.length +
    deliverables.reduce((total, deliverable) => total + deliverable.stages.length, 0);

  const canAddStage = !pending && paymentStageCount < MAX_PAYMENT_STAGES;
  const canAddDeliverable = !pending && deliverables.length < MAX_DELIVERABLES;

  const planPayload = {
    projectStages: projectStages.map(toStagePayload),
    deliverables: deliverables.map((deliverable) => ({
      ...(deliverable.id ? { id: deliverable.id } : {}),
      title: deliverable.title,
      description: deliverable.description,
      quantity: Number(deliverable.quantity),
      stages: deliverable.stages.map(toStagePayload),
    })),
  };

  return (
    <>
      <button
        className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm text-white/85 transition hover:bg-white/15"
        onClick={openEditor}
        type="button"
      >
        Edit payment plan
      </button>

      <CommissionAdminModal
        description="Edit the draft plan before requesting payments. Payment stages can be added or removed, while remaining stages keep their relative order and deliverable associations."
        onClose={closeModal}
        open={open}
        title="Edit payment plan"
      >
        <form action={formAction} className="space-y-6" noValidate>
          <input name="commissionId" type="hidden" value={commissionId} />
          <input name="agreementId" type="hidden" value={agreementId} />
          <input
            name="expectedAgreementUpdatedAt"
            type="hidden"
            value={expectedAgreementUpdatedAt}
          />
          <input name="plan" type="hidden" value={JSON.stringify(planPayload)} />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wider text-white/55">Accepted Quote total</p>
            <p className="mt-1 text-xl font-medium">
              {quoteTotalAmount} {currency}
            </p>
            <p className="mt-2 text-xs text-white/55">
              All payment stages must total this amount. Saving this plan does not request
              or collect payments.
            </p>
          </div>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Project-wide payments</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                Optional payments that apply to the overall Commission.
              </p>
            </div>

            {projectStages.map((stage, index) => (
              <PaymentStageEditor
                currency={currency}
                key={stage.clientKey}
                onChange={(changes) => updateProjectStage(stage.clientKey, changes)}
                onRemove={() => removeProjectStage(stage.clientKey)}
                pending={pending}
                stage={stage}
                stageNumber={index + 1}
              />
            ))}

            <button
              className={ADD_BUTTON_CLASS}
              disabled={!canAddStage}
              onClick={addProjectStage}
              type="button"
            >
              + Add project-wide payment
            </button>
          </section>

          <div className="border-t border-white/10" />

          <section className="space-y-5">
            <div>
              <h3 className="text-lg font-medium">Deliverables</h3>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                Edit the included work and its payment stages. New deliverables are added
                after the existing ones.
              </p>
            </div>

            {deliverables.map((deliverable, deliverableIndex) => (
              <section
                className="space-y-5 rounded-2xl border border-white/15 bg-white/[0.035] p-4"
                key={deliverable.clientKey}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/45">
                      Deliverable {deliverableIndex + 1}
                    </p>
                    {deliverable.id && (
                      <p className="mt-1 text-xs text-white/45">
                        Existing deliverable · cannot be removed
                      </p>
                    )}
                  </div>
                  {!deliverable.id && (
                    <button
                      className="text-xs text-rose-100/75 transition hover:text-rose-100 disabled:opacity-50"
                      disabled={pending}
                      onClick={() => removeDeliverable(deliverable.clientKey)}
                      type="button"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm text-white/75"
                    htmlFor={`${deliverable.clientKey}-title`}
                  >
                    Deliverable title
                  </label>
                  <input
                    className={INPUT_CLASS}
                    disabled={pending}
                    id={`${deliverable.clientKey}-title`}
                    maxLength={150}
                    onChange={(event) =>
                      updateDeliverable(deliverable.clientKey, { title: event.target.value })
                    }
                    placeholder="e.g. Illustration 1"
                    type="text"
                    value={deliverable.title}
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm text-white/75"
                    htmlFor={`${deliverable.clientKey}-quantity`}
                  >
                    Quantity
                  </label>
                  <input
                    className={INPUT_CLASS}
                    disabled={pending}
                    id={`${deliverable.clientKey}-quantity`}
                    inputMode="numeric"
                    onChange={(event) =>
                      updateDeliverable(deliverable.clientKey, {
                        quantity: event.target.value,
                      })
                    }
                    placeholder="1"
                    type="text"
                    value={deliverable.quantity}
                  />
                </div>

                <div>
                  <label
                    className="mb-2 block text-sm text-white/75"
                    htmlFor={`${deliverable.clientKey}-description`}
                  >
                    Description (optional)
                  </label>
                  <textarea
                    className={`${INPUT_CLASS} min-h-24`}
                    disabled={pending}
                    id={`${deliverable.clientKey}-description`}
                    onChange={(event) =>
                      updateDeliverable(deliverable.clientKey, {
                        description: event.target.value,
                      })
                    }
                    placeholder="Describe this deliverable."
                    value={deliverable.description}
                  />
                </div>

                <div className="border-t border-white/10 pt-4">
                  <h4 className="text-sm font-medium text-white/85">
                    Payment stages for this deliverable
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">
                    Leave this section empty if payments are covered by project-wide stages.
                  </p>
                </div>

                <div className="space-y-4">
                  {deliverable.stages.map((stage, index) => (
                    <PaymentStageEditor
                      currency={currency}
                      key={stage.clientKey}
                      onChange={(changes) =>
                        updateDeliverableStage(deliverable.clientKey, stage.clientKey, changes)
                      }
                      onRemove={() =>
                        removeDeliverableStage(deliverable.clientKey, stage.clientKey)
                      }
                      pending={pending}
                      stage={stage}
                      stageNumber={index + 1}
                    />
                  ))}
                </div>

                <button
                  className={ADD_BUTTON_CLASS}
                  disabled={!canAddStage}
                  onClick={() => addDeliverableStage(deliverable.clientKey)}
                  type="button"
                >
                  + Add payment stage
                </button>
              </section>
            ))}

            <button
              className={ADD_BUTTON_CLASS}
              disabled={!canAddDeliverable}
              onClick={addDeliverable}
              type="button"
            >
              + Add deliverable
            </button>
          </section>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-wider text-white/50">Plan summary</p>
            <p className="mt-2 text-sm text-white/80">
              {deliverables.length} {deliverables.length === 1 ? "deliverable" : "deliverables"}
              {" · "}
              {paymentStageCount} {paymentStageCount === 1 ? "payment stage" : "payment stages"}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              All payment stages must total {quoteTotalAmount} {currency}.
            </p>
          </div>

          {(state.outcome === "error" || state.outcome === "conflict") && (
            <p className="text-sm text-rose-200" role="alert">
              {state.message}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
            <button
              className={SECONDARY_BUTTON_CLASS}
              disabled={pending}
              onClick={closeModal}
              type="button"
            >
              Close
            </button>
            <button
              className="rounded-xl border border-white/20 bg-white/15 px-5 py-3 text-sm transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending || paymentStageCount === 0}
              type="submit"
            >
              {pending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </CommissionAdminModal>

      <CommissionAdminToast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
