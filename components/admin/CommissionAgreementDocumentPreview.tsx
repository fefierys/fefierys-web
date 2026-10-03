"use client";

import { useCallback, useState } from "react";

import type {
  CommissionAgreementDocumentData,
  CommissionAgreementDocumentPaymentStage,
} from "@/lib/commissions/commissionAgreementDocumentData";

import CommissionAdminModal from "./CommissionAdminModal";

interface CommissionAgreementDocumentPreviewProps {
  document: CommissionAgreementDocumentData;
}

function formatMoney(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

function getPaymentTriggerLabel(
  stage: CommissionAgreementDocumentPaymentStage,
): string {
  switch (stage.trigger) {
    case "before_start":
      return "Before work begins";
    case "after_sketch_approval":
      return "After sketch approval";
    case "before_final_delivery":
      return "Before final delivery";
    case "custom":
      return stage.customTriggerNote?.trim() || "Custom payment condition";
  }
}

function PaymentStageList({
  stages,
  currency,
}: {
  stages: readonly CommissionAgreementDocumentPaymentStage[];
  currency: string;
}) {
  return (
    <ol className="space-y-3">
      {stages.map((stage) => (
        <li
          className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
          key={stage.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="text-sm font-medium text-white">{stage.label}</span>
            <span className="text-sm font-medium tabular-nums text-white">
              {formatMoney(stage.amount, currency)}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/60">
            {getPaymentTriggerLabel(stage)}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function CommissionAgreementDocumentPreview({
  document,
}: CommissionAgreementDocumentPreviewProps) {
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);
  const { agreement, parties, pricing, paymentPlan } = document;
  const { project, delivery, license, projectConditions } = agreement.content;

  return (
    <>
      <button
        className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm transition hover:bg-white/15"
        onClick={() => setOpen(true)}
        type="button"
      >
        Preview Agreement
      </button>

      <CommissionAdminModal
        description="Review the document before generating and sending it to the client."
        onClose={closeModal}
        open={open}
        title="Commission Agreement preview"
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-light">Agreement preview</h2>
              <p className="mt-2 text-xs text-white/50">
                Agreement revision {agreement.revision} · Template{" "}
                {agreement.agreementVersion} · ToS {agreement.termsVersion}
              </p>
            </div>
            <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs text-sky-100">
              Draft preview
            </span>
          </div>

          <p className="text-sm leading-relaxed text-white/60">
            Draft preview of the complete Agreement. This is not an issued PDF
            or a request for the Client to accept its terms.
          </p>

          <div className="space-y-5 border-t border-white/10 pt-6">
            <div>
              <h3 className="text-center text-xl font-semibold tracking-wide text-white">
                COMMISSION AGREEMENT
              </h3>
              <p className="mt-2 text-center text-xs text-white/60">
                Issue date: assigned when the document is generated
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white underline underline-offset-4">
                PARTIES
              </h4>
              <p className="mt-3 text-sm leading-relaxed text-white/85">
                This Commission Agreement is between Josefa Santis
                {" “Fefierys”"} (the Artist) and {parties.client.name} (the Client)
                for the creation of the commissioned artwork described below.
              </p>
              <p className="mt-2 break-words text-xs text-white/60">
                Client email: {parties.client.email}
              </p>
              {parties.client.companyName && (
                <p className="mt-1 text-xs text-white/60">
                  Company: {parties.client.companyName}
                </p>
              )}
              {parties.client.country && (
                <p className="mt-1 text-xs text-white/60">
                  Country: {parties.client.country}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-5 border-t border-white/10 pt-6">
            <h3 className="text-base font-semibold text-white underline underline-offset-4">
              1. PROJECT DETAILS, DELIVERY, FEES &amp; PAYMENT
            </h3>

            <div>
              <h4 className="text-sm font-medium text-white">
                1.1. Project Name/Description
              </h4>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white/85">
                {project.name}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/75">
                {project.description}
              </p>
              <p className="mt-2 text-sm text-white/75">
                Type of illustration: {project.illustrationType}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium text-white">
                1.2. File Format &amp; Specifications
              </h4>
              <p className="mt-3 text-sm text-white/75">
                Size: {delivery.size}
              </p>
              <p className="mt-1 text-sm text-white/75">
                Color mode: {delivery.colorMode}
              </p>
              <p className="mt-1 text-sm text-white/75">
                File format(s): {delivery.fileFormats.join(", ")}
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h4 className="text-sm font-medium text-white">1.3. Project Fees</h4>
            <p className="mt-5 text-sm font-medium text-white/85 underline underline-offset-4">
              Price details
            </p>

            {pricing.items.length > 0 ? (
              <div className="mt-4 space-y-3">
                {pricing.items.map((item) => (
                  <div
                    className="flex flex-wrap items-start justify-between gap-3"
                    key={item.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm text-white/85">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs text-white/50">
                        Quantity: {item.quantity} · Unit amount:{" "}
                        {formatMoney(item.unitAmount, pricing.currency)}
                      </p>
                      {item.description && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-white/50">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <span className="text-sm tabular-nums text-white">
                      {formatMoney(item.lineTotal, pricing.currency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/50">
                An itemized price breakdown is not available for this Quote.
              </p>
            )}

            <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
              {pricing.preDiscountSubtotal !== null && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-white/65">Subtotal before discounts</span>
                  <span className="tabular-nums text-white/85">
                    {formatMoney(pricing.preDiscountSubtotal, pricing.currency)}
                  </span>
                </div>
              )}
              {pricing.discountTotal !== null && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-white/65">Total discounts</span>
                  <span className="tabular-nums text-white/85">
                    -{formatMoney(pricing.discountTotal, pricing.currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-white/10 pt-4">
                <span className="font-medium text-white">Total project fee</span>
                <span className="font-medium tabular-nums text-white">
                  {formatMoney(pricing.totalAmount, pricing.currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h3 className="text-sm font-medium text-white/85 underline underline-offset-4">
              Payment details
            </h3>
            {paymentPlan.projectStages.length > 0 && (
              <div className="mt-5">
                <h4 className="mb-3 text-sm font-medium text-white">
                  Project-wide payments
                </h4>
                <PaymentStageList
                  currency={paymentPlan.currency}
                  stages={paymentPlan.projectStages}
                />
              </div>
            )}
            {paymentPlan.deliverables.map((deliverable) => (
              <div className="mt-5" key={deliverable.id}>
                <h4 className="mb-1 text-sm font-medium text-white">
                  {deliverable.title}
                </h4>
                <p className="mb-3 text-xs text-white/55">
                  Quantity: {deliverable.quantity}
                </p>
                {deliverable.description && (
                  <p className="mb-3 whitespace-pre-wrap text-xs text-white/60">
                    {deliverable.description}
                  </p>
                )}
                {deliverable.stages.length > 0 ? (
                  <PaymentStageList
                    currency={paymentPlan.currency}
                    stages={deliverable.stages}
                  />
                ) : (
                  <p className="text-xs text-white/50">
                    No payment stages associated with this deliverable.
                  </p>
                )}
              </div>
            ))}
            <div className="mt-6 flex justify-between gap-3 border-t border-white/10 pt-4">
              <span className="font-medium text-white">Total payments</span>
              <span className="font-medium tabular-nums text-white">
                {formatMoney(paymentPlan.totalAmount, paymentPlan.currency)}
              </span>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/10 pt-6">
            <h3 className="text-base font-semibold text-white underline underline-offset-4">
              2. LICENSE RIGHTS &amp; USAGE
            </h3>
            <div>
              <h4 className="text-sm font-medium text-white">
                2.1. Selected License
              </h4>
              <div className="mt-2 space-y-2 text-sm text-white/80">
                <p>
                  {license.selectedOption === "personal_use" ? "☒" : "☐"}{" "}
                  OPTION A: PERSONAL USE ONLY
                </p>
                <p>
                  {license.selectedOption === "commercial_use" ? "☒" : "☐"}{" "}
                  OPTION B: COMMERCIAL USE
                </p>
              </div>
            </div>
            {license.selectedOption === "commercial_use" && (
              <div>
                <h4 className="text-sm font-medium text-white">
                  2.2. Commercial Scope
                </h4>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">
                  {license.commercialScope}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-white/10 pt-6">
            <h3 className="text-base font-semibold text-white underline underline-offset-4">
              3. CONFIDENTIALITY &amp; PROJECT-SPECIFIC CONDITIONS
            </h3>
            <div>
              <h4 className="text-sm font-medium text-white">
                3.1. Confidentiality &amp; Hold Date
              </h4>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">
                Confidentiality requirement: {projectConditions.confidentialityRequirement}
              </p>
              <p className="mt-2 text-sm text-white/80">
                Hold Date: {projectConditions.holdDate ?? "N/A"}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">
                3.2. Project-Specific Exceptions or Additional Terms
              </h4>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">
                {projectConditions.additionalTerms.trim() || "N/A"}
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/10 pt-6">
            <h3 className="text-base font-semibold text-white underline underline-offset-4">
              4. NO GENERATIVE AI POLICY
            </h3>
            <div>
              <h4 className="text-sm font-medium text-white">
                4.1. Artist AI Guarantee
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                All illustrations, Artwork, and design assets provided by the
                Artist are 100% human-created and hand-crafted.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">
                4.2. Client AI Restrictions
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                The Client explicitly agrees NOT to upload, process, submit,
                host, or feed any part of the commissioned Artwork, sketches,
                preliminary works, or final deliverables into any generative AI
                tools, machine-learning models, image-generation datasets, or
                algorithms.
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/10 pt-6">
            <h3 className="text-base font-semibold text-white underline underline-offset-4">
              5. ACCEPTANCE OF TERMS
            </h3>
            <div>
              <h4 className="text-sm font-medium text-white">
                5.1. Agreement to Terms
              </h4>
              <div className="mt-2 space-y-3 text-sm leading-relaxed text-white/80">
                <p>
                  The Client will receive a secure link to the Fefierys website
                  to review and electronically accept this Commission Agreement,
                  already electronically signed by the Artist, and the applicable
                  version of the Artist’s Terms of Service (version{" "}
                  {agreement.termsVersion}).
                </p>
                <p>
                  By electronically accepting both documents, the Client
                  acknowledges that they have read, understood, and agreed to
                  their terms, including the project details, license rights,
                  payment plan, and other conditions set forth in this Agreement.
                </p>
                <p>
                  Following the Client’s acceptance, the initial payment will be
                  requested in accordance with the agreed payment plan.
                </p>
                <p>
                  The Artist will begin work on the commission only after the
                  initial payment has been received and confirmed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CommissionAdminModal>
    </>
  );
}
