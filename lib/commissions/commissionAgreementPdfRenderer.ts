import { readFile } from "node:fs/promises";
import path from "node:path";

import { createElement } from "react";
import type {
  ReactElement,
} from "react";

import {
  renderToBuffer,
} from "@react-pdf/renderer";
import type {
  DocumentProps,
} from "@react-pdf/renderer";

import CommissionAgreementPdf from "@/components/pdf/CommissionAgreementPdf";
import type {
  CommissionAgreementPdfVariant,
} from "@/components/pdf/CommissionAgreementPdfLayout";

import type {
  CommissionAgreementDocumentData,
} from "./commissionAgreementDocumentData";

export interface RenderCommissionAgreementPdfOptions {
  variant?: CommissionAgreementPdfVariant;

  /*
   * Exact instant at which the Artist presents and signs the
   * immutable Agreement.
   *
   * This is intentionally supplied by the application service
   * so the PDF and persisted Agreement.sentAt can share the
   * same authoritative timestamp.
   */
  artistSignedAt?: Date;
}

function validateArtistSignedAt(
  value: Date | undefined,
  variant: CommissionAgreementPdfVariant,
): Date | undefined {
  if (
    variant ===
    "draft"
  ) {
    return undefined;
  }

  if (
    !(
      value
      instanceof Date
    ) ||
    Number.isNaN(
      value.getTime(),
    )
  ) {
    throw new Error(
      "artistSignedAt must be a valid Date for presented or executed Agreement PDFs.",
    );
  }

  return value;
}

export async function renderCommissionAgreementPdf(
  documentData: CommissionAgreementDocumentData,
  options: RenderCommissionAgreementPdfOptions = {},
): Promise<Buffer> {
  const variant =
    options.variant ??
    "draft";

  const artistSignedAt =
    validateArtistSignedAt(
      options.artistSignedAt,
      variant,
    );

  const backgroundPath =
    path.join(
      process.cwd(),
      "assets",
      "agreements",
      "Fondo-agreement.png",
    );

  const backgroundBytes =
    await readFile(
      backgroundPath,
    );

  const backgroundDataUrl =
    `data:image/png;base64,${backgroundBytes.toString("base64")}`;

  const pdfDocument =
    createElement(
      CommissionAgreementPdf,
      {
        backgroundDataUrl,
        documentData,
        variant,
        artistSignedAt,
      },
    ) as unknown as ReactElement<DocumentProps>;

  /*
   * One renderer is shared by all Agreement document states.
   *
   * - draft:
   *   internal preview/download only;
   *
   * - presented:
   *   immutable Agreement presented to the Client;
   *
   * - executed:
   *   immutable accepted copy generated after electronic
   *   acceptance.
   */
  return renderToBuffer(
    pdfDocument,
  );
}
