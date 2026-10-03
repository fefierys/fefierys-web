import {
  formatCommissionQuoteAmount,
  parseCommissionQuoteAmount,
} from "@/lib/commissions/commissionQuote";

import type {
  getCommissionDeliverables,
  getCommissionPaymentPlan,
} from "@/lib/repositories/commissionPayments/commissionPaymentPlanRepository";

type Deliverable = Awaited<
  ReturnType<typeof getCommissionDeliverables>
>[number];

type PaymentStage = Awaited<
  ReturnType<typeof getCommissionPaymentPlan>
>[number];

interface CommissionPaymentPlanPanelProps {
  deliverables: Deliverable[];
  stages: PaymentStage[];
  currency: string;
  agreementStatus: string;
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStageTotal(stages: PaymentStage[]): string {
  let total = BigInt(0);

  for (const stage of stages) {
    const amount = parseCommissionQuoteAmount(stage.amount);

    if (amount === null) {
      return "Amount unavailable";
    }

    total += amount;
  }

  return formatCommissionQuoteAmount(total);
}

function PaymentStageList({
  stages,
}: {
  stages: PaymentStage[];
}) {
  return (
    <div className="divide-y divide-white/10">
      {stages.map((stage) => (
        <div
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
          key={stage.id}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90">
              {stage.label}
            </p>

            <p className="mt-1 text-xs text-white/55">
              Stage {stage.sequence} · {humanize(stage.trigger)}
            </p>

            {stage.customTriggerNote && (
              <p className="mt-2 whitespace-pre-wrap break-words text-xs text-white/65">
                {stage.customTriggerNote}
              </p>
            )}
          </div>

          <div className="shrink-0 sm:text-right">
            <p className="text-sm font-medium text-white/90">
              {stage.amount} {stage.currency}
            </p>

            <p className="mt-1 text-xs text-white/55">
              {humanize(stage.status)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentGroup({
  title,
  subtitle,
  stages,
  currency,
}: {
  title: string;
  subtitle?: string;
  stages: PaymentStage[];
  currency: string;
}) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-white/15 bg-white/[0.04]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h3 className="font-medium text-white/90">{title}</h3>

          {subtitle && (
            <p className="mt-1 text-xs text-white/55">
              {subtitle}
            </p>
          )}

          <p className="mt-1 text-xs text-white/65">
            {stages.length} payment{" "}
            {stages.length === 1 ? "stage" : "stages"}
            {" · "}
            {formatStageTotal(stages)} {currency}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/80 transition-colors group-hover:bg-white/10">
            <span className="group-open:hidden">See details</span>
            <span className="hidden group-open:inline">Hide details</span>

            <svg
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
            >
                <path d="m6 9 6 6 6-6" />
            </svg>
        </span>
      </summary>

      <div className="border-t border-white/10">
        {stages.length > 0 ? (
          <PaymentStageList stages={stages} />
        ) : (
          <p className="px-4 py-4 text-sm text-white/55">
            No individual payment stages. This deliverable may
            be covered by project-wide payments.
          </p>
        )}
      </div>
    </details>
  );
}

export default function CommissionPaymentPlanPanel({
  deliverables,
  stages,
  currency,
  agreementStatus,
}: CommissionPaymentPlanPanelProps) {
  // Total amount of the payment plan.
  const totalAmount = formatStageTotal(stages);

  // Amount represented by stages recorded as paid.
  const paidStages = stages.filter(
    (stage) => stage.status === "paid",
  );

  const paidAmount = formatStageTotal(paidStages);

  // Display the current Agreement lifecycle status.
  const statusLabel = humanize(agreementStatus);
  const projectStages = stages.filter(
    (stage) => stage.deliverableId === null,
  );

  const knownDeliverableIds = new Set(
    deliverables.map((deliverable) => deliverable.id),
  );

  const unassignedStages = stages.filter(
    (stage) =>
      stage.deliverableId !== null &&
      !knownDeliverableIds.has(stage.deliverableId),
  );

  return (
    <section className="glass-card p-6">
      {/* Payment plan header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-light text-white">
            Payment plan
          </h2>

          <p className="mt-1 text-sm text-white/60">
            {deliverables.length}{" "}
            {deliverables.length === 1
              ? "deliverable"
              : "deliverables"}
            {" · "}
            {stages.length} payment{" "}
            {stages.length === 1 ? "stage" : "stages"}
          </p>
        </div>

        {/* Current Agreement status */}
        <span
          className={
            agreementStatus === "draft"
              ? "inline-flex shrink-0 items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200"
              : "inline-flex shrink-0 items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
          }
          title="Agreement status"
        >
          {statusLabel}
        </span>
      </div>

      {/* Payment plan summary */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Total amount */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="text-xs font-medium text-white/60">
            Total
          </p>

          <p className="mt-2 break-words text-xl font-semibold text-white">
            {totalAmount} {currency}
          </p>
        </div>

        {/* Paid amount */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <p className="text-xs font-medium text-white/60">
            Paid
          </p>

          <p className="mt-2 break-words text-xl font-semibold text-white">
            {paidAmount} {currency}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {projectStages.length > 0 && (
          <PaymentGroup
            currency={currency}
            stages={projectStages}
            title="Project-wide payments"
          />
        )}

        {deliverables.map((deliverable) => (
          <PaymentGroup
            currency={currency}
            key={deliverable.id}
            stages={stages.filter(
              (stage) =>
                stage.deliverableId === deliverable.id,
            )}
            subtitle={
              deliverable.quantity > 1
                ? `Quantity: ${deliverable.quantity}`
                : undefined
            }
            title={deliverable.title}
          />
        ))}

        {unassignedStages.length > 0 && (
          <PaymentGroup
            currency={currency}
            stages={unassignedStages}
            title="Payments requiring review"
          />
        )}

        {deliverables.length === 0 &&
          stages.length === 0 && (
            <p className="text-sm text-white/55">
              No payment plan has been created.
            </p>
          )}
      </div>
    </section>
  );
}