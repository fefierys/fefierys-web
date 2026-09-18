import {
  equal,
  ok,
  rejects,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not configured. Run this script with .env.local loaded.",
    );
  }

  const {
    eq,
    inArray,
  } = await import("drizzle-orm");

  const { db } =
    await import("../lib/db");

  const {
    commissionEmailMessages,
    commissionEmailThreads,
    commissions,
  } = await import(
    "../lib/db/schema/commissions"
  );

  const {
    createCommissionEmailThreadIfMissing,
    createReceivedCommissionEmailMessage,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );

  const {
    deliverCommissionEmailMessage,
  } = await import(
    "../lib/email/commissionEmailDeliveryService"
  );

  const createdCommissionIds: string[] = [];

  interface Fixture {
    commissionId: string;
    clientEmail: string;
    reference: string;
    subject: string;
    threadId: string;
  }

  async function createFixture(
    label: string,
  ): Promise<Fixture> {
    const commissionId =
      randomUUID();

    const reference =
      `INBOUND-${label}-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 10)
        .toUpperCase()}`;

    const clientEmail =
      `inbound-${label.toLowerCase()}-${commissionId}@example.com`;

    const subject =
      `Fefierys Art — Your project — ${reference}`;

    await db
      .insert(commissions)
      .values({
        id:
          commissionId,

        submissionId:
          randomUUID(),

        reference,

        clientName:
          `Inbound ${label} Verification`,

        clientEmail,

        initialMessage:
          `Temporary fixture created by verifyCommissionInboundEmailRepository for ${label}.`,
      });

    createdCommissionIds.push(
      commissionId,
    );

    const threadResult =
      await createCommissionEmailThreadIfMissing({
        commissionId,
        subject,
      });

    return {
      commissionId,
      clientEmail,
      reference,
      subject,
      threadId:
        threadResult.thread.id,
    };
  }

  function createInboundInput(
    fixture: Fixture,
    overrides: Partial<{
      commissionId: string;
      threadId: string;
      senderEmail: string;
      recipientEmail: string;
      subject: string;
      messageText: string;
      providerEmailId: string;
      providerMessageId: string;
      inReplyToMessageId: string | null;
      referencesHeader: string | null;
      receivedAt: Date;
    }> = {},
  ) {
    const rootMessageId =
      `<root-${fixture.commissionId}@email.fefierys.test>`;

    return {
      commissionId:
        overrides.commissionId ??
        fixture.commissionId,

      threadId:
        overrides.threadId ??
        fixture.threadId,

      senderEmail:
        overrides.senderEmail ??
        fixture.clientEmail,

      recipientEmail:
        overrides.recipientEmail ??
        "replies@example.fefierys.test",

      subject:
        overrides.subject ??
        fixture.subject,

      messageText:
        overrides.messageText ??
        "Thank you! I would like to continue with the commission.",

      providerEmailId:
        overrides.providerEmailId ??
        `resend-inbound-${randomUUID()}`,

      providerMessageId:
        overrides.providerMessageId ??
        `<${randomUUID()}@client.example>`,

      inReplyToMessageId:
        overrides.inReplyToMessageId ===
        undefined
          ? rootMessageId
          : overrides.inReplyToMessageId,

      referencesHeader:
        overrides.referencesHeader ===
        undefined
          ? rootMessageId
          : overrides.referencesHeader,

      receivedAt:
        overrides.receivedAt ??
        new Date(),
    };
  }

  try {
    /*
     * ============================================================
     * BASIC INBOUND CREATION
     * ============================================================
     */

    const basicFixture =
      await createFixture(
        "BASIC",
      );

    const receivedAt =
      new Date(
        "2026-09-17T20:00:00.000Z",
      );

    const basicInput =
      createInboundInput(
        basicFixture,
        {
          messageText:
            "Yes, that works for me.\nPlease continue.",
          receivedAt,
        },
      );

    const basicResult =
      await createReceivedCommissionEmailMessage(
        basicInput,
      );

    equal(
      basicResult.outcome,
      "created",
    );

    if (
      basicResult.outcome !==
      "created"
    ) {
      throw new Error(
        "Expected the basic inbound email to be created.",
      );
    }

    const basicMessage =
      basicResult.message;

    equal(
      basicMessage.commissionId,
      basicFixture.commissionId,
    );

    equal(
      basicMessage.threadId,
      basicFixture.threadId,
    );

    equal(
      basicMessage.scope,
      "client_thread",
    );

    equal(
      basicMessage.direction,
      "inbound",
    );

    equal(
      basicMessage.kind,
      "general_message",
    );

    equal(
      basicMessage.actor,
      "client",
    );

    equal(
      basicMessage.deliveryStatus,
      "received",
    );

    equal(
      basicMessage.senderEmail,
      basicFixture.clientEmail,
    );

    equal(
      basicMessage.recipientEmail,
      basicInput.recipientEmail,
    );

    equal(
      basicMessage.replyToEmail,
      null,
    );

    equal(
      basicMessage.messageText,
      basicInput.messageText,
    );

    equal(
      basicMessage.providerEmailId,
      basicInput.providerEmailId,
    );

    equal(
      basicMessage.providerMessageId,
      basicInput.providerMessageId,
    );

    equal(
      basicMessage.inReplyToMessageId,
      basicInput.inReplyToMessageId,
    );

    equal(
      basicMessage.referencesHeader,
      basicInput.referencesHeader,
    );

    equal(
      basicMessage.attemptCount,
      0,
    );

    equal(
      basicMessage.lastAttemptAt,
      null,
    );

    equal(
      basicMessage.sentAt,
      null,
    );

    equal(
      basicMessage.failedAt,
      null,
    );

    equal(
      basicMessage.failureMessage,
      null,
    );

    equal(
      basicMessage.createdByAdminUserId,
      null,
    );

    equal(
      basicMessage.createdAt.getTime(),
      receivedAt.getTime(),
    );

    console.log(
      "[OK] Received client email is persisted with inbound/client/received semantics",
    );

    /*
     * ============================================================
     * DUPLICATE WEBHOOK IDEMPOTENCY
     * ============================================================
     */

    const duplicateResult =
      await createReceivedCommissionEmailMessage(
        basicInput,
      );

    equal(
      duplicateResult.outcome,
      "already_received",
    );

    if (
      duplicateResult.outcome !==
      "already_received"
    ) {
      throw new Error(
        "Expected duplicate inbound delivery to reconcile.",
      );
    }

    equal(
      duplicateResult.message.id,
      basicMessage.id,
    );

    const duplicateRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            basicFixture.commissionId,
          ),
        );

    equal(
      duplicateRows.length,
      1,
    );

    console.log(
      "[OK] Repeated provider delivery returns the same logical inbound message",
    );

    /*
     * ============================================================
     * CONCURRENT DUPLICATE DELIVERY
     * ============================================================
     */

    const concurrentFixture =
      await createFixture(
        "CONCURRENT",
      );

    const concurrentInput =
      createInboundInput(
        concurrentFixture,
      );

    const concurrentResults =
      await Promise.all([
        createReceivedCommissionEmailMessage(
          concurrentInput,
        ),
        createReceivedCommissionEmailMessage(
          concurrentInput,
        ),
      ]);

    equal(
      concurrentResults.filter(
        (result) =>
          result.outcome ===
          "created",
      ).length,
      1,
    );

    equal(
      concurrentResults.filter(
        (result) =>
          result.outcome ===
          "already_received",
      ).length,
      1,
    );

    const concurrentRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            concurrentFixture.commissionId,
          ),
        );

    equal(
      concurrentRows.length,
      1,
    );

    console.log(
      "[OK] Concurrent duplicate inbound deliveries create exactly one logical message",
    );

    /*
     * ============================================================
     * PROVIDER EMAIL ID CONFLICT
     * ============================================================
     */

    const providerEmailConflict =
      await createReceivedCommissionEmailMessage(
        createInboundInput(
          basicFixture,
          {
            providerEmailId:
              basicInput.providerEmailId,

            providerMessageId:
              `<different-${randomUUID()}@client.example>`,
          },
        ),
      );

    equal(
      providerEmailConflict.outcome,
      "conflict",
    );

    console.log(
      "[OK] Reusing a provider email ID with a different RFC Message-ID is rejected as a conflict",
    );

    /*
     * ============================================================
     * RFC MESSAGE-ID CONFLICT
     * ============================================================
     */

    const providerMessageConflict =
      await createReceivedCommissionEmailMessage(
        createInboundInput(
          basicFixture,
          {
            providerEmailId:
              `resend-different-${randomUUID()}`,

            providerMessageId:
              basicInput.providerMessageId,
          },
        ),
      );

    equal(
      providerMessageConflict.outcome,
      "conflict",
    );

    console.log(
      "[OK] Reusing an RFC Message-ID with a different provider email ID is rejected as a conflict",
    );

    /*
     * ============================================================
     * THREAD / COMMISSION OWNERSHIP
     * ============================================================
     */

    const ownershipFixtureA =
      await createFixture(
        "OWNER-A",
      );

    const ownershipFixtureB =
      await createFixture(
        "OWNER-B",
      );

    const threadMismatchResult =
      await createReceivedCommissionEmailMessage(
        createInboundInput(
          ownershipFixtureA,
          {
            threadId:
              ownershipFixtureB.threadId,
          },
        ),
      );

    equal(
      threadMismatchResult.outcome,
      "thread_mismatch",
    );

    console.log(
      "[OK] A thread belonging to another commission cannot receive the inbound message",
    );

    /*
     * ============================================================
     * MISSING THREAD
     * ============================================================
     */

    const missingThreadResult =
      await createReceivedCommissionEmailMessage(
        createInboundInput(
          ownershipFixtureA,
          {
            threadId:
              randomUUID(),
          },
        ),
      );

    equal(
      missingThreadResult.outcome,
      "thread_not_found",
    );

    console.log(
      "[OK] Inbound persistence refuses a missing commission email thread",
    );

    /*
     * ============================================================
     * A REPLY MUST CONTAIN THREADING EVIDENCE
     * ============================================================
     */

    const noHeadersFixture =
      await createFixture(
        "NO-HEADERS",
      );

    await rejects(
      () =>
        createReceivedCommissionEmailMessage(
          createInboundInput(
            noHeadersFixture,
            {
              inReplyToMessageId:
                null,

              referencesHeader:
                null,
            },
          ),
        ),
      /requires In-Reply-To or References/,
    );

    const noHeadersRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            noHeadersFixture.commissionId,
          ),
        );

    equal(
      noHeadersRows.length,
      0,
    );

    console.log(
      "[OK] A received email without reply-thread evidence is not persisted as a commission reply",
    );

    /*
     * ============================================================
     * OUTBOUND DELIVERY MUST NEVER CLAIM INBOUND MESSAGES
     * ============================================================
     */

    await rejects(
      () =>
        deliverCommissionEmailMessage(
          {
            messageId:
              basicMessage.id,

            body: {
              text:
                "This body must never be sent.",
            },
          },
        ),
      /Inbound commission email messages cannot be delivered through the outbound delivery service/,
    );

    const inboundAfterDeliveryAttempt =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.id,
            basicMessage.id,
          ),
        )
        .limit(1);

    const unchangedInbound =
      inboundAfterDeliveryAttempt[0];

    ok(
      unchangedInbound,
    );

    equal(
      unchangedInbound.deliveryStatus,
      "received",
    );

    equal(
      unchangedInbound.attemptCount,
      0,
    );

    equal(
      unchangedInbound.lastAttemptAt,
      null,
    );

    console.log(
      "[OK] Outbound delivery cannot claim or mutate a received inbound message",
    );

    console.log(
      "[OK] Commission inbound email repository verification passed",
    );
  } finally {
    if (
      createdCommissionIds.length >
      0
    ) {
      await db
        .delete(
          commissionEmailMessages,
        )
        .where(
          inArray(
            commissionEmailMessages.commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(
          commissionEmailThreads,
        )
        .where(
          inArray(
            commissionEmailThreads.commissionId,
            createdCommissionIds,
          ),
        );

      await db
        .delete(
          commissions,
        )
        .where(
          inArray(
            commissions.id,
            createdCommissionIds,
          ),
        );
    }

    console.log(
      "[OK] Temporary inbound email verification data was removed",
    );
  }
}

main().catch(
  (
    error: unknown,
  ) => {
    console.error(
      "[ERROR] Commission inbound email repository verification failed",
      error,
    );

    process.exitCode =
      1;
  },
);