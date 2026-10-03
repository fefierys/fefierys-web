"use client";

import { useEffect } from "react";

interface CommissionAdminToastProps {
  message: string | null;
  onDismiss: () => void;
}

export default function CommissionAdminToast({
  message,
  onDismiss,
}: CommissionAdminToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(onDismiss, 5000);

    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="fixed left-4 right-4 top-24 z-[120] mx-auto flex max-w-md items-start justify-between gap-4 rounded-2xl border border-emerald-100/25 bg-[#7880b2]/80 px-4 py-3 text-sm text-emerald-50 shadow-[0_15px_45px_rgba(32,38,82,0.25)] backdrop-blur-2xl sm:left-auto sm:right-6"
      role="status"
    >
      <span>✓ {message}</span>
      <button
        aria-label="Dismiss notification"
        className="shrink-0 text-white/55 transition hover:text-white"
        onClick={onDismiss}
        type="button"
      >
        ×
      </button>
    </div>
  );
}
