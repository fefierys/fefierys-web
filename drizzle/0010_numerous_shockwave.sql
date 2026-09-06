CREATE TYPE "public"."commission_request_source" AS ENUM('contact', 'portfolio', 'admin');--> statement-breakpoint
CREATE TYPE "public"."commission_service_classification" AS ENUM('unclassified', 'catalog', 'custom');--> statement-breakpoint
ALTER TYPE "public"."commission_event_type" ADD VALUE 'commission_service_classified' BEFORE 'note_added';--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "request_source" "commission_request_source" DEFAULT 'contact' NOT NULL;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "service_classification" "commission_service_classification" DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
UPDATE "commissions"
SET "request_source" = 'portfolio'
WHERE NULLIF(BTRIM("option_snapshot"), '') IS NOT NULL;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "pricing_service_id" uuid;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "pricing_option_id" uuid;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "classified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "classified_by" "commission_actor";--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "classified_by_admin_user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "commissions" ADD COLUMN "classification_note" text;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_pricing_service_id_commission_pricing_services_id_fk" FOREIGN KEY ("pricing_service_id") REFERENCES "public"."commission_pricing_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_pricing_option_id_commission_pricing_options_id_fk" FOREIGN KEY ("pricing_option_id") REFERENCES "public"."commission_pricing_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commissions_service_classification_idx" ON "commissions" USING btree ("service_classification");--> statement-breakpoint
CREATE INDEX "commissions_pricing_option_idx" ON "commissions" USING btree ("pricing_option_id");--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_service_classification_check" CHECK (
        (
          "commissions"."service_classification" = 'unclassified'
          AND "commissions"."pricing_service_id" IS NULL
          AND "commissions"."pricing_option_id" IS NULL
          AND "commissions"."classified_at" IS NULL
          AND "commissions"."classified_by" IS NULL
          AND "commissions"."classified_by_admin_user_id" IS NULL
          AND "commissions"."classification_note" IS NULL
        )
        OR
        (
          "commissions"."service_classification" = 'catalog'
          AND "commissions"."pricing_service_id" IS NOT NULL
          AND "commissions"."pricing_option_id" IS NOT NULL
          AND "commissions"."classified_at" IS NOT NULL
          AND "commissions"."classified_by" IS NOT NULL
        )
        OR
        (
          "commissions"."service_classification" = 'custom'
          AND "commissions"."pricing_service_id" IS NULL
          AND "commissions"."pricing_option_id" IS NULL
          AND "commissions"."classified_at" IS NOT NULL
          AND "commissions"."classified_by" IS NOT NULL
        )
      );--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_classification_admin_actor_check" CHECK (
        (
          "commissions"."classified_by" = 'artist'
          AND "commissions"."classified_by_admin_user_id" IS NOT NULL
        )
        OR
        (
          "commissions"."classified_by" IS DISTINCT FROM 'artist'
          AND "commissions"."classified_by_admin_user_id" IS NULL
        )
      );
