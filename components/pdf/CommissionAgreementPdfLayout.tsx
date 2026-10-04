import type { ReactNode } from "react";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

export type CommissionAgreementPdfVariant =
  | "draft"
  | "presented"
  | "executed";

interface CommissionAgreementPdfLayoutProps {
  backgroundDataUrl: string;
  children: ReactNode;
  variant?: CommissionAgreementPdfVariant;
}

const styles = StyleSheet.create({
  page: {
    position: "relative",
    paddingTop: 76,
    paddingBottom: 76,
    paddingHorizontal: 64,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#FFFFFF",
  },

  background: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 612,
    height: 792,
  },

  documentLabel: {
    position: "absolute",
    top: 43,
    right: 64,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#FFFFFF",
  },

  content: {
    width: "100%",
  },
});

function getDocumentTitle(
  variant: CommissionAgreementPdfVariant,
): string {
  switch (variant) {
    case "draft":
      return "Fefierys Art - Commission Agreement - Draft";

    case "presented":
      return "Fefierys Art - Commission Agreement";

    case "executed":
      return "Fefierys Art - Commission Agreement - Executed";
  }
}

function getDocumentLabel(
  variant: CommissionAgreementPdfVariant,
): string | null {
  switch (variant) {
    case "draft":
      return "DRAFT - NOT FOR CLIENT DELIVERY";

    case "presented":
      return null;

    case "executed":
      return "EXECUTED AGREEMENT";
  }
}

export default function CommissionAgreementPdfLayout({
  backgroundDataUrl,
  children,
  variant = "draft",
}: CommissionAgreementPdfLayoutProps) {
  const documentLabel =
    getDocumentLabel(
      variant,
    );

  return (
    <Document
      title={getDocumentTitle(variant)}
      author="Fefierys Art"
    >
      <Page
        size="LETTER"
        style={styles.page}
        wrap
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Decorative background in a PDF; @react-pdf/renderer Image does not support alt. */}
        <Image
          src={backgroundDataUrl}
          style={styles.background}
          fixed
        />

        {documentLabel && (
          <Text
            style={styles.documentLabel}
            fixed
          >
            {documentLabel}
          </Text>
        )}

        <View style={styles.content}>
          {children}
        </View>
      </Page>
    </Document>
  );
}