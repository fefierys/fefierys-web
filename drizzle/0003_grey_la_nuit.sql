CREATE TYPE "public"."acceptance_method" AS ENUM('electronic', 'manual', 'external_signature');--> statement-breakpoint
CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'sent', 'accepted', 'superseded', 'voided');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'changes_requested', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."approval_type" AS ENUM('sketch', 'final', 'amendment');--> statement-breakpoint
CREATE TYPE "public"."commission_actor" AS ENUM('client', 'artist', 'system');--> statement-breakpoint
CREATE TYPE "public"."commission_close_reason" AS ENUM('client_cancelled', 'artist_cancelled', 'mutual_cancellation', 'artist_declined_request', 'client_declined_quote', 'quote_expired', 'client_details_timeout', 'payment_timeout', 'other');--> statement-breakpoint
CREATE TYPE "public"."commission_event_type" AS ENUM('commission_received', 'client_contacted', 'client_details_requested', 'client_details_received', 'quote_created', 'quote_sent', 'quote_accepted', 'quote_declined', 'quote_expired', 'agreement_created', 'agreement_sent', 'agreement_accepted', 'terms_accepted', 'payment_due', 'payment_received', 'payment_overdue', 'payment_refunded', 'work_started', 'sketch_submitted', 'sketch_revision_requested', 'sketch_approved', 'final_preview_sent', 'final_delivered', 'final_revision_requested', 'final_approved', 'commission_paused', 'commission_resumed', 'document_generated', 'document_sent', 'commission_completed', 'commission_cancelled', 'commission_declined', 'commission_expired', 'note_added');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('received', 'under_review', 'awaiting_client_details', 'quoting', 'awaiting_quote_response', 'awaiting_payment', 'in_progress', 'sketch_review', 'sketch_revision', 'final_preview', 'final_review', 'final_revision', 'completed', 'cancelled', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('draft', 'generated', 'sent', 'send_failed', 'voided');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('quote', 'commission_agreement', 'commission_confirmation', 'payment_acknowledgement', 'commission_amendment', 'completion_summary', 'cancellation_summary', 'refund_acknowledgement', 'other');--> statement-breakpoint
CREATE TYPE "public"."installment_status" AS ENUM('pending', 'due', 'paid', 'overdue', 'waived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."installment_trigger" AS ENUM('before_start', 'after_sketch_approval', 'before_final_delivery', 'custom');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('paypal', 'bank_transfer', 'wise', 'stripe', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'failed', 'partially_refunded', 'refunded', 'voided');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('installment', 'additional', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'declined', 'expired', 'superseded');--> statement-breakpoint
CREATE TABLE "commission_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"document_id" uuid,
	"version" integer NOT NULL,
	"terms_version" varchar(50) NOT NULL,
	"agreement_version" varchar(50) NOT NULL,
	"status" "agreement_status" DEFAULT 'draft' NOT NULL,
	"accepted_by_name" varchar(200),
	"accepted_by_email" varchar(320),
	"acceptance_method" "acceptance_method",
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_agreements_version_check" CHECK (
          "commission_agreements"."version" >= 1
        ),
	CONSTRAINT "commission_agreements_acceptance_check" CHECK (
          "commission_agreements"."status" != 'accepted'
          OR (
            "commission_agreements"."accepted_by_name" IS NOT NULL
            AND "commission_agreements"."accepted_by_email" IS NOT NULL
            AND "commission_agreements"."acceptance_method" IS NOT NULL
            AND "commission_agreements"."accepted_at" IS NOT NULL
          )
        )
);
--> statement-breakpoint
CREATE TABLE "commission_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"type" "approval_type" NOT NULL,
	"revision_number" integer,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"client_name" varchar(200) NOT NULL,
	"client_email" varchar(320) NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"client_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_approvals_revision_number_check" CHECK (
          "commission_approvals"."revision_number"
          IS NULL
          OR "commission_approvals"."revision_number" >= 1
        ),
	CONSTRAINT "commission_approvals_response_check" CHECK (
          "commission_approvals"."responded_at" IS NULL
          OR "commission_approvals"."status" != 'pending'
        )
);
--> statement-breakpoint
CREATE TABLE "commission_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"document_number" varchar(100),
	"version" integer NOT NULL,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"storage_key" text,
	"content_sha256" varchar(64),
	"recipient_email" varchar(320),
	"generated_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_documents_version_check" CHECK (
          "commission_documents"."version" >= 1
        ),
	CONSTRAINT "commission_documents_sha256_check" CHECK (
          "commission_documents"."content_sha256" IS NULL
          OR char_length(
            "commission_documents"."content_sha256"
          ) = 64
        ),
	CONSTRAINT "commission_documents_generated_file_check" CHECK (
          "commission_documents"."status" = 'draft'
          OR (
            "commission_documents"."storage_key" IS NOT NULL
            AND "commission_documents"."content_sha256" IS NOT NULL
            AND "commission_documents"."generated_at" IS NOT NULL
          )
        )
);
--> statement-breakpoint
CREATE TABLE "commission_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"type" "commission_event_type" NOT NULL,
	"actor" "commission_actor" NOT NULL,
	"title" varchar(250) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_by_admin_user_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_payment_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" varchar(500) NOT NULL,
	"mime_type" varchar(150) NOT NULL,
	"size_bytes" integer NOT NULL,
	"content_sha256" varchar(64) NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_payment_evidence_size_check" CHECK (
          "commission_payment_evidence"."size_bytes" > 0
        ),
	CONSTRAINT "commission_payment_evidence_sha256_length_check" CHECK (
          char_length(
            "commission_payment_evidence"."content_sha256"
          ) = 64
        )
);
--> statement-breakpoint
CREATE TABLE "commission_payment_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"label" varchar(150) NOT NULL,
	"percentage" numeric(5, 2),
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"trigger" "installment_trigger" NOT NULL,
	"custom_trigger_note" text,
	"status" "installment_status" DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone,
	"became_due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_installments_sequence_check" CHECK (
          "commission_payment_installments"."sequence" >= 1
        ),
	CONSTRAINT "commission_installments_amount_check" CHECK (
          "commission_payment_installments"."amount" >= 0
        ),
	CONSTRAINT "commission_installments_percentage_check" CHECK (
          "commission_payment_installments"."percentage"
          IS NULL
          OR (
            "commission_payment_installments"."percentage" > 0
            AND "commission_payment_installments"."percentage" <= 100
          )
        ),
	CONSTRAINT "commission_installments_currency_check" CHECK (
          "commission_payment_installments"."currency"
          =
          upper("commission_payment_installments"."currency")
        ),
	CONSTRAINT "commission_installments_custom_trigger_check" CHECK (
          "commission_payment_installments"."trigger" != 'custom'
          OR "commission_payment_installments"."custom_trigger_note" IS NOT NULL
        ),
	CONSTRAINT "commission_installments_paid_at_check" CHECK (
          "commission_payment_installments"."paid_at" IS NULL
          OR "commission_payment_installments"."status" = 'paid'
        )
);
--> statement-breakpoint
CREATE TABLE "commission_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"installment_id" uuid,
	"type" "payment_type" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"method" "payment_method",
	"method_label" varchar(150),
	"transaction_reference" varchar(250),
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_payments_amount_check" CHECK (
          "commission_payments"."amount" > 0
        ),
	CONSTRAINT "commission_payments_currency_check" CHECK (
          "commission_payments"."currency"
          =
          upper("commission_payments"."currency")
        ),
	CONSTRAINT "commission_payments_method_label_check" CHECK (
          "commission_payments"."method" != 'other'
          OR "commission_payments"."method_label" IS NOT NULL
        ),
	CONSTRAINT "commission_payments_paid_at_check" CHECK (
          "commission_payments"."paid_at" IS NULL
          OR "commission_payments"."status" IN (
            'confirmed',
            'partially_refunded',
            'refunded'
          )
        )
);
--> statement-breakpoint
CREATE TABLE "commission_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"currency" varchar(3) NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"description" text,
	"notes" text,
	"valid_until" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_quotes_version_check" CHECK (
          "commission_quotes"."version" >= 1
        ),
	CONSTRAINT "commission_quotes_total_amount_check" CHECK (
          "commission_quotes"."total_amount" >= 0
        ),
	CONSTRAINT "commission_quotes_currency_check" CHECK (
          "commission_quotes"."currency"
          =
          upper("commission_quotes"."currency")
        )
);
--> statement-breakpoint
CREATE TABLE "commission_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"from_status" "commission_status",
	"to_status" "commission_status" NOT NULL,
	"initiated_by" "commission_actor" NOT NULL,
	"reason" varchar(150),
	"note" text,
	"changed_by_admin_user_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_status_history_transition_check" CHECK (
          "commission_status_history"."from_status" IS NULL
          OR "commission_status_history"."from_status" != "commission_status_history"."to_status"
        )
);
--> statement-breakpoint
CREATE TABLE "commission_tax_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"payment_id" uuid,
	"type_code" varchar(50) NOT NULL,
	"type_label" varchar(200) NOT NULL,
	"document_number" varchar(150) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"storage_key" text,
	"content_sha256" varchar(64),
	"external_reference" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_tax_documents_amount_check" CHECK (
          "commission_tax_documents"."amount" > 0
        ),
	CONSTRAINT "commission_tax_documents_currency_check" CHECK (
          "commission_tax_documents"."currency"
          =
          upper("commission_tax_documents"."currency")
        ),
	CONSTRAINT "commission_tax_documents_sha256_check" CHECK (
          "commission_tax_documents"."content_sha256" IS NULL
          OR char_length(
            "commission_tax_documents"."content_sha256"
          ) = 64
        ),
	CONSTRAINT "commission_tax_documents_file_hash_check" CHECK (
          "commission_tax_documents"."storage_key" IS NULL
          OR "commission_tax_documents"."content_sha256" IS NOT NULL
        )
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(32) NOT NULL,
	"client_name" varchar(200) NOT NULL,
	"client_email" varchar(320) NOT NULL,
	"client_company_name" varchar(250),
	"client_country" varchar(100),
	"style_snapshot" varchar(200),
	"collection_snapshot" varchar(200),
	"category_snapshot" varchar(200),
	"option_snapshot" varchar(200),
	"initial_message" text NOT NULL,
	"status" "commission_status" DEFAULT 'received' NOT NULL,
	"close_reason" "commission_close_reason",
	"close_reason_note" text,
	"closed_by" "commission_actor",
	"is_on_hold" boolean DEFAULT false NOT NULL,
	"hold_reason" text,
	"hold_started_at" timestamp with time zone,
	"terms_version" varchar(50),
	"agreement_version" varchar(50),
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"final_delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commissions_hold_state_check" CHECK (
        (
          "commissions"."is_on_hold" = true
          AND "commissions"."hold_started_at" IS NOT NULL
        )
        OR
        (
          "commissions"."is_on_hold" = false
          AND "commissions"."hold_started_at" IS NULL
        )
      ),
	CONSTRAINT "commissions_completed_at_check" CHECK (
        "commissions"."completed_at" IS NULL
        OR "commissions"."status" = 'completed'
      ),
	CONSTRAINT "commissions_closed_at_check" CHECK (
        "commissions"."closed_at" IS NULL
        OR "commissions"."status" IN (
          'completed',
          'cancelled',
          'declined',
          'expired'
        )
      )
);
--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_quote_id_commission_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."commission_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_document_id_commission_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."commission_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_approvals" ADD CONSTRAINT "commission_approvals_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_documents" ADD CONSTRAINT "commission_documents_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_events" ADD CONSTRAINT "commission_events_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payment_evidence" ADD CONSTRAINT "commission_payment_evidence_payment_id_commission_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."commission_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payment_installments" ADD CONSTRAINT "commission_payment_installments_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payment_installments" ADD CONSTRAINT "commission_payment_installments_quote_id_commission_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."commission_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_installment_id_commission_payment_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."commission_payment_installments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD CONSTRAINT "commission_quotes_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_status_history" ADD CONSTRAINT "commission_status_history_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_tax_documents" ADD CONSTRAINT "commission_tax_documents_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_tax_documents" ADD CONSTRAINT "commission_tax_documents_payment_id_commission_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."commission_payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_agreements_commission_version_unique" ON "commission_agreements" USING btree ("commission_id","version");--> statement-breakpoint
CREATE INDEX "commission_agreements_commission_id_idx" ON "commission_agreements" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_agreements_quote_id_idx" ON "commission_agreements" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "commission_agreements_status_idx" ON "commission_agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_approvals_commission_id_idx" ON "commission_approvals" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_approvals_status_idx" ON "commission_approvals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_documents_commission_type_version_unique" ON "commission_documents" USING btree ("commission_id","type","version");--> statement-breakpoint
CREATE INDEX "commission_documents_commission_id_idx" ON "commission_documents" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_documents_status_idx" ON "commission_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_events_commission_created_idx" ON "commission_events" USING btree ("commission_id","created_at");--> statement-breakpoint
CREATE INDEX "commission_events_type_idx" ON "commission_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "commission_payment_evidence_payment_id_idx" ON "commission_payment_evidence" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_payment_evidence_storage_key_unique" ON "commission_payment_evidence" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_installments_quote_sequence_unique" ON "commission_payment_installments" USING btree ("quote_id","sequence");--> statement-breakpoint
CREATE INDEX "commission_installments_commission_id_idx" ON "commission_payment_installments" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_installments_quote_id_idx" ON "commission_payment_installments" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "commission_installments_status_idx" ON "commission_payment_installments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_installments_due_at_idx" ON "commission_payment_installments" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "commission_payments_commission_id_idx" ON "commission_payments" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_payments_installment_id_idx" ON "commission_payments" USING btree ("installment_id");--> statement-breakpoint
CREATE INDEX "commission_payments_status_idx" ON "commission_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_payments_paid_at_idx" ON "commission_payments" USING btree ("paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_quotes_commission_version_unique" ON "commission_quotes" USING btree ("commission_id","version");--> statement-breakpoint
CREATE INDEX "commission_quotes_commission_id_idx" ON "commission_quotes" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_quotes_status_idx" ON "commission_quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commission_status_history_commission_created_idx" ON "commission_status_history" USING btree ("commission_id","created_at");--> statement-breakpoint
CREATE INDEX "commission_status_history_to_status_idx" ON "commission_status_history" USING btree ("to_status");--> statement-breakpoint
CREATE INDEX "commission_tax_documents_commission_id_idx" ON "commission_tax_documents" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_tax_documents_payment_id_idx" ON "commission_tax_documents" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "commission_tax_documents_issued_at_idx" ON "commission_tax_documents" USING btree ("issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commissions_reference_unique" ON "commissions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "commissions_status_idx" ON "commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "commissions_client_email_idx" ON "commissions" USING btree ("client_email");--> statement-breakpoint
CREATE INDEX "commissions_created_at_idx" ON "commissions" USING btree ("created_at");