CREATE TYPE "public"."commission_email_delivery_status" AS ENUM('queued', 'sending', 'sent', 'failed');--> statement-breakpoint

CREATE TYPE "public"."commission_email_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint

CREATE TYPE "public"."commission_email_kind" AS ENUM('inquiry_confirmation', 'internal_inquiry_notification', 'client_details_request', 'general_message', 'quote_ready', 'agreement_ready', 'payment_request', 'payment_confirmation', 'sketch_review', 'final_review', 'final_delivery', 'commission_completed');--> statement-breakpoint

CREATE TYPE "public"."commission_email_scope" AS ENUM('client_thread', 'internal_notification');--> statement-breakpoint

CREATE TABLE "commission_email_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "commission_id" uuid NOT NULL,
  "thread_id" uuid,
  "quote_id" uuid,
  "scope" "commission_email_scope" NOT NULL,
  "direction" "commission_email_direction" DEFAULT 'outbound' NOT NULL,
  "kind" "commission_email_kind" NOT NULL,
  "actor" "commission_actor" NOT NULL,
  "delivery_status" "commission_email_delivery_status" DEFAULT 'queued' NOT NULL,
  "sender_email" varchar(320) NOT NULL,
  "recipient_email" varchar(320) NOT NULL,
  "reply_to_email" varchar(320),
  "subject" varchar(350) NOT NULL,
  "message_text" text,
  "provider_email_id" varchar(255),
  "provider_message_id" text,
  "in_reply_to_message_id" text,
  "references_header" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "sent_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "failure_message" text,
  "created_by_admin_user_id" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "commission_email_messages_attempt_count_check" CHECK (
    "commission_email_messages"."attempt_count" >= 0
  ),

  CONSTRAINT "commission_email_messages_subject_check" CHECK (
    char_length(
      btrim("commission_email_messages"."subject")
    ) > 0
  ),

  CONSTRAINT "commission_email_messages_scope_thread_check" CHECK (
    (
      "commission_email_messages"."scope" = 'client_thread'
      AND "commission_email_messages"."thread_id" IS NOT NULL
    )
    OR
    (
      "commission_email_messages"."scope" = 'internal_notification'
      AND "commission_email_messages"."thread_id" IS NULL
    )
  ),

  CONSTRAINT "commission_email_messages_delivery_state_check" CHECK (
    (
      "commission_email_messages"."delivery_status" = 'queued'
      AND "commission_email_messages"."sent_at" IS NULL
      AND "commission_email_messages"."failed_at" IS NULL
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
  ),

  CONSTRAINT "commission_email_messages_internal_thread_headers_check" CHECK (
    "commission_email_messages"."scope" != 'internal_notification'
    OR (
      "commission_email_messages"."in_reply_to_message_id" IS NULL
      AND "commission_email_messages"."references_header" IS NULL
    )
  )
);
--> statement-breakpoint

CREATE TABLE "commission_email_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "commission_id" uuid NOT NULL,
  "subject" varchar(350) NOT NULL,
  "root_provider_email_id" varchar(255),
  "root_message_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,

  CONSTRAINT "commission_email_threads_subject_check" CHECK (
    char_length(
      btrim("commission_email_threads"."subject")
    ) > 0
  ),

  CONSTRAINT "commission_email_threads_root_state_check" CHECK (
    (
      "commission_email_threads"."root_provider_email_id" IS NULL
      AND "commission_email_threads"."root_message_id" IS NULL
    )
    OR
    (
      "commission_email_threads"."root_provider_email_id" IS NOT NULL
    )
  )
);
--> statement-breakpoint

-- These two unique indexes must exist BEFORE the composite foreign keys below.
CREATE UNIQUE INDEX "commission_email_threads_commission_id_id_unique"
ON "commission_email_threads" USING btree ("commission_id","id");--> statement-breakpoint

CREATE UNIQUE INDEX "commission_quotes_commission_id_id_unique"
ON "commission_quotes" USING btree ("commission_id","id");--> statement-breakpoint

ALTER TABLE "commission_email_messages"
ADD CONSTRAINT "commission_email_messages_commission_id_commissions_id_fk"
FOREIGN KEY ("commission_id")
REFERENCES "public"."commissions"("id")
ON DELETE restrict
ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "commission_email_messages"
ADD CONSTRAINT "commission_email_messages_commission_thread_fk"
FOREIGN KEY ("commission_id","thread_id")
REFERENCES "public"."commission_email_threads"("commission_id","id")
ON DELETE restrict
ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "commission_email_messages"
ADD CONSTRAINT "commission_email_messages_commission_quote_fk"
FOREIGN KEY ("commission_id","quote_id")
REFERENCES "public"."commission_quotes"("commission_id","id")
ON DELETE restrict
ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "commission_email_threads"
ADD CONSTRAINT "commission_email_threads_commission_id_commissions_id_fk"
FOREIGN KEY ("commission_id")
REFERENCES "public"."commissions"("id")
ON DELETE restrict
ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "commission_email_messages_commission_created_idx"
ON "commission_email_messages" USING btree ("commission_id","created_at");--> statement-breakpoint

CREATE INDEX "commission_email_messages_thread_created_idx"
ON "commission_email_messages" USING btree ("thread_id","created_at");--> statement-breakpoint

CREATE INDEX "commission_email_messages_delivery_status_idx"
ON "commission_email_messages" USING btree ("delivery_status");--> statement-breakpoint

CREATE INDEX "commission_email_messages_quote_idx"
ON "commission_email_messages" USING btree ("quote_id");--> statement-breakpoint

CREATE UNIQUE INDEX "commission_email_messages_provider_email_unique"
ON "commission_email_messages" USING btree ("provider_email_id");--> statement-breakpoint

CREATE UNIQUE INDEX "commission_email_messages_provider_message_unique"
ON "commission_email_messages" USING btree ("provider_message_id");--> statement-breakpoint

CREATE UNIQUE INDEX "commission_email_threads_commission_unique"
ON "commission_email_threads" USING btree ("commission_id");--> statement-breakpoint

CREATE UNIQUE INDEX "commission_email_threads_root_provider_email_unique"
ON "commission_email_threads" USING btree ("root_provider_email_id");--> statement-breakpoint

CREATE UNIQUE INDEX "commission_email_threads_root_message_unique"
ON "commission_email_threads" USING btree ("root_message_id");
