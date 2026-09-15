import {
  equal,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  inArray,
} from "drizzle-orm";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Run this script with .env.local loaded.",
    );
  }

  const { db } =
    await import("../lib/db");
  const {
    commissionEmailThreads,
    commissions,
  } = await import(
    "../lib/db/schema/commissions"
  );
  const {
    createCommissionEmailThreadIfMissing,
    getCommissionEmailThreadById,
    setCommissionEmailThreadRootMessageId,
    setCommissionEmailThreadRootProvider,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );

  const commissionIds: string[] =
    [];

  async function createFixture(): Promise<{
    commissionId: string;
    threadId: string;
  }> {
    const commissionId =
      randomUUID();
    const reference =
      `ROOT-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 12)
        .toUpperCase()}`;
    const subject =
      `Fefierys Art — Your project — ${reference}`;

    await db
      .insert(commissions)
      .values({
        id: commissionId,
        submissionId:
          randomUUID(),
        reference,
        clientName:
          "Email Root Verification",
        clientEmail:
          "email-root-verification@example.com",
        initialMessage:
          "Temporary fixture created by verifyCommissionEmailThreadRootRepository.",
      });

    commissionIds.push(
      commissionId,
    );

    const thread =
      await createCommissionEmailThreadIfMissing({
        commissionId,
        subject,
      });

    return {
      commissionId,
      threadId:
        thread.thread.id,
    };
  }

  try {
    const firstFixture =
      await createFixture();

    const initialThread =
      await getCommissionEmailThreadById(
        firstFixture.threadId,
      );

    ok(initialThread);
    equal(
      initialThread.rootProviderEmailId,
      null,
    );
    equal(
      initialThread.rootMessageId,
      null,
    );

    console.log(
      "[OK] New thread starts without provider or RFC root identity",
    );

    const providerA =
      `resend-${randomUUID()}`;
    const providerB =
      `resend-${randomUUID()}`;

    const setProvider =
      await setCommissionEmailThreadRootProvider({
        threadId:
          firstFixture.threadId,
        providerEmailId:
          providerA,
      });

    equal(
      setProvider.outcome,
      "set",
    );

    if (
      setProvider.outcome === "set"
    ) {
      equal(
        setProvider.thread.rootProviderEmailId,
        providerA,
      );
      equal(
        setProvider.thread.rootMessageId,
        null,
      );
    }

    console.log(
      "[OK] Root provider ID can be established once",
    );

    const repeatProvider =
      await setCommissionEmailThreadRootProvider({
        threadId:
          firstFixture.threadId,
        providerEmailId:
          providerA,
      });

    equal(
      repeatProvider.outcome,
      "already_set",
    );

    console.log(
      "[OK] Repeating the same root provider is idempotent",
    );

    const replaceProvider =
      await setCommissionEmailThreadRootProvider({
        threadId:
          firstFixture.threadId,
        providerEmailId:
          providerB,
      });

    equal(
      replaceProvider.outcome,
      "conflict",
    );

    if (
      replaceProvider.outcome ===
      "conflict"
    ) {
      equal(
        replaceProvider.thread.rootProviderEmailId,
        providerA,
      );
    }

    console.log(
      "[OK] Established root provider cannot be replaced",
    );

    const messageA =
      `<${randomUUID()}@email.fefierys.test>`;
    const messageB =
      `<${randomUUID()}@email.fefierys.test>`;

    const wrongProviderMessage =
      await setCommissionEmailThreadRootMessageId({
        threadId:
          firstFixture.threadId,
        providerEmailId:
          providerB,
        rootMessageId:
          messageA,
      });

    equal(
      wrongProviderMessage.outcome,
      "conflict",
    );

    console.log(
      "[OK] RFC root cannot be attached through a different provider ID",
    );

    const setMessage =
      await setCommissionEmailThreadRootMessageId({
        threadId:
          firstFixture.threadId,
        providerEmailId:
          providerA,
        rootMessageId:
          messageA,
      });

    equal(
      setMessage.outcome,
      "set",
    );

    if (
      setMessage.outcome === "set"
    ) {
      equal(
        setMessage.thread.rootProviderEmailId,
        providerA,
      );
      equal(
        setMessage.thread.rootMessageId,
        messageA,
      );
    }

    console.log(
      "[OK] RFC Message-ID completes the existing provider root",
    );

    const repeatMessage =
      await setCommissionEmailThreadRootMessageId({
        threadId:
          firstFixture.threadId,
        providerEmailId:
          providerA,
        rootMessageId:
          messageA,
      });

    equal(
      repeatMessage.outcome,
      "already_set",
    );

    console.log(
      "[OK] Repeating the same RFC root is idempotent",
    );

    const replaceMessage =
      await setCommissionEmailThreadRootMessageId({
        threadId:
          firstFixture.threadId,
        providerEmailId:
          providerA,
        rootMessageId:
          messageB,
      });

    equal(
      replaceMessage.outcome,
      "conflict",
    );

    if (
      replaceMessage.outcome ===
      "conflict"
    ) {
      equal(
        replaceMessage.thread.rootMessageId,
        messageA,
      );
    }

    console.log(
      "[OK] Established RFC root cannot be replaced",
    );

    const concurrentFixture =
      await createFixture();
    const concurrentProvider =
      `resend-${randomUUID()}`;

    const providerResults =
      await Promise.all(
        Array.from(
          {
            length: 8,
          },
          () =>
            setCommissionEmailThreadRootProvider({
              threadId:
                concurrentFixture.threadId,
              providerEmailId:
                concurrentProvider,
            }),
        ),
      );

    equal(
      providerResults.filter(
        (result) =>
          result.outcome === "set",
      ).length,
      1,
    );
    equal(
      providerResults.filter(
        (result) =>
          result.outcome ===
          "already_set",
      ).length,
      7,
    );

    console.log(
      "[OK] Concurrent provider initialization establishes one root",
    );

    const concurrentMessage =
      `<${randomUUID()}@email.fefierys.test>`;

    const messageResults =
      await Promise.all(
        Array.from(
          {
            length: 8,
          },
          () =>
            setCommissionEmailThreadRootMessageId({
              threadId:
                concurrentFixture.threadId,
              providerEmailId:
                concurrentProvider,
              rootMessageId:
                concurrentMessage,
            }),
        ),
      );

    equal(
      messageResults.filter(
        (result) =>
          result.outcome === "set",
      ).length,
      1,
    );
    equal(
      messageResults.filter(
        (result) =>
          result.outcome ===
          "already_set",
      ).length,
      7,
    );

    const concurrentThread =
      await getCommissionEmailThreadById(
        concurrentFixture.threadId,
      );

    ok(concurrentThread);
    equal(
      concurrentThread.rootProviderEmailId,
      concurrentProvider,
    );
    equal(
      concurrentThread.rootMessageId,
      concurrentMessage,
    );

    console.log(
      "[OK] Concurrent RFC completion preserves one immutable root identity",
    );

    console.log(
      "[OK] Commission email thread root repository verification passed",
    );
  } finally {
    if (
      commissionIds.length > 0
    ) {
      await db
        .delete(
          commissionEmailThreads,
        )
        .where(
          inArray(
            commissionEmailThreads.commissionId,
            commissionIds,
          ),
        );

      await db
        .delete(
          commissions,
        )
        .where(
          inArray(
            commissions.id,
            commissionIds,
          ),
        );
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "[ERROR] Commission email thread root repository verification failed",
      error,
    );
    process.exitCode = 1;
  },
);
