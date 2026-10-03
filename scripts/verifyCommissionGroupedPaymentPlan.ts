import assert from "node:assert/strict";

import {
  validateCommissionGroupedPaymentPlan,
} from "../lib/commissions/commissionGroupedPaymentPlan";

const stage = (
  label: string,
  amount: string,
  trigger = "before_start",
) => ({
  label,
  amount,
  trigger,
});

// Case 1: Two illustrations, each with three payment stages.
const twoIllustrations = validateCommissionGroupedPaymentPlan("400.00", {
  projectStages: [],
  deliverables: [
    {
      title: "Illustration 1",
      quantity: 1,
      stages: [
        stage("Initial payment", "70.00"),
        stage("After sketch approval", "65.00", "after_sketch_approval"),
        stage("Before delivery", "65.00", "before_final_delivery"),
      ],
    },
    {
      title: "Illustration 2",
      quantity: 1,
      stages: [
        stage("Initial payment", "70.00"),
        stage("After sketch approval", "65.00", "after_sketch_approval"),
        stage("Before delivery", "65.00", "before_final_delivery"),
      ],
    },
  ],
});

if (!twoIllustrations.valid) {
  throw new Error(twoIllustrations.message);
}

assert.equal(twoIllustrations.deliverables.length, 2);
assert.equal(twoIllustrations.stages.length, 6);
assert.deepEqual(
  twoIllustrations.stages.map((payment) => payment.deliverableSequence),
  [1, 1, 1, 2, 2, 2],
);
assert.deepEqual(
  twoIllustrations.stages.map((payment) => payment.sequence),
  [1, 2, 3, 4, 5, 6],
);

console.log("PASS: two illustrations with three payments each");

// Case 2: Ten character designs paid as one group.
const tenDesignsAsGroup = validateCommissionGroupedPaymentPlan("560.00", {
  projectStages: [],
  deliverables: [
    {
      title: "Character Designs",
      quantity: 10,
      stages: [
        stage("Initial payment", "280.00"),
        stage("Final payment", "280.00", "before_final_delivery"),
      ],
    },
  ],
});

if (!tenDesignsAsGroup.valid) {
  throw new Error(tenDesignsAsGroup.message);
}

assert.equal(tenDesignsAsGroup.deliverables.length, 1);
assert.equal(tenDesignsAsGroup.deliverables[0]?.quantity, 10);
assert.equal(tenDesignsAsGroup.stages.length, 2);

console.log("PASS: ten character designs with a shared payment plan");

// Case 3: Ten individual character designs.
const tenIndividualDesigns = validateCommissionGroupedPaymentPlan("560.00", {
  projectStages: [],
  deliverables: Array.from({ length: 10 }, (_, index) => ({
    title: `Character Design ${index + 1}`,
    quantity: 1,
    stages: [stage("Payment before work begins", "56.00")],
  })),
});

if (!tenIndividualDesigns.valid) {
  throw new Error(tenIndividualDesigns.message);
}

assert.equal(tenIndividualDesigns.deliverables.length, 10);
assert.equal(tenIndividualDesigns.stages.length, 10);
assert.deepEqual(
  tenIndividualDesigns.stages.map((payment) => payment.deliverableSequence),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
);

console.log("PASS: ten individual character designs");

// Case 4: Project-wide payment plus deliverable-specific payments.
const mixedPlan = validateCommissionGroupedPaymentPlan("560.00", {
  projectStages: [stage("Project booking payment", "160.00")],
  deliverables: [
    {
      title: "Illustration 1",
      quantity: 1,
      stages: [stage("Illustration 1 payment", "200.00")],
    },
    {
      title: "Illustration 2",
      quantity: 1,
      stages: [stage("Illustration 2 payment", "200.00")],
    },
  ],
});

if (!mixedPlan.valid) {
  throw new Error(mixedPlan.message);
}

assert.deepEqual(
  mixedPlan.stages.map((payment) => payment.deliverableSequence),
  [null, 1, 2],
);

console.log("PASS: project-wide and deliverable-specific payments");

// Case 5: The payment total must match the accepted Quote.
const invalidTotal = validateCommissionGroupedPaymentPlan("560.00", {
  projectStages: [],
  deliverables: [
    {
      title: "Illustration 1",
      quantity: 1,
      stages: [stage("Initial payment", "200.00")],
    },
  ],
});

assert.equal(invalidTotal.valid, false);

if (invalidTotal.valid) {
  throw new Error("The invalid payment plan was accepted.");
}

assert.equal(invalidTotal.code, "installment_total_mismatch");

console.log("PASS: a mismatched payment total is rejected");

console.log("All grouped payment plan tests passed.");