import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  resend,
} from "@/lib/email/emailClient";
import {
  processCommissionEmailSentEvent,
} from "@/lib/email/commissionEmailSentWebhookService";

const TRACKING_TAG_NAME =
  "fefierys_comm_message_id";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getRequiredString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value =
    record[key];

  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized || null;
}

function getTrackingMessageId(
  tags: unknown,
): string | null {
  if (isRecord(tags)) {
    return getRequiredString(
      tags,
      TRACKING_TAG_NAME,
    );
  }

  /*
   * The current Resend webhook shape exposes tags as an object. Supporting
   * the send-style array form as well keeps this route tolerant of payload
   * representation changes without weakening signature verification.
   */
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (!isRecord(tag)) {
        continue;
      }

      if (
        tag.name ===
          TRACKING_TAG_NAME &&
        typeof tag.value ===
          "string"
      ) {
        const normalized =
          tag.value.trim();

        if (normalized) {
          return normalized;
        }
      }
    }
  }

  return null;
}

function parseProviderSentAt(
  data: Record<string, unknown>,
  event: Record<string, unknown>,
): Date | null {
  const value =
    getRequiredString(
      data,
      "created_at",
    ) ??
    getRequiredString(
      event,
      "created_at",
    );

  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime(),
  )
    ? null
    : parsed;
}

export async function POST(
  request: NextRequest,
) {
  const webhookSecret =
    process.env.RESEND_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    return NextResponse.json(
      {
        error:
          "Webhook is not configured.",
      },
      {
        status: 503,
      },
    );
  }

  const svixId =
    request.headers.get(
      "svix-id",
    );
  const svixTimestamp =
    request.headers.get(
      "svix-timestamp",
    );
  const svixSignature =
    request.headers.get(
      "svix-signature",
    );

  if (
    !svixId ||
    !svixTimestamp ||
    !svixSignature
  ) {
    return NextResponse.json(
      {
        error:
          "Missing webhook signature headers.",
      },
      {
        status: 400,
      },
    );
  }

  const payload =
    await request.text();

  let verifiedEvent: unknown;

  try {
    verifiedEvent =
      await resend.webhooks.verify({
        payload,
        headers: {
          id: svixId,
          timestamp:
            svixTimestamp,
          signature:
            svixSignature,
        },
        webhookSecret,
      });
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid webhook signature.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isRecord(verifiedEvent)) {
    return NextResponse.json(
      {
        error:
          "Invalid webhook payload.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    verifiedEvent.type !==
    "email.sent"
  ) {
    return NextResponse.json({
      ok: true,
      ignored: true,
    });
  }

  const data =
    verifiedEvent.data;

  if (!isRecord(data)) {
    return NextResponse.json(
      {
        error:
          "Invalid email.sent payload.",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * Only emails sent through the persisted commission-email pipeline carry
   * this tag. Direct/legacy Resend sends (for example the temporary owner
   * inquiry notification) are intentionally ignored.
   */
  const messageId =
    getTrackingMessageId(
      data.tags,
    );

  if (!messageId) {
    return NextResponse.json({
      ok: true,
      ignored: true,
    });
  }

  const providerEmailId =
    getRequiredString(
      data,
      "email_id",
    );
  const providerMessageId =
    getRequiredString(
      data,
      "message_id",
    );
  const sentAt =
    parseProviderSentAt(
      data,
      verifiedEvent,
    );

  if (
    !providerEmailId ||
    !providerMessageId ||
    !sentAt
  ) {
    return NextResponse.json(
      {
        error:
          "Tracked email.sent event is missing required fields.",
      },
      {
        status: 400,
      },
    );
  }

  const result =
    await processCommissionEmailSentEvent({
      messageId,
      providerEmailId,
      providerMessageId,
      sentAt,
    });

  if (
    result.outcome ===
    "conflict" ||
    result.outcome ===
    "invalid_state"
  ) {
    return NextResponse.json(
      {
        error:
          "Webhook event conflicts with persisted commission email state.",
      },
      {
        status: 409,
      },
    );
  }

  if (
    result.outcome ===
    "not_found"
  ) {
    /*
     * The logical message exists before the provider send starts, so a
     * signed event for an unknown tagged message is not an ordering race.
     * Acknowledge it to avoid useless provider retries for deleted test data
     * or stale historical events.
     */
    return NextResponse.json({
      ok: true,
      ignored: true,
    });
  }

  return NextResponse.json({
    ok: true,
    outcome:
      result.outcome,
  });
}
