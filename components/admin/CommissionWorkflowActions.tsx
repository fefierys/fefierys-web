"use client";

import { useCallback, useState } from "react";

import { isTerminalCommissionStatus } from "@/lib/commissions/commissionWorkflow";
import type { CommissionStatus } from "@/lib/repositories/commissionAdminRepository";

import CommissionAdminModal from "./CommissionAdminModal";
import CommissionAdminToast from "./CommissionAdminToast";
import CommissionHoldForm from "./CommissionHoldForm";
import CommissionStatusForm from "./CommissionStatusForm";

interface CommissionWorkflowActionsProps {
  commissionId: string;
  currentStatus: CommissionStatus;
  isOnHold: boolean;
}

type WorkflowModal = "hold" | "status" | null;

export default function CommissionWorkflowActions({
  commissionId,
  currentStatus,
  isOnHold,
}: CommissionWorkflowActionsProps) {
  const [modal, setModal] = useState<WorkflowModal>(null);
  const [toast, setToast] = useState<string | null>(null);

  const closeModal = useCallback(() => setModal(null), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const finishAction = useCallback((message: string) => {
    setModal(null);
    setToast(message);
  }, []);

  if (isTerminalCommissionStatus(currentStatus)) {
    return (
      <p className="mt-6 border-t border-white/10 pt-5 text-sm text-white/55">
        This commission is closed and has no available workflow actions.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-3 border-t border-white/10 pt-6">
        <button
          className={`w-full rounded-xl border px-4 py-3 text-sm transition ${
            isOnHold
              ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-50 hover:bg-emerald-200/15"
              : "border-amber-200/20 bg-amber-200/10 text-amber-50 hover:bg-amber-200/15"
          }`}
          onClick={() => setModal("hold")}
          type="button"
        >
          {isOnHold ? "Resume commission" : "Pause commission"}
        </button>

        <button
          className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15"
          onClick={() => setModal("status")}
          type="button"
        >
          Update status
        </button>
      </div>

      <CommissionAdminModal
        description={
          isOnHold
            ? "Resume work or client communication without changing the workflow status."
            : "Temporarily stop workflow progress without changing the current status."
        }
        onClose={closeModal}
        open={modal === "hold"}
        title={isOnHold ? "Resume commission" : "Pause commission"}
      >
        <CommissionHoldForm
          commissionId={commissionId}
          currentStatus={currentStatus}
          isOnHold={isOnHold}
          onSuccess={finishAction}
          variant="dialog"
        />
      </CommissionAdminModal>

      <CommissionAdminModal
        description="Choose the next workflow state and record who initiated the change."
        onClose={closeModal}
        open={modal === "status"}
        title="Update commission status"
      >
        <CommissionStatusForm
          commissionId={commissionId}
          confirmationVariant="inline"
          currentStatus={currentStatus}
          isOnHold={isOnHold}
          onSuccess={() =>
            finishAction("Commission status updated successfully.")
          }
          variant="dialog"
        />
      </CommissionAdminModal>

      <CommissionAdminToast message={toast} onDismiss={dismissToast} />
    </>
  );
}
