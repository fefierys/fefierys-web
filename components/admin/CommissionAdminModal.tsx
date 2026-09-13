"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface CommissionAdminModalProps {
  children: React.ReactNode;
  description?: string;
  footer?: React.ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function CommissionAdminModal({
  children,
  description,
  footer,
  onClose,
  open,
  title,
}: CommissionAdminModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleEscape(event: KeyboardEvent): void {
      if (
        event.key === "Escape" &&
        !document.querySelector(
          '[data-commission-select-open="true"], [data-commission-date-picker-open="true"]',
        )
      ) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, open]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
    );

    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    open ? (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#35436d]/70 p-3 sm:p-6">
        <div
          aria-describedby={
            description ? "commission-admin-modal-description" : undefined
          }
          aria-labelledby="commission-admin-modal-title"
          aria-modal="true"
          className="flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#7880b2] text-white shadow-[0_25px_75px_rgba(32,38,82,0.3)] sm:max-h-[90dvh] sm:max-w-5xl sm:rounded-3xl"
          onKeyDown={handleKeyDown}
          ref={panelRef}
          role="dialog"
        >
          <header className="flex shrink-0 items-start justify-between gap-5 border-b border-white/10 bg-white/[0.03] px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0">
              <h2
                className="text-xl font-light"
                id="commission-admin-modal-title"
              >
                {title}
              </h2>
              {description && (
                <p
                  className="mt-1 text-xs leading-relaxed text-white/55"
                  id="commission-admin-modal-description"
                >
                  {description}
                </p>
              )}
            </div>

            <button
              aria-label="Close dialog"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              ×
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [scrollbar-gutter:stable] sm:px-7 sm:py-6">
            {children}
          </div>

          <div className="shrink-0" id="commission-admin-modal-footer-root">
            {footer}
          </div>
        </div>
      </div>
    ) : null,
    document.body,
  );
}
