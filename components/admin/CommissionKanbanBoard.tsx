"use client";

import {
  DragDropProvider,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import CommissionKanbanTransitionDialog from "@/components/admin/CommissionKanbanTransitionDialog";
import DroppableCommissionKanbanColumn from "@/components/admin/DroppableCommissionKanbanColumn";
import {
  COMMISSION_KANBAN_COLUMNS,
  getCommissionKanbanTransitionStatuses,
} from "@/lib/commissions/commissionKanban";
import {
  isCommissionKanbanCardDragData,
  isCommissionKanbanColumnDropData,
} from "@/lib/commissions/commissionKanbanDrag";
import type {
  CommissionStatus,
  CommissionStatusCounts,
} from "@/lib/repositories/commissionAdminRepository";
import type {
  AdminCommissionKanbanBoard,
  AdminCommissionKanbanCard,
} from "@/lib/repositories/commissionKanbanRepository";

interface CommissionKanbanBoardProps {
  board: AdminCommissionKanbanBoard;
  counts: CommissionStatusCounts;
}

interface CommissionTransitionRequest {
  commission: AdminCommissionKanbanCard;
  availableStatuses?: readonly CommissionStatus[];
  initialStatus?: CommissionStatus;
}

export default function CommissionKanbanBoard({
  board,
  counts,
}: CommissionKanbanBoardProps) {
  const router = useRouter();

  const [activeStatus, setActiveStatus] = useState<CommissionStatus | null>(
    null,
  );

  const [transitionRequest, setTransitionRequest] =
    useState<CommissionTransitionRequest | null>(null);

  const commissionsById = useMemo(
    () =>
      new Map(
        COMMISSION_KANBAN_COLUMNS.flatMap((column) =>
          board[column.id].items.map(
            (commission) => [commission.id, commission] as const,
          ),
        ),
      ),
    [board],
  );

  const closeTransitionDialog = useCallback(() => {
    setTransitionRequest(null);
  }, []);

  const handleTransitionSuccess = useCallback(() => {
    setTransitionRequest(null);
    router.refresh();
  }, [router]);

  function handleDragStart(event: DragStartEvent): void {
    const sourceData = event.operation.source?.data;

    if (!isCommissionKanbanCardDragData(sourceData)) {
      setActiveStatus(null);
      return;
    }

    setActiveStatus(sourceData.status);
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveStatus(null);

    if (event.canceled) {
      return;
    }

    const sourceData = event.operation.source?.data;
    const targetData = event.operation.target?.data;

    if (
      !isCommissionKanbanCardDragData(sourceData) ||
      !isCommissionKanbanColumnDropData(targetData)
    ) {
      return;
    }

    const commission = commissionsById.get(sourceData.commissionId);

    if (!commission || commission.status !== sourceData.status) {
      router.refresh();
      return;
    }

    const availableStatuses = getCommissionKanbanTransitionStatuses(
      sourceData.status,
      targetData.columnId,
    );

    const initialStatus = availableStatuses[0];

    if (!initialStatus) {
      return;
    }

    setTransitionRequest({
      commission,
      availableStatuses,
      initialStatus,
    });
  }

  function handleChangeStatus(commission: AdminCommissionKanbanCard): void {
    setTransitionRequest({
      commission,
    });
  }

  return (
    <>
      <DragDropProvider onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <section aria-label="Commission workflow board">
          <div className="pb-6 md:-mx-6 md:overflow-x-auto md:px-6">
            <div className="grid gap-5 md:flex md:min-w-max md:snap-x md:snap-mandatory">
              {COMMISSION_KANBAN_COLUMNS.map((column) => {
                const result = board[column.id];

                const total = column.statuses.reduce(
                  (sum, status) => sum + counts[status],
                  0,
                );

                return (
                  <DroppableCommissionKanbanColumn
                    activeStatus={activeStatus}
                    column={column}
                    key={column.id}
                    onChangeStatus={handleChangeStatus}
                    result={result}
                    total={total}
                  />
                );
              })}
            </div>
          </div>
        </section>
      </DragDropProvider>

      {transitionRequest && (
        <CommissionKanbanTransitionDialog
          availableStatuses={transitionRequest.availableStatuses}
          commission={transitionRequest.commission}
          initialStatus={transitionRequest.initialStatus}
          key={`${transitionRequest.commission.id}-${transitionRequest.commission.status}-${transitionRequest.initialStatus ?? "all"}`}
          onClose={closeTransitionDialog}
          onSuccess={handleTransitionSuccess}
        />
      )}
    </>
  );
}
