"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface CommissionQuoteDateTimePickerProps {
  disabled?: boolean;
  error?: string;
  onChange: (value: string) => void;
  value: string;
}

interface PickerPosition {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function toLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function parseLocalValue(value: string): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function createInitialSelection(value: string): Date {
  const current = parseLocalValue(value);

  if (current) {
    return current;
  }

  const date = new Date();

  date.setDate(date.getDate() + 7);
  date.setHours(23, 59, 59, 999);

  return date;
}

function formatDisplayValue(value: string): string {
  const date = parseLocalValue(value);

  if (!date) {
    return "Select date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

export default function CommissionQuoteDateTimePicker({
  disabled = false,
  error,
  onChange,
  value,
}: CommissionQuoteDateTimePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const [selection, setSelection] = useState(() =>
    createInitialSelection(value),
  );
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selection.getFullYear(), selection.getMonth(), 1),
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [visibleMonth]);

  function updatePosition(): void {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();

    const modal = trigger.closest<HTMLElement>('[role="dialog"]');
    const modalRect = modal?.getBoundingClientRect();

    const viewportMargin = 12;
    const modalMargin = 12;
    const gap = 8;

    const leftBoundary = modalRect
      ? Math.max(modalRect.left + modalMargin, viewportMargin)
      : viewportMargin;

    const rightBoundary = modalRect
      ? Math.min(
          modalRect.right - modalMargin,
          window.innerWidth - viewportMargin,
        )
      : window.innerWidth - viewportMargin;

    const topBoundary = modalRect
      ? Math.max(modalRect.top + modalMargin, viewportMargin)
      : viewportMargin;

    const bottomBoundary = modalRect
      ? Math.min(
          modalRect.bottom - modalMargin,
          window.innerHeight - viewportMargin,
        )
      : window.innerHeight - viewportMargin;

    /*
    * El calendario usa exactamente el ancho del input,
    * salvo que no haya espacio suficiente.
    */
    const width = Math.min(
      triggerRect.width,
      rightBoundary - leftBoundary,
    );

    const left = Math.min(
      Math.max(triggerRect.left, leftBoundary),
      rightBoundary - width,
    );

    const availableBelow =
      bottomBoundary - triggerRect.bottom - gap;

    const availableAbove =
      triggerRect.top - topBoundary - gap;

    /*
    * El calendario compacto necesita aprox. 340px.
    */
    const preferredHeight = 340;

    const fitsBelow = availableBelow >= preferredHeight;
    const fitsAbove = availableAbove >= preferredHeight;

    const openBelow =
      fitsBelow ||
      (!fitsAbove && availableBelow >= availableAbove);

    const availableHeight = Math.max(
      0,
      openBelow ? availableBelow : availableAbove,
    );

    const height = Math.min(
      preferredHeight,
      availableHeight,
    );

    const top = openBelow
      ? triggerRect.bottom + gap
      : triggerRect.top - gap - height;

    setPosition({
      left,
      maxHeight: height,
      top,
      width,
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) ||
        pickerRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setOpen(false);
      triggerRef.current?.focus();
    }

    function handleViewportChange(): void {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  function openPicker(): void {
    if (open) {
      setOpen(false);
      return;
    }

    const nextSelection = createInitialSelection(value);

    setSelection(nextSelection);
    setVisibleMonth(
      new Date(nextSelection.getFullYear(), nextSelection.getMonth(), 1),
    );
    setOpen(true);

    window.requestAnimationFrame(() => {
      triggerRef.current?.scrollIntoView({
        block: "center",
        inline: "nearest",
      });

      window.requestAnimationFrame(updatePosition);
    });
  }

  function selectDay(day: number): void {
    const nextSelection = new Date(selection);

    nextSelection.setFullYear(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day,
    );

    setSelection(nextSelection);
  }

  function changeMonth(offset: number): void {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function applySelection(): void {
    const endOfDay = new Date(selection);

    endOfDay.setHours(23, 59, 59, 999);

    onChange(toLocalValue(endOfDay));
    setOpen(false);
    triggerRef.current?.focus();
  }

  const monthLabel = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);

  const today = new Date();

  const picker =
    mounted && open && position
      ? createPortal(
          <div
            aria-label="Choose quote validity date"
            data-commission-date-picker-open="true"
            className="fixed z-[1100] overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-[#7880b2] p-3 shadow-[0_22px_65px_rgba(32,38,82,0.3)]"
            ref={pickerRef}
            role="dialog"
            style={{
              left: position.left,
              maxHeight: position.maxHeight,
              top: position.top,
              width: position.width,
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                onClick={() => changeMonth(-1)}
                type="button"
              >
                ‹
              </button>

              <p className="text-sm font-medium text-white">{monthLabel}</p>

              <button
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                onClick={() => changeMonth(1)}
                type="button"
              >
                ›
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((day) => (
                <span
                  className="py-1 text-[0.65rem] uppercase tracking-[0.08em] text-white/40"
                  key={day}
                >
                  {day}
                </span>
              ))}

              {days.map((day, index) => {
                if (day === null) {
                  return <span key={`empty-${index}`} />;
                }

                const selected =
                  selection.getFullYear() === visibleMonth.getFullYear() &&
                  selection.getMonth() === visibleMonth.getMonth() &&
                  selection.getDate() === day;

                const isToday =
                  today.getFullYear() === visibleMonth.getFullYear() &&
                  today.getMonth() === visibleMonth.getMonth() &&
                  today.getDate() === day;

                return (
                  <button
                    aria-pressed={selected}
                    className={`h-7 rounded-lg text-xs transition ${
                      selected
                        ? "bg-[#aeb8ef] font-medium text-[#26305c]"
                        : isToday
                          ? "border border-sky-200/35 bg-sky-200/10 text-sky-50"
                          : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                    key={day}
                    onClick={() => selectDay(day)}
                    type="button"
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-relaxed text-white/50">
              Valid through the end of the selected day.
            </p>

            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                className="text-xs text-white/55 transition hover:text-white"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                type="button"
              >
                Clear
              </button>

              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-white/15 px-3 py-2 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="rounded-xl border border-sky-200/25 bg-sky-200/15 px-4 py-2 text-xs text-sky-50 transition hover:bg-sky-200/20"
                  onClick={applySelection}
                  type="button"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="min-w-0">
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border bg-white/5 px-3 py-2.5 text-left text-sm outline-none transition ${
            error
              ? "border-red-300/50 text-red-50"
              : "border-white/15 text-white hover:bg-white/[0.08]"
          }`}
          disabled={disabled}
          onClick={openPicker}
          ref={triggerRef}
          type="button"
        >
          <span
            className={`min-w-0 truncate ${
              value ? "text-white" : "text-white/45"
            }`}
          >
            {formatDisplayValue(value)}
          </span>

          <span aria-hidden="true" className="shrink-0 text-white/55">
            ◫
          </span>
        </button>

        {error && <p className="mt-1.5 text-xs text-red-200">{error}</p>}
      </div>

      {picker}
    </>
  );
}