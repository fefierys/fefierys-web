ALTER TABLE "commission_quotes" ADD COLUMN "public_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD COLUMN "public_token_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD COLUMN "public_token_revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_quotes_public_token_hash_unique" ON "commission_quotes" USING btree ("public_token_hash");--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD CONSTRAINT "commission_quotes_public_token_state_check" CHECK (
        (
          "commission_quotes"."public_token_hash" IS NULL
          AND "commission_quotes"."public_token_created_at" IS NULL
          AND "commission_quotes"."public_token_revoked_at" IS NULL
        )
        OR
        (
          "commission_quotes"."public_token_hash" IS NOT NULL
          AND "commission_quotes"."public_token_created_at" IS NOT NULL
          AND char_length("commission_quotes"."public_token_hash") = 64
        )
      );