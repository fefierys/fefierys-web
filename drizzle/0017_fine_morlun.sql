ALTER TABLE "commission_quote_items"
DROP CONSTRAINT "commission_quote_items_pricing_source_check";
--> statement-breakpoint

UPDATE "commission_quote_items"
SET "pricing_option_id" = NULL
WHERE "kind" = 'discount';
--> statement-breakpoint

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
          "commission_quote_items"."kind" IN ('extra', 'license')
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
        OR
        (
          "commission_quote_items"."kind" = 'discount'
          AND "commission_quote_items"."pricing_option_id" IS NULL
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
      );