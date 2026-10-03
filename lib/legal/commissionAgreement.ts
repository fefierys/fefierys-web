/*
 * Version of the Commission Agreement template.
 *
 * Increment this value when the contractual text changes.
 * The version presented to a client must be preserved
 * independently of later template updates.
 */
export const CURRENT_COMMISSION_AGREEMENT_VERSION = "1.0";

/*
 * Approved wording for Section 5.1.
 *
 * The Artist's electronic acceptance must be recorded
 * before the Agreement is presented to the Client.
 */
export const COMMISSION_AGREEMENT_ACCEPTANCE_SECTION = {
  number: "5.1",
  title: "Agreement to Terms",
  paragraphs: [
    "The Client will receive a secure link to the Fefierys website to review and electronically accept this Commission Agreement, already electronically signed by the Artist, and the applicable version of the Artist’s Terms of Service.",

    "By accepting both documents, the Client acknowledges that they have read, understood, and agreed to their terms and conditions.",

    "Once accepted, the Client will be requested to make the first payment according to the payment schedule in Section 1.3. Work will begin only after the required initial payment has been received and confirmed.",
  ],
} as const;