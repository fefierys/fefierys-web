import Link from "next/link";
import { notFound } from "next/navigation";

import CommissionActivityPanel from "@/components/admin/CommissionActivityPanel";
import CommissionClassificationPanel from "@/components/admin/CommissionClassificationPanel";
import CommissionQuotePanel from "@/components/admin/CommissionQuotePanel";
import CommissionStatusBadge from "@/components/admin/CommissionStatusBadge";
import CommissionWorkflowActions from "@/components/admin/CommissionWorkflowActions";
import CommissionConversationPanel from "@/components/admin/CommissionConversationPanel";
import CommissionAgreementPanel from "@/components/admin/CommissionAgreementPanel";
import CommissionAgreementDocumentPreview from "@/components/admin/CommissionAgreementDocumentPreview";
import CommissionAgreementCreatePanel from "@/components/admin/CommissionAgreementCreatePanel";
import CommissionPaymentPlanCreatePanel from "@/components/admin/CommissionPaymentPlanCreatePanel";
import CommissionPaymentPlanPanel from "@/components/admin/CommissionPaymentPlanPanel";
import CommissionPaymentPlanEditPanel from "@/components/admin/CommissionPaymentPlanEditPanel";
import { requireAdmin } from "@/lib/auth/admin";
import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import { COMMISSION_STATUS_LABELS } from "@/lib/commissions/commissionStatus";
import type { CommissionQuotePricingEditorConfig } from "@/lib/commissions/commissionQuotePricingEditor";
import {
  createEmptyCommissionAgreementDraftData,
  validateCommissionAgreementDraftData,
  validateCommissionAgreementReadyToPresent,
} from "@/lib/commissions/commissionAgreementData";

import {
  buildCommissionAgreementDocumentData,
  type CommissionAgreementDocumentData,
} from "@/lib/commissions/commissionAgreementDocumentData";
import { getAdminCommissionDetail } from "@/lib/repositories/commissionAdminRepository";
import {
  getActiveCommissionPricingCatalog,
  getCommissionPricingCatalogByVersion,
} from "@/lib/repositories/commissionPricingRepository";
import { getCommissionQuotes } from "@/lib/repositories/commissionQuoteRepository";
import { getActiveCommissionAgreement } from "@/lib/repositories/commissionAgreements/commissionAgreementDataRepository";
import {
  getCommissionDeliverables,
  getCommissionPaymentPlan,
  hasCommissionPaymentPlanLinkedPayments,
} from "@/lib/repositories/commissionPayments/commissionPaymentPlanRepository";

export const dynamic = "force-dynamic";

interface CommissionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
}

const COMMISSION_DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "conversation", label: "Conversation" },
  { id: "documents", label: "Quotes & Agreement" },
  { id: "payments", label: "Payments" },
  { id: "activity", label: "Activity" },
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function displayValue(value: string | null): string {
  return value?.trim() || "Not provided";
}

function displayRequestedValue(value: string | null): string {
  const normalizedValue = value?.trim();

  return normalizedValue && normalizedValue.toLowerCase() !== "not specified"
    ? normalizedValue
    : "Not specified by client";
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-white/45">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-white/85">{value}</dd>
    </div>
  );
}

export default async function CommissionDetailPage({
  params,
  searchParams,
}: CommissionDetailPageProps) {
  await requireAdmin();

  const { id } = await params;
  const query = await searchParams;
  const requestedTab = typeof query?.tab === "string" ? query.tab : null;
  const activeTab =
    COMMISSION_DETAIL_TABS.find((tab) => tab.id === requestedTab)?.id ??
    "overview";

  if (!UUID_PATTERN.test(id)) {
    notFound();
  }

  const [detail, quotes, pricingCatalog, activeAgreement] =
    await Promise.all([
      getAdminCommissionDetail(id),
      getCommissionQuotes(id),
      getActiveCommissionPricingCatalog({ audience: "admin" }),
      getActiveCommissionAgreement(id),
    ]);

  if (!detail) {
    notFound();
  }

  const agreementQuoteWithItems = activeAgreement
    ? quotes.find(
        ({ quote }) =>
          quote.id === activeAgreement.quoteId &&
          quote.status === "accepted",
      ) ?? null
    : null;

  const agreementQuote = agreementQuoteWithItems?.quote ?? null;

  const agreementPaymentPlan = activeAgreement
    ? await getCommissionPaymentPlan(
        activeAgreement.commissionId,
        activeAgreement.quoteId,
      )
    : [];

  const agreementDeliverables = activeAgreement
    ? await getCommissionDeliverables(
        activeAgreement.commissionId,
        activeAgreement.quoteId,
      )
    : [];

  const agreementDraftValidation =
    activeAgreement?.status === "draft" &&
    activeAgreement.agreementData !== null
      ? validateCommissionAgreementDraftData(activeAgreement.agreementData)
      : null;

  const agreementDraftData =
    activeAgreement?.status === "draft"
      ? activeAgreement.agreementData === null
        ? createEmptyCommissionAgreementDraftData()
        : agreementDraftValidation?.valid
          ? agreementDraftValidation.data
          : null
      : null;

  const {
    commission,
    conversation,
    events,
    statusHistory,
  } = detail;

  let agreementPreviewData:
    CommissionAgreementDocumentData | null = null;

  let agreementPreviewError: string | null = null;

  if (
    activeAgreement?.status === "draft" &&
    agreementQuoteWithItems !== null &&
    agreementPaymentPlan.length > 0 &&
    commission.status === "awaiting_agreement" &&
    !commission.isOnHold
  ) {
    const readyValidation =
      validateCommissionAgreementReadyToPresent(
        activeAgreement.agreementData,
      );

    if (!readyValidation.valid) {
      agreementPreviewError =
        `Complete the Agreement field: ${readyValidation.field}.`;
    } else {
      try {
        agreementPreviewData =
          buildCommissionAgreementDocumentData({
            commission,
            agreement: activeAgreement,
            quote: agreementQuoteWithItems.quote,
            quoteItems: agreementQuoteWithItems.items,
            deliverables: agreementDeliverables,
            paymentStages: agreementPaymentPlan,
          });
      } catch (error) {
        console.error(
          "Unable to prepare Commission Agreement preview:",
          error,
        );

        agreementPreviewError =
          "The Agreement preview could not be prepared. " +
          "Review the Quote and payment plan data.";
      }
    }
  }

  const meetsPaymentPlanEditConditions =
    commission.status === "awaiting_agreement" &&
    !commission.isOnHold &&
    activeAgreement?.status === "draft" &&
    agreementQuote !== null &&
    agreementPaymentPlan.length > 0 &&
    agreementPaymentPlan.every((stage) => stage.status === "pending");

  const hasLinkedPayment = meetsPaymentPlanEditConditions
    ? await hasCommissionPaymentPlanLinkedPayments(
        commission.id,
        agreementPaymentPlan.map((stage) => stage.id),
      )
    : false;

  const canEditPaymentPlan =
    meetsPaymentPlanEditConditions && !hasLinkedPayment;

  const editableDraft =
    quotes.find(({ quote }) => quote.status === "draft") ?? null;
  let quotePricingCatalog = pricingCatalog;

  if (
    editableDraft?.quote.pricingMode === "catalog" &&
    editableDraft.quote.pricingVersionId &&
    editableDraft.quote.pricingVersionId !== pricingCatalog?.version.id
  ) {
    quotePricingCatalog = await getCommissionPricingCatalogByVersion({
      at: editableDraft.quote.createdAt,
      audience: "admin",
      versionId: editableDraft.quote.pricingVersionId,
    });
  }

  const editorPricingMode = editableDraft
    ? editableDraft.quote.pricingMode
    : commission.serviceClassification;
  const editorPricingOptionId =
    editableDraft?.quote.pricingMode === "catalog"
      ? (editableDraft.items.find((item) => item.kind === "base")
          ?.pricingOptionId ?? null)
      : commission.pricingOptionId;
  const editorPricingOption = quotePricingCatalog?.services
    .flatMap((service) => service.options)
    .find(({ option }) => option.id === editorPricingOptionId);
  const pricingConfig: CommissionQuotePricingEditorConfig | null =
    editorPricingMode === "custom"
      ? { mode: "custom" }
      : editorPricingMode === "catalog" &&
          quotePricingCatalog &&
          editorPricingOption
        ? {
            adjustments: editorPricingOption.adjustments.map((adjustment) => ({
              calculationBasis: adjustment.calculationBasis,
              calculationType: adjustment.calculationType,
              description: adjustment.description,
              fixedAmount: adjustment.fixedAmount,
              id: adjustment.id,
              isValueEditable: adjustment.isValueEditable,
              kind: adjustment.kind,
              maximumPercentageRate: adjustment.maximumPercentageRate,
              maxQuantity: adjustment.maxQuantity,
              minimumPercentageRate: adjustment.minimumPercentageRate,
              name: adjustment.name,
              percentageRate: adjustment.percentageRate,
              requiresInternalNote: adjustment.requiresInternalNote,
              stackable: adjustment.stackable,
            })),
            mode: "catalog",
            option: {
              baseAmount: editorPricingOption.option.baseAmount,
              description: editorPricingOption.option.description,
              id: editorPricingOption.option.id,
              quoteLabel: editorPricingOption.option.quoteLabel,
            },
            pricingVersionId: quotePricingCatalog.version.id,
          }
        : null;

  return (
    <main className="min-h-screen px-6 pb-28 pt-36 md:py-28">
      <div className="mx-auto max-w-[96rem]">
        <Link
          className="text-sm text-white/60 transition hover:text-white"
          href="/admin/commissions"
        >
          ← All commissions
        </Link>

        <header className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.16em] text-white/50">
              {commission.reference}
            </p>
            <h1 className="mt-2 text-4xl font-light">
              {commission.clientName}
            </h1>
            <p className="mt-2 text-white/60">
              Submitted {formatCommissionDate(commission.submittedAt)}
            </p>
            <p className="mt-1 text-xs text-white/45">
              All dates and times are shown in Chile local time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <CommissionStatusBadge status={commission.status} />
            {commission.isOnHold && (
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                On hold
              </span>
            )}
          </div>
        </header>

        <nav
          aria-label="Commission sections"
          className="mt-8 flex gap-2 overflow-x-auto border-b border-white/10 pb-3"
        >
          {COMMISSION_DETAIL_TABS.map((tab) => (
            <Link
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={
                activeTab === tab.id
                  ? "shrink-0 rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-medium text-white"
                  : "shrink-0 rounded-xl border border-transparent px-4 py-2.5 text-sm text-white/60 transition hover:border-white/10 hover:bg-white/[0.06] hover:text-white"
              }
              href={`/admin/commissions/${id}?tab=${tab.id}`}
              key={tab.id}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {activeTab === "overview" && (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.85fr)]">
            <div className="space-y-6">
              <section className="glass-card p-6">
                <h2 className="text-xl font-light">Client</h2>
                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  <DetailItem label="Name" value={commission.clientName} />
                  <DetailItem label="Email" value={commission.clientEmail} />
                  <DetailItem
                    label="Company"
                    value={displayValue(commission.clientCompanyName)}
                  />
                  <DetailItem
                    label="Country"
                    value={displayValue(commission.clientCountry)}
                  />
                </dl>
              </section>

              <section className="glass-card p-6">
                <h2 className="text-xl font-light">Original client request</h2>
                <p className="mt-1 text-xs leading-relaxed text-white/50">
                  Preserved exactly as submitted. The administrative selection is
                  shown under Service classification.
                </p>
                <dl className="mt-5 grid gap-5 sm:grid-cols-2">
                  <DetailItem
                    label="Style"
                    value={displayRequestedValue(commission.styleSnapshot)}
                  />
                  <DetailItem
                    label="Collection"
                    value={displayRequestedValue(commission.collectionSnapshot)}
                  />
                  <DetailItem
                    label="Category"
                    value={displayRequestedValue(commission.categorySnapshot)}
                  />
                  <DetailItem
                    label="Option"
                    value={displayRequestedValue(commission.optionSnapshot)}
                  />
                </dl>

                <div className="mt-6 border-t border-white/10 pt-6">
                  <p className="text-xs uppercase tracking-[0.12em] text-white/45">
                    Initial message
                  </p>
                  <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-white/85">
                    {commission.initialMessage}
                  </p>
                </div>
              </section>
            </div>
            <aside className="space-y-6">
              <div id="commission-workflow" className="scroll-mt-28">
                <section className="glass-card p-6">
                  <h2 className="text-xl font-light">Workflow</h2>
                  <dl className="mt-5 space-y-5">
                    <DetailItem
                      label="Status"
                      value={COMMISSION_STATUS_LABELS[commission.status]}
                    />
                    <DetailItem
                      label="Hold reason"
                      value={displayValue(commission.holdReason)}
                    />
                    <DetailItem
                      label="Hold started"
                      value={formatCommissionDate(commission.holdStartedAt)}
                    />
                    <DetailItem
                      label="Close reason"
                      value={
                        commission.closeReason
                          ? humanize(commission.closeReason)
                          : "Not applicable"
                      }
                    />
                    <DetailItem
                      label="Close note"
                      value={displayValue(commission.closeReasonNote)}
                    />
                    <DetailItem
                      label="Closed by"
                      value={
                        commission.closedBy
                          ? humanize(commission.closedBy)
                          : "Not applicable"
                      }
                    />
                  </dl>

                  <CommissionWorkflowActions
                    commissionId={commission.id}
                    currentStatus={commission.status}
                    isOnHold={commission.isOnHold}
                  />
                </section>
              </div>
              <CommissionClassificationPanel
                classification={commission.serviceClassification}
                classificationNote={commission.classificationNote}
                commissionId={commission.id}
                expectedUpdatedAt={commission.updatedAt.toISOString()}
                hasQuotes={quotes.length > 0}
                pricingOptionId={commission.pricingOptionId}
                pricingServiceId={commission.pricingServiceId}
                requestSource={commission.requestSource}
                services={(pricingCatalog?.services ?? []).map((entry) => ({
                  code: entry.service.code,
                  id: entry.service.id,
                  options: entry.options.map(({ option }) => ({
                    baseAmount: option.baseAmount,
                    id: option.id,
                    quoteLabel: option.quoteLabel,
                    title: option.title,
                  })),
                  title: entry.service.title,
                }))}
              />
            </aside>
          </div>
        )}

        {activeTab === "conversation" && (
          <div className="mx-auto mt-6 w-full max-w-5xl">
            <CommissionConversationPanel
              commissionId={commission.id}
              messages={conversation.messages.map((message) => ({
                createdAt: message.createdAt,
                deliveryStatus: message.deliveryStatus,
                direction: message.direction,
                failedAt: message.failedAt,
                id: message.id,
                kind: message.kind,
                messageText: message.messageText,
                sentAt: message.sentAt,
              }))}
              subject={conversation.thread?.subject ?? null}
              threadExists={conversation.thread !== null}
              threadReady={Boolean(
                conversation.thread?.rootMessageId,
              )}
            />
          </div>
        )}

        {activeTab === "documents" && (
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)]">
            <div className="min-w-0 space-y-6">
              <CommissionQuotePanel
                commissionId={commission.id}
                commissionStatus={commission.status}
                pricingConfig={pricingConfig}
                quotes={quotes}
              />
            </div>
            <div className="min-w-0 space-y-6">
              {/* Commission Agreement */}
              {activeAgreement?.status === "draft" && agreementDraftData ? (
                <CommissionAgreementPanel
                  agreementId={activeAgreement.id}
                  agreementVersion={activeAgreement.agreementVersion}
                  commissionId={commission.id}
                  initialData={agreementDraftData}
                  initialUpdatedAt={activeAgreement.updatedAt.toISOString()}
                  quoteId={activeAgreement.quoteId}
                  termsVersion={activeAgreement.termsVersion}
                  preview={
                    agreementPreviewData ? (
                      <CommissionAgreementDocumentPreview
                        document={agreementPreviewData}
                      />
                    ) : (
                      <p className="text-sm leading-relaxed text-white/60">
                        {agreementPreviewError ??
                          (agreementPaymentPlan.length === 0
                            ? "Create the payment plan in the Payments tab before previewing the Agreement."
                            : "The Agreement preview is not available in the current commission state.")}
                      </p>
                    )
                  }
                />
              ) : !activeAgreement &&
                commission.status === "awaiting_agreement" ? (
                <CommissionAgreementCreatePanel
                  commissionId={commission.id}
                  isOnHold={commission.isOnHold}
                />
              ) : (
                (commission.status === "awaiting_agreement" ||
                  activeAgreement) && (
                  <section className="glass-card p-6">
                    <h2 className="text-xl font-light">
                      Commission Agreement
                    </h2>

                    {activeAgreement ? (
                      <div className="mt-4 space-y-4">
                        <dl className="space-y-4">
                          <DetailItem
                            label="Status"
                            value={humanize(activeAgreement.status)}
                          />

                          <DetailItem
                            label="Agreement revision"
                            value={`Version ${activeAgreement.version}`}
                          />

                          <DetailItem
                            label="Template version"
                            value={activeAgreement.agreementVersion}
                          />

                          <DetailItem
                            label="Terms of Service version"
                            value={activeAgreement.termsVersion}
                          />
                        </dl>

                        {activeAgreement.status === "draft" &&
                          !agreementDraftData && (
                            <p className="text-sm leading-relaxed text-amber-100">
                              The saved Agreement data has an unsupported
                              structure. Review it before enabling the editor.
                              No data has been replaced.
                            </p>
                          )}

                        {activeAgreement.status === "sent" && (
                          <p className="text-sm leading-relaxed text-white/60">
                            This Agreement has been presented to the client
                            and can no longer be edited.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-relaxed text-white/60">
                        No active Agreement has been created for this
                        commission.
                      </p>
                    )}
                  </section>
                )
              )}

            </div>
          </div>
        )}

        {activeTab === "payments" && (
          <div className="mt-6 max-w-5xl space-y-6">
            {/* Payment plan: creation */}
            {activeAgreement?.status === "draft" &&
              agreementQuote &&
              agreementPaymentPlan.length === 0 && (
                <CommissionPaymentPlanCreatePanel
                  agreementId={activeAgreement.id}
                  commissionId={commission.id}
                  currency={agreementQuote.currency}
                  quoteTotalAmount={agreementQuote.totalAmount}
                />
              )}

            {/* Payment plan: existing stages */}
            {activeAgreement && agreementPaymentPlan.length > 0 && (
              <div className="space-y-3">
                {canEditPaymentPlan && agreementQuote && (
                  <div className="flex justify-end">
                    <CommissionPaymentPlanEditPanel
                      commissionId={commission.id}
                      agreementId={activeAgreement.id}
                      expectedAgreementUpdatedAt={
                        activeAgreement.updatedAt.toISOString()
                      }
                      quoteTotalAmount={agreementQuote.totalAmount}
                      currency={agreementQuote.currency}
                      initialDeliverables={agreementDeliverables}
                      initialStages={agreementPaymentPlan}
                    />
                  </div>
                )}

                <CommissionPaymentPlanPanel
                  agreementStatus={activeAgreement.status}
                  currency={
                    agreementQuote?.currency ??
                    agreementPaymentPlan[0].currency
                  }
                  deliverables={agreementDeliverables}
                  stages={agreementPaymentPlan}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
            <div className="space-y-6">
              <div className="lg:col-span-3">
                <CommissionActivityPanel
                  commissionId={commission.id}
                  events={events}
                  statusHistory={statusHistory}
                />
              </div>
            </div>
            <aside className="space-y-6">
              <section className="glass-card p-6">
                <h2 className="text-xl font-light">Dates</h2>
                <dl className="mt-5 space-y-5">
                  <DetailItem
                    label="Submitted"
                    value={formatCommissionDate(commission.submittedAt)}
                  />
                  <DetailItem
                    label="Started"
                    value={formatCommissionDate(commission.startedAt)}
                  />
                  <DetailItem
                    label="Final delivered"
                    value={formatCommissionDate(commission.finalDeliveredAt)}
                  />
                  <DetailItem
                    label="Completed"
                    value={formatCommissionDate(commission.completedAt)}
                  />
                  <DetailItem
                    label="Closed"
                    value={formatCommissionDate(commission.closedAt)}
                  />
                  <DetailItem
                    label="Last updated"
                    value={formatCommissionDate(commission.updatedAt)}
                  />
                </dl>
              </section>

              <section className="glass-card p-6">
                <h2 className="text-xl font-light">Consent</h2>
                <dl className="mt-5 space-y-5">
                  <DetailItem
                    label="Terms version"
                    value={displayValue(commission.termsVersion)}
                  />
                  <DetailItem
                    label="Agreement version"
                    value={displayValue(commission.agreementVersion)}
                  />
                </dl>
              </section>

              <section className="glass-card p-6">
                <h2 className="text-xl font-light">Technical identifiers</h2>
                <dl className="mt-5 space-y-5">
                  <DetailItem label="Commission ID" value={commission.id} />
                  <DetailItem
                    label="Submission ID"
                    value={commission.submissionId}
                  />
                </dl>
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
