CREATE TYPE "public"."artwork_orientation" AS ENUM('portrait', 'landscape');--> statement-breakpoint
CREATE TYPE "public"."artwork_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"legacy_id" integer,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"alt" text NOT NULL,
	"image_src" text NOT NULL,
	"storage_key" text,
	"width" integer,
	"height" integer,
	"orientation" "artwork_orientation" NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "artwork_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"nav_label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_category_id_portfolio_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."portfolio_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_categories" ADD CONSTRAINT "portfolio_categories_group_id_portfolio_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."portfolio_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_groups" ADD CONSTRAINT "portfolio_groups_section_id_portfolio_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."portfolio_sections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artworks_category_slug_unique" ON "artworks" USING btree ("category_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "artworks_category_legacy_id_unique" ON "artworks" USING btree ("category_id","legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_categories_code_unique" ON "portfolio_categories" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_categories_group_slug_unique" ON "portfolio_categories" USING btree ("group_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_groups_section_slug_unique" ON "portfolio_groups" USING btree ("section_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_sections_slug_unique" ON "portfolio_sections" USING btree ("slug");