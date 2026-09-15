ALTER TABLE "commissions" ALTER COLUMN "request_source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "commissions" ALTER COLUMN "request_source" SET DEFAULT 'contact'::text;--> statement-breakpoint
UPDATE "commissions" SET "request_source" = 'commissions' WHERE "request_source" = 'portfolio';--> statement-breakpoint
DROP TYPE "public"."commission_request_source";--> statement-breakpoint
CREATE TYPE "public"."commission_request_source" AS ENUM('contact', 'commissions', 'admin');--> statement-breakpoint
ALTER TABLE "commissions" ALTER COLUMN "request_source" SET DEFAULT 'contact'::"public"."commission_request_source";--> statement-breakpoint
ALTER TABLE "commissions" ALTER COLUMN "request_source" SET DATA TYPE "public"."commission_request_source" USING "request_source"::"public"."commission_request_source";