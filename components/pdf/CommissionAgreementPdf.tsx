
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

import CommissionAgreementPdfLayout from "./CommissionAgreementPdfLayout";

interface CommissionAgreementPdfProps {
  backgroundDataUrl: string;
  documentData: CommissionAgreementDocumentData;
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
});

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


function LicenseOption({
  selected,
  label,
}: {
  selected: boolean;
  label: string;
}) {
  return (
    <View style={styles.licenseRow} wrap={false}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
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
        <View key={stage.id} style={styles.stage} wrap={false}>
          <View style={styles.stageHeader}>
            <Text style={styles.stageLabel}>
              {stage.label}
            </Text>

            <Text style={styles.stageAmount}>
              {formatMoney(stage.amount, currency)}
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

  return (
    <CommissionAgreementPdfLayout
      backgroundDataUrl={backgroundDataUrl}
    >
      <Text style={styles.title}>
        COMMISSION AGREEMENT
      </Text>

      <Text style={styles.subtitle}>
        Agreement revision {agreement.revision} | Template{" "}
        {agreement.agreementVersion} | ToS {agreement.termsVersion}
      </Text>

      <Text style={styles.sectionTitle} minPresenceAhead={45}>
        PARTIES
      </Text>

      <Text style={styles.paragraph}>
        This Commission Agreement is between Josefa Santis
        {" “Fefierys”"} (the Artist) and {parties.client.name} (the Client)
        for the creation of a custom illustration.
      </Text>

      <Text style={styles.detail}>
        Client email: {parties.client.email}
      </Text>

        {parties.client.companyName?.trim() &&
        !["n/a", "not provided"].includes(
            parties.client.companyName.trim().toLowerCase(),
        ) && (
            <Text style={styles.detail}>
            Company: {parties.client.companyName.trim()}
            </Text>
        )}

        {parties.client.country?.trim() &&
        !["n/a", "not provided"].includes(
            parties.client.country.trim().toLowerCase(),
        ) && (
            <Text style={styles.detail}>
            Country: {parties.client.country.trim()}
            </Text>
        )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={48}>
          1. PROJECT DETAILS, DELIVERY, FEES &amp; PAYMENT
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={30}>
          1.1. Project Name/Description
        </Text>

        <Text style={[styles.paragraph, styles.emphasis]}>
          {project.name}
        </Text>

        <Text style={styles.paragraph}>
          {project.description}
        </Text>

        <Text style={styles.detail}>
          Type of illustration: {project.illustrationType}
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={35}>
          1.2. File Format &amp; Specifications
        </Text>

        <Text style={styles.detail}>
          Size: {delivery.size}
        </Text>

        <Text style={styles.detail}>
          Color mode: {delivery.colorMode}
        </Text>

        <Text style={styles.detail}>
          File format(s): {delivery.fileFormats.join(", ")}
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={35}>
          1.3. Project Fees
        </Text>

        <Text style={[styles.detail, styles.emphasis]}>
          Price details
        </Text>

        {pricing.items.length > 0 ? (
          pricing.items.map((item) => (
            <View key={item.id}>
              <View style={styles.priceRow} wrap={false}>
                <Text style={styles.priceLabel}>
                  {item.label} (Qty: {item.quantity})
                </Text>

                <Text style={styles.priceAmount}>
                  {formatMoney(item.lineTotal, pricing.currency)}
                </Text>
              </View>

              <Text style={styles.muted}>
                Unit amount:{" "}
                {formatMoney(item.unitAmount, pricing.currency)}
              </Text>

              {item.description && (
                <Text style={styles.muted}>
                  {item.description}
                </Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.detail}>
            An itemized price breakdown is not available for this Quote.
          </Text>
        )}

        {pricing.preDiscountSubtotal !== null && (
          <View style={styles.priceRow} wrap={false}>
            <Text style={styles.priceLabel}>
              Subtotal before discounts
            </Text>

            <Text style={styles.priceAmount}>
              {formatMoney(
                pricing.preDiscountSubtotal,
                pricing.currency,
              )}
            </Text>
          </View>
        )}

        {pricing.discountTotal !== null && (
          <View style={styles.priceRow} wrap={false}>
            <Text style={styles.priceLabel}>
              Total discounts
            </Text>

            <Text style={styles.priceAmount}>
              {formatMoney(
                pricing.discountTotal.startsWith("-")
                  ? pricing.discountTotal
                  : `-${pricing.discountTotal}`,
                pricing.currency,
              )}
            </Text>
          </View>
        )}

        <View style={styles.totalRow} wrap={false}>
          <Text style={[styles.priceLabel, styles.emphasis]}>
            Total project fee
          </Text>

          <Text style={[styles.priceAmount, styles.emphasis]}>
            {formatMoney(pricing.totalAmount, pricing.currency)}
          </Text>
        </View>

        <Text style={styles.subsectionTitle} minPresenceAhead={35}>
          Payment details
        </Text>

        {paymentPlan.projectStages.length > 0 && (
          <View>
            <Text style={styles.subsectionTitle} minPresenceAhead={25}>
              Project-wide payments
            </Text>

            <PaymentStages
              stages={paymentPlan.projectStages}
              currency={paymentPlan.currency}
            />
          </View>
        )}

        {paymentPlan.deliverables.map((deliverable) => (
          <View key={deliverable.id}>
            <Text style={styles.subsectionTitle} minPresenceAhead={30}>
              {deliverable.title}
            </Text>

            <Text style={styles.detail}>
              Quantity: {deliverable.quantity}
            </Text>

            {deliverable.description && (
              <Text style={styles.paragraph}>
                {deliverable.description}
              </Text>
            )}

            {deliverable.stages.length > 0 ? (
              <PaymentStages
                stages={deliverable.stages}
                currency={paymentPlan.currency}
              />
            ) : (
              <Text style={styles.muted}>
                No payment stages associated with this deliverable.
              </Text>
            )}
          </View>
        ))}

        <View style={styles.totalRow} wrap={false}>
          <Text style={[styles.priceLabel, styles.emphasis]}>
            Total payments
          </Text>

          <Text style={[styles.priceAmount, styles.emphasis]}>
            {formatMoney(
              paymentPlan.totalAmount,
              paymentPlan.currency,
            )}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={45}>
          2. LICENSE RIGHTS &amp; USAGE
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={30}>
          2.1. Selected License
        </Text>

        <LicenseOption
        selected={license.selectedOption === "personal_use"}
        label="OPTION A: PERSONAL USE ONLY"
        />

        <LicenseOption
        selected={license.selectedOption === "commercial_use"}
        label="OPTION B: COMMERCIAL USE"
        />

        {license.selectedOption === "commercial_use" && (
          <>
            <Text style={styles.subsectionTitle} minPresenceAhead={30}>
              2.2. Commercial Scope
            </Text>

            <Text style={styles.paragraph}>
              {license.commercialScope}
            </Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={45}>
          3. CONFIDENTIALITY &amp; PROJECT-SPECIFIC CONDITIONS
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={30}>
          3.1. Confidentiality &amp; Hold Date
        </Text>

        <Text style={styles.paragraph}>
          Confidentiality requirement:{" "}
          {projectConditions.confidentialityRequirement}
        </Text>

        <Text style={styles.detail}>
          Hold Date: {projectConditions.holdDate ?? "N/A"}
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={30}>
          3.2. Project-Specific Exceptions or Additional Terms
        </Text>

        <Text style={styles.paragraph}>
          {projectConditions.additionalTerms.trim() || "N/A"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={45}>
          4. NO GENERATIVE AI POLICY
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={30}>
          4.1. Artist AI Guarantee
        </Text>

        <Text style={styles.paragraph}>
          All illustrations, Artwork, and design assets provided by
          the Artist are 100% human-created and hand-crafted.
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={30}>
          4.2. Client AI Restrictions
        </Text>

        <Text style={styles.paragraph}>
          The Client explicitly agrees NOT to upload, process, submit,
          host, or feed any part of the commissioned Artwork, sketches,
          preliminary works, or final deliverables into any generative
          AI tools, machine-learning models, image-generation datasets,
          or algorithms.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle} minPresenceAhead={45}>
          5. ACCEPTANCE OF TERMS
        </Text>

        <Text style={styles.subsectionTitle} minPresenceAhead={30}>
          5.1. Agreement to Terms
        </Text>

        <Text style={styles.paragraph}>
          The Client will receive a secure link to the Fefierys website
          to review and electronically accept this Commission Agreement,
          already electronically signed by the Artist, and the applicable
          version of the Artist&apos;s Terms of Service (version{" "}
          {agreement.termsVersion}).
        </Text>

        <Text style={styles.paragraph}>
          By electronically accepting both documents, the Client
          acknowledges that they have read, understood, and agreed to
          their terms, including the project details, license rights,
          payment plan, and other conditions set forth in this Agreement.
        </Text>

        <Text style={styles.paragraph}>
          Following the Client&apos;s acceptance, the initial payment will
          be requested in accordance with the agreed payment plan.
        </Text>

        <Text style={styles.paragraph}>
          The Artist will begin work on the commission only after the
          initial payment has been received and confirmed.
        </Text>
      </View>
    </CommissionAgreementPdfLayout>
  );
}
