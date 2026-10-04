export const COMMISSION_AGREEMENT_ARTIST_SIGNER_NAME =
  "Josefa Santis";

export const COMMISSION_AGREEMENT_ARTIST_ROLE =
  "Fefierys - The Artist";

export const COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION =
  "Signed and Agreed";

export const COMMISSION_AGREEMENT_SIGNATURE_TIME_ZONE =
  "America/Santiago";

/*
 * The Agreement PDF is rendered as US Letter:
 * 612 x 792 pt, with 64 pt horizontal padding and 76 pt
 * vertical padding.
 *
 * Section 5 starts on its own page and reserves a fixed
 * 90 pt signature area 24 pt above the content area's bottom.
 *
 * The Executed renderer uses the coordinates below to write the
 * Client signature into the left column of the exact immutable
 * Presented PDF.
 */
export const COMMISSION_AGREEMENT_SIGNATURE_CLIENT_X =
  64;

export const COMMISSION_AGREEMENT_SIGNATURE_COLUMN_WIDTH =
  222;

export const COMMISSION_AGREEMENT_SIGNATURE_NAME_Y =
  179;

export const COMMISSION_AGREEMENT_SIGNATURE_ROLE_Y =
  160;

export const COMMISSION_AGREEMENT_SIGNATURE_DATE_Y =
  143;

export const COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION_Y =
  127;

export const COMMISSION_AGREEMENT_SIGNATURE_NAME_SIZE =
  11;

export const COMMISSION_AGREEMENT_SIGNATURE_ROLE_SIZE =
  9.5;

export const COMMISSION_AGREEMENT_SIGNATURE_DATE_SIZE =
  8.5;

export const COMMISSION_AGREEMENT_SIGNATURE_CONFIRMATION_SIZE =
  9;

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return (
    parts.find(
      (part) =>
        part.type ===
        type,
    )?.value ??
    ""
  );
}

export function formatCommissionAgreementSignatureDate(
  value: Date,
): string {
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
      "Commission Agreement signature date must be a valid Date.",
    );
  }

  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          COMMISSION_AGREEMENT_SIGNATURE_TIME_ZONE,

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hourCycle:
          "h23",

        timeZoneName:
          "longOffset",
      },
    );

  const parts =
    formatter.formatToParts(
      value,
    );

  const year =
    getPart(
      parts,
      "year",
    );

  const month =
    getPart(
      parts,
      "month",
    );

  const day =
    getPart(
      parts,
      "day",
    );

  const hour =
    getPart(
      parts,
      "hour",
    );

  const minute =
    getPart(
      parts,
      "minute",
    );

  const second =
    getPart(
      parts,
      "second",
    );

  const zoneName =
    getPart(
      parts,
      "timeZoneName",
    );

  const offset =
    zoneName ===
    "GMT"
      ? "+00:00"
      : zoneName.startsWith(
            "GMT",
          )
        ? zoneName.slice(3)
        : "";

  if (
    !year ||
    !month ||
    !day ||
    !hour ||
    !minute ||
    !second ||
    !offset
  ) {
    throw new Error(
      "Could not format Commission Agreement signature date.",
    );
  }

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}
