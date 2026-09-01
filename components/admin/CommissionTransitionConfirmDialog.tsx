"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

import { COMMISSION_STATUS_LABELS } from "@/lib/commissions/commissionStatus";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

import { createPortal } from "react-dom";

interface CommissionTransitionConfirmDialogProps {
  open: boolean;
  pending: boolean;
  status: CommissionStatus;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function CommissionTransitionConfirmDialog({
  open,
  pending,
  status,
  onCancel,
  onConfirm,
}: CommissionTransitionConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape" && !pending) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onCancel, open, pending]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Tab") {
      return;
    }

    if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
      event.preventDefault();
      confirmButtonRef.current?.focus();
    }

    if (
      !event.shiftKey &&
      document.activeElement === confirmButtonRef.current
    ) {
      event.preventDefault();
      cancelButtonRef.current?.focus();
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#6b6fa8]/55 p-5 backdrop-blur-lg"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={() => {
            if (!pending) {
              onCancel();
            }
          }}
        >
          <motion.div
            aria-describedby="commission-transition-description"
            aria-labelledby="commission-transition-title"
            aria-modal="true"
            className="w-full max-w-md rounded-4xl border border-white/10 bg-[#3A4D84]/80 p-7 text-white shadow-[0_30px_80px_rgba(30,30,70,0.35)] backdrop-blur-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={handleKeyDown}
            role="dialog"
            transition={{ duration: 0.2 }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200/20 bg-amber-200/10 text-xl text-amber-100">
              !
            </div>

            <h2
              className="mt-5 text-2xl font-light"
              id="commission-transition-title"
            >
              Confirm status change
            </h2>

            <p
              className="mt-3 leading-relaxed text-white/75"
              id="commission-transition-description"
            >
              This commission will move to{" "}
              <strong className="font-medium text-white">
                {COMMISSION_STATUS_LABELS[status]}
              </strong>
              . Terminal transitions cannot be reversed from the dashboard.
            </p>

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                disabled={pending}
                onClick={onCancel}
                ref={cancelButtonRef}
                type="button"
              >
                Go back
              </button>

              <button
                className="rounded-xl border border-rose-200/20 bg-rose-200/15 px-5 py-3 text-sm text-rose-50 transition hover:bg-rose-200/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-100/50 disabled:opacity-50"
                disabled={pending}
                onClick={onConfirm}
                ref={confirmButtonRef}
                type="button"
              >
                {pending ? "Updating..." : "Confirm transition"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
