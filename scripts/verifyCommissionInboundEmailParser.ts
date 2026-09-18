import {
  deepEqual,
  equal,
  rejects,
} from "node:assert/strict";

import type {
  CommissionInboundEmail,
} from "../lib/email/commissionInboundEmailProvider";

import {
  extractCommissionInboundSenderEmail,
  getCommissionInboundHeader,
  parseCommissionInboundEmail,
} from "../lib/email/commissionInboundEmailParser";

function createEmail(
  overrides: Partial<CommissionInboundEmail> = {},
): CommissionInboundEmail {
  return {
    providerEmailId:
      "resend-received-123",

    providerMessageId:
      "<client-reply@example.com>",

    from:
      "Example Client <client@example.com>",

    to: [
      "reply@reply.fefierys.com",
    ],

    subject:
      "Re: Fefierys Art — Your project — TEST-123",

    text:
      "Hello!\n\nYes, that works for me.",

    html:
      "<p>Hello!</p><p>Yes, that works for me.</p>",

    headers: {
      "Message-ID":
        "<client-reply@example.com>",

      "IN-REPLY-TO":
        "<root@email.fefierys.test>",

      References:
        "<root@email.fefierys.test> <previous@email.fefierys.test>",
    },

    receivedAt:
      new Date(
        "2026-09-18T14:00:00.000Z",
      ),

    ...overrides,
  };
}

async function main(): Promise<void> {
  equal(
    extractCommissionInboundSenderEmail(
      "Example Client <client@example.com>",
    ),
    "client@example.com",
  );

  equal(
    extractCommissionInboundSenderEmail(
      "client@example.com",
    ),
    "client@example.com",
  );

  console.log(
    "[OK] From parser accepts display-name and bare mailbox forms",
  );

  const headers = {
    "IN-REPLY-TO":
      "  <root@example.com>  ",

    references:
      "<root@example.com> <second@example.com>",
  };

  equal(
    getCommissionInboundHeader(
      headers,
      "In-Reply-To",
    ),
    "<root@example.com>",
  );

  equal(
    getCommissionInboundHeader(
      headers,
      "REFERENCES",
    ),
    "<root@example.com> <second@example.com>",
  );

  equal(
    getCommissionInboundHeader(
      headers,
      "X-Unknown",
    ),
    null,
  );

  console.log(
    "[OK] Header lookup is case-insensitive and trims values",
  );

  const parsed =
    parseCommissionInboundEmail(
      createEmail(),
    );

  equal(
    parsed.providerEmailId,
    "resend-received-123",
  );

  equal(
    parsed.providerMessageId,
    "<client-reply@example.com>",
  );

  equal(
    parsed.senderEmail,
    "client@example.com",
  );

  deepEqual(
    parsed.recipientEmails,
    [
      "reply@reply.fefierys.com",
    ],
  );

  equal(
    parsed.messageText,
    "Hello!\n\nYes, that works for me.",
  );

  equal(
    parsed.inReplyToMessageId,
    "<root@email.fefierys.test>",
  );

  equal(
    parsed.referencesHeader,
    "<root@email.fefierys.test> <previous@email.fefierys.test>",
  );

  equal(
    parsed.receivedAt.getTime(),
    new Date(
      "2026-09-18T14:00:00.000Z",
    ).getTime(),
  );

  console.log(
    "[OK] Received Resend email is normalized into commission reply input",
  );

  const deduplicatedRecipients =
    parseCommissionInboundEmail(
      createEmail({
        to: [
          "reply@reply.fefierys.com",
          "reply@reply.fefierys.com",
        ],
      }),
    );

  deepEqual(
    deduplicatedRecipients.recipientEmails,
    [
      "reply@reply.fefierys.com",
    ],
  );

  console.log(
    "[OK] Duplicate recipient addresses are normalized",
  );

  const noThreadHeaders =
    parseCommissionInboundEmail(
      createEmail({
        headers: {},
      }),
    );

  equal(
    noThreadHeaders.inReplyToMessageId,
    null,
  );

  equal(
    noThreadHeaders.referencesHeader,
    null,
  );

  console.log(
    "[OK] Missing reply headers remain null for the resolver to reject safely",
  );

  await rejects(
    async () => {
      parseCommissionInboundEmail(
        createEmail({
          from:
            "not-an-email",
        }),
      );
    },
    /valid mailbox address/,
  );

  console.log(
    "[OK] Invalid From mailbox is rejected",
  );

  await rejects(
    async () => {
      parseCommissionInboundEmail(
        createEmail({
          from:
            "One <one@example.com>, Two <two@example.com>",
        }),
      );
    },
    /more than one mailbox/,
  );

  console.log(
    "[OK] Multiple From mailboxes are rejected",
  );

  await rejects(
    async () => {
      parseCommissionInboundEmail(
        createEmail({
          text:
            null,
        }),
      );
    },
    /plain-text body/,
  );

  console.log(
    "[OK] Email without a plain-text body is not silently converted from HTML",
  );

  await rejects(
    async () => {
      parseCommissionInboundEmail(
        createEmail({
          to: [],
        }),
      );
    },
    /does not contain a recipient/,
  );

  console.log(
    "[OK] Email without recipients is rejected",
  );

  console.log(
    "[OK] Commission inbound email parser verification passed",
  );
}

main().catch(
  (
    error: unknown,
  ) => {
    console.error(
      "[ERROR] Commission inbound email parser verification failed",
      error,
    );

    process.exitCode =
      1;
  },
);