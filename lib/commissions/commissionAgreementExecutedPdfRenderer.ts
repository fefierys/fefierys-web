import {
  PDFDocument,
  PDFFont,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  COMMISSION_AGREEMENT_SIGNATURE_CLIENT_X,
  COMMISSION_AGREEMENT_SIGNATURE_COLUMN_WIDTH,
  COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION,
  COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION_SIZE,
  COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION_Y,
  COMMISSION_AGREEMENT_SIGNATURE_DATE_SIZE,
  COMMISSION_AGREEMENT_SIGNATURE_DATE_Y,
  COMMISSION_AGREEMENT_SIGNATURE_NAME_SIZE,
  COMMISSION_AGREEMENT_SIGNATURE_NAME_Y,
  COMMISSION_AGREEMENT_SIGNATURE_ROLE_SIZE,
  COMMISSION_AGREEMENT_SIGNATURE_ROLE_Y,
  formatCommissionAgreementSignatureDate,
} from "./commissionAgreementSignature";

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

export interface RenderExecutedCommissionAgreementPdfInput {
  /*
   * Exact bytes of the immutable PDF that was presented
   * to the Client and verified against its persisted SHA-256.
   */
  presentedPdf: Uint8Array;

  presentedContentSha256: string;

  reference: string;
  agreementRevision: number;

  /*
   * acceptedByName is the name explicitly entered by the Client
   * as their electronic signature.
   *
   * clientContactName is the trusted Commission client snapshot
   * originally captured from Contact.
   */
  acceptedByName: string;
  clientContactName: string;
  acceptedByEmail: string;

  acceptedAt: Date;
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

function fitFontSize(
  text: string,
  font: PDFFont,
  preferredSize: number,
  minimumSize: number,
  maxWidth: number,
): number {
  let size =
    preferredSize;

  while (
    size >
      minimumSize &&
    font.widthOfTextAtSize(
      text,
      size,
    ) >
      maxWidth
  ) {
    size -=
      0.25;
  }

  return size;
}

export async function renderExecutedCommissionAgreementPdf(
  input: RenderExecutedCommissionAgreementPdfInput,
): Promise<Uint8Array> {
  if (
    input.presentedPdf.byteLength ===
    0
  ) {
    throw new Error(
      "Presented Commission Agreement PDF cannot be empty.",
    );
  }

  const presentedContentSha256 =
    input.presentedContentSha256
      .trim()
      .toLowerCase();

  if (
    !SHA256_PATTERN.test(
      presentedContentSha256,
    )
  ) {
    throw new Error(
      "Presented Commission Agreement SHA-256 is invalid.",
    );
  }

  const reference =
    normalizeRequiredText(
      input.reference,
      "reference",
    );

  const acceptedByName =
    normalizeRequiredText(
      input.acceptedByName,
      "acceptedByName",
    );

  const clientContactName =
    normalizeRequiredText(
      input.clientContactName,
      "clientContactName",
    );

  /*
   * The Client email remains part of the internal acceptance
   * evidence and is persisted by the repository, but it is not
   * printed in the client-facing Executed Agreement.
   */
  normalizeRequiredText(
    input.acceptedByEmail,
    "acceptedByEmail",
  );

  if (
    !Number.isInteger(
      input.agreementRevision,
    ) ||
    input.agreementRevision <
      1
  ) {
    throw new Error(
      "agreementRevision must be a positive integer.",
    );
  }

  if (
    !(
      input.acceptedAt
      instanceof Date
    ) ||
    Number.isNaN(
      input.acceptedAt.getTime(),
    )
  ) {
    throw new Error(
      "acceptedAt must be a valid Date.",
    );
  }

  /*
   * Load the exact immutable PDF that was presented to the Client.
   *
   * The Artist signature is already part of those bytes.
   * The Executed Agreement adds only the Client signature to the
   * reserved left column on the final Acceptance page.
   */
  const pdfDocument =
    await PDFDocument.load(
      input.presentedPdf,
    );

  const pages =
    pdfDocument.getPages();

  if (
    pages.length ===
    0
  ) {
    throw new Error(
      "Presented Commission Agreement contains no pages.",
    );
  }

  const signaturePage =
    pages[
      pages.length -
        1
    ];

  const {
    width,
    height,
  } =
    signaturePage.getSize();

  /*
   * The Presented renderer uses US Letter (612 x 792 pt).
   *
   * Refuse to place a signature onto an unexpected final-page
   * geometry because that could position contractual evidence in
   * the wrong location.
   */
  if (
    Math.abs(
      width -
        612,
    ) >
      0.5 ||
    Math.abs(
      height -
        792,
    ) >
      0.5
  ) {
    throw new Error(
      "Presented Commission Agreement final page has an unexpected size.",
    );
  }

  const regularFont =
    await pdfDocument.embedFont(
      StandardFonts.Helvetica,
    );

  const boldFont =
    await pdfDocument.embedFont(
      StandardFonts.HelveticaBold,
    );

  const white =
    rgb(
      1,
      1,
      1,
    );

  const clientRole =
    `${clientContactName} - The Client`;

  const acceptedAt =
    formatCommissionAgreementSignatureDate(
      input.acceptedAt,
    );

  const nameSize =
    fitFontSize(
      acceptedByName,
      boldFont,
      COMMISSION_AGREEMENT_SIGNATURE_NAME_SIZE,
      6,
      COMMISSION_AGREEMENT_SIGNATURE_COLUMN_WIDTH,
    );

  const roleSize =
    fitFontSize(
      clientRole,
      regularFont,
      COMMISSION_AGREEMENT_SIGNATURE_ROLE_SIZE,
      6,
      COMMISSION_AGREEMENT_SIGNATURE_COLUMN_WIDTH,
    );

  const dateSize =
    fitFontSize(
      acceptedAt,
      regularFont,
      COMMISSION_AGREEMENT_SIGNATURE_DATE_SIZE,
      6,
      COMMISSION_AGREEMENT_SIGNATURE_COLUMN_WIDTH,
    );

  signaturePage.drawText(
    acceptedByName,
    {
      x:
        COMMISSION_AGREEMENT_SIGNATURE_CLIENT_X,

      y:
        COMMISSION_AGREEMENT_SIGNATURE_NAME_Y,

      size:
        nameSize,

      font:
        boldFont,

      color:
        white,
    },
  );

  signaturePage.drawText(
    clientRole,
    {
      x:
        COMMISSION_AGREEMENT_SIGNATURE_CLIENT_X,

      y:
        COMMISSION_AGREEMENT_SIGNATURE_ROLE_Y,

      size:
        roleSize,

      font:
        regularFont,

      color:
        white,
    },
  );

  signaturePage.drawText(
    acceptedAt,
    {
      x:
        COMMISSION_AGREEMENT_SIGNATURE_CLIENT_X,

      y:
        COMMISSION_AGREEMENT_SIGNATURE_DATE_Y,

      size:
        dateSize,

      font:
        regularFont,

      color:
        white,
    },
  );

  signaturePage.drawText(
    COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION,
    {
      x:
        COMMISSION_AGREEMENT_SIGNATURE_CLIENT_X,

      y:
        COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION_Y,

      size:
        COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION_SIZE,

      font:
        boldFont,

      color:
        white,
    },
  );

  /*
   * Technical acceptance evidence remains internal:
   * - accepted name and trusted client email;
   * - acceptance method;
   * - statement version;
   * - accepted_at;
   * - presented-document SHA-256.
   *
   * None of those audit details are rendered as an additional
   * client-facing evidence page.
   */
  pdfDocument.setTitle(
    "Fefierys Art - Commission Agreement - Executed",
  );

  pdfDocument.setSubject(
    `Executed Commission Agreement ${reference} - revision ${input.agreementRevision}`,
  );

  pdfDocument.setCreator(
    "Fefierys Art",
  );

  pdfDocument.setProducer(
    "Fefierys Art",
  );

  pdfDocument.setModificationDate(
    input.acceptedAt,
  );

  return await pdfDocument.save({
    useObjectStreams:
      true,
  });
}
