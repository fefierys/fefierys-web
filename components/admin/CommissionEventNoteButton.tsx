"use client";

import { useCallback, useState } from "react";

import CommissionAdminModal from "./CommissionAdminModal";
import CommissionAdminToast from "./CommissionAdminToast";
import CommissionNoteForm from "./CommissionNoteForm";

interface CommissionEventNoteButtonProps {
  commissionId: string;
}

export default function CommissionEventNoteButton({
  commissionId,
}: CommissionEventNoteButtonProps) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const closeModal = useCallback(() => setOpen(false), []);
  const dismissToast = useCallback(() => setToast(null), []);
  const finishAction = useCallback((message: string) => {
    setOpen(false);
    setToast(message);
  }, []);

  return (
    <>
      <button
        className="shrink-0 rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2 text-xs transition hover:bg-white/[0.13]"
        onClick={() => setOpen(true)}
        type="button"
      >
        Add note
      </button>

      <CommissionAdminModal
        description="Notes are private administrative timeline entries."
        onClose={closeModal}
        open={open}
        title="Add commission note"
      >
        <CommissionNoteForm
          commissionId={commissionId}
          onSuccess={finishAction}
          variant="dialog"
        />
      </CommissionAdminModal>

      <CommissionAdminToast message={toast} onDismiss={dismissToast} />
    </>
  );
}
