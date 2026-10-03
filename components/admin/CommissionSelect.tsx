"use client";

import { useEffect, useRef, useState } from "react";

interface CommissionSelectOption {
  label: string;
  value: string;
}

interface CommissionSelectProps {
  disabled?: boolean;
  name: string;
  onChange: (value: string) => void;
  options: readonly CommissionSelectOption[];
  value: string;
}

export default function CommissionSelect({
  disabled = false,
  name,
  onChange,
  options,
  value,
}: CommissionSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      optionRefs.current.get(value)?.focus();
    });

    function handlePointerDown(event: PointerEvent): void {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, value]);

  function selectOption(optionValue: string): void {
    onChange(optionValue);
    setOpen(false);
  }

  function moveFocus(offset: number): void {
    const currentIndex = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    const nextIndex = (currentIndex + offset + options.length) % options.length;
    const nextOption = options[nextIndex];

    if (nextOption) {
      onChange(nextOption.value);
      optionRefs.current.get(nextOption.value)?.focus();
    }
  }

  return (
    <div
      className="relative min-w-0"
      data-commission-select-open={open ? "true" : undefined}
      ref={containerRef}
    >
      <input name={name} type="hidden" value={value} />

      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#5966A5]/80 px-4 py-3 text-left text-sm text-white outline-none transition hover:bg-[#6471ad]/85 focus-visible:ring-2 focus-visible:ring-white/35 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        type="button"
      >
        <span className="min-w-0 truncate">
          {selectedOption?.label ?? "Select an option"}
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-white/65 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          aria-label={name}
          className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-white/15 bg-[#7880b2]/95 p-1.5 shadow-[0_18px_50px_rgba(32,38,82,0.3)] backdrop-blur-2xl"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(-1);
            } else if (event.key === "Home") {
              event.preventDefault();
              const firstOption = options[0];
              if (firstOption) {
                onChange(firstOption.value);
                optionRefs.current.get(firstOption.value)?.focus();
              }
            } else if (event.key === "End") {
              event.preventDefault();
              const lastOption = options[options.length - 1];
              if (lastOption) {
                onChange(lastOption.value);
                optionRefs.current.get(lastOption.value)?.focus();
              }
            }
          }}
          role="listbox"
        >
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                aria-selected={selected}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  selected
                    ? "bg-white/15 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
                key={option.value}
                onClick={() => selectOption(option.value)}
                ref={(element) => {
                  if (element) {
                    optionRefs.current.set(option.value, element);
                  } else {
                    optionRefs.current.delete(option.value);
                  }
                }}
                role="option"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <span>{option.label}</span>
                {selected && (
                  <span aria-hidden="true" className="text-sky-100">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
