import {
  deepEqual,
  equal,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

import type {
  CommissionEmailProvider,
} from "../lib/email/commissionEmailProvider";

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
    inArray,
  } = await import(
    "drizzle-orm"
  );

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
    createQueuedCommissionEmailMessage,
    setCommissionEmailThreadRootMessageId,
    setCommissionEmailThreadRootProvider,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );

  const {
    deliverCommissionEmailMessage,
  } = await import(
    "../lib/email/commissionEmailDeliveryService"
  );

  const {
    resolveCommissionInboundReply,
  } = await import(
    "../lib/email/commissionInboundReplyResolver"
  );

  const createdCommissionIds: string[] =
    [];

  interface Fixture {
    commissionId: string;
    clientEmail: string;
    subject: string;
    threadId: string;
    rootMessageId: string;
  }

  async function createFixture(
    label: string,
  ): Promise<Fixture> {
    const commissionId =
      randomUUID();

    const reference =
      `REPLY-${label}-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 10)
        .toUpperCase()}`;

    const clientEmail =
      `reply-${label.toLowerCase()}-${commissionId}@example.com`;

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
          `Inbound Reply ${label} Verification`,

        clientEmail,

        initialMessage:
          `Temporary fixture created by verifyCommissionInboundReplyResolver for ${label}.`,
      });

    createdCommissionIds.push(
      commissionId,
    );

    const threadResult =
      await createCommissionEmailThreadIfMissing({
        commissionId,
        subject,
      });

    const threadId =
      threadResult.thread.id;

    const rootProviderEmailId =
      `root-provider-${randomUUID()}`;

    const rootMessageId =
      `<root-${randomUUID()}@email.fefierys.test>`;

    const providerRootResult =
      await setCommissionEmailThreadRootProvider({
        threadId,
        providerEmailId:
          rootProviderEmailId,
      });

    ok(
      providerRootResult.outcome ===
        "set" ||
        providerRootResult.outcome ===
          "already_set",
    );

    const messageRootResult =
      await setCommissionEmailThreadRootMessageId({
        threadId,
        providerEmailId:
          rootProviderEmailId,
        rootMessageId,
      });

    ok(
      messageRootResult.outcome ===
        "set" ||
        messageRootResult.outcome ===
          "already_set",
    );

    return {
      commissionId,
      clientEmail,
      subject,
      threadId,
      rootMessageId,
    };
  }

  async function createLaterOutboundMessage(
    fixture: Fixture,
  ): Promise<{
    providerEmailId: string;
    providerMessageId: string;
  }> {
    const logicalMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          fixture.commissionId,

        threadId:
          fixture.threadId,

        quoteId:
          null,

        scope:
          "client_thread",

        kind:
          "general_message",

        actor:
          "artist",

        senderEmail:
          "contact@fefierys.com",

        recipientEmail:
          fixture.clientEmail,

        replyToEmail:
          "artist@example.com",

        subject:
          fixture.subject,

        messageText:
          "Temporary later outbound message for inbound reply correlation verification.",

        inReplyToMessageId:
          fixture.rootMessageId,

        referencesHeader:
          fixture.rootMessageId,

        createdByAdminUserId:
          "verify-inbound-reply-resolver",
      });

    const providerEmailId =
      `later-provider-${randomUUID()}`;

    const providerMessageId =
      `<later-${randomUUID()}@email.fefierys.test>`;

    const provider:
      CommissionEmailProvider = {
        async send() {
          return {
            outcome:
              "sent",

            providerEmailId,

            providerMessageId,
          };
        },
      };

    const delivery =
      await deliverCommissionEmailMessage(
        {
          messageId:
            logicalMessage.id,

          body: {
            text:
              logicalMessage.messageText ??
              "Temporary later outbound message.",
          },
        },
        provider,
      );

    equal(
      delivery.outcome,
      "sent",
    );

    return {
      providerEmailId,
      providerMessageId,
    };
  }

  try {
    /*
     * ============================================================
     * ROOT MESSAGE-ID
     * ============================================================
     */

    const rootFixture =
      await createFixture(
        "ROOT",
      );

    const rootResult =
      await resolveCommissionInboundReply({
        senderEmail:
          rootFixture.clientEmail.toUpperCase(),

        inReplyToMessageId:
          rootFixture.rootMessageId,

        referencesHeader:
          null,
      });

    equal(
      rootResult.outcome,
      "matched",
    );

    if (
      rootResult.outcome !==
      "matched"
    ) {
      throw new Error(
        "Expected root Message-ID to resolve the commission thread.",
      );
    }

    equal(
      rootResult.commissionId,
      rootFixture.commissionId,
    );

    equal(
      rootResult.threadId,
      rootFixture.threadId,
    );

    equal(
      rootResult.subject,
      rootFixture.subject,
    );

    equal(
      rootResult.clientEmail,
      rootFixture.clientEmail,
    );

    console.log(
      "[OK] In-Reply-To can resolve the immutable commission thread root",
    );

    /*
     * ============================================================
     * LATER OUTBOUND MESSAGE-ID
     * ============================================================
     */

    const laterOutbound =
      await createLaterOutboundMessage(
        rootFixture,
      );

    const laterResult =
      await resolveCommissionInboundReply({
        senderEmail:
          rootFixture.clientEmail,

        inReplyToMessageId:
          laterOutbound.providerMessageId,

        referencesHeader:
          rootFixture.rootMessageId,
      });

    equal(
      laterResult.outcome,
      "matched",
    );

    if (
      laterResult.outcome !==
      "matched"
    ) {
      throw new Error(
        "Expected later outbound Message-ID to resolve the commission thread.",
      );
    }

    equal(
      laterResult.commissionId,
      rootFixture.commissionId,
    );

    equal(
      laterResult.threadId,
      rootFixture.threadId,
    );

    console.log(
      "[OK] A reply to a later outbound email resolves the same commission thread",
    );

    /*
     * ============================================================
     * REFERENCES-ONLY CORRELATION
     * ============================================================
     */

    const referencesOnlyResult =
      await resolveCommissionInboundReply({
        senderEmail:
          rootFixture.clientEmail,

        inReplyToMessageId:
          null,

        referencesHeader:
          `${rootFixture.rootMessageId} ${laterOutbound.providerMessageId}`,
      });

    equal(
      referencesOnlyResult.outcome,
      "matched",
    );

    if (
      referencesOnlyResult.outcome !==
      "matched"
    ) {
      throw new Error(
        "Expected References to resolve the commission thread.",
      );
    }

    equal(
      referencesOnlyResult.threadId,
      rootFixture.threadId,
    );

    console.log(
      "[OK] References can resolve the thread even when In-Reply-To is unavailable",
    );

    /*
     * ============================================================
     * UNKNOWN MESSAGE-ID
     * ============================================================
     */

    const unknownResult =
      await resolveCommissionInboundReply({
        senderEmail:
          rootFixture.clientEmail,

        inReplyToMessageId:
          `<unknown-${randomUUID()}@client.example>`,

        referencesHeader:
          null,
      });

    equal(
      unknownResult.outcome,
      "not_found",
    );

    console.log(
      "[OK] Unknown RFC Message-ID is not attached to any commission",
    );

    /*
     * ============================================================
     * NO THREAD EVIDENCE
     * ============================================================
     */

    const noEvidenceResult =
      await resolveCommissionInboundReply({
        senderEmail:
          rootFixture.clientEmail,

        inReplyToMessageId:
          null,

        referencesHeader:
          null,
      });

    equal(
      noEvidenceResult.outcome,
      "no_thread_evidence",
    );

    console.log(
      "[OK] Email without In-Reply-To or References is not guessed by subject or sender",
    );

    /*
     * ============================================================
     * WRONG SENDER
     * ============================================================
     */

    const wrongSenderResult =
      await resolveCommissionInboundReply({
        senderEmail:
          "someone-else@example.com",

        inReplyToMessageId:
          rootFixture.rootMessageId,

        referencesHeader:
          null,
      });

    equal(
      wrongSenderResult.outcome,
      "sender_mismatch",
    );

    if (
      wrongSenderResult.outcome !==
      "sender_mismatch"
    ) {
      throw new Error(
        "Expected an incorrect sender to be rejected.",
      );
    }

    equal(
      wrongSenderResult.commissionId,
      rootFixture.commissionId,
    );

    equal(
      wrongSenderResult.threadId,
      rootFixture.threadId,
    );

    console.log(
      "[OK] Valid thread evidence is insufficient when From does not match the commission client",
    );

    /*
     * ============================================================
     * AMBIGUOUS REFERENCES
     * ============================================================
     */

    const ambiguousFixtureA =
      await createFixture(
        "AMBIGUOUS-A",
      );

    const ambiguousFixtureB =
      await createFixture(
        "AMBIGUOUS-B",
      );

    const ambiguousResult =
      await resolveCommissionInboundReply({
        senderEmail:
          ambiguousFixtureA.clientEmail,

        inReplyToMessageId:
          ambiguousFixtureA.rootMessageId,

        referencesHeader:
          `${ambiguousFixtureA.rootMessageId} ${ambiguousFixtureB.rootMessageId}`,
      });

    equal(
      ambiguousResult.outcome,
      "ambiguous",
    );

    if (
      ambiguousResult.outcome !==
      "ambiguous"
    ) {
      throw new Error(
        "Expected conflicting thread evidence to be ambiguous.",
      );
    }

    deepEqual(
      [...ambiguousResult.threadIds].sort(),
      [
        ambiguousFixtureA.threadId,
        ambiguousFixtureB.threadId,
      ].sort(),
    );

    console.log(
      "[OK] RFC evidence pointing to multiple commission threads is rejected as ambiguous",
    );

    console.log(
      "[OK] Commission inbound reply resolver verification passed",
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
      "[OK] Temporary inbound reply resolver verification data was removed",
    );
  }
}

main().catch(
  (
    error: unknown,
  ) => {
    console.error(
      "[ERROR] Commission inbound reply resolver verification failed",
      error,
    );

    process.exitCode =
      1;
  },
);