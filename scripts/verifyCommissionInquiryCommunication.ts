import {
  equal,
  match,
  ok,
} from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  eq,
  inArray,
} from "drizzle-orm";

import type {
  CommissionEmailProvider,
  CommissionEmailProviderSendInput,
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
    commissionEmailMessages,
    commissionEmailThreads,
    commissions,
  } = await import(
    "../lib/db/schema/commissions"
  );
  const {
    createAndDeliverClientInquiryConfirmation,
  } = await import(
    "../lib/email/commissionInquiryCommunicationService"
  );

  const commissionIds: string[] =
    [];

  async function createFixture(
    prefix: string,
  ): Promise<{
    commissionId: string;
    reference: string;
  }> {
    const commissionId =
      randomUUID();
    const reference =
      `${prefix}-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 12)
        .toUpperCase()}`;

    await db
      .insert(commissions)
      .values({
        id: commissionId,
        submissionId:
          randomUUID(),
        reference,
        clientName:
          "Inquiry Communication Verification",
        clientEmail:
          "inquiry-communication@example.com",
        styleSnapshot:
          "Stylized",
        collectionSnapshot:
          "Character Art",
        categorySnapshot:
          "Character Illustration",
        optionSnapshot:
          "Full Render",
        initialMessage:
          "Temporary fixture created by verifyCommissionInquiryCommunication.",
      });

    commissionIds.push(
      commissionId,
    );

    return {
      commissionId,
      reference,
    };
  }

  function createEmailData(
    reference: string,
  ) {
    return {
      reference,
      name:
        "Inquiry Communication Verification",
      email:
        "inquiry-communication@example.com",
      message:
        "Temporary inquiry message.",
      style:
        "Stylized",
      collection:
        "Character Art",
      category:
        "Character Illustration",
      option:
        "Full Render",
    };
  }

  try {
    const successFixture =
      await createFixture(
        "EMAIL",
      );

    const emailData =
      createEmailData(
        successFixture.reference,
      );

    const providerEmailId =
      `resend-${randomUUID()}`;
    const providerMessageId =
      `<${randomUUID()}@email.fefierys.test>`;

    const captured:
      CommissionEmailProviderSendInput[] =
      [];

    const successProvider:
      CommissionEmailProvider = {
        async send(input) {
          captured.push(input);

          return {
            outcome: "sent",
            providerEmailId,
            providerMessageId,
          };
        },
      };

    const successResult =
      await createAndDeliverClientInquiryConfirmation(
        {
          commissionId:
            successFixture.commissionId,
          emailData,
        },
        successProvider,
      );

    equal(
      successResult.delivery.outcome,
      "sent",
    );
    equal(
      captured.length,
      1,
    );

    const expectedSubject =
      `Fefierys Art — Your project — ${successFixture.reference}`;

    equal(
      captured[0]?.subject,
      expectedSubject,
    );
    equal(
      captured[0]?.recipientEmail,
      emailData.email,
    );
    equal(
      captured[0]?.inReplyToMessageId,
      null,
    );
    equal(
      captured[0]?.referencesHeader,
      null,
    );
    match(
      captured[0]?.body.text ?? "",
      new RegExp(
        successFixture.reference,
      ),
    );

    console.log(
      "[OK] Client inquiry confirmation uses the stable commission thread subject",
    );

    const threadRows =
      await db
        .select()
        .from(
          commissionEmailThreads,
        )
        .where(
          eq(
            commissionEmailThreads.commissionId,
            successFixture.commissionId,
          ),
        );

    equal(
      threadRows.length,
      1,
    );

    const thread =
      threadRows[0];

    ok(thread);
    equal(
      thread.id,
      successResult.threadId,
    );
    equal(
      thread.subject,
      expectedSubject,
    );
    equal(
      thread.rootProviderEmailId,
      providerEmailId,
    );
    equal(
      thread.rootMessageId,
      providerMessageId,
    );

    console.log(
      "[OK] Successful inquiry confirmation establishes the client thread root",
    );

    const messageRows =
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
      messageRows.length,
      1,
    );

    const message =
      messageRows[0];

    ok(message);
    equal(
      message.id,
      successResult.messageId,
    );
    equal(
      message.threadId,
      thread.id,
    );
    equal(
      message.scope,
      "client_thread",
    );
    equal(
      message.direction,
      "outbound",
    );
    equal(
      message.kind,
      "inquiry_confirmation",
    );
    equal(
      message.actor,
      "system",
    );
    equal(
      message.deliveryStatus,
      "sent",
    );
    equal(
      message.attemptCount,
      1,
    );
    equal(
      message.providerEmailId,
      providerEmailId,
    );
    equal(
      message.providerMessageId,
      providerMessageId,
    );
    equal(
      message.subject,
      expectedSubject,
    );
    match(
      message.messageText ?? "",
      new RegExp(
        successFixture.reference,
      ),
    );

    console.log(
      "[OK] Client inquiry confirmation is persisted as one sent commission email message",
    );

    const failedFixture =
      await createFixture(
        "FAIL",
      );

    const failedEmailData =
      createEmailData(
        failedFixture.reference,
      );

    const failedProvider:
      CommissionEmailProvider = {
        async send() {
          return {
            outcome: "failed",
            failureMessage:
              "Synthetic safe inquiry confirmation failure.",
          };
        },
      };

    const failedResult =
      await createAndDeliverClientInquiryConfirmation(
        {
          commissionId:
            failedFixture.commissionId,
          emailData:
            failedEmailData,
        },
        failedProvider,
      );

    equal(
      failedResult.delivery.outcome,
      "failed",
    );

    const failedMessages =
      await db
        .select()
        .from(
          commissionEmailMessages,
        )
        .where(
          eq(
            commissionEmailMessages.commissionId,
            failedFixture.commissionId,
          ),
        );

    equal(
      failedMessages.length,
      1,
    );
    equal(
      failedMessages[0]?.deliveryStatus,
      "failed",
    );
    equal(
      failedMessages[0]?.attemptCount,
      1,
    );
    equal(
      failedMessages[0]?.failureMessage,
      "Synthetic safe inquiry confirmation failure.",
    );

    const failedThreads =
      await db
        .select()
        .from(
          commissionEmailThreads,
        )
        .where(
          eq(
            commissionEmailThreads.commissionId,
            failedFixture.commissionId,
          ),
        );

    equal(
      failedThreads.length,
      1,
    );
    equal(
      failedThreads[0]?.rootProviderEmailId,
      null,
    );
    equal(
      failedThreads[0]?.rootMessageId,
      null,
    );

    console.log(
      "[OK] Failed inquiry confirmation remains persisted for later retry without creating a false root",
    );

    console.log(
      "[OK] Commission inquiry communication verification passed",
    );
  } finally {
    if (
      commissionIds.length > 0
    ) {
      await db
        .delete(
          commissionEmailMessages,
        )
        .where(
          inArray(
            commissionEmailMessages.commissionId,
            commissionIds,
          ),
        );

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
      "[ERROR] Commission inquiry communication verification failed",
      error,
    );
    process.exitCode = 1;
  },
);
