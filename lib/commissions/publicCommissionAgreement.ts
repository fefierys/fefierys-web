export type PublicCommissionAgreementStatus =
  | "sent"
  | "accepted";

export interface PublicCommissionAgreement {
  reference: string;
  clientName: string;

  revision: number;
  agreementVersion: string;
  termsVersion: string;

  status: PublicCommissionAgreementStatus;

  sentAt: Date;
  acceptedAt: Date | null;
}