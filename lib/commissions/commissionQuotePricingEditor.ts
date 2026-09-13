import type {
  CommissionPricingAdjustmentKind,
  CommissionPricingCalculationBasis,
  CommissionPricingCalculationType,
} from "./commissionPricing";

export interface CommissionQuotePricingEditorAdjustment {
  calculationBasis: CommissionPricingCalculationBasis;
  calculationType: CommissionPricingCalculationType;
  description: string | null;
  fixedAmount: string | null;
  id: string;
  isValueEditable: boolean;
  kind: CommissionPricingAdjustmentKind;
  maxQuantity: number | null;
  maximumPercentageRate: string | null;
  minimumPercentageRate: string | null;
  name: string;
  percentageRate: string | null;
  requiresInternalNote: boolean;
  stackable: boolean;
}

export type CommissionQuotePricingEditorConfig =
  | {
      mode: "custom";
    }
  | {
      adjustments: CommissionQuotePricingEditorAdjustment[];
      mode: "catalog";
      option: {
        baseAmount: string;
        description: string | null;
        id: string;
        quoteLabel: string;
      };
      pricingVersionId: string;
    };
