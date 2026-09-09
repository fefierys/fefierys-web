"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  createCommissionQuoteDraftAction,
  updateCommissionQuoteDraftAction,
  type CommissionQuoteActionState,
} from "@/app/admin/(protected)/commissions/actions";
import { buildCommissionQuotePricingSnapshot } from "@/lib/commissions/commissionQuotePricing";
import type {
  CommissionQuotePricingEditorAdjustment,
  CommissionQuotePricingEditorConfig,
} from "@/lib/commissions/commissionQuotePricingEditor";
import type { CommissionQuoteWithItems } from "@/lib/repositories/commissionQuoteRepository";

import CommissionQuoteDateTimePicker from "./CommissionQuoteDateTimePicker";

interface CommissionPricedQuoteEditorProps {
  commissionId: string;
  config: CommissionQuotePricingEditorConfig;
  draft?: CommissionQuoteWithItems | null;
  onCancel: () => void;
  onSuccess: (message: string) => void;
}

interface EditableCustomItem {
  description: string;
  key: string;
  label: string;
  quantity: string;
  unitAmount: string;
}

interface EditableAdjustment {
  internalNote: string;
  percentageRate: string;
  quantity: string;
  selected: boolean;
}

const initialActionState: CommissionQuoteActionState = {
  message: null,
  outcome: "idle",
};

const COMMISSION_TIME_ZONE = "America/Santiago";

type DatePart = "day" | "hour" | "minute" | "month" | "second" | "year";

function createCustomItem(): EditableCustomItem {
  return {
    description: "",
    key: crypto.randomUUID(),
    label: "",
    quantity: "1",
    unitAmount: "0.00",
  };
}

function getInitialCustomItems(
  draft: CommissionQuoteWithItems | null | undefined,
  mode: CommissionQuotePricingEditorConfig["mode"],
): EditableCustomItem[] {
  const items =
    draft?.items
      .filter((item) => item.kind === "custom")
      .map((item) => ({
        description: item.description ?? "",
        key: item.id,
        label: item.label,
        quantity: item.quantity.toString(),
        unitAmount: item.unitAmount,
      })) ?? [];

  return items.length > 0 || mode === "catalog" ? items : [createCustomItem()];
}

function getInitialAdjustments(
  adjustments: readonly CommissionQuotePricingEditorAdjustment[],
  draft?: CommissionQuoteWithItems | null,
): Record<string, EditableAdjustment> {
  return Object.fromEntries(
    adjustments.map((adjustment) => {
      const item = draft?.items.find(
        (candidate) => candidate.pricingAdjustmentId === adjustment.id,
      );

      return [
        adjustment.id,
        {
          internalNote: item?.internalNote ?? "",
          percentageRate:
            item?.percentageRate ?? adjustment.percentageRate ?? "",
          quantity: item?.quantity.toString() ?? "1",
          selected: Boolean(item),
        },
      ];
    }),
  );
}

function toEndOfDayLocal(date: Date | null): string {
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: COMMISSION_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const part = (type: string): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function toIsoDate(value: string): string {
  if (!value) return "";

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const wallClockUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
    999,
  );
  const getOffset = (timestamp: number): number => {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: COMMISSION_TIME_ZONE,
      year: "numeric",
    }).formatToParts(new Date(timestamp));
    const part = (type: DatePart): number =>
      Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);

    return (
      Date.UTC(
        part("year"),
        part("month") - 1,
        part("day"),
        part("hour"),
        part("minute"),
        part("second"),
      ) -
      Math.floor(timestamp / 1000) * 1000
    );
  };
  let timestamp = wallClockUtc - getOffset(wallClockUtc);
  timestamp = wallClockUtc - getOffset(timestamp);

  return new Date(timestamp).toISOString();
}

function adjustmentValue(adjustment: CommissionQuotePricingEditorAdjustment) {
  return adjustment.calculationType === "fixed"
    ? `${adjustment.fixedAmount ?? "0.00"} USD`
    : `${adjustment.percentageRate ?? "Variable"}%`;
}

export default function CommissionPricedQuoteEditor({
  commissionId,
  config,
  draft = null,
  onCancel,
  onSuccess,
}: CommissionPricedQuoteEditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const [description, setDescription] = useState(
    draft?.quote.description ?? "",
  );
  const [notes, setNotes] = useState(draft?.quote.notes ?? "");
  const [validUntil, setValidUntil] = useState(
    toEndOfDayLocal(draft?.quote.validUntil ?? null),
  );
  const [customItems, setCustomItems] = useState(() =>
    getInitialCustomItems(draft, config.mode),
  );
  const [adjustments, setAdjustments] = useState(() =>
    getInitialAdjustments(
      config.mode === "catalog" ? config.adjustments : [],
      draft,
    ),
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const [footerRoot, setFooterRoot] = useState<HTMLElement | null>(null);
  const formId = `commission-priced-quote-form-${commissionId}`;
  const action = draft
    ? updateCommissionQuoteDraftAction
    : createCommissionQuoteDraftAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFooterRoot(
        document.getElementById("commission-admin-modal-footer-root"),
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!pending) submitted.current = false;
  }, [pending]);

  useEffect(() => {
    if (state.outcome === "success" && state.message) onSuccess(state.message);
  }, [onSuccess, state.message, state.outcome]);

  const normalizedCustomItems = useMemo(
    () =>
      customItems.map((item) => ({
        description: item.description || null,
        key: item.key,
        label: item.label,
        quantity: Number(item.quantity),
        unitAmount: item.unitAmount,
      })),
    [customItems],
  );
  const selectedAdjustments = useMemo(
    () =>
      config.mode === "catalog"
        ? config.adjustments
            .filter((adjustment) => adjustments[adjustment.id]?.selected)
            .map((adjustment) => ({
              adjustmentId: adjustment.id,
              internalNote: adjustments[adjustment.id]?.internalNote || null,
              percentageRate:
                adjustments[adjustment.id]?.percentageRate || null,
              quantity: Number(adjustments[adjustment.id]?.quantity ?? "1"),
            }))
        : [],
    [adjustments, config],
  );
  const pricingSelection = useMemo(
    () =>
      config.mode === "catalog"
        ? {
            customItems: normalizedCustomItems,
            mode: "catalog" as const,
            selectedAdjustments,
          }
        : {
            customItems: normalizedCustomItems,
            mode: "custom" as const,
          },
    [config.mode, normalizedCustomItems, selectedAdjustments],
  );

  const preview = useMemo(
    () =>
      config.mode === "catalog"
        ? buildCommissionQuotePricingSnapshot({
            adjustments: config.adjustments,
            customItems: normalizedCustomItems,
            mode: "catalog",
            option: config.option,
            pricingVersionId: config.pricingVersionId,
            selectedAdjustments,
          })
        : buildCommissionQuotePricingSnapshot({
            customItems: normalizedCustomItems,
            mode: "custom",
          }),
    [config, normalizedCustomItems, selectedAdjustments],
  );

  function updateCustomItem(
    key: string,
    field: Exclude<keyof EditableCustomItem, "key">,
    value: string,
  ): void {
    setCustomItems((items) =>
      items.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  }

  function updateAdjustment(
    id: string,
    changes: Partial<EditableAdjustment>,
  ): void {
    setAdjustments((current) => ({
      ...current,
      [id]: { ...current[id], ...changes } as EditableAdjustment,
    }));
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
    if (submitted.current || !preview.valid) {
      event.preventDefault();
      setClientError(
        preview.valid
          ? "Please wait while your quote is being saved."
          : preview.message,
      );
      return;
    }

    submitted.current = true;
    setClientError(null);
  }

  const error =
    clientError ?? (state.outcome === "success" ? null : state.message);

  return (
    <form
      action={formAction}
      className="min-w-0"
      id={formId}
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <input name="commissionId" type="hidden" value={commissionId} />
      <input
        name="pricingSelection"
        type="hidden"
        value={JSON.stringify(pricingSelection)}
      />
      <input name="validUntil" type="hidden" value={toIsoDate(validUntil)} />
      {draft && (
        <>
          <input name="quoteId" type="hidden" value={draft.quote.id} />
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={draft.quote.updatedAt.toISOString()}
          />
        </>
      )}

      {error && (
        <p className="mb-5 rounded-xl border border-red-200/20 bg-red-200/10 px-3 py-2.5 text-sm text-red-100">
          {error}
        </p>
      )}

      {config.mode === "catalog" && (
        <>
          <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-white/45">
              Classified service
            </p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium text-white">
                  {config.option.quoteLabel}
                </h4>
                {config.option.description && (
                  <p className="mt-1 text-xs leading-relaxed text-white/55">
                    {config.option.description}
                  </p>
                )}
              </div>
              <strong className="shrink-0 text-white">
                {config.option.baseAmount} USD
              </strong>
            </div>
          </section>

          {config.adjustments.length > 0 && (
            <section className="mt-5">
              <h4 className="text-sm font-medium text-white/90">
                Extras, licenses and discounts
              </h4>
              <div className="mt-3 space-y-3">
                {config.adjustments.map((adjustment) => {
                  const value = adjustments[adjustment.id];
                  return (
                    <div
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      key={adjustment.id}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          checked={value?.selected ?? false}
                          className="mt-1 h-4 w-4 accent-[#aeb8ff]"
                          disabled={pending}
                          onChange={(event) =>
                            updateAdjustment(adjustment.id, {
                              selected: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex justify-between gap-3 text-sm">
                            <span>{adjustment.name}</span>
                            <span className="shrink-0 text-white/65">
                              {adjustmentValue(adjustment)}
                            </span>
                          </span>
                          {adjustment.description && (
                            <span className="mt-1 block text-xs leading-relaxed text-white/45">
                              {adjustment.description}
                            </span>
                          )}
                        </span>
                      </label>

                      {value?.selected && (
                        <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-2">
                          {adjustment.maxQuantity !== 1 && (
                            <label className="text-xs text-white/60">
                              Quantity
                              <input
                                className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                                max={adjustment.maxQuantity ?? 10000}
                                min={1}
                                onChange={(event) =>
                                  updateAdjustment(adjustment.id, {
                                    quantity: event.target.value,
                                  })
                                }
                                type="number"
                                value={value.quantity}
                              />
                            </label>
                          )}
                          {adjustment.isValueEditable && (
                            <label className="text-xs text-white/60">
                              Percentage
                              <input
                                className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                                inputMode="decimal"
                                max={adjustment.maximumPercentageRate ?? 100}
                                min={adjustment.minimumPercentageRate ?? 0}
                                onChange={(event) =>
                                  updateAdjustment(adjustment.id, {
                                    percentageRate: event.target.value,
                                  })
                                }
                                type="number"
                                value={value.percentageRate}
                              />
                            </label>
                          )}
                          {adjustment.requiresInternalNote && (
                            <label className="text-xs text-white/60 sm:col-span-2">
                              Reason for this adjustment
                              <textarea
                                className="mt-1.5 min-h-16 w-full resize-y rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                                onChange={(event) =>
                                  updateAdjustment(adjustment.id, {
                                    internalNote: event.target.value,
                                  })
                                }
                                placeholder="Add a short note for your records."
                                value={value.internalNote}
                              />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <section className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-white/90">
              {config.mode === "custom"
                ? "Custom services"
                : "Specific request charges"}
            </h4>
            <p className="mt-1 text-xs text-white/45">
              {config.mode === "custom"
                ? "Describe and price the work agreed with the client."
                : "Add only work that is not represented in the catalog."}
            </p>
          </div>
          <button
            className="rounded-lg border border-white/15 px-3 py-2 text-xs hover:bg-white/10"
            disabled={pending || customItems.length >= 50}
            onClick={() =>
              setCustomItems((items) => [...items, createCustomItem()])
            }
            type="button"
          >
            Add custom item
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {customItems.map((item, index) => (
            <fieldset
              className="rounded-xl border border-white/10 p-3"
              disabled={pending}
              key={item.key}
            >
              <div className="flex items-center justify-between">
                <legend className="px-1 text-xs uppercase tracking-[0.12em] text-white/45">
                  Custom item {index + 1}
                </legend>
                <button
                  className="text-xs text-red-200/70 hover:text-red-200"
                  disabled={
                    config.mode === "custom" && customItems.length === 1
                  }
                  onClick={() =>
                    setCustomItems((items) =>
                      items.filter((candidate) => candidate.key !== item.key),
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
              <input
                className="mt-3 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                onChange={(event) =>
                  updateCustomItem(item.key, "label", event.target.value)
                }
                placeholder="Service or specific request"
                value={item.label}
              />
              <div className="mt-3 grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] gap-3">
                <input
                  className="min-w-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                  min={1}
                  onChange={(event) =>
                    updateCustomItem(item.key, "quantity", event.target.value)
                  }
                  placeholder="Quantity"
                  type="number"
                  value={item.quantity}
                />
                <input
                  className="min-w-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                  inputMode="decimal"
                  onChange={(event) =>
                    updateCustomItem(item.key, "unitAmount", event.target.value)
                  }
                  placeholder="Unit amount"
                  value={item.unitAmount}
                />
              </div>
              <textarea
                className="mt-3 min-h-16 w-full resize-y rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                onChange={(event) =>
                  updateCustomItem(item.key, "description", event.target.value)
                }
                placeholder="Description (optional)"
                value={item.description}
              />
            </fieldset>
          ))}
        </div>
      </section>

      <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <span className="block text-sm text-white/70">
            Valid through (optional)
          </span>
          <div className="mt-2">
            <CommissionQuoteDateTimePicker
              disabled={pending}
              onChange={setValidUntil}
              value={validUntil}
            />
          </div>
        </div>
        <label className="min-w-0 text-sm text-white/70">
          Quote description (optional)
          <textarea
            className="mt-2 min-h-20 w-full resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm text-white/70">
        Internal notes (optional)
        <textarea
          className="mt-2 min-h-20 w-full resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
          name="notes"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </label>

      <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        {preview.valid ? (
          <>
            <div className="space-y-2 text-sm text-white/65">
              {preview.snapshot.items.map((item) => (
                <div
                  className="flex justify-between gap-4"
                  key={`${item.sequence}-${item.label}`}
                >
                  <span>{item.label}</span>
                  <span className="shrink-0">{item.lineAmount} USD</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-white/10 pt-4">
              <strong>Draft total</strong>
              <strong>{preview.snapshot.totalAmount} USD</strong>
            </div>
          </>
        ) : (
          <p className="text-sm text-white/55">
            Complete the pricing details to see the final total.
          </p>
        )}
      </section>

      {footerRoot
        ? createPortal(
            <div className="flex flex-col-reverse gap-3 border-t border-white/10 bg-[#7880b2] px-5 py-4 sm:flex-row sm:justify-end sm:px-7 sm:py-5">
              <button
                className="rounded-xl border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                disabled={pending}
                onClick={onCancel}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl border border-sky-200/25 bg-sky-200/15 px-5 py-3 text-sm text-sky-50 transition hover:bg-sky-200/20 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending}
                form={formId}
                type="submit"
              >
                {pending
                  ? "Saving..."
                  : draft
                    ? "Save quote draft"
                    : "Create quote draft"}
              </button>
            </div>,
            footerRoot,
          )
        : null}
    </form>
  );
}
