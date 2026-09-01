import { equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main() {
  const { eq, inArray } = await import("drizzle-orm");
  const { db } = await import("../lib/db");
  const { commissionEvents, commissions, commissionStatusHistory } =
    await import("../lib/db/schema/commissions");
  const {
    getAdminCommissionDetail,
    getAdminCommissionPage,
    getCommissionStatusCounts,
  } = await import("../lib/repositories/commissionAdminRepository");
  const { createCommission } =
    await import("../lib/repositories/commissionRepository");

  const baselineCounts = await getCommissionStatusCounts();
  const createdIds: string[] = [];

  try {
    const timestamps = [
      new Date("2099-01-03T12:00:00.000Z"),
      new Date("2099-01-02T12:00:00.000Z"),
      new Date("2099-01-01T12:00:00.000Z"),
    ];

    for (const [index, submittedAt] of timestamps.entries()) {
      const marker = randomUUID();
      const created = await createCommission({
        submissionId: randomUUID(),
        clientName: `Admin Query Verification ${index + 1}`,
        clientEmail: `admin-query-${marker}@example.com`,
        initialMessage: `Temporary admin query verification ${marker}`,
        termsVersion: "2026.1",
        agreementVersion: null,
      });

      createdIds.push(created.id);

      await db
        .update(commissions)
        .set({
          submittedAt,
          updatedAt: submittedAt,
        })
        .where(eq(commissions.id, created.id));
    }

    const [firstId, secondId, thirdId] = createdIds;

    ok(firstId);
    ok(secondId);
    ok(thirdId);

    const counts = await getCommissionStatusCounts();

    equal(counts.received, baselineCounts.received + createdIds.length);
    equal(counts.completed, baselineCounts.completed);

    console.log("[OK] Status counts include zero and populated statuses");

    const firstPage = await getAdminCommissionPage({
      status: "received",
      limit: 2,
    });

    equal(firstPage.items.length, 2);
    const [firstItem, secondItem] = firstPage.items;
    ok(firstItem);
    ok(secondItem);
    equal(firstItem.id, firstId);
    equal(secondItem.id, secondId);
    equal("clientEmail" in firstItem, false);
    equal("initialMessage" in firstItem, false);

    const nextCursor = firstPage.nextCursor;
    ok(nextCursor, "First page did not return a cursor");

    console.log("[OK] Admin summary page is ordered and data-minimized");

    const secondPage = await getAdminCommissionPage({
      status: "received",
      limit: 2,
      cursor: nextCursor,
    });

    equal(secondPage.items[0]?.id, thirdId);

    console.log("[OK] Cursor pagination is stable");

    const detail = await getAdminCommissionDetail(firstId);

    ok(detail, "Admin commission detail was not found");
    equal(detail.commission.id, firstId);
    equal(detail.statusHistory.length, 1);
    equal(detail.statusHistory[0]?.toStatus, "received");
    equal(detail.events.length, 1);
    equal(detail.events[0]?.type, "commission_received");

    console.log("[OK] Admin detail includes history and events");

    const missingDetail = await getAdminCommissionDetail(randomUUID());

    equal(missingDetail, null);

    console.log("[OK] Missing admin detail returns null");
    console.log("[OK] Commission admin query verification passed");
  } finally {
    if (createdIds.length > 0) {
      await db.batch([
        db
          .delete(commissionEvents)
          .where(inArray(commissionEvents.commissionId, createdIds)),
        db
          .delete(commissionStatusHistory)
          .where(inArray(commissionStatusHistory.commissionId, createdIds)),
        db.delete(commissions).where(inArray(commissions.id, createdIds)),
      ]);

      const remainingRows = await db
        .select({
          id: commissions.id,
        })
        .from(commissions)
        .where(inArray(commissions.id, createdIds));

      equal(remainingRows.length, 0);

      const restoredCounts = await getCommissionStatusCounts();
      equal(restoredCounts.received, baselineCounts.received);

      console.log("[OK] Temporary admin query data was removed");
    }
  }
}

main().catch((error: unknown) => {
  console.error("Commission admin query verification failed:", error);
  process.exitCode = 1;
});
