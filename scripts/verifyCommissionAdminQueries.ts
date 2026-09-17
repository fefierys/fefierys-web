import { equal, ok } from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main() {
  const { eq, inArray } =
    await import("drizzle-orm");

  const { db } =
    await import("../lib/db");

  const {
    commissionEmailMessages,
    commissionEmailThreads,
    commissionEvents,
    commissions,
    commissionStatusHistory,
  } = await import(
    "../lib/db/schema/commissions"
  );

  const {
    getAdminCommissionDetail,
    getAdminCommissionPage,
    getCommissionStatusCounts,
  } = await import(
    "../lib/repositories/commissionAdminRepository"
  );

  const {
    createCommissionEmailThreadIfMissing,
    createQueuedCommissionEmailMessage,
  } = await import(
    "../lib/repositories/commissionEmailRepository"
  );

  const {
    createCommission,
  } = await import(
    "../lib/repositories/commissionRepository"
  );

  const baselineCounts =
    await getCommissionStatusCounts();

  const createdIds: string[] = [];

  try {
    const timestamps = [
      new Date(
        "2099-01-03T12:00:00.000Z",
      ),
      new Date(
        "2099-01-02T12:00:00.000Z",
      ),
      new Date(
        "2099-01-01T12:00:00.000Z",
      ),
    ];

    for (
      const [
        index,
        submittedAt,
      ] of timestamps.entries()
    ) {
      const marker =
        randomUUID();

      const created =
        await createCommission({
          submissionId:
            randomUUID(),
          clientName:
            `Admin Query Verification ${index + 1}`,
          clientEmail:
            `admin-query-${marker}@example.com`,
          initialMessage:
            `Temporary admin query verification ${marker}`,
          termsVersion:
            "2026.1",
          agreementVersion:
            null,
        });

      createdIds.push(
        created.id,
      );

      await db
        .update(
          commissions,
        )
        .set({
          submittedAt,
          updatedAt:
            submittedAt,
        })
        .where(
          eq(
            commissions.id,
            created.id,
          ),
        );
    }

    const [
      firstId,
      secondId,
      thirdId,
    ] = createdIds;

    ok(firstId);
    ok(secondId);
    ok(thirdId);

    const counts =
      await getCommissionStatusCounts();

    equal(
      counts.received,
      baselineCounts.received +
        createdIds.length,
    );

    equal(
      counts.completed,
      baselineCounts.completed,
    );

    console.log(
      "[OK] Status counts include zero and populated statuses",
    );

    const firstPage =
      await getAdminCommissionPage({
        status: "received",
        limit: 2,
      });

    equal(
      firstPage.items.length,
      2,
    );

    const [
      firstItem,
      secondItem,
    ] = firstPage.items;

    ok(firstItem);
    ok(secondItem);

    equal(
      firstItem.id,
      firstId,
    );

    equal(
      secondItem.id,
      secondId,
    );

    equal(
      "clientEmail" in firstItem,
      false,
    );

    equal(
      "initialMessage" in firstItem,
      false,
    );

    const nextCursor =
      firstPage.nextCursor;

    ok(
      nextCursor,
      "First page did not return a cursor",
    );

    console.log(
      "[OK] Admin summary page is ordered and data-minimized",
    );

    const secondPage =
      await getAdminCommissionPage({
        status: "received",
        limit: 2,
        cursor:
          nextCursor,
      });

    equal(
      secondPage.items[0]?.id,
      thirdId,
    );

    console.log(
      "[OK] Cursor pagination is stable",
    );

    /*
     * Build one real client conversation for the
     * first temporary commission.
     */
    const firstCommissionRows =
      await db
        .select({
          reference:
            commissions.reference,
          clientEmail:
            commissions.clientEmail,
        })
        .from(
          commissions,
        )
        .where(
          eq(
            commissions.id,
            firstId,
          ),
        )
        .limit(1);

    const firstCommission =
      firstCommissionRows[0];

    ok(firstCommission);

    const conversationSubject =
      `Fefierys Art — Your project — ${firstCommission.reference}`;

    const threadResult =
      await createCommissionEmailThreadIfMissing({
        commissionId:
          firstId,
        subject:
          conversationSubject,
      });

    const firstClientMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          firstId,
        threadId:
          threadResult.thread.id,
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
          firstCommission.clientEmail,
        replyToEmail:
          "artist@fefierys.test",
        subject:
          conversationSubject,
        messageText:
          "First temporary client conversation message.",
        inReplyToMessageId:
          null,
        referencesHeader:
          null,
        createdByAdminUserId:
          "admin-query-verifier",
      });

    const secondClientMessage =
      await createQueuedCommissionEmailMessage({
        commissionId:
          firstId,
        threadId:
          threadResult.thread.id,
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
          firstCommission.clientEmail,
        replyToEmail:
          "artist@fefierys.test",
        subject:
          conversationSubject,
        messageText:
          "Second temporary client conversation message.",
        inReplyToMessageId:
          null,
        referencesHeader:
          null,
        createdByAdminUserId:
          "admin-query-verifier",
      });

    /*
     * Force deterministic timestamps so the verifier
     * proves chronological conversation ordering instead
     * of depending on database timestamp precision.
     */
    await db
      .update(
        commissionEmailMessages,
      )
      .set({
        createdAt:
          new Date(
            "2099-01-03T12:10:00.000Z",
          ),
      })
      .where(
        eq(
          commissionEmailMessages.id,
          firstClientMessage.id,
        ),
      );

    await db
      .update(
        commissionEmailMessages,
      )
      .set({
        createdAt:
          new Date(
            "2099-01-03T12:20:00.000Z",
          ),
      })
      .where(
        eq(
          commissionEmailMessages.id,
          secondClientMessage.id,
        ),
      );

    /*
     * This belongs to the same commission but must NOT
     * appear in the client conversation projection.
     */
    await createQueuedCommissionEmailMessage({
      commissionId:
        firstId,
      threadId:
        null,
      quoteId:
        null,
      scope:
        "internal_notification",
      kind:
        "internal_inquiry_notification",
      actor:
        "system",
      senderEmail:
        "contact@fefierys.com",
      recipientEmail:
        "artist@fefierys.test",
      replyToEmail:
        null,
      subject:
        `Internal notification — ${firstCommission.reference}`,
      messageText:
        "Temporary internal notification.",
      inReplyToMessageId:
        null,
      referencesHeader:
        null,
      createdByAdminUserId:
        null,
    });

    const detail =
      await getAdminCommissionDetail(
        firstId,
      );

    ok(
      detail,
      "Admin commission detail was not found",
    );

    equal(
      detail.commission.id,
      firstId,
    );

    equal(
      detail.statusHistory.length,
      1,
    );

    equal(
      detail.statusHistory[0]
        ?.toStatus,
      "received",
    );

    equal(
      detail.events.length,
      1,
    );

    equal(
      detail.events[0]?.type,
      "commission_received",
    );

    console.log(
      "[OK] Admin detail includes history and events",
    );

    ok(
      detail.conversation.thread,
      "Admin detail did not include the client email thread",
    );

    equal(
      detail.conversation.thread.id,
      threadResult.thread.id,
    );

    equal(
      detail.conversation.thread.commissionId,
      firstId,
    );

    equal(
      detail.conversation.thread.subject,
      conversationSubject,
    );

    console.log(
      "[OK] Admin detail includes the commission client email thread",
    );

    equal(
      detail.conversation.messages.length,
      2,
    );

    equal(
      detail.conversation.messages[0]?.id,
      firstClientMessage.id,
    );

    equal(
      detail.conversation.messages[1]?.id,
      secondClientMessage.id,
    );

    equal(
      detail.conversation.messages.every(
        (message) =>
          message.scope ===
          "client_thread",
      ),
      true,
    );

    console.log(
      "[OK] Admin conversation includes client-thread messages in chronological order",
    );

    equal(
      detail.conversation.messages.some(
        (message) =>
          message.kind ===
          "internal_inquiry_notification",
      ),
      false,
    );

    console.log(
      "[OK] Internal email notifications are excluded from the client conversation",
    );

    /*
     * A commission that has not initialized email
     * communication must still return a valid empty
     * conversation projection.
     */
    const emptyConversationDetail =
      await getAdminCommissionDetail(
        secondId,
      );

    ok(
      emptyConversationDetail,
    );

    equal(
      emptyConversationDetail
        .conversation.thread,
      null,
    );

    equal(
      emptyConversationDetail
        .conversation.messages.length,
      0,
    );

    console.log(
      "[OK] Admin detail returns an empty conversation when no email thread exists",
    );

    const missingDetail =
      await getAdminCommissionDetail(
        randomUUID(),
      );

    equal(
      missingDetail,
      null,
    );

    console.log(
      "[OK] Missing admin detail returns null",
    );

    console.log(
      "[OK] Commission admin query verification passed",
    );
  } finally {
    if (
      createdIds.length >
      0
    ) {
      /*
       * Email messages reference both commissions and
       * threads, so they must be removed first.
       */
      await db
        .delete(
          commissionEmailMessages,
        )
        .where(
          inArray(
            commissionEmailMessages.commissionId,
            createdIds,
          ),
        );

      await db
        .delete(
          commissionEmailThreads,
        )
        .where(
          inArray(
            commissionEmailThreads.commissionId,
            createdIds,
          ),
        );

      await db.batch([
        db
          .delete(
            commissionEvents,
          )
          .where(
            inArray(
              commissionEvents.commissionId,
              createdIds,
            ),
          ),

        db
          .delete(
            commissionStatusHistory,
          )
          .where(
            inArray(
              commissionStatusHistory.commissionId,
              createdIds,
            ),
          ),

        db
          .delete(
            commissions,
          )
          .where(
            inArray(
              commissions.id,
              createdIds,
            ),
          ),
      ]);

      const remainingRows =
        await db
          .select({
            id:
              commissions.id,
          })
          .from(
            commissions,
          )
          .where(
            inArray(
              commissions.id,
              createdIds,
            ),
          );

      equal(
        remainingRows.length,
        0,
      );

      const restoredCounts =
        await getCommissionStatusCounts();

      equal(
        restoredCounts.received,
        baselineCounts.received,
      );

      console.log(
        "[OK] Temporary admin query data was removed",
      );
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "Commission admin query verification failed:",
      error,
    );

    process.exitCode = 1;
  },
);