"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  createCommissionQuoteDraftAction,
  updateCommissionQuoteDraftAction,
  type CommissionQuoteActionState,
} from "@/app/admin/(protected)/commissions/actions";
import {
  formatCommissionQuoteAmount,
  MAX_COMMISSION_QUOTE_ITEMS,
  MAX_COMMISSION_QUOTE_ITEM_QUANTITY,
  MAX_COMMISSION_QUOTE_TEXT_LENGTH,
  parseCommissionQuoteAmount,
  validateCommissionQuoteDraft,
} from "@/lib/commissions/commissionQuote";
import type { CommissionQuoteWithItems } from "@/lib/repositories/commissionQuoteRepository";

import CommissionQuoteDateTimePicker from "./CommissionQuoteDateTimePicker";

interface CommissionQuoteEditorProps {
  commissionId: string;
  draft?: CommissionQuoteWithItems | null;
  onCancel: () => void;
  onSuccess: (message: string) => void;
}

interface EditableQuoteItem {
  key: string;
  label: string;
  description: string;
  quantity: string;
  unitAmount: string;
}

interface EditorErrors {
  currency?: string;
  general?: string;
  validUntil?: string;
  items: Record<
    string,
    {
      label?: string;
      quantity?: string;
      unitAmount?: string;
    }
  >;
}

const emptyErrors: EditorErrors = {
  items: {},
};

const initialState: CommissionQuoteActionState = {
  outcome: "idle",
  message: null,
};

const COMMISSION_TIME_ZONE = "America/Santiago";

type DatePart = "day" | "hour" | "minute" | "month" | "second" | "year";

function createItemKey(): string {
  return crypto.randomUUID();
}

function createEmptyItem(): EditableQuoteItem {
  return {
    key: createItemKey(),
    label: "",
    description: "",
    quantity: "1",
    unitAmount: "0.00",
  };
}

function toEndOfDayLocal(date: Date | null): string {
  if (!date) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: COMMISSION_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  const getPart = (type: DatePart): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function toIsoDate(value: string): string {
  if (!value) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return value;
  }

  const [, yearValue, monthValue, dayValue] = match;
  const wallClockUtc = Date.UTC(
    Number(yearValue),
    Number(monthValue) - 1,
    Number(dayValue),
    23,
    59,
    59,
    999,
  );

  function getOffset(timestamp: number): number {
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

    const getPart = (type: DatePart): number =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);

    const representedAsUtc = Date.UTC(
      getPart("year"),
      getPart("month") - 1,
      getPart("day"),
      getPart("hour"),
      getPart("minute"),
      getPart("second"),
    );

    return representedAsUtc - Math.floor(timestamp / 1000) * 1000;
  }

  let timestamp = wallClockUtc - getOffset(wallClockUtc);
  timestamp = wallClockUtc - getOffset(timestamp);

  return new Date(timestamp).toISOString();
}

function getInitialItems(
  draft?: CommissionQuoteWithItems | null,
): EditableQuoteItem[] {
  if (!draft || draft.items.length === 0) {
    return [createEmptyItem()];
  }

  return draft.items.map((item) => ({
    key: item.id,
    label: item.label,
    description: item.description ?? "",
    quantity: item.quantity.toString(),
    unitAmount: item.unitAmount,
  }));
}

function calculateLineTotal(item: EditableQuoteItem): bigint | null {
  const amount = parseCommissionQuoteAmount(item.unitAmount);
  const quantity = Number(item.quantity);

  if (
    amount === null ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_COMMISSION_QUOTE_ITEM_QUANTITY
  ) {
    return null;
  }

  return amount * BigInt(quantity);
}

export default function CommissionQuoteEditor({
  commissionId,
  draft = null,
  onCancel,
  onSuccess,
}: CommissionQuoteEditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const submissionStarted = useRef(false);
  const wasPending = useRef(false);

  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [currency, setCurrency] = useState(draft?.quote.currency ?? "USD");
  const [description, setDescription] = useState(
    draft?.quote.description ?? "",
  );
  const [notes, setNotes] = useState(draft?.quote.notes ?? "");
  const [validUntil, setValidUntil] = useState(
    toEndOfDayLocal(draft?.quote.validUntil ?? null),
  );
  const [items, setItems] = useState<EditableQuoteItem[]>(() =>
    getInitialItems(draft),
  );
  const [errors, setErrors] = useState<EditorErrors>(emptyErrors);

  const action = draft
    ? updateCommissionQuoteDraftAction
    : createCommissionQuoteDraftAction;

  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }

    if (wasPending.current) {
      wasPending.current = false;
      submissionStarted.current = false;
      setSubmissionLocked(false);
    }
  }, [pending]);

  useEffect(() => {
    if (state.outcome === "success" && state.message) {
      onSuccess(state.message);
    }
  }, [onSuccess, state.message, state.outcome]);

  const serializedItems = useMemo(
    () =>
      JSON.stringify(
        items.map((item) => ({
          label: item.label,
          description: item.description || null,
          quantity: Number(item.quantity),
          unitAmount: item.unitAmount,
        })),
      ),
    [items],
  );

  const total = useMemo(() => {
    let minorUnits = BigInt(0);

    for (const item of items) {
      const lineTotal = calculateLineTotal(item);

      if (lineTotal === null) {
        return null;
      }

      minorUnits += lineTotal;
    }

    return minorUnits;
  }, [items]);

  function updateItem(
    key: string,
    field: keyof Omit<EditableQuoteItem, "key">,
    value: string,
  ): void {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.key === key ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItem(): void {
    setItems((currentItems) => {
      if (currentItems.length >= MAX_COMMISSION_QUOTE_ITEMS) {
        return currentItems;
      }

      return [...currentItems, createEmptyItem()];
    });
  }

  function removeItem(key: string): void {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems;
      }

      return currentItems.filter((item) => item.key !== key);
    });
  }

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>): void {
    if (submissionStarted.current) {
      event.preventDefault();
      return;
    }

    const nextErrors: EditorErrors = { items: {} };
    const validation = validateCommissionQuoteDraft({
      currency,
      description,
      notes,
      validUntil: validUntil ? new Date(toIsoDate(validUntil)) : null,
      items: items.map((item) => ({
        label: item.label,
        description: item.description,
        quantity: Number(item.quantity),
        unitAmount: item.unitAmount,
      })),
    });

    if (!validation.valid) {
      event.preventDefault();

      const itemMatch = validation.message.match(/quote item (\d+)/i);
      const item = itemMatch ? items[Number(itemMatch[1]) - 1] : undefined;

      if (validation.code === "currency_invalid") {
        nextErrors.currency = validation.message;
      } else if (validation.code === "valid_until_invalid") {
        nextErrors.validUntil = validation.message;
      } else if (item) {
        const itemErrors = (nextErrors.items[item.key] ??= {});

        if (
          validation.code === "item_label_required" ||
          validation.code === "item_label_too_long"
        ) {
          itemErrors.label =
            validation.code === "item_label_required"
              ? "Complete this field."
              : validation.message;
        } else if (validation.code === "item_quantity_invalid") {
          itemErrors.quantity = "Enter a whole number between 1 and 10,000.";
        } else if (
          validation.code === "item_amount_invalid" ||
          validation.code === "item_total_too_large"
        ) {
          itemErrors.unitAmount =
            validation.code === "item_amount_invalid"
              ? item.unitAmount.trim()
                ? "Enter an amount with up to 2 decimal places."
                : "Complete this field."
              : validation.message;
        } else {
          nextErrors.general = validation.message;
        }
      } else {
        nextErrors.general = validation.message;
      }

      setErrors(nextErrors);

      window.setTimeout(() => {
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      });

      return;
    }

    setErrors(emptyErrors);
    submissionStarted.current = true;
    setSubmissionLocked(true);
  }

  const submitting = pending || submissionLocked;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="min-w-0"
      noValidate
      onSubmit={handleSubmit}
    >
      <input name="commissionId" type="hidden" value={commissionId} />
      <input name="items" type="hidden" value={serializedItems} />
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

      {(errors.general || (state.message && state.outcome !== "success")) && (
        <p
          aria-live="polite"
          className={`mb-5 rounded-xl border px-3 py-2.5 text-sm ${
            state.outcome === "conflict"
              ? "border-amber-200/20 bg-amber-200/10 text-amber-100"
              : "border-red-200/20 bg-red-200/10 text-red-100"
          }`}
        >
          {errors.general ?? state.message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-sm text-white/70">Currency</span>
          <input
            aria-invalid={Boolean(errors.currency)}
            autoCapitalize="characters"
            className={`min-w-0 rounded-xl border bg-white/5 px-3 py-2.5 text-sm uppercase text-white outline-none ${
              errors.currency ? "border-red-300/50" : "border-white/15"
            }`}
            maxLength={3}
            name="currency"
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            placeholder="USD"
            required
            value={currency}
          />
          {errors.currency && (
            <span className="text-xs text-red-200">{errors.currency}</span>
          )}
        </label>

        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm text-white/70">
            Valid through (optional)
          </span>
          <CommissionQuoteDateTimePicker
            disabled={submitting}
            error={errors.validUntil}
            onChange={setValidUntil}
            value={validUntil}
          />
        </div>
      </div>

      <label className="mt-4 flex flex-col gap-2">
        <span className="text-sm text-white/70">Description (optional)</span>
        <textarea
          className="min-h-20 resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none"
          maxLength={MAX_COMMISSION_QUOTE_TEXT_LENGTH}
          name="description"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </label>

      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-white/90">Quote items</h4>
          <button
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs transition hover:bg-white/10 disabled:opacity-50"
            disabled={items.length >= MAX_COMMISSION_QUOTE_ITEMS || submitting}
            onClick={addItem}
            type="button"
          >
            Add item
          </button>
        </div>

        {items.map((item, index) => {
          const lineTotal = calculateLineTotal(item);
          const itemErrors = errors.items[item.key];

          return (
            <fieldset
              className="min-w-0 rounded-xl border border-white/10 p-3"
              disabled={submitting}
              key={item.key}
            >
              <div className="flex items-center justify-between gap-3">
                <legend className="px-1 text-xs uppercase tracking-[0.12em] text-white/45">
                  Item {index + 1}
                </legend>
                <button
                  className="text-xs text-red-200/70 transition hover:text-red-200 disabled:opacity-40"
                  disabled={items.length === 1}
                  onClick={() => removeItem(item.key)}
                  type="button"
                >
                  Remove
                </button>
              </div>

              <label className="mt-3 flex min-w-0 flex-col gap-2">
                <span className="text-sm text-white/70">Label</span>
                <input
                  aria-invalid={Boolean(itemErrors?.label)}
                  className={`min-w-0 rounded-xl border bg-white/5 px-3 py-2.5 text-sm text-white outline-none ${
                    itemErrors?.label ? "border-red-300/50" : "border-white/15"
                  }`}
                  maxLength={250}
                  onChange={(event) =>
                    updateItem(item.key, "label", event.target.value)
                  }
                  required
                  value={item.label}
                />
                {itemErrors?.label && (
                  <span className="text-xs text-red-200">
                    {itemErrors.label}
                  </span>
                )}
              </label>

              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm text-white/70">Quantity</span>
                  <input
                    aria-invalid={Boolean(itemErrors?.quantity)}
                    className={`min-w-0 rounded-xl border bg-white/5 px-3 py-2.5 text-sm text-white outline-none ${
                      itemErrors?.quantity
                        ? "border-red-300/50"
                        : "border-white/15"
                    }`}
                    inputMode="numeric"
                    max={MAX_COMMISSION_QUOTE_ITEM_QUANTITY}
                    min={1}
                    onChange={(event) =>
                      updateItem(item.key, "quantity", event.target.value)
                    }
                    required
                    step={1}
                    type="number"
                    value={item.quantity}
                  />
                  {itemErrors?.quantity && (
                    <span className="text-xs text-red-200">
                      {itemErrors.quantity}
                    </span>
                  )}
                </label>

                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-sm text-white/70">Unit amount</span>
                  <input
                    aria-invalid={Boolean(itemErrors?.unitAmount)}
                    className={`min-w-0 rounded-xl border bg-white/5 px-3 py-2.5 text-sm text-white outline-none ${
                      itemErrors?.unitAmount
                        ? "border-red-300/50"
                        : "border-white/15"
                    }`}
                    inputMode="decimal"
                    onChange={(event) =>
                      updateItem(item.key, "unitAmount", event.target.value)
                    }
                    placeholder="0.00"
                    required
                    value={item.unitAmount}
                  />
                  {itemErrors?.unitAmount && (
                    <span className="text-xs text-red-200">
                      {itemErrors.unitAmount}
                    </span>
                  )}
                </label>
              </div>

              <label className="mt-3 flex flex-col gap-2">
                <span className="text-sm text-white/70">
                  Item description (optional)
                </span>
                <textarea
                  className="min-h-16 resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none"
                  maxLength={MAX_COMMISSION_QUOTE_TEXT_LENGTH}
                  onChange={(event) =>
                    updateItem(item.key, "description", event.target.value)
                  }
                  value={item.description}
                />
              </label>

              <p className="mt-3 text-right text-sm text-white/60">
                Line total:{" "}
                {lineTotal === null
                  ? "—"
                  : formatCommissionQuoteAmount(lineTotal)}{" "}
                {currency}
              </p>
            </fieldset>
          );
        })}
      </div>

      <label className="mt-4 flex flex-col gap-2">
        <span className="text-sm text-white/70">Internal notes (optional)</span>
        <textarea
          className="min-h-20 resize-y rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none"
          maxLength={MAX_COMMISSION_QUOTE_TEXT_LENGTH}
          name="notes"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </label>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
        <span className="text-sm text-white/60">Draft total</span>
        <strong className="text-lg font-medium text-white">
          {total === null ? "—" : formatCommissionQuoteAmount(total)} {currency}
        </strong>
      </div>

      <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col-reverse gap-3 border-t border-white/10 bg-[#7880b2]/90 px-5 pb-1 pt-4 backdrop-blur-xl sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0">
        <button
          className="rounded-xl border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
          disabled={submitting}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className="rounded-xl border border-sky-200/25 bg-sky-200/15 px-5 py-3 text-sm text-sky-50 transition hover:bg-sky-200/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitting}
          type="submit"
        >
          {submitting
            ? "Saving..."
            : draft
              ? "Save quote draft"
              : "Create quote draft"}
        </button>
      </div>
    </form>
  );
}
