ALTER TABLE "commission_email_messages"
  DROP CONSTRAINT "commission_email_messages_delivery_state_check";
--> statement-breakpoint

ALTER TABLE "commission_email_messages"
  ALTER COLUMN "delivery_status" DROP DEFAULT;
--> statement-breakpoint

ALTER TABLE "commission_email_messages"
  ALTER COLUMN "delivery_status"
  TYPE text
  USING "delivery_status"::text;
--> statement-breakpoint

DROP TYPE "public"."commission_email_delivery_status";
--> statement-breakpoint

CREATE TYPE "public"."commission_email_delivery_status" AS ENUM (
  'queued',
  'sending',
  'sent',
  'failed',
  'received'
);
--> statement-breakpoint

ALTER TABLE "commission_email_messages"
  ALTER COLUMN "delivery_status"
  TYPE "public"."commission_email_delivery_status"
  USING "delivery_status"::"public"."commission_email_delivery_status";
--> statement-breakpoint

ALTER TABLE "commission_email_messages"
  ALTER COLUMN "delivery_status"
  SET DEFAULT 'queued'::"public"."commission_email_delivery_status";
--> statement-breakpoint

ALTER TABLE "commission_email_messages"
  ADD CONSTRAINT "commission_email_messages_delivery_state_check"
  CHECK (
    (
      "commission_email_messages"."direction" = 'outbound'
      AND (
        (
          "commission_email_messages"."delivery_status" = 'queued'
          AND "commission_email_messages"."sent_at" IS NULL
          AND "commission_email_messages"."failed_at" IS NULL
          AND "commission_email_messages"."attempt_count" = 0
          AND "commission_email_messages"."last_attempt_at" IS NULL
        )
        OR
        (
          "commission_email_messages"."delivery_status" = 'sending'
          AND "commission_email_messages"."sent_at" IS NULL
          AND "commission_email_messages"."failed_at" IS NULL
          AND "commission_email_messages"."attempt_count" > 0
          AND "commission_email_messages"."last_attempt_at" IS NOT NULL
        )
        OR
        (
          "commission_email_messages"."delivery_status" = 'sent'
          AND "commission_email_messages"."sent_at" IS NOT NULL
          AND "commission_email_messages"."failed_at" IS NULL
          AND "commission_email_messages"."attempt_count" > 0
          AND "commission_email_messages"."last_attempt_at" IS NOT NULL
        )
        OR
        (
          "commission_email_messages"."delivery_status" = 'failed'
          AND "commission_email_messages"."sent_at" IS NULL
          AND "commission_email_messages"."failed_at" IS NOT NULL
          AND "commission_email_messages"."attempt_count" > 0
          AND "commission_email_messages"."last_attempt_at" IS NOT NULL
        )
      )
    )
    OR
    (
      "commission_email_messages"."direction" = 'inbound'
      AND "commission_email_messages"."delivery_status" = 'received'
      AND "commission_email_messages"."sent_at" IS NULL
      AND "commission_email_messages"."failed_at" IS NULL
      AND "commission_email_messages"."attempt_count" = 0
      AND "commission_email_messages"."last_attempt_at" IS NULL
    )
  );