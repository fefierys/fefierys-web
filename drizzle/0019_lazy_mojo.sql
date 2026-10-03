ALTER TYPE "public"."commission_email_delivery_status" ADD VALUE 'received';--> statement-breakpoint
ALTER TYPE "public"."commission_status" ADD VALUE 'awaiting_agreement' BEFORE 'awaiting_payment';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'commission_agreement_executed' BEFORE 'commission_confirmation';--> statement-breakpoint
CREATE TABLE "commission_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"title" varchar(150) NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_deliverables_sequence_check" CHECK ("commission_deliverables"."sequence" >= 1),
	CONSTRAINT "commission_deliverables_quantity_check" CHECK ("commission_deliverables"."quantity" >= 1),
	CONSTRAINT "commission_deliverables_title_check" CHECK (char_length(trim("commission_deliverables"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "commission_agreements" DROP CONSTRAINT "commission_agreements_acceptance_check";--> statement-breakpoint
ALTER TABLE "commission_email_messages" DROP CONSTRAINT "commission_email_messages_delivery_state_check";--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "executed_document_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "agreement_data" jsonb;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "public_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "public_token_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "public_token_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "acceptance_statement_version" varchar(50);--> statement-breakpoint
ALTER TABLE "commission_payment_installments" ADD COLUMN "deliverable_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_deliverables" ADD CONSTRAINT "commission_deliverables_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_deliverables" ADD CONSTRAINT "commission_deliverables_quote_id_commission_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."commission_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_deliverables" ADD CONSTRAINT "commission_deliverables_quote_commission_fk" FOREIGN KEY ("commission_id","quote_id") REFERENCES "public"."commission_quotes"("commission_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_deliverables_id_commission_quote_unique" ON "commission_deliverables" USING btree ("id","commission_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_deliverables_quote_sequence_unique" ON "commission_deliverables" USING btree ("quote_id","sequence");--> statement-breakpoint
CREATE INDEX "commission_deliverables_commission_id_idx" ON "commission_deliverables" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_deliverables_quote_id_idx" ON "commission_deliverables" USING btree ("quote_id");--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_executed_document_id_commission_documents_id_fk" FOREIGN KEY ("executed_document_id") REFERENCES "public"."commission_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payment_installments" ADD CONSTRAINT "commission_payment_installments_deliverable_id_commission_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."commission_deliverables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payment_installments" ADD CONSTRAINT "commission_installments_deliverable_scope_fk" FOREIGN KEY ("deliverable_id","commission_id","quote_id") REFERENCES "public"."commission_deliverables"("id","commission_id","quote_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_agreements_commission_active_unique" ON "commission_agreements" USING btree ("commission_id") WHERE
          "commission_agreements"."status" IN ('draft', 'sent')
        ;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_agreements_public_token_hash_unique" ON "commission_agreements" USING btree ("public_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_agreements_executed_document_id_unique" ON "commission_agreements" USING btree ("executed_document_id") WHERE "commission_agreements"."executed_document_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "commission_installments_deliverable_id_idx" ON "commission_payment_installments" USING btree ("deliverable_id");--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_public_token_state_check" CHECK (
        (
          "commission_agreements"."public_token_hash" IS NULL
          AND "commission_agreements"."public_token_created_at" IS NULL
          AND "commission_agreements"."public_token_revoked_at" IS NULL
        )
        OR
        (
          "commission_agreements"."public_token_hash" IS NOT NULL
          AND "commission_agreements"."public_token_created_at" IS NOT NULL
          AND char_length("commission_agreements"."public_token_hash") = 64
        )
      );--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_acceptance_check" CHECK (
        "commission_agreements"."status" != 'accepted'
        OR (
          "commission_agreements"."accepted_by_name" IS NOT NULL
          AND "commission_agreements"."accepted_by_email" IS NOT NULL
          AND "commission_agreements"."acceptance_method" IS NOT NULL
          AND "commission_agreements"."accepted_at" IS NOT NULL
          AND (
            "commission_agreements"."acceptance_method" != 'electronic'
            OR "commission_agreements"."acceptance_statement_version" IS NOT NULL
          )
        )
      );--> statement-breakpoint
ALTER TABLE "commission_email_messages" ADD CONSTRAINT "commission_email_messages_delivery_state_check" CHECK (
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