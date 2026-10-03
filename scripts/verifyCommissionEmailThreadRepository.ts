import { equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Run this script with .env.local loaded.",
    );
  }

  const { db } = await import("../lib/db");
  const {
    commissionEmailThreads,
    commissions,
  } = await import("../lib/db/schema/commissions");
  const {
    createCommissionEmailThreadIfMissing,
    getCommissionEmailThreadByCommissionId,
  } = await import("../lib/repositories/commissionEmailRepository");

  const commissionIds: string[] = [];

  function createReference(prefix: string): string {
    return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  }

  async function createFixtureCommission(reference: string): Promise<string> {
    const id = randomUUID();

    await db.insert(commissions).values({
      id,
      submissionId: randomUUID(),
      reference,
      clientName: "Email Thread Verification",
      clientEmail: "email-thread-verification@example.com",
      initialMessage:
        "Temporary fixture created by verifyCommissionEmailThreadRepository.",
    });

    commissionIds.push(id);

    return id;
  }

  try {
    const firstReference = createReference("EMAIL");
    const firstCommissionId = await createFixtureCommission(firstReference);
    const firstSubject = `Fefierys Art — Your project — ${firstReference}`;

    const firstCreate = await createCommissionEmailThreadIfMissing({
      commissionId: firstCommissionId,
      subject: firstSubject,
    });

    equal(firstCreate.created, true);
    equal(firstCreate.thread.commissionId, firstCommissionId);
    equal(firstCreate.thread.subject, firstSubject);
    equal(firstCreate.thread.rootProviderEmailId, null);
    equal(firstCreate.thread.rootMessageId, null);

    console.log("[OK] First thread creation creates one thread");

    const fetchedThread = await getCommissionEmailThreadByCommissionId(
      firstCommissionId,
    );

    ok(fetchedThread);
    equal(fetchedThread.id, firstCreate.thread.id);
    equal(fetchedThread.subject, firstSubject);

    console.log("[OK] Thread can be fetched by commission id");

    const repeatedCreate = await createCommissionEmailThreadIfMissing({
      commissionId: firstCommissionId,
      subject: firstSubject,
    });

    equal(repeatedCreate.created, false);
    equal(repeatedCreate.thread.id, firstCreate.thread.id);

    console.log("[OK] Repeated creation reuses the existing thread");

    const differentSubjectCreate =
      await createCommissionEmailThreadIfMissing({
        commissionId: firstCommissionId,
        subject: "This subject must not replace the established subject",
      });

    equal(differentSubjectCreate.created, false);
    equal(differentSubjectCreate.thread.id, firstCreate.thread.id);
    equal(differentSubjectCreate.thread.subject, firstSubject);

    console.log("[OK] Existing thread subject remains stable");

    const concurrentReference = createReference("RACE");
    const concurrentCommissionId =
      await createFixtureCommission(concurrentReference);
    const concurrentSubject =
      `Fefierys Art — Your project — ${concurrentReference}`;

    const concurrentResults = await Promise.all(
      Array.from(
        { length: 8 },
        () =>
          createCommissionEmailThreadIfMissing({
            commissionId: concurrentCommissionId,
            subject: concurrentSubject,
          }),
      ),
    );

    equal(
      concurrentResults.filter((result) => result.created).length,
      1,
    );

    const concurrentThreadIds = new Set(
      concurrentResults.map((result) => result.thread.id),
    );

    equal(concurrentThreadIds.size, 1);

    const persistedConcurrentRows = await db
      .select()
      .from(commissionEmailThreads)
      .where(
        eq(
          commissionEmailThreads.commissionId,
          concurrentCommissionId,
        ),
      );

    equal(persistedConcurrentRows.length, 1);
    equal(persistedConcurrentRows[0]?.subject, concurrentSubject);

    console.log(
      "[OK] Concurrent creation produces exactly one persisted thread",
    );

    console.log(
      "[OK] Commission email thread repository verification passed",
    );
  } finally {
    if (commissionIds.length > 0) {
      await db
        .delete(commissionEmailThreads)
        .where(
          inArray(
            commissionEmailThreads.commissionId,
            commissionIds,
          ),
        );

      await db
        .delete(commissions)
        .where(inArray(commissions.id, commissionIds));
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    "[ERROR] Commission email thread repository verification failed",
    error,
  );
  process.exitCode = 1;
});
