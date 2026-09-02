"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import CommissionStatusBadge from "@/components/admin/CommissionStatusBadge";
import CommissionStatusForm from "@/components/admin/CommissionStatusForm";
import { COMMISSION_STATUS_LABELS } from "@/lib/commissions/commissionStatus";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";
import type { AdminCommissionKanbanCard } from "@/lib/repositories/commissionKanbanRepository";

interface CommissionKanbanTransitionDialogProps {
  commission: AdminCommissionKanbanCard;
  availableStatuses?: readonly CommissionStatus[];
  initialStatus?: CommissionStatus;
  onClose: () => void;
  onSuccess: () => void;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "input:not([type='hidden']):not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function CommissionKanbanTransitionDialog({
  commission,
  availableStatuses,
  initialStatus,
  onClose,
  onSuccess,
}: CommissionKanbanTransitionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
      previouslyFocusedElement?.focus();
    };
  }, [onClose]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
        [],
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }

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
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#6b6fa8]/55 p-4 backdrop-blur-lg sm:p-6"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
      >
        <motion.div
          ref={dialogRef}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          aria-describedby="commission-kanban-transition-description"
          aria-labelledby="commission-kanban-transition-title"
          aria-modal="true"
          className="my-auto w-full max-w-lg rounded-4xl border border-white/10 bg-[#3A4D84]/90 p-6 text-white shadow-[0_30px_80px_rgba(30,30,70,0.35)] backdrop-blur-2xl sm:p-7"
          exit={{ opacity: 0, scale: 0.97, y: 10 }}
          initial={{ opacity: 0, scale: 0.97, y: 10 }}
          onKeyDown={handleKeyDown}
          role="dialog"
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-white/45">
                Commission workflow
              </p>

              <h2
                className="mt-2 text-2xl font-light"
                id="commission-kanban-transition-title"
              >
                Change status
              </h2>
            </div>

            <button
              ref={closeButtonRef}
              aria-label="Close status dialog"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-lg text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>

          <div
            className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4"
            id="commission-kanban-transition-description"
          >
            <p className="break-words font-medium">{commission.clientName}</p>
            <p className="mt-1 break-all text-xs text-white/45">
              {commission.reference}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/65">
              <span>Current status:</span>
              <CommissionStatusBadge status={commission.status} />
            </div>

            {initialStatus && (
              <p className="mt-3 text-sm text-white/65">
                Suggested destination:{" "}
                <strong className="font-medium text-white">
                  {COMMISSION_STATUS_LABELS[initialStatus]}
                </strong>
              </p>
            )}
          </div>

          <div className="mt-6">
            <CommissionStatusForm
              availableStatuses={availableStatuses}
              commissionId={commission.id}
              currentStatus={commission.status}
              initialStatus={initialStatus}
              onSuccess={onSuccess}
              variant="dialog"
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
