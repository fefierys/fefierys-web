import { equal, deepEqual } from "node:assert/strict";

import {
  validateCommissionPaymentPlan,
  validateCommissionPaymentPlanAmounts,
} from "../lib/commissions/commissionPaymentPlan";

const singlePayment = validateCommissionPaymentPlanAmounts("450.00", [
  { amount: "450" },
]);

equal(singlePayment.valid, true);

if (singlePayment.valid) {
  equal(singlePayment.totalAmount, "450.00");
  deepEqual(singlePayment.amounts, ["450.00"]);
}

console.log("[OK] Single payment matches the Quote total");

const threePayments = validateCommissionPaymentPlanAmounts("450.00", [
  { amount: "150.00" },
  { amount: "135.00" },
  { amount: "165.00" },
]);

equal(threePayments.valid, true);

if (threePayments.valid) {
  deepEqual(threePayments.amounts, ["150.00", "135.00", "165.00"]);
}

console.log("[OK] Three payment stages match the Quote total");

const exactCents = validateCommissionPaymentPlanAmounts("0.03", [
  { amount: "0.01" },
  { amount: "0.02" },
]);

equal(exactCents.valid, true);

console.log("[OK] Cent amounts are added exactly");

const oneCentMismatch = validateCommissionPaymentPlanAmounts("450.00", [
  { amount: "149.99" },
  { amount: "300.00" },
]);

equal(oneCentMismatch.valid, false);

if (!oneCentMismatch.valid) {
  equal(oneCentMismatch.code, "installment_total_mismatch");
}

console.log("[OK] A one-cent difference is rejected");

const negativePayment = validateCommissionPaymentPlanAmounts("450.00", [
  { amount: "-50.00" },
  { amount: "500.00" },
]);

equal(negativePayment.valid, false);

if (!negativePayment.valid) {
  equal(negativePayment.code, "installment_amount_invalid");
  equal(negativePayment.installmentIndex, 0);
}

console.log("[OK] Negative payment amounts are rejected");

const zeroPayment = validateCommissionPaymentPlanAmounts("450.00", [
  { amount: "0.00" },
  { amount: "450.00" },
]);

equal(zeroPayment.valid, false);

if (!zeroPayment.valid) {
  equal(zeroPayment.code, "installment_amount_invalid");
}

console.log("[OK] Zero-value payment stages are rejected");

const missingPayments = validateCommissionPaymentPlanAmounts("450.00", []);

equal(missingPayments.valid, false);

if (!missingPayments.valid) {
  equal(missingPayments.code, "installments_required");
}

console.log("[OK] An empty payment plan is rejected");

const zeroTotal = validateCommissionPaymentPlanAmounts("0.00", []);

equal(zeroTotal.valid, false);

if (!zeroTotal.valid) {
  equal(zeroTotal.code, "zero_total_requires_separate_flow");
}

console.log("[OK] Zero-total Quotes require a separate flow");

console.log("[OK] Commission payment plan amount verification passed");

const validStages = validateCommissionPaymentPlan("450.00", [
  {
    label: " Initial payment ",
    amount: "150",
    trigger: "before_start",
  },
  {
    label: "After sketch approval",
    amount: "150.00",
    trigger: "after_sketch_approval",
  },
  {
    label: "Before final delivery",
    amount: "150",
    trigger: "before_final_delivery",
  },
]);

equal(validStages.valid, true);

if (validStages.valid) {
  deepEqual(
    validStages.stages.map((stage) => ({
      sequence: stage.sequence,
      label: stage.label,
      amount: stage.amount,
      trigger: stage.trigger,
    })),
    [
      {
        sequence: 1,
        label: "Initial payment",
        amount: "150.00",
        trigger: "before_start",
      },
      {
        sequence: 2,
        label: "After sketch approval",
        amount: "150.00",
        trigger: "after_sketch_approval",
      },
      {
        sequence: 3,
        label: "Before final delivery",
        amount: "150.00",
        trigger: "before_final_delivery",
      },
    ],
  );
}

console.log("[OK] Payment stages are normalized and ordered");

const validCustomStage = validateCommissionPaymentPlan("450.00", [
  {
    label: "Custom milestone",
    amount: "450.00",
    trigger: "custom",
    customTriggerNote: " After approval of the agreed milestone. ",
  },
]);

equal(validCustomStage.valid, true);

if (validCustomStage.valid) {
  equal(
    validCustomStage.stages[0]?.customTriggerNote,
    "After approval of the agreed milestone.",
  );
}

console.log("[OK] Custom payment trigger was normalized");

const invalidTrigger = validateCommissionPaymentPlan("450.00", [
  {
    label: "Initial payment",
    amount: "450.00",
    trigger: "invalid_trigger",
  },
]);

equal(invalidTrigger.valid, false);

if (!invalidTrigger.valid) {
  equal(invalidTrigger.code, "stage_trigger_invalid");
  equal(invalidTrigger.stageIndex, 0);
}

console.log("[OK] Invalid payment trigger was rejected");

const missingCustomNote = validateCommissionPaymentPlan("450.00", [
  {
    label: "Custom milestone",
    amount: "450.00",
    trigger: "custom",
  },
]);

equal(missingCustomNote.valid, false);

if (!missingCustomNote.valid) {
  equal(missingCustomNote.code, "custom_trigger_note_required");
}

console.log("[OK] Custom trigger requires an explanation");

const unexpectedCustomNote = validateCommissionPaymentPlan("450.00", [
  {
    label: "Initial payment",
    amount: "450.00",
    trigger: "before_start",
    customTriggerNote: "Unexpected custom condition",
  },
]);

equal(unexpectedCustomNote.valid, false);

if (!unexpectedCustomNote.valid) {
  equal(unexpectedCustomNote.code, "custom_trigger_note_forbidden");
}

console.log("[OK] Non-custom trigger rejects custom notes");

const invalidLabel = validateCommissionPaymentPlan("450.00", [
  {
    label: "   ",
    amount: "450.00",
    trigger: "before_start",
  },
]);

equal(invalidLabel.valid, false);

if (!invalidLabel.valid) {
  equal(invalidLabel.code, "stage_label_invalid");
}

console.log("[OK] Empty payment stage label was rejected");

console.log("[OK] Full commission payment plan verification passed");