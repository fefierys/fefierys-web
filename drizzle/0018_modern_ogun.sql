ALTER TABLE "commission_pricing_adjustments" DROP CONSTRAINT "commission_pricing_adjustments_editable_value_check";--> statement-breakpoint
ALTER TABLE "commission_pricing_adjustments" ADD CONSTRAINT "commission_pricing_adjustments_editable_value_check" CHECK (
        (
          "commission_pricing_adjustments"."is_value_editable" = false
          AND "commission_pricing_adjustments"."minimum_percentage_rate" IS NULL
          AND "commission_pricing_adjustments"."maximum_percentage_rate" IS NULL
        )
        OR
        (
          "commission_pricing_adjustments"."is_value_editable" = true
          AND (
            (
              "commission_pricing_adjustments"."calculation_type" = 'percentage'
              AND "commission_pricing_adjustments"."minimum_percentage_rate" IS NOT NULL
              AND "commission_pricing_adjustments"."maximum_percentage_rate" IS NOT NULL
              AND "commission_pricing_adjustments"."minimum_percentage_rate" >= 0
              AND "commission_pricing_adjustments"."maximum_percentage_rate" <= 100
              AND "commission_pricing_adjustments"."maximum_percentage_rate" >= "commission_pricing_adjustments"."minimum_percentage_rate"
              AND "commission_pricing_adjustments"."percentage_rate" >= "commission_pricing_adjustments"."minimum_percentage_rate"
              AND "commission_pricing_adjustments"."percentage_rate" <= "commission_pricing_adjustments"."maximum_percentage_rate"
            )
            OR
            (
              "commission_pricing_adjustments"."calculation_type" = 'fixed'
              AND "commission_pricing_adjustments"."minimum_percentage_rate" IS NULL
              AND "commission_pricing_adjustments"."maximum_percentage_rate" IS NULL
            )
          )
        )
      );