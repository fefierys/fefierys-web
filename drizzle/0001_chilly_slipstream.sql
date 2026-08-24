ALTER TABLE "artworks" ADD COLUMN "thumbnail_focus_x" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "artworks" ADD COLUMN "thumbnail_focus_y" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_thumbnail_focus_x_check" CHECK ("artworks"."thumbnail_focus_x" >= 0 AND "artworks"."thumbnail_focus_x" <= 100);--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_thumbnail_focus_y_check" CHECK ("artworks"."thumbnail_focus_y" >= 0 AND "artworks"."thumbnail_focus_y" <= 100);