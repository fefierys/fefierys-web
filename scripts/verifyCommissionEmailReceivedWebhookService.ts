import {
  equal,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

import type {
  CommissionInboundEmail,
  CommissionInboundEmailProvider,
} from "../lib/email/commissionInboundEmailProvider";

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
    setCommissionEmailThreadRootMessageId,
    setCommissionEmailThreadRootProvider,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );

  const {
    processCommissionEmailReceivedEvent,
  } = await import(
    "../lib/email/commissionEmailReceivedWebhookService"
  );

  const createdCommissionIds: string[] =
    [];

  const expectedRecipientEmail =
    "reply@reply.fefierys.com";

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
      `INBOUND-WH-${label}-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase()}`;

    const clientEmail =
      `inbound-wh-${label.toLowerCase()}-${commissionId}@example.com`;

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
          `Inbound Webhook ${label} Verification`,

        clientEmail,

        initialMessage:
          `Temporary fixture created by verifyCommissionEmailReceivedWebhookService for ${label}.`,
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

    const providerRoot =
      await setCommissionEmailThreadRootProvider({
        threadId,
        providerEmailId:
          rootProviderEmailId,
      });

    ok(
      providerRoot.outcome ===
        "set" ||
        providerRoot.outcome ===
          "already_set",
    );

    const messageRoot =
      await setCommissionEmailThreadRootMessageId({
        threadId,
        providerEmailId:
          rootProviderEmailId,
        rootMessageId,
      });

    ok(
      messageRoot.outcome ===
        "set" ||
        messageRoot.outcome ===
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

  function createReceivedEmail(
    fixture: Fixture,
    overrides: Partial<CommissionInboundEmail> = {},
  ): CommissionInboundEmail {
    const providerEmailId =
      `received-${randomUUID()}`;

    return {
      providerEmailId,

      providerMessageId:
        `<reply-${randomUUID()}@client.example>`,

      from:
        `Verification Client <${fixture.clientEmail}>`,

      to: [
        expectedRecipientEmail,
      ],

      subject:
        `Re: ${fixture.subject}`,

      text:
        "Thank you! Yes, I would like to continue.",

      html:
        "<p>Thank you! Yes, I would like to continue.</p>",

      headers: {
        "In-Reply-To":
          fixture.rootMessageId,

        References:
          fixture.rootMessageId,
      },

      receivedAt:
        new Date(
          "2026-09-18T14:30:00.000Z",
        ),

      ...overrides,
    };
  }

  function providerFor(
    email: CommissionInboundEmail,
  ): CommissionInboundEmailProvider {
    return {
      async getReceivedEmail(
        providerEmailId,
      ) {
        /*
         * The fake intentionally does not manufacture another email.
         * Tests control exactly what the provider retrieval layer returns.
         */
        void providerEmailId;

        return email;
      },
    };
  }

  try {
    /*
     * ============================================================
     * SUCCESSFUL PROCESSING
     * ============================================================
     */

    const successFixture =
      await createFixture(
        "SUCCESS",
      );

    const receivedEmail =
      createReceivedEmail(
        successFixture,
      );

    const successResult =
      await processCommissionEmailReceivedEvent(
        {
          providerEmailId:
            receivedEmail.providerEmailId,

          expectedRecipientEmail,
        },
        providerFor(
          receivedEmail,
        ),
      );

    equal(
      successResult.outcome,
      "processed",
    );

    if (
      successResult.outcome !==
      "processed"
    ) {
      throw new Error(
        "Expected inbound email to be processed.",
      );
    }

    equal(
      successResult.message.commissionId,
      successFixture.commissionId,
    );

    equal(
      successResult.message.threadId,
      successFixture.threadId,
    );

    equal(
      successResult.message.direction,
      "inbound",
    );

    equal(
      successResult.message.scope,
      "client_thread",
    );

    equal(
      successResult.message.actor,
      "client",
    );

    equal(
      successResult.message.kind,
      "general_message",
    );

    equal(
      successResult.message.deliveryStatus,
      "received",
    );

    equal(
      successResult.message.senderEmail,
      successFixture.clientEmail,
    );

    equal(
      successResult.message.recipientEmail,
      expectedRecipientEmail,
    );

    equal(
      successResult.message.providerEmailId,
      receivedEmail.providerEmailId,
    );

    equal(
      successResult.message.providerMessageId,
      receivedEmail.providerMessageId,
    );

    equal(
      successResult.message.inReplyToMessageId,
      successFixture.rootMessageId,
    );

    equal(
      successResult.message.referencesHeader,
      successFixture.rootMessageId,
    );

    equal(
      successResult.message.messageText,
      receivedEmail.text,
    );

    console.log(
      "[OK] Valid received email resolves and persists as one inbound commission message",
    );

    /*
     * ============================================================
     * WEBHOOK REPLAY
     * ============================================================
     */

    const replayResult =
      await processCommissionEmailReceivedEvent(
        {
          providerEmailId:
            receivedEmail.providerEmailId,

          expectedRecipientEmail,
        },
        providerFor(
          receivedEmail,
        ),
      );

    equal(
      replayResult.outcome,
      "already_processed",
    );

    if (
      replayResult.outcome !==
      "already_processed"
    ) {
      throw new Error(
        "Expected replayed received email to reconcile idempotently.",
      );
    }

    equal(
      replayResult.message.id,
      successResult.message.id,
    );

    const replayRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            successFixture.commissionId,
          ),
        );

    equal(
      replayRows.length,
      1,
    );

    console.log(
      "[OK] Replayed email.received event is idempotent",
    );

    /*
     * ============================================================
     * RECIPIENT MISMATCH
     * ============================================================
     */

    const recipientFixture =
      await createFixture(
        "RECIPIENT",
      );

    const wrongRecipientEmail =
      createReceivedEmail(
        recipientFixture,
        {
          to: [
            "some-other-mailbox@reply.fefierys.com",
          ],
        },
      );

    const recipientResult =
      await processCommissionEmailReceivedEvent(
        {
          providerEmailId:
            wrongRecipientEmail.providerEmailId,

          expectedRecipientEmail,
        },
        providerFor(
          wrongRecipientEmail,
        ),
      );

    equal(
      recipientResult.outcome,
      "recipient_mismatch",
    );

    console.log(
      "[OK] Email delivered to a different mailbox does not enter the commission conversation",
    );

    /*
     * ============================================================
     * SENDER MISMATCH
     * ============================================================
     */

    const senderFixture =
      await createFixture(
        "SENDER",
      );

    const wrongSenderEmail =
      createReceivedEmail(
        senderFixture,
        {
          from:
            "Someone Else <someone-else@example.com>",
        },
      );

    const senderResult =
      await processCommissionEmailReceivedEvent(
        {
          providerEmailId:
            wrongSenderEmail.providerEmailId,

          expectedRecipientEmail,
        },
        providerFor(
          wrongSenderEmail,
        ),
      );

    equal(
      senderResult.outcome,
      "sender_mismatch",
    );

    if (
      senderResult.outcome !==
      "sender_mismatch"
    ) {
      throw new Error(
        "Expected incorrect sender to be rejected.",
      );
    }

    equal(
      senderResult.commissionId,
      senderFixture.commissionId,
    );

    equal(
      senderResult.threadId,
      senderFixture.threadId,
    );

    console.log(
      "[OK] Matching RFC thread evidence cannot impersonate a different commission client",
    );

    /*
     * ============================================================
     * UNKNOWN THREADING EVIDENCE
     * ============================================================
     */

    const unknownFixture =
      await createFixture(
        "UNKNOWN",
      );

    const unknownMessageId =
      `<unknown-${randomUUID()}@client.example>`;

    const unknownEmail =
      createReceivedEmail(
        unknownFixture,
        {
          headers: {
            "In-Reply-To":
              unknownMessageId,

            References:
              unknownMessageId,
          },
        },
      );

    const unknownResult =
      await processCommissionEmailReceivedEvent(
        {
          providerEmailId:
            unknownEmail.providerEmailId,

          expectedRecipientEmail,
        },
        providerFor(
          unknownEmail,
        ),
      );

    equal(
      unknownResult.outcome,
      "not_found",
    );

    console.log(
      "[OK] Unknown RFC thread evidence is not guessed into a commission",
    );

    /*
     * ============================================================
     * NO THREADING EVIDENCE
     * ============================================================
     */

    const noEvidenceFixture =
      await createFixture(
        "NO-EVIDENCE",
      );

    const noEvidenceEmail =
      createReceivedEmail(
        noEvidenceFixture,
        {
          headers: {},
        },
      );

    const noEvidenceResult =
      await processCommissionEmailReceivedEvent(
        {
          providerEmailId:
            noEvidenceEmail.providerEmailId,

          expectedRecipientEmail,
        },
        providerFor(
          noEvidenceEmail,
        ),
      );

    equal(
      noEvidenceResult.outcome,
      "no_thread_evidence",
    );

    console.log(
      "[OK] Received email without RFC reply evidence is not associated by subject or sender",
    );

    /*
     * ============================================================
     * PROVIDER RETRIEVAL IDENTITY MISMATCH
     * ============================================================
     */

    const identityFixture =
      await createFixture(
        "IDENTITY",
      );

    const requestedProviderEmailId =
      `requested-${randomUUID()}`;

    const mismatchedProviderEmail =
      createReceivedEmail(
        identityFixture,
        {
          providerEmailId:
            `different-${randomUUID()}`,
        },
      );

    const identityResult =
      await processCommissionEmailReceivedEvent(
        {
          providerEmailId:
            requestedProviderEmailId,

          expectedRecipientEmail,
        },
        providerFor(
          mismatchedProviderEmail,
        ),
      );

    equal(
      identityResult.outcome,
      "conflict",
    );

    console.log(
      "[OK] Provider retrieval cannot substitute a different received email identity",
    );

    /*
     * ============================================================
     * ENSURE REJECTED CASES DID NOT CREATE INBOUND ROWS
     * ============================================================
     */

    const rejectedCommissionIds = [
      recipientFixture.commissionId,
      senderFixture.commissionId,
      unknownFixture.commissionId,
      noEvidenceFixture.commissionId,
      identityFixture.commissionId,
    ];

    const rejectedRows =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          inArray(
            commissionEmailMessages.commissionId,
            rejectedCommissionIds,
          ),
        );

    equal(
      rejectedRows.length,
      0,
    );

    console.log(
      "[OK] Rejected inbound emails produce no commission message writes",
    );

    console.log(
      "[OK] Commission email.received webhook service verification passed",
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
      "[OK] Temporary email.received verification data was removed",
    );
  }
}

main().catch(
  (
    error: unknown,
  ) => {
    console.error(
      "[ERROR] Commission email.received webhook service verification failed",
      error,
    );

    process.exitCode =
      1;
  },
);