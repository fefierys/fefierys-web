"use client";

import { useDraggable } from "@dnd-kit/react";

import CommissionKanbanCard from "@/components/admin/CommissionKanbanCard";
import {
  getCommissionKanbanCardDragId,
  type CommissionKanbanDragData,
} from "@/lib/commissions/commissionKanbanDrag";
import type { AdminCommissionKanbanCard } from "@/lib/repositories/commissionKanbanRepository";

interface DraggableCommissionKanbanCardProps {
  commission: AdminCommissionKanbanCard;
  disabled: boolean;
  onChangeStatus: () => void;
}

export default function DraggableCommissionKanbanCard({
  commission,
  disabled,
  onChangeStatus,
}: DraggableCommissionKanbanCardProps) {
  const { handleRef, isDragging, ref } = useDraggable<CommissionKanbanDragData>(
    {
      id: getCommissionKanbanCardDragId(commission.id),
      type: "commission",
      data: {
        kind: "commission",
        commissionId: commission.id,
        status: commission.status,
      },
      disabled,
    },
  );

  return (
    <div ref={(element) => ref(element)}>
      <CommissionKanbanCard
        commission={commission}
        dragHandleRef={disabled ? undefined : (element) => handleRef(element)}
        dragging={isDragging}
        onChangeStatus={disabled ? undefined : onChangeStatus}
      />
    </div>
  );
}
