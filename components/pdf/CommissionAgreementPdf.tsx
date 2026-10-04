import {
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";

import type {
  CommissionAgreementDocumentData,
  CommissionAgreementDocumentPaymentStage,
} from "@/lib/commissions/commissionAgreementDocumentData";

import {
  getCommissionAgreementLayout,
  type CommissionAgreementLayoutSection,
} from "@/lib/commissions/commissionAgreementData";

import {
  COMMISSION_AGREEMENT_ARTIST_ROLE,
  COMMISSION_AGREEMENT_ARTIST_SIGNER_NAME,
  COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION,
  formatCommissionAgreementSignatureDate,
} from "@/lib/commissions/commissionAgreementSignature";

import CommissionAgreementPdfLayout, {
  type CommissionAgreementPdfVariant,
} from "./CommissionAgreementPdfLayout";

interface CommissionAgreementPdfProps {
  backgroundDataUrl: string;
  documentData: CommissionAgreementDocumentData;
  variant?: CommissionAgreementPdfVariant;
  artistSignedAt?: Date;
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 9,
  },

  subtitle: {
    fontSize: 8,
    textAlign: "center",
    marginBottom: 22,
  },

  section: {
    marginTop: 17,
  },

  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11.5,
    marginBottom: 10,
    textDecoration: "underline",
  },

  subsectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    marginTop: 12,
    marginBottom: 7,
  },

  paragraph: {
    fontSize: 10.5,
    lineHeight: 1.45,
    marginBottom: 8,
  },

  detail: {
    fontSize: 10,
    lineHeight: 1.45,
    marginBottom: 6,
  },

  muted: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 5,
  },

  emphasis: {
    fontFamily: "Helvetica-Bold",
  },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 7,
  },

  priceLabel: {
    width: "73%",
    fontSize: 10,
    lineHeight: 1.4,
  },

  priceAmount: {
    width: "25%",
    fontSize: 10,
    textAlign: "right",
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: "#FFFFFF",
  },

  stage: {
    marginTop: 8,
    paddingBottom: 7,
    borderBottomWidth: 0.4,
    borderBottomColor: "#FFFFFF",
  },

  stageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  stageLabel: {
    width: "72%",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },

  stageAmount: {
    width: "26%",
    fontSize: 10,
    textAlign: "right",
  },

  licenseRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  licenseLabel: {
    fontSize: 10.5,
    marginLeft: 8,
  },

  acceptancePage: {
    position: "relative",
    height: 640,
  },

  signatureRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  signatureColumn: {
    width: "36%",
    minHeight: 90,
  },

  signatureName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    lineHeight: 1.35,
    marginBottom: 4,
  },

  signatureRole: {
    fontSize: 9.5,
    lineHeight: 1.35,
    marginBottom: 4,
  },

  signatureDate: {
    fontSize: 8.5,
    lineHeight: 1.35,
    marginBottom: 5,
  },

  signatureConfirmation: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    lineHeight: 1.35,
  },
});

function formatMoney(
  amount: string,
  currency: string,
): string {
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
      return (
        stage.customTriggerNote?.trim() ||
        "Custom payment condition"
      );
  }
}

function LicenseOption({
  selected,
  label,
}: {
  selected: boolean;
  label: string;
}) {
  return (
    <View
      style={styles.licenseRow}
      wrap={false}
    >
      <Svg
        width={12}
        height={12}
        viewBox="0 0 12 12"
      >
        <Rect
          x={1}
          y={1}
          width={10}
          height={10}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={0.9}
        />

        {selected && (
          <Path
            d="M 3.2 3.2 L 8.8 8.8 M 8.8 3.2 L 3.2 8.8"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.1}
          />
        )}
      </Svg>

      <Text style={styles.licenseLabel}>
        {label}
      </Text>
    </View>
  );
}

function PaymentStages({
  stages,
  currency,
}: {
  stages: readonly CommissionAgreementDocumentPaymentStage[];
  currency: string;
}) {
  return (
    <View>
      {stages.map((stage) => (
        <View
          key={stage.id}
          style={styles.stage}
          wrap={false}
        >
          <View style={styles.stageHeader}>
            <Text style={styles.stageLabel}>
              {stage.label}
            </Text>

            <Text style={styles.stageAmount}>
              {formatMoney(
                stage.amount,
                currency,
              )}
            </Text>
          </View>

          <Text style={styles.muted}>
            {getPaymentTriggerLabel(stage)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function CommissionAgreementPdf({
  backgroundDataUrl,
  documentData,
  variant = "draft",
  artistSignedAt,
}: CommissionAgreementPdfProps) {
  const {
    agreement,
    parties,
    pricing,
    paymentPlan,
  } = documentData;

  const {
    project,
    delivery,
    license,
    projectConditions,
  } = agreement.content;

  const layout =
    getCommissionAgreementLayout(
      agreement.content,
    );

  const artistSignatureDate =
    artistSignedAt
      ? formatCommissionAgreementSignatureDate(
          artistSignedAt,
        )
      : null;

  function startsOnNewPage(
    section: CommissionAgreementLayoutSection,
  ): boolean {
    return layout.pageBreakBefore.includes(
      section,
    );
  }

  function keepsTogether(
    section: CommissionAgreementLayoutSection,
  ): boolean {
    return layout.keepTogether.includes(
      section,
    );
  }

  return (
    <CommissionAgreementPdfLayout
      backgroundDataUrl={backgroundDataUrl}
      variant={variant}
    >
      <Text style={styles.title}>
        COMMISSION AGREEMENT
      </Text>

      <Text style={styles.subtitle}>
        Agreement revision {agreement.revision} | Template{" "}
        {agreement.agreementVersion} | ToS{" "}
        {agreement.termsVersion}
      </Text>

      {/* ======================================================
       * PARTIES
       * ====================================================== */}
      <View
        break={startsOnNewPage("parties")}
        wrap={!keepsTogether("parties")}
      >
        <Text
          style={styles.sectionTitle}
          minPresenceAhead={45}
        >
          PARTIES
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          This Commission Agreement is between Josefa Santis
          {" “Fefierys”"} (the Artist) and {parties.client.name} (the
          Client) for the creation of a custom illustration.
        </Text>

        <Text style={styles.detail}>
          Client email: {parties.client.email}
        </Text>

        {parties.client.companyName?.trim() &&
          !["n/a", "not provided"].includes(
            parties.client.companyName
              .trim()
              .toLowerCase(),
          ) && (
            <Text style={styles.detail}>
              Company:{" "}
              {parties.client.companyName.trim()}
            </Text>
          )}

        {parties.client.country?.trim() &&
          !["n/a", "not provided"].includes(
            parties.client.country
              .trim()
              .toLowerCase(),
          ) && (
            <Text style={styles.detail}>
              Country:{" "}
              {parties.client.country.trim()}
            </Text>
          )}
      </View>

      {/* ======================================================
       * 1.1 PROJECT DETAILS
       * ====================================================== */}
      <View
        style={styles.section}
        break={startsOnNewPage(
          "project_details",
        )}
        wrap={
          !keepsTogether(
            "project_details",
          )
        }
      >
        <Text
          style={styles.sectionTitle}
          minPresenceAhead={48}
        >
          1. PROJECT DETAILS, DELIVERY, FEES &amp; PAYMENT
        </Text>

        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={30}
        >
          1.1. Project Name/Description
        </Text>

        <Text
          style={[
            styles.paragraph,
            styles.emphasis,
          ]}
        >
          {project.name}
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          {project.description}
        </Text>

        <Text style={styles.detail}>
          Type of illustration:{" "}
          {project.illustrationType}
        </Text>
      </View>

      {/* ======================================================
       * 1.2 DELIVERY
       * ====================================================== */}
      <View
        break={startsOnNewPage("delivery")}
        wrap={!keepsTogether("delivery")}
      >
        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={35}
        >
          1.2. File Format &amp; Specifications
        </Text>

        <Text style={styles.detail}>
          Size: {delivery.size}
        </Text>

        <Text style={styles.detail}>
          Color mode: {delivery.colorMode}
        </Text>

        <Text style={styles.detail}>
          File format(s):{" "}
          {delivery.fileFormats.join(", ")}
        </Text>
      </View>

      {/* ======================================================
       * 1.3 PRICING
       * ====================================================== */}
      <View
        break={startsOnNewPage("pricing")}
        wrap={!keepsTogether("pricing")}
      >
        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={35}
        >
          1.3. Project Fees
        </Text>

        <Text
          style={[
            styles.detail,
            styles.emphasis,
          ]}
        >
          Price details
        </Text>

        {pricing.items.length > 0 ? (
          pricing.items.map((item) => (
            <View
              key={item.id}
              wrap={false}
            >
              <View
                style={styles.priceRow}
                wrap={false}
              >
                <Text style={styles.priceLabel}>
                  {item.label} (Qty:{" "}
                  {item.quantity})
                </Text>

                <Text
                  style={styles.priceAmount}
                >
                  {formatMoney(
                    item.lineTotal,
                    pricing.currency,
                  )}
                </Text>
              </View>

              <Text style={styles.muted}>
                Unit amount:{" "}
                {formatMoney(
                  item.unitAmount,
                  pricing.currency,
                )}
              </Text>

              {item.description && (
                <Text
                  style={styles.muted}
                  orphans={2}
                  widows={2}
                >
                  {item.description}
                </Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.detail}>
            An itemized price breakdown is not available for
            this Quote.
          </Text>
        )}

        {pricing.preDiscountSubtotal !==
          null && (
          <View
            style={styles.priceRow}
            wrap={false}
          >
            <Text style={styles.priceLabel}>
              Subtotal before discounts
            </Text>

            <Text
              style={styles.priceAmount}
            >
              {formatMoney(
                pricing.preDiscountSubtotal,
                pricing.currency,
              )}
            </Text>
          </View>
        )}

        {pricing.discountTotal !== null && (
          <View
            style={styles.priceRow}
            wrap={false}
          >
            <Text style={styles.priceLabel}>
              Total discounts
            </Text>

            <Text
              style={styles.priceAmount}
            >
              {formatMoney(
                pricing.discountTotal.startsWith(
                  "-",
                )
                  ? pricing.discountTotal
                  : `-${pricing.discountTotal}`,
                pricing.currency,
              )}
            </Text>
          </View>
        )}

        <View
          style={styles.totalRow}
          wrap={false}
        >
          <Text
            style={[
              styles.priceLabel,
              styles.emphasis,
            ]}
          >
            Total project fee
          </Text>

          <Text
            style={[
              styles.priceAmount,
              styles.emphasis,
            ]}
          >
            {formatMoney(
              pricing.totalAmount,
              pricing.currency,
            )}
          </Text>
        </View>
      </View>

      {/* ======================================================
       * PAYMENT PLAN
       * ====================================================== */}
      <View
        break={startsOnNewPage(
          "payment_plan",
        )}
        wrap={
          !keepsTogether(
            "payment_plan",
          )
        }
      >
        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={35}
        >
          Payment details
        </Text>

        {paymentPlan.projectStages.length >
          0 && (
          <View>
            <Text
              style={styles.subsectionTitle}
              minPresenceAhead={25}
            >
              Project-wide payments
            </Text>

            <PaymentStages
              stages={
                paymentPlan.projectStages
              }
              currency={
                paymentPlan.currency
              }
            />
          </View>
        )}

        {paymentPlan.deliverables.map(
          (deliverable) => (
            <View key={deliverable.id}>
              {/*
               * Keep the deliverable heading and its descriptive
               * information together. Individual payment stages
               * are independently protected by PaymentStages.
               */}
              <View wrap={false}>
                <Text
                  style={
                    styles.subsectionTitle
                  }
                  minPresenceAhead={30}
                >
                  {deliverable.title}
                </Text>

                <Text style={styles.detail}>
                  Quantity:{" "}
                  {deliverable.quantity}
                </Text>

                {deliverable.description && (
                  <Text
                    style={styles.paragraph}
                    orphans={2}
                    widows={2}
                  >
                    {
                      deliverable.description
                    }
                  </Text>
                )}
              </View>

              {deliverable.stages.length >
              0 ? (
                <PaymentStages
                  stages={
                    deliverable.stages
                  }
                  currency={
                    paymentPlan.currency
                  }
                />
              ) : (
                <Text style={styles.muted}>
                  No payment stages associated with this
                  deliverable.
                </Text>
              )}
            </View>
          ),
        )}

        <View
          style={styles.totalRow}
          wrap={false}
        >
          <Text
            style={[
              styles.priceLabel,
              styles.emphasis,
            ]}
          >
            Total payments
          </Text>

          <Text
            style={[
              styles.priceAmount,
              styles.emphasis,
            ]}
          >
            {formatMoney(
              paymentPlan.totalAmount,
              paymentPlan.currency,
            )}
          </Text>
        </View>
      </View>

      {/* ======================================================
       * LICENSE
       * ====================================================== */}
      <View
        style={styles.section}
        break={startsOnNewPage("license")}
        wrap={!keepsTogether("license")}
      >
        <Text
          style={styles.sectionTitle}
          minPresenceAhead={45}
        >
          2. LICENSE RIGHTS &amp; USAGE
        </Text>

        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={30}
        >
          2.1. Selected License
        </Text>

        <LicenseOption
          selected={
            license.selectedOption ===
            "personal_use"
          }
          label="OPTION A: PERSONAL USE ONLY"
        />

        <LicenseOption
          selected={
            license.selectedOption ===
            "commercial_use"
          }
          label="OPTION B: COMMERCIAL USE"
        />

        {license.selectedOption ===
          "commercial_use" && (
          <>
            <Text
              style={
                styles.subsectionTitle
              }
              minPresenceAhead={30}
            >
              2.2. Commercial Scope
            </Text>

            <Text
              style={styles.paragraph}
              orphans={2}
              widows={2}
            >
              {license.commercialScope}
            </Text>
          </>
        )}
      </View>

      {/* ======================================================
       * PROJECT CONDITIONS
       * ====================================================== */}
      <View
        style={styles.section}
        break={startsOnNewPage(
          "project_conditions",
        )}
        wrap={
          !keepsTogether(
            "project_conditions",
          )
        }
      >
        <Text
          style={styles.sectionTitle}
          minPresenceAhead={45}
        >
          3. CONFIDENTIALITY &amp; PROJECT-SPECIFIC
          CONDITIONS
        </Text>

        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={30}
        >
          3.1. Confidentiality &amp; Hold Date
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          Confidentiality requirement:{" "}
          {
            projectConditions.confidentialityRequirement
          }
        </Text>

        <Text style={styles.detail}>
          Hold Date:{" "}
          {projectConditions.holdDate ??
            "N/A"}
        </Text>

        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={30}
        >
          3.2. Project-Specific Exceptions or Additional
          Terms
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          {projectConditions.additionalTerms.trim() ||
            "N/A"}
        </Text>
      </View>

      {/* ======================================================
       * NO GENERATIVE AI POLICY
       * ====================================================== */}
      <View
        style={styles.section}
        break={startsOnNewPage(
          "ai_policy",
        )}
        wrap={
          !keepsTogether(
            "ai_policy",
          )
        }
      >
        <Text
          style={styles.sectionTitle}
          minPresenceAhead={45}
        >
          4. NO GENERATIVE AI POLICY
        </Text>

        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={30}
        >
          4.1. Artist AI Guarantee
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          All illustrations, Artwork, and design assets
          provided by the Artist are 100% human-created
          and hand-crafted.
        </Text>

        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={30}
        >
          4.2. Client AI Restrictions
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          The Client explicitly agrees NOT to upload,
          process, submit, host, or feed any part of the
          commissioned Artwork, sketches, preliminary
          works, or final deliverables into any
          generative AI tools, machine-learning models,
          image-generation datasets, or algorithms.
        </Text>
      </View>

      {/* ======================================================
       * ACCEPTANCE
       * ====================================================== */}
      <View
        style={styles.acceptancePage}
        break
        wrap={false}
      >
        <Text
          style={styles.sectionTitle}
          minPresenceAhead={45}
        >
          5. ACCEPTANCE OF TERMS
        </Text>

        <Text
          style={styles.subsectionTitle}
          minPresenceAhead={30}
        >
          5.1. Agreement to Terms
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          The Client will receive a secure link to the
          Fefierys website to review and electronically
          accept this Commission Agreement, already
          electronically signed by the Artist, and the
          applicable version of the Artist&apos;s Terms
          of Service (version{" "}
          {agreement.termsVersion}).
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          Following the Client&apos;s acceptance, the
          initial payment will be requested in
          accordance with the agreed payment plan.
        </Text>

        <Text
          style={styles.paragraph}
          orphans={2}
          widows={2}
        >
          The Artist will begin work on the commission
          only after the initial payment has been
          received and confirmed.
        </Text>

        {variant !== "draft" &&
          artistSignatureDate && (
            <View style={styles.signatureRow}>
              {/*
               * The Client column is intentionally reserved in the
               * immutable Presented PDF.
               *
               * After electronic acceptance, the Executed renderer
               * writes the Client's signature into this exact area
               * without rebuilding the contractual pages.
               */}
              <View style={styles.signatureColumn} />

              <View style={styles.signatureColumn}>
                <Text style={styles.signatureName}>
                  {
                    COMMISSION_AGREEMENT_ARTIST_SIGNER_NAME
                  }
                </Text>

                <Text style={styles.signatureRole}>
                  {
                    COMMISSION_AGREEMENT_ARTIST_ROLE
                  }
                </Text>

                <Text style={styles.signatureDate}>
                  {artistSignatureDate}
                </Text>

                <Text
                  style={
                    styles.signatureConfirmation
                  }
                >
                  {
                    COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION
                  }
                </Text>
              </View>
            </View>
          )}
      </View>
    </CommissionAgreementPdfLayout>
  );
}
