ALTER TYPE "public"."commission_service_classification" ADD VALUE 'bulk' BEFORE 'custom';--> statement-breakpoint
ALTER TABLE "commissions" DROP CONSTRAINT "commissions_service_classification_check";--> statement-breakpoint
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
          "commissions"."service_classification"::text = 'bulk'
          AND "commissions"."pricing_service_id" IS NULL
          AND "commissions"."pricing_option_id" IS NULL
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
      );