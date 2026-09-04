CREATE UNIQUE INDEX "commission_quotes_commission_active_unique" ON "commission_quotes" USING btree ("commission_id") WHERE
            "commission_quotes"."status"
            IN ('draft', 'sent')
          ;--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD CONSTRAINT "commission_quotes_status_dates_check" CHECK (
          (
            "commission_quotes"."status" = 'draft'
            AND "commission_quotes"."sent_at" IS NULL
            AND "commission_quotes"."accepted_at" IS NULL
            AND "commission_quotes"."declined_at" IS NULL
            AND "commission_quotes"."expired_at" IS NULL
          )
          OR
          (
            "commission_quotes"."status" = 'sent'
            AND "commission_quotes"."valid_until" IS NOT NULL
            AND "commission_quotes"."sent_at" IS NOT NULL
            AND "commission_quotes"."accepted_at" IS NULL
            AND "commission_quotes"."declined_at" IS NULL
            AND "commission_quotes"."expired_at" IS NULL
          )
          OR
          (
            "commission_quotes"."status" = 'accepted'
            AND "commission_quotes"."valid_until" IS NOT NULL
            AND "commission_quotes"."sent_at" IS NOT NULL
            AND "commission_quotes"."accepted_at" IS NOT NULL
            AND "commission_quotes"."declined_at" IS NULL
            AND "commission_quotes"."expired_at" IS NULL
          )
          OR
          (
            "commission_quotes"."status" = 'declined'
            AND "commission_quotes"."valid_until" IS NOT NULL
            AND "commission_quotes"."sent_at" IS NOT NULL
            AND "commission_quotes"."accepted_at" IS NULL
            AND "commission_quotes"."declined_at" IS NOT NULL
            AND "commission_quotes"."expired_at" IS NULL
          )
          OR
          (
            "commission_quotes"."status" = 'expired'
            AND "commission_quotes"."valid_until" IS NOT NULL
            AND "commission_quotes"."sent_at" IS NOT NULL
            AND "commission_quotes"."accepted_at" IS NULL
            AND "commission_quotes"."declined_at" IS NULL
            AND "commission_quotes"."expired_at" IS NOT NULL
          )
          OR
          (
            "commission_quotes"."status" = 'superseded'
            AND "commission_quotes"."valid_until" IS NOT NULL
            AND "commission_quotes"."sent_at" IS NOT NULL
            AND "commission_quotes"."accepted_at" IS NULL
            AND "commission_quotes"."declined_at" IS NULL
            AND "commission_quotes"."expired_at" IS NULL
          )
        );
