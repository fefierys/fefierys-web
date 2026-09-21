CREATE TABLE "commission_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"commission_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"title" varchar(150) NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_deliverables_sequence_check" CHECK ("commission_deliverables"."sequence" >= 1),
	CONSTRAINT "commission_deliverables_quantity_check" CHECK ("commission_deliverables"."quantity" >= 1),
	CONSTRAINT "commission_deliverables_title_check" CHECK (char_length(trim("commission_deliverables"."title")) > 0)
);
--> statement-breakpoint
ALTER TABLE "commission_payment_installments" ADD COLUMN "deliverable_id" uuid;--> statement-breakpoint
ALTER TABLE "commission_deliverables" ADD CONSTRAINT "commission_deliverables_commission_id_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "public"."commissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_deliverables" ADD CONSTRAINT "commission_deliverables_quote_id_commission_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."commission_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_deliverables" ADD CONSTRAINT "commission_deliverables_quote_commission_fk" FOREIGN KEY ("commission_id","quote_id") REFERENCES "public"."commission_quotes"("commission_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_deliverables_id_commission_quote_unique" ON "commission_deliverables" USING btree ("id","commission_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_deliverables_quote_sequence_unique" ON "commission_deliverables" USING btree ("quote_id","sequence");--> statement-breakpoint
CREATE INDEX "commission_deliverables_commission_id_idx" ON "commission_deliverables" USING btree ("commission_id");--> statement-breakpoint
CREATE INDEX "commission_deliverables_quote_id_idx" ON "commission_deliverables" USING btree ("quote_id");--> statement-breakpoint
ALTER TABLE "commission_payment_installments" ADD CONSTRAINT "commission_payment_installments_deliverable_id_commission_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."commission_deliverables"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_payment_installments" ADD CONSTRAINT "commission_installments_deliverable_scope_fk" FOREIGN KEY ("deliverable_id","commission_id","quote_id") REFERENCES "public"."commission_deliverables"("id","commission_id","quote_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_installments_deliverable_id_idx" ON "commission_payment_installments" USING btree ("deliverable_id");