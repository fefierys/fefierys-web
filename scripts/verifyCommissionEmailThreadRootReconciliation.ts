import {
  equal,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import {
  inArray,
} from "drizzle-orm";

import type {
  CommissionEmailMessageLookupProvider,
} from "../lib/email/commissionEmailProvider";

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
    setCommissionEmailThreadRootProvider,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );
  const {
    reconcileCommissionEmailThreadRoot,
  } = await import(
    "../lib/email/commissionEmailThreadRootReconciliationService"
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
      `RECON-${randomUUID()
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
          "Root Reconciliation Verification",
        clientEmail:
          "root-reconciliation@example.com",
        initialMessage:
          "Temporary fixture created by verifyCommissionEmailThreadRootReconciliation.",
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
    const notReadyFixture =
      await createFixture();

    let notReadyLookupCalls = 0;

    const unusedProvider:
      CommissionEmailMessageLookupProvider = {
        async lookupMessageId() {
          notReadyLookupCalls += 1;

          return {
            outcome: "pending",
          };
        },
      };

    const notReadyResult =
      await reconcileCommissionEmailThreadRoot(
        notReadyFixture.threadId,
        unusedProvider,
      );

    equal(
      notReadyResult.outcome,
      "not_ready",
    );
    equal(
      notReadyLookupCalls,
      0,
    );

    console.log(
      "[OK] Thread without provider root does not call the provider lookup",
    );

    const pendingFixture =
      await createFixture();
    const pendingProviderEmailId =
      `resend-${randomUUID()}`;

    const pendingProviderSet =
      await setCommissionEmailThreadRootProvider({
        threadId:
          pendingFixture.threadId,
        providerEmailId:
          pendingProviderEmailId,
      });

    equal(
      pendingProviderSet.outcome,
      "set",
    );

    let pendingLookupCalls = 0;

    const pendingProvider:
      CommissionEmailMessageLookupProvider = {
        async lookupMessageId(
          providerEmailId,
        ) {
          pendingLookupCalls += 1;
          equal(
            providerEmailId,
            pendingProviderEmailId,
          );

          return {
            outcome: "pending",
          };
        },
      };

    const pendingResult =
      await reconcileCommissionEmailThreadRoot(
        pendingFixture.threadId,
        pendingProvider,
      );

    equal(
      pendingResult.outcome,
      "pending",
    );
    equal(
      pendingLookupCalls,
      1,
    );

    const stillPendingThread =
      await getCommissionEmailThreadById(
        pendingFixture.threadId,
      );

    ok(stillPendingThread);
    equal(
      stillPendingThread.rootProviderEmailId,
      pendingProviderEmailId,
    );
    equal(
      stillPendingThread.rootMessageId,
      null,
    );

    console.log(
      "[OK] Missing provider Message-ID keeps the thread pending without mutation",
    );

    const failedProvider:
      CommissionEmailMessageLookupProvider = {
        async lookupMessageId() {
          return {
            outcome: "failed",
            failureMessage:
              "Synthetic safe lookup failure.",
          };
        },
      };

    const providerFailure =
      await reconcileCommissionEmailThreadRoot(
        pendingFixture.threadId,
        failedProvider,
      );

    equal(
      providerFailure.outcome,
      "provider_failed",
    );

    if (
      providerFailure.outcome ===
      "provider_failed"
    ) {
      equal(
        providerFailure.failureMessage,
        "Synthetic safe lookup failure.",
      );
    }

    console.log(
      "[OK] Provider lookup failure is surfaced without changing the root",
    );

    const resolvedMessageId =
      `<${randomUUID()}@email.fefierys.test>`;

    const foundProvider:
      CommissionEmailMessageLookupProvider = {
        async lookupMessageId(
          providerEmailId,
        ) {
          equal(
            providerEmailId,
            pendingProviderEmailId,
          );

          return {
            outcome: "found",
            providerMessageId:
              resolvedMessageId,
          };
        },
      };

    const completedResult =
      await reconcileCommissionEmailThreadRoot(
        pendingFixture.threadId,
        foundProvider,
      );

    equal(
      completedResult.outcome,
      "completed",
    );

    const completedThread =
      await getCommissionEmailThreadById(
        pendingFixture.threadId,
      );

    ok(completedThread);
    equal(
      completedThread.rootProviderEmailId,
      pendingProviderEmailId,
    );
    equal(
      completedThread.rootMessageId,
      resolvedMessageId,
    );

    console.log(
      "[OK] Provider Message-ID completes the pending thread root",
    );

    let completedLookupCalls = 0;

    const shouldNotBeCalled:
      CommissionEmailMessageLookupProvider = {
        async lookupMessageId() {
          completedLookupCalls += 1;

          throw new Error(
            "Completed root must not call the provider.",
          );
        },
      };

    const alreadyComplete =
      await reconcileCommissionEmailThreadRoot(
        pendingFixture.threadId,
        shouldNotBeCalled,
      );

    equal(
      alreadyComplete.outcome,
      "already_complete",
    );
    equal(
      completedLookupCalls,
      0,
    );

    console.log(
      "[OK] Completed root is returned idempotently without another provider lookup",
    );

    const concurrentFixture =
      await createFixture();
    const concurrentProviderEmailId =
      `resend-${randomUUID()}`;
    const concurrentMessageId =
      `<${randomUUID()}@email.fefierys.test>`;

    const concurrentProviderSet =
      await setCommissionEmailThreadRootProvider({
        threadId:
          concurrentFixture.threadId,
        providerEmailId:
          concurrentProviderEmailId,
      });

    equal(
      concurrentProviderSet.outcome,
      "set",
    );

    const slowFoundProvider:
      CommissionEmailMessageLookupProvider = {
        async lookupMessageId(
          providerEmailId,
        ) {
          equal(
            providerEmailId,
            concurrentProviderEmailId,
          );

          await delay(50);

          return {
            outcome: "found",
            providerMessageId:
              concurrentMessageId,
          };
        },
      };

    const concurrentResults =
      await Promise.all(
        Array.from(
          {
            length: 8,
          },
          () =>
            reconcileCommissionEmailThreadRoot(
              concurrentFixture.threadId,
              slowFoundProvider,
            ),
        ),
      );

    equal(
      concurrentResults.every(
        (result) =>
          result.outcome ===
            "completed" ||
          result.outcome ===
            "already_complete",
      ),
      true,
    );

    equal(
      concurrentResults.some(
        (result) =>
          result.outcome ===
          "completed",
      ),
      true,
    );

    const concurrentThread =
      await getCommissionEmailThreadById(
        concurrentFixture.threadId,
      );

    ok(concurrentThread);
    equal(
      concurrentThread.rootProviderEmailId,
      concurrentProviderEmailId,
    );
    equal(
      concurrentThread.rootMessageId,
      concurrentMessageId,
    );

    console.log(
      "[OK] Concurrent reconciliation converges on one immutable RFC root",
    );

    console.log(
      "[OK] Commission email thread root reconciliation verification passed",
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
      "[ERROR] Commission email thread root reconciliation verification failed",
      error,
    );
    process.exitCode = 1;
  },
);
