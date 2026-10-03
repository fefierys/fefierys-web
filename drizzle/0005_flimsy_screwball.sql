CREATE TABLE "commission_quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"label" varchar(250) NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_quote_items_sequence_check" CHECK (
        "commission_quote_items"."sequence" >= 1
      ),
	CONSTRAINT "commission_quote_items_quantity_check" CHECK (
        "commission_quote_items"."quantity" >= 1
      )
);
--> statement-breakpoint
ALTER TABLE "commission_quote_items" ADD CONSTRAINT "commission_quote_items_quote_id_commission_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."commission_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_quote_items_quote_sequence_unique" ON "commission_quote_items" USING btree ("quote_id","sequence");--> statement-breakpoint
CREATE INDEX "commission_quote_items_quote_id_idx" ON "commission_quote_items" USING btree ("quote_id");