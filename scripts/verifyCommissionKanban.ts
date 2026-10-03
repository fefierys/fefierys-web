import { deepEqual, equal, ok } from "node:assert/strict";

import {
  COMMISSION_KANBAN_COLUMNS,
  COMMISSION_KANBAN_COLUMN_LIMIT,
  getCommissionKanbanColumn,
  getCommissionKanbanDropColumns,
  getCommissionKanbanTransitionStatuses,
} from "../lib/commissions/commissionKanban";
import { COMMISSION_STATUSES } from "../lib/commissions/commissionStatus";
import { TERMINAL_COMMISSION_STATUSES } from "../lib/commissions/commissionWorkflow";

import {
  getCommissionKanbanCardDragId,
  getCommissionKanbanColumnDropId,
  isCommissionKanbanCardDragData,
  isCommissionKanbanColumnDropData,
} from "../lib/commissions/commissionKanbanDrag";

function main(): void {
  const columnIds = COMMISSION_KANBAN_COLUMNS.map((column) => column.id);

  equal(
    new Set(columnIds).size,
    columnIds.length,
    "Kanban column IDs must be unique.",
  );

  console.log("[OK] Kanban column IDs are unique");

  const assignedStatuses = COMMISSION_KANBAN_COLUMNS.flatMap((column) => [
    ...column.statuses,
  ]);

  equal(
    assignedStatuses.length,
    COMMISSION_STATUSES.length,
    "Every status must be assigned exactly once.",
  );

  deepEqual(
    [...new Set(assignedStatuses)].sort(),
    [...COMMISSION_STATUSES].sort(),
  );

  console.log("[OK] Every commission status is assigned exactly once");

  for (const status of COMMISSION_STATUSES) {
    const column = getCommissionKanbanColumn(status);

    ok(
      (column.statuses as readonly string[]).includes(status),
      `${status} was resolved to the wrong column.`,
    );
  }

  console.log("[OK] Every status resolves to its Kanban column");

  for (const status of TERMINAL_COMMISSION_STATUSES) {
    equal(
      getCommissionKanbanColumn(status).id,
      "closed",
      `${status} must belong to the closed column.`,
    );
  }

  console.log("[OK] Terminal statuses belong to the closed column");

  deepEqual(getCommissionKanbanTransitionStatuses("received", "inbox"), [
    "under_review",
  ]);

  deepEqual(getCommissionKanbanTransitionStatuses("received", "quote"), []);

  console.log("[OK] Internal and forbidden Kanban transitions are valid");

  deepEqual(
    getCommissionKanbanDropColumns("received").map((column) => column.id),
    ["closed"],
  );

  deepEqual(
    getCommissionKanbanDropColumns("under_review").map((column) => column.id),
    ["quote", "closed"],
  );

  deepEqual(
    getCommissionKanbanDropColumns("awaiting_payment").map(
      (column) => column.id,
    ),
    ["production", "final", "closed"],
  );

  console.log("[OK] Kanban drop destinations follow the workflow");

  for (const status of TERMINAL_COMMISSION_STATUSES) {
    deepEqual(
      getCommissionKanbanDropColumns(status),
      [],
      `${status} must not have a Kanban drop destination.`,
    );
  }

  console.log("[OK] Terminal statuses have no Kanban drop destinations");

  equal(
    getCommissionKanbanCardDragId("commission-id"),
    "commission:commission-id",
  );

  equal(getCommissionKanbanColumnDropId("quote"), "column:quote");

  ok(
    isCommissionKanbanCardDragData({
      kind: "commission",
      commissionId: "commission-id",
      status: "under_review",
    }),
  );

  equal(
    isCommissionKanbanCardDragData({
      kind: "commission",
      commissionId: "commission-id",
      status: "invalid_status",
    }),
    false,
  );

  ok(
    isCommissionKanbanColumnDropData({
      kind: "column",
      columnId: "closed",
    }),
  );

  equal(
    isCommissionKanbanColumnDropData({
      kind: "column",
      columnId: "unknown",
    }),
    false,
  );

  console.log("[OK] Kanban drag-and-drop data is validated");

  ok(
    Number.isInteger(COMMISSION_KANBAN_COLUMN_LIMIT) &&
      COMMISSION_KANBAN_COLUMN_LIMIT > 0,
  );

  console.log("[OK] Kanban column limit is valid");
  console.log("[OK] Commission Kanban verification passed");
}

main();
