CREATE TABLE "commission_quote_illustrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_quote_illustrations_sequence_check" CHECK ("commission_quote_illustrations"."sequence" >= 1)
);
--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD COLUMN "illustration_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_quote_illustrations" ADD CONSTRAINT "commission_quote_illustrations_quote_id_commission_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."commission_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_quote_illustrations_quote_sequence_unique" ON "commission_quote_illustrations" USING btree ("quote_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_quote_illustrations_quote_id_id_unique" ON "commission_quote_illustrations" USING btree ("quote_id","id");--> statement-breakpoint
CREATE INDEX "commission_quote_illustrations_quote_id_idx" ON "commission_quote_illustrations" USING btree ("quote_id");--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD CONSTRAINT "commission_quote_items_illustration_fk" FOREIGN KEY ("quote_id","illustration_id") REFERENCES "public"."commission_quote_illustrations"("quote_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_quote_items_illustration_id_idx" ON "commission_quote_items" USING btree ("illustration_id");