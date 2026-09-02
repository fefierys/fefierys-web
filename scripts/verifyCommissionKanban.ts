import { deepEqual, equal, ok } from "node:assert/strict";

import {
  COMMISSION_KANBAN_COLUMNS,
  COMMISSION_KANBAN_COLUMN_LIMIT,
  getCommissionKanbanColumn,
} from "../lib/commissions/commissionKanban";
import { COMMISSION_STATUSES } from "../lib/commissions/commissionStatus";
import { TERMINAL_COMMISSION_STATUSES } from "../lib/commissions/commissionWorkflow";

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

  ok(
    Number.isInteger(COMMISSION_KANBAN_COLUMN_LIMIT) &&
      COMMISSION_KANBAN_COLUMN_LIMIT > 0,
  );

  console.log("[OK] Kanban column limit is valid");
  console.log("[OK] Commission Kanban verification passed");
}

main();
