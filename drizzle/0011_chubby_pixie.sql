CREATE TYPE "public"."quote_item_kind" AS ENUM('legacy', 'base', 'extra', 'license', 'discount', 'custom');--> statement-breakpoint
CREATE TYPE "public"."quote_pricing_mode" AS ENUM('legacy', 'catalog', 'custom');--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD COLUMN "kind" "quote_item_kind" DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD COLUMN "pricing_option_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD COLUMN "pricing_adjustment_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD COLUMN "calculation_type" "commission_pricing_calculation_type";--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD COLUMN "calculation_basis" "commission_pricing_calculation_basis";--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD COLUMN "percentage_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD COLUMN "internal_note" text;--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD COLUMN "pricing_mode" "quote_pricing_mode" DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD COLUMN "pricing_version_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD COLUMN "base_subtotal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD COLUMN "pre_discount_subtotal" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD COLUMN "discount_total" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD CONSTRAINT "commission_quote_items_pricing_option_id_commission_pricing_options_id_fk" FOREIGN KEY ("pricing_option_id") REFERENCES "public"."commission_pricing_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD CONSTRAINT "commission_quote_items_pricing_adjustment_id_commission_pricing_adjustments_id_fk" FOREIGN KEY ("pricing_adjustment_id") REFERENCES "public"."commission_pricing_adjustments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD CONSTRAINT "commission_quotes_pricing_version_id_commission_pricing_versions_id_fk" FOREIGN KEY ("pricing_version_id") REFERENCES "public"."commission_pricing_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_quote_items_pricing_option_idx" ON "commission_quote_items" USING btree ("pricing_option_id");--> statement-breakpoint
CREATE INDEX "commission_quote_items_pricing_adjustment_idx" ON "commission_quote_items" USING btree ("pricing_adjustment_id");--> statement-breakpoint
CREATE INDEX "commission_quotes_pricing_version_idx" ON "commission_quotes" USING btree ("pricing_version_id");--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD CONSTRAINT "commission_quote_items_pricing_source_check" CHECK (
        (
          "commission_quote_items"."kind" = 'legacy'
          AND "commission_quote_items"."pricing_option_id" IS NULL
          AND "commission_quote_items"."pricing_adjustment_id" IS NULL
          AND "commission_quote_items"."calculation_type" IS NULL
          AND "commission_quote_items"."calculation_basis" IS NULL
          AND "commission_quote_items"."percentage_rate" IS NULL
          AND "commission_quote_items"."internal_note" IS NULL
        )
        OR
        (
          "commission_quote_items"."kind" = 'custom'
          AND "commission_quote_items"."pricing_option_id" IS NULL
          AND "commission_quote_items"."pricing_adjustment_id" IS NULL
          AND "commission_quote_items"."calculation_type" = 'fixed'
          AND "commission_quote_items"."calculation_basis" = 'none'
          AND "commission_quote_items"."percentage_rate" IS NULL
        )
        OR
        (
          "commission_quote_items"."kind" = 'base'
          AND "commission_quote_items"."pricing_option_id" IS NOT NULL
          AND "commission_quote_items"."pricing_adjustment_id" IS NULL
          AND "commission_quote_items"."calculation_type" = 'fixed'
          AND "commission_quote_items"."calculation_basis" = 'none'
          AND "commission_quote_items"."percentage_rate" IS NULL
        )
        OR
        (
          "commission_quote_items"."kind" IN ('extra', 'license', 'discount')
          AND "commission_quote_items"."pricing_option_id" IS NOT NULL
          AND "commission_quote_items"."pricing_adjustment_id" IS NOT NULL
          AND "commission_quote_items"."calculation_type" IS NOT NULL
          AND "commission_quote_items"."calculation_basis" IS NOT NULL
          AND (
            (
              "commission_quote_items"."calculation_type" = 'fixed'
              AND "commission_quote_items"."calculation_basis" = 'none'
              AND "commission_quote_items"."percentage_rate" IS NULL
            )
            OR
            (
              "commission_quote_items"."calculation_type" = 'percentage'
              AND "commission_quote_items"."calculation_basis" != 'none'
              AND "commission_quote_items"."percentage_rate" IS NOT NULL
              AND "commission_quote_items"."percentage_rate" >= 0
              AND "commission_quote_items"."percentage_rate" <= 100
            )
          )
        )
      );--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD CONSTRAINT "commission_quotes_pricing_snapshot_check" CHECK (
        (
          "commission_quotes"."pricing_mode" = 'legacy'
          AND "commission_quotes"."pricing_version_id" IS NULL
          AND "commission_quotes"."base_subtotal" IS NULL
          AND "commission_quotes"."pre_discount_subtotal" IS NULL
          AND "commission_quotes"."discount_total" IS NULL
        )
        OR
        (
          "commission_quotes"."pricing_mode" = 'catalog'
          AND "commission_quotes"."pricing_version_id" IS NOT NULL
          AND "commission_quotes"."base_subtotal" IS NOT NULL
          AND "commission_quotes"."pre_discount_subtotal" IS NOT NULL
          AND "commission_quotes"."discount_total" IS NOT NULL
        )
        OR
        (
          "commission_quotes"."pricing_mode" = 'custom'
          AND "commission_quotes"."pricing_version_id" IS NULL
          AND "commission_quotes"."base_subtotal" IS NOT NULL
          AND "commission_quotes"."pre_discount_subtotal" IS NOT NULL
          AND "commission_quotes"."discount_total" IS NOT NULL
        )
      );--> statement-breakpoint
ALTER TABLE "commission_quotes" ADD CONSTRAINT "commission_quotes_pricing_totals_check" CHECK (
        "commission_quotes"."pricing_mode" = 'legacy'
        OR
        (
          "commission_quotes"."base_subtotal" >= 0
          AND "commission_quotes"."pre_discount_subtotal" >= "commission_quotes"."base_subtotal"
          AND "commission_quotes"."discount_total" >= 0
          AND "commission_quotes"."total_amount"
            = "commission_quotes"."pre_discount_subtotal" - "commission_quotes"."discount_total"
        )
      );