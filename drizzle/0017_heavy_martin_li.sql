CREATE UNIQUE INDEX "commission_agreements_commission_active_unique" ON "commission_agreements" USING btree ("commission_id") WHERE
          "commission_agreements"."status" IN ('draft', 'sent')
        ;