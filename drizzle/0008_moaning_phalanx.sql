CREATE TYPE "public"."commission_pricing_adjustment_kind" AS ENUM('extra', 'license', 'discount');--> statement-breakpoint
CREATE TYPE "public"."commission_pricing_calculation_basis" AS ENUM('none', 'base_price', 'base_plus_extras', 'base_items', 'pre_discount_subtotal');--> statement-breakpoint
CREATE TYPE "public"."commission_pricing_calculation_type" AS ENUM('fixed', 'percentage');--> statement-breakpoint
CREATE TYPE "public"."commission_pricing_version_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."commission_pricing_visibility" AS ENUM('public', 'admin_only');--> statement-breakpoint
CREATE TABLE "commission_pricing_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pricing_version_id" uuid NOT NULL,
	"code" varchar(160) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"kind" "commission_pricing_adjustment_kind" NOT NULL,
	"calculation_type" "commission_pricing_calculation_type" NOT NULL,
	"calculation_basis" "commission_pricing_calculation_basis" DEFAULT 'none' NOT NULL,
	"fixed_amount" numeric(12, 2),
	"percentage_rate" numeric(5, 2),
	"max_quantity" integer,
	"requires_internal_note" boolean DEFAULT false NOT NULL,
	"stackable" boolean DEFAULT true NOT NULL,
	"visibility" "commission_pricing_visibility" DEFAULT 'admin_only' NOT NULL,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_pricing_adjustments_value_check" CHECK (
        (
          "commission_pricing_adjustments"."calculation_type" = 'fixed'
          AND "commission_pricing_adjustments"."fixed_amount" IS NOT NULL
          AND "commission_pricing_adjustments"."fixed_amount" >= 0
          AND "commission_pricing_adjustments"."percentage_rate" IS NULL
          AND "commission_pricing_adjustments"."calculation_basis" = 'none'
        )
        OR
        (
          "commission_pricing_adjustments"."calculation_type" = 'percentage'
          AND "commission_pricing_adjustments"."fixed_amount" IS NULL
          AND "commission_pricing_adjustments"."percentage_rate" IS NOT NULL
          AND "commission_pricing_adjustments"."percentage_rate" >= 0
          AND "commission_pricing_adjustments"."percentage_rate" <= 100
          AND "commission_pricing_adjustments"."calculation_basis" != 'none'
        )
      ),
	CONSTRAINT "commission_pricing_adjustments_quantity_check" CHECK ("commission_pricing_adjustments"."max_quantity" IS NULL OR "commission_pricing_adjustments"."max_quantity" >= 1),
	CONSTRAINT "commission_pricing_adjustments_discount_quantity_check" CHECK (
        "commission_pricing_adjustments"."kind" != 'discount'
        OR (
          "commission_pricing_adjustments"."max_quantity" IS NOT NULL
          AND "commission_pricing_adjustments"."max_quantity" = 1
        )
      ),
	CONSTRAINT "commission_pricing_adjustments_availability_check" CHECK (
        "commission_pricing_adjustments"."available_until" IS NULL
        OR "commission_pricing_adjustments"."available_from" IS NULL
        OR "commission_pricing_adjustments"."available_until" > "commission_pricing_adjustments"."available_from"
      )
);
--> statement-breakpoint
CREATE TABLE "commission_pricing_option_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pricing_option_id" uuid NOT NULL,
	"pricing_adjustment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_pricing_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"code" varchar(120) NOT NULL,
	"title" varchar(200) NOT NULL,
	"public_label" varchar(250) NOT NULL,
	"quote_label" varchar(250) NOT NULL,
	"description" text,
	"base_amount" numeric(12, 2) NOT NULL,
	"visibility" "commission_pricing_visibility" DEFAULT 'public' NOT NULL,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"requires_manual_price_confirmation" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_pricing_options_base_amount_check" CHECK ("commission_pricing_options"."base_amount" >= 0),
	CONSTRAINT "commission_pricing_options_availability_check" CHECK (
        "commission_pricing_options"."available_until" IS NULL
        OR "commission_pricing_options"."available_from" IS NULL
        OR "commission_pricing_options"."available_until" > "commission_pricing_options"."available_from"
      )
);
--> statement-breakpoint
CREATE TABLE "commission_pricing_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pricing_version_id" uuid NOT NULL,
	"portfolio_category_id" uuid,
	"code" varchar(120) NOT NULL,
	"title" varchar(200) NOT NULL,
	"subtitle" text,
	"hero_image" text,
	"cta" varchar(250),
	"visibility" "commission_pricing_visibility" DEFAULT 'public' NOT NULL,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_pricing_services_availability_check" CHECK (
        "commission_pricing_services"."available_until" IS NULL
        OR "commission_pricing_services"."available_from" IS NULL
        OR "commission_pricing_services"."available_until" > "commission_pricing_services"."available_from"
      )
);
--> statement-breakpoint
CREATE TABLE "commission_pricing_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "commission_pricing_version_status" DEFAULT 'draft' NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_by_admin_user_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_pricing_versions_currency_check" CHECK ("commission_pricing_versions"."currency" = 'USD'),
	CONSTRAINT "commission_pricing_versions_effective_window_check" CHECK (
        "commission_pricing_versions"."effective_until" IS NULL
        OR "commission_pricing_versions"."effective_from" IS NULL
        OR "commission_pricing_versions"."effective_until" > "commission_pricing_versions"."effective_from"
      ),
	CONSTRAINT "commission_pricing_versions_publication_check" CHECK (
        (
          "commission_pricing_versions"."status" = 'draft'
          AND "commission_pricing_versions"."published_at" IS NULL
        )
        OR
        (
          "commission_pricing_versions"."status" IN ('active', 'archived')
          AND "commission_pricing_versions"."published_at" IS NOT NULL
          AND "commission_pricing_versions"."effective_from" IS NOT NULL
        )
      )
);
--> statement-breakpoint
ALTER TABLE "commission_pricing_adjustments" ADD CONSTRAINT "commission_pricing_adjustments_pricing_version_id_commission_pricing_versions_id_fk" FOREIGN KEY ("pricing_version_id") REFERENCES "public"."commission_pricing_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_pricing_option_adjustments" ADD CONSTRAINT "commission_pricing_option_adjustments_pricing_option_id_commission_pricing_options_id_fk" FOREIGN KEY ("pricing_option_id") REFERENCES "public"."commission_pricing_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_pricing_option_adjustments" ADD CONSTRAINT "commission_pricing_option_adjustments_pricing_adjustment_id_commission_pricing_adjustments_id_fk" FOREIGN KEY ("pricing_adjustment_id") REFERENCES "public"."commission_pricing_adjustments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_pricing_options" ADD CONSTRAINT "commission_pricing_options_service_id_commission_pricing_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."commission_pricing_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_pricing_services" ADD CONSTRAINT "commission_pricing_services_pricing_version_id_commission_pricing_versions_id_fk" FOREIGN KEY ("pricing_version_id") REFERENCES "public"."commission_pricing_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_pricing_services" ADD CONSTRAINT "commission_pricing_services_portfolio_category_id_portfolio_categories_id_fk" FOREIGN KEY ("portfolio_category_id") REFERENCES "public"."portfolio_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_pricing_adjustments_version_code_unique" ON "commission_pricing_adjustments" USING btree ("pricing_version_id","code");--> statement-breakpoint
CREATE INDEX "commission_pricing_adjustments_version_idx" ON "commission_pricing_adjustments" USING btree ("pricing_version_id");--> statement-breakpoint
CREATE INDEX "commission_pricing_adjustments_kind_idx" ON "commission_pricing_adjustments" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "commission_pricing_adjustments_available_idx" ON "commission_pricing_adjustments" USING btree ("visibility","is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_pricing_option_adjustments_unique" ON "commission_pricing_option_adjustments" USING btree ("pricing_option_id","pricing_adjustment_id");--> statement-breakpoint
CREATE INDEX "commission_pricing_option_adjustments_option_idx" ON "commission_pricing_option_adjustments" USING btree ("pricing_option_id");--> statement-breakpoint
CREATE INDEX "commission_pricing_option_adjustments_adjustment_idx" ON "commission_pricing_option_adjustments" USING btree ("pricing_adjustment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_pricing_options_service_code_unique" ON "commission_pricing_options" USING btree ("service_id","code");--> statement-breakpoint
CREATE INDEX "commission_pricing_options_service_idx" ON "commission_pricing_options" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "commission_pricing_options_public_idx" ON "commission_pricing_options" USING btree ("visibility","is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_pricing_services_version_code_unique" ON "commission_pricing_services" USING btree ("pricing_version_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_pricing_services_version_category_unique" ON "commission_pricing_services" USING btree ("pricing_version_id","portfolio_category_id");--> statement-breakpoint
CREATE INDEX "commission_pricing_services_version_idx" ON "commission_pricing_services" USING btree ("pricing_version_id");--> statement-breakpoint
CREATE INDEX "commission_pricing_services_portfolio_category_idx" ON "commission_pricing_services" USING btree ("portfolio_category_id");--> statement-breakpoint
CREATE INDEX "commission_pricing_services_public_idx" ON "commission_pricing_services" USING btree ("visibility","is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_pricing_versions_name_unique" ON "commission_pricing_versions" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_pricing_versions_active_unique" ON "commission_pricing_versions" USING btree ("status") WHERE "commission_pricing_versions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "commission_pricing_versions_status_idx" ON "commission_pricing_versions" USING btree ("status");