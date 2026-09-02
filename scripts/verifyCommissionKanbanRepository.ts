import { equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main() {
  const { inArray } = await import("drizzle-orm");
  const { COMMISSION_KANBAN_COLUMNS } =
    await import("../lib/commissions/commissionKanban");
  const { getCommissionKanbanColumn } =
    await import("../lib/commissions/commissionKanban");
  const { db } = await import("../lib/db");
  const { commissions } = await import("../lib/db/schema/commissions");
  const { getAdminCommissionKanban } =
    await import("../lib/repositories/commissionKanbanRepository");

  const verificationId = randomUUID();
  const createdIds: string[] = [];
  const expectedTopIdByColumn = new Map<string, string>();

  try {
    const fixtures = COMMISSION_KANBAN_COLUMNS.flatMap(
      (column, columnIndex) => {
        const primaryId = randomUUID();
        const primaryDate = new Date(Date.UTC(2099, 0, 1, 0, columnIndex, 1));

        createdIds.push(primaryId);
        expectedTopIdByColumn.set(column.id, primaryId);

        const primaryFixture = {
          id: primaryId,
          submissionId: randomUUID(),
          reference: `COM-20990101-${randomUUID()
            .replaceAll("-", "")
            .slice(0, 6)
            .toUpperCase()}`,
          clientName: `Kanban ${column.label} Verification`,
          clientEmail: `kanban-${column.id}-${verificationId}@example.com`,
          styleSnapshot: "Verification Style",
          categorySnapshot: "Verification Category",
          optionSnapshot: "Verification Option",
          initialMessage: `Temporary ${column.id} Kanban verification`,
          status: column.statuses[0],
          submittedAt: primaryDate,
          createdAt: primaryDate,
          updatedAt: primaryDate,
        };

        if (column.id !== "inbox") {
          return [primaryFixture];
        }

        const newestInboxId = randomUUID();
        const newestInboxDate = new Date(primaryDate.getTime() + 1000);

        createdIds.push(newestInboxId);
        expectedTopIdByColumn.set("inbox", newestInboxId);

        return [
          primaryFixture,
          {
            ...primaryFixture,
            id: newestInboxId,
            submissionId: randomUUID(),
            reference: `COM-20990101-${randomUUID()
              .replaceAll("-", "")
              .slice(0, 6)
              .toUpperCase()}`,
            clientName: "Kanban Inbox Newest Verification",
            clientEmail: `kanban-inbox-newest-${verificationId}@example.com`,
            submittedAt: newestInboxDate,
            createdAt: newestInboxDate,
            updatedAt: newestInboxDate,
          },
        ];
      },
    );

    await db.insert(commissions).values(fixtures);

    console.log("[OK] Temporary Kanban commissions were created");

    const board = await getAdminCommissionKanban(1);

    for (const column of COMMISSION_KANBAN_COLUMNS) {
      const result = board[column.id];
      const card = result.items[0];

      ok(card, `${column.label} did not return a card`);
      equal(
        card.id,
        expectedTopIdByColumn.get(column.id),
        `${column.label} was not ordered by updatedAt DESC`,
      );
      equal(getCommissionKanbanColumn(card.status).id, column.id);
      equal("clientEmail" in card, false);
      equal("initialMessage" in card, false);
    }

    console.log("[OK] Every Kanban column returns minimized data");

    equal(board.inbox.items.length, 1);
    equal(board.inbox.hasMore, true);

    console.log("[OK] Column limit and hasMore are valid");

    const defaultBoard = await getAdminCommissionKanban();

    for (const column of COMMISSION_KANBAN_COLUMNS) {
      ok(
        defaultBoard[column.id].items.some(
          (card) => card.id === expectedTopIdByColumn.get(column.id),
        ),
      );
    }

    console.log("[OK] Default Kanban query includes every fixture");
    console.log("[OK] Commission Kanban repository verification passed");
  } finally {
    if (createdIds.length > 0) {
      await db.delete(commissions).where(inArray(commissions.id, createdIds));

      const remainingRows = await db
        .select({
          id: commissions.id,
        })
        .from(commissions)
        .where(inArray(commissions.id, createdIds));

      equal(remainingRows.length, 0);
      console.log("[OK] Temporary Kanban data was removed");
    }
  }
}

main().catch((error: unknown) => {
  console.error("Commission Kanban repository verification failed:", error);
  process.exitCode = 1;
});
