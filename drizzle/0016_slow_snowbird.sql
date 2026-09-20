ALTER TYPE "public"."commission_status" ADD VALUE 'awaiting_agreement' BEFORE 'awaiting_payment';--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'commission_agreement_executed' BEFORE 'commission_confirmation';--> statement-breakpoint
ALTER TABLE "commission_agreements" DROP CONSTRAINT "commission_agreements_acceptance_check";--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "executed_document_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "agreement_data" jsonb;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "public_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "public_token_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "public_token_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD COLUMN "acceptance_statement_version" varchar(50);--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_executed_document_id_commission_documents_id_fk" FOREIGN KEY ("executed_document_id") REFERENCES "public"."commission_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_agreements_public_token_hash_unique" ON "commission_agreements" USING btree ("public_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_agreements_executed_document_id_unique" ON "commission_agreements" USING btree ("executed_document_id") WHERE "commission_agreements"."executed_document_id" IS NOT NULL;--> statement-breakpoint
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
      );