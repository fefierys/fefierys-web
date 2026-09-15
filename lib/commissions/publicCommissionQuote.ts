export type PublicCommissionQuoteStatus =
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "superseded";

export interface PublicCommissionQuoteItem {
  sequence: number;
  label: string;
  description: string | null;
  quantity: number;
  unitAmount: string;
}

export interface PublicCommissionQuote {
  reference: string;
  clientName: string;

  version: number;
  status: PublicCommissionQuoteStatus;

  currency: string;
  totalAmount: string;

  description: string | null;

  validUntil: Date;
  sentAt: Date;

  acceptedAt: Date | null;
  declinedAt: Date | null;
  expiredAt: Date | null;

  items: PublicCommissionQuoteItem[];
}