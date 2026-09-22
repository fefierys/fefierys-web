
import {
  validateCommissionAgreementReadyToPresent,
  type CommissionAgreementDraftData,
} from "./commissionAgreementData";

import {
  commissionAgreements,
  commissionDeliverables,
  commissionPaymentInstallments,
  commissionQuoteItems,
  commissionQuotes,
  commissions,
} from "@/lib/db/schema/commissions";

type Commission = typeof commissions.$inferSelect;
type Agreement = typeof commissionAgreements.$inferSelect;
type Quote = typeof commissionQuotes.$inferSelect;
type QuoteItem = typeof commissionQuoteItems.$inferSelect;
type Deliverable = typeof commissionDeliverables.$inferSelect;
type PaymentStage = typeof commissionPaymentInstallments.$inferSelect;

export interface BuildCommissionAgreementDocumentDataInput {
  commission: Commission;
  agreement: Agreement;
  quote: Quote;
  quoteItems: readonly QuoteItem[];
  deliverables: readonly Deliverable[];
  paymentStages: readonly PaymentStage[];
}

export interface CommissionAgreementDocumentPaymentStage {
  id: string;
  sequence: number;
  label: string;
  percentage: string | null;
  amount: string;
  trigger: PaymentStage["trigger"];
  customTriggerNote: string | null;
}

export interface CommissionAgreementDocumentData {
  agreement: {
    id: string;
    revision: number;
    agreementVersion: string;
    termsVersion: string;
    content: CommissionAgreementDraftData;
  };

  parties: {
    client: {
      name: string;
      email: string;
      companyName: string | null;
      country: string | null;
    };
  };

  pricing: {
    quoteId: string;
    quoteVersion: number;
    currency: string;

    items: Array<{
      id: string;
      sequence: number;
      kind: QuoteItem["kind"];
      label: string;
      description: string | null;
      quantity: number;
      unitAmount: string;
      lineTotal: string;
    }>;

    baseSubtotal: string | null;
    preDiscountSubtotal: string | null;
    discountTotal: string | null;
    totalAmount: string;
  };

  paymentPlan: {
    currency: string;
    totalAmount: string;

    projectStages: CommissionAgreementDocumentPaymentStage[];

    deliverables: Array<{
      id: string;
      sequence: number;
      title: string;
      description: string | null;
      quantity: number;
      stages: CommissionAgreementDocumentPaymentStage[];
    }>;
  };
}

/**
 * Converts a PostgreSQL numeric monetary value into integer cents.
 * This avoids floating-point calculations when validating amounts.
 */
function amountToCents(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);

  if (!match) {
    throw new Error(`Invalid monetary amount: ${value}`);
  }

  const [, sign, whole, fraction = ""] = match;

  const cents =
    BigInt(whole) * BigInt(100) +
    BigInt(fraction.padEnd(2, "0"));

  return sign === "-" ? -cents : cents;
}

function centsToAmount(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;

  const whole = absolute / BigInt(100);
  const fraction = (absolute % BigInt(100)).toString().padStart(2, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function mapPaymentStage(
  stage: PaymentStage,
): CommissionAgreementDocumentPaymentStage {
  return {
    id: stage.id,
    sequence: stage.sequence,
    label: stage.label,
    percentage: stage.percentage,
    amount: stage.amount,
    trigger: stage.trigger,
    customTriggerNote: stage.customTriggerNote,
  };
}

export function buildCommissionAgreementDocumentData({
  commission,
  agreement,
  quote,
  quoteItems,
  deliverables,
  paymentStages,
}: BuildCommissionAgreementDocumentDataInput): CommissionAgreementDocumentData {
  /*
   * Validate the relationship between the commission,
   * its accepted Quote and its Agreement.
   */
  if (
    agreement.commissionId !== commission.id ||
    quote.commissionId !== commission.id ||
    agreement.quoteId !== quote.id
  ) {
    throw new Error(
      "The Agreement, Quote and commission do not belong together.",
    );
  }

  if (commission.status !== "awaiting_agreement" || commission.isOnHold) {
    throw new Error(
      "The commission is not ready to prepare an Agreement.",
    );
  }

  if (quote.status !== "accepted") {
    throw new Error(
      "The Commission Agreement requires an accepted Quote.",
    );
  }

  if (agreement.status !== "draft") {
    throw new Error(
      "Only a draft Agreement can be prepared for presentation.",
    );
  }

  /*
   * Validate the editable Agreement content.
   */
  const agreementValidation =
    validateCommissionAgreementReadyToPresent(agreement.agreementData);

  if (!agreementValidation.valid) {
    throw new Error(
      `The Agreement is incomplete: ${agreementValidation.field}`,
    );
  }

  /*
   * Validate the Quote concepts and prepare their totals.
   */
  const orderedQuoteItems = [...quoteItems].sort(
    (a, b) => a.sequence - b.sequence,
  );

  if (orderedQuoteItems.some((item) => item.quoteId !== quote.id)) {
    throw new Error(
      "A Quote item does not belong to the accepted Quote.",
    );
  }

  const pricingItems = orderedQuoteItems.map((item) => {
    const lineTotal =
      amountToCents(item.unitAmount) * BigInt(item.quantity);

    return {
      id: item.id,
      sequence: item.sequence,
      kind: item.kind,
      label: item.label,
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      lineTotal: centsToAmount(lineTotal),
    };
  });

  const quoteTotalCents = amountToCents(quote.totalAmount);

  if (pricingItems.length > 0) {
    const itemsTotalCents = pricingItems.reduce(
      (total, item) => total + amountToCents(item.lineTotal),
      BigInt(0),
    );

    if (itemsTotalCents !== quoteTotalCents) {
      throw new Error(
        "The Quote items do not match the accepted Quote total.",
      );
    }
  }

  /*
   * Validate the deliverables and payment stages.
   */
  if (paymentStages.length === 0) {
    throw new Error(
      "The Agreement requires a payment plan.",
    );
  }

  const orderedDeliverables = [...deliverables].sort(
    (a, b) => a.sequence - b.sequence,
  );

  const orderedStages = [...paymentStages].sort(
    (a, b) => a.sequence - b.sequence,
  );

  if (
    orderedDeliverables.some(
      (deliverable) =>
        deliverable.commissionId !== commission.id ||
        deliverable.quoteId !== quote.id,
    )
  ) {
    throw new Error(
      "A deliverable does not belong to the accepted Quote.",
    );
  }

  const deliverableIds = new Set(
    orderedDeliverables.map((deliverable) => deliverable.id),
  );

  for (const stage of orderedStages) {
    if (
      stage.commissionId !== commission.id ||
      stage.quoteId !== quote.id
    ) {
      throw new Error(
        "A payment stage does not belong to the accepted Quote.",
      );
    }

    if (stage.currency !== quote.currency) {
      throw new Error(
        "A payment stage uses a different currency from the Quote.",
      );
    }

    if (
      stage.deliverableId !== null &&
      !deliverableIds.has(stage.deliverableId)
    ) {
      throw new Error(
        "A payment stage references an unknown deliverable.",
      );
    }
  }

  /*
   * The complete payment plan must equal the accepted
   * Quote total. No rounding or recalculation is allowed.
   */
  const paymentPlanTotalCents = orderedStages.reduce(
    (total, stage) => total + amountToCents(stage.amount),
    BigInt(0),
  );

  if (paymentPlanTotalCents !== quoteTotalCents) {
    throw new Error(
      "The payment plan total does not match the accepted Quote.",
    );
  }

  /*
   * Construct the document content.
   *
   * Project-wide stages have deliverableId = null.
   * Other stages remain associated with their deliverable.
   */
  return {
    agreement: {
      id: agreement.id,
      revision: agreement.version,
      agreementVersion: agreement.agreementVersion,
      termsVersion: agreement.termsVersion,
      content: agreementValidation.data,
    },

    parties: {
      client: {
        name: commission.clientName,
        email: commission.clientEmail,
        companyName: commission.clientCompanyName,
        country: commission.clientCountry,
      },
    },

    pricing: {
      quoteId: quote.id,
      quoteVersion: quote.version,
      currency: quote.currency,
      items: pricingItems,
      baseSubtotal: quote.baseSubtotal,
      preDiscountSubtotal: quote.preDiscountSubtotal,
      discountTotal: quote.discountTotal,
      totalAmount: quote.totalAmount,
    },

    paymentPlan: {
      currency: quote.currency,
      totalAmount: centsToAmount(paymentPlanTotalCents),

      projectStages: orderedStages
        .filter((stage) => stage.deliverableId === null)
        .map(mapPaymentStage),

      deliverables: orderedDeliverables.map((deliverable) => ({
        id: deliverable.id,
        sequence: deliverable.sequence,
        title: deliverable.title,
        description: deliverable.description,
        quantity: deliverable.quantity,

        stages: orderedStages
          .filter((stage) => stage.deliverableId === deliverable.id)
          .map(mapPaymentStage),
      })),
    },
  };
}