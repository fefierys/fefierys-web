
import type { ReactNode } from "react";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

interface CommissionAgreementPdfLayoutProps {
  backgroundDataUrl: string;
  children: ReactNode;
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

  draftLabel: {
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

export default function CommissionAgreementPdfLayout({
  backgroundDataUrl,
  children,
}: CommissionAgreementPdfLayoutProps) {
  return (
    <Document
      title="Fefierys Art - Commission Agreement - Draft"
      author="Fefierys Art"
    >
      <Page size="LETTER" style={styles.page} wrap>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- Decorative background in a PDF; @react-pdf/renderer Image does not support alt. */}
        <Image
          src={backgroundDataUrl}
          style={styles.background}
          fixed
        />

        <Text style={styles.draftLabel} fixed>
          DRAFT - NOT FOR CLIENT DELIVERY
        </Text>

        <View style={styles.content}>
          {children}
        </View>
      </Page>
    </Document>
  );
}