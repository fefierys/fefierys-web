import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/*
 * ============================================================
 * ENUMS
 * ============================================================
 */

export const commissionStatusEnum = pgEnum(
  "commission_status",
  [
    "received",
    "under_review",
    "awaiting_client_details",
    "quoting",
    "awaiting_quote_response",
    "awaiting_payment",
    "in_progress",
    "sketch_review",
    "sketch_revision",
    "final_preview",
    "final_review",
    "final_revision",
    "completed",
    "cancelled",
    "declined",
    "expired",
  ]
);

export const commissionActorEnum = pgEnum(
  "commission_actor",
  [
    "client",
    "artist",
    "system",
  ]
);

export const commissionCloseReasonEnum = pgEnum(
  "commission_close_reason",
  [
    "client_cancelled",
    "artist_cancelled",
    "mutual_cancellation",
    "artist_declined_request",
    "client_declined_quote",
    "quote_expired",
    "client_details_timeout",
    "payment_timeout",
    "other",
  ]
);

export const quoteStatusEnum = pgEnum(
  "quote_status",
  [
    "draft",
    "sent",
    "accepted",
    "declined",
    "expired",
    "superseded",
  ]
);

export const installmentTriggerEnum = pgEnum(
  "installment_trigger",
  [
    "before_start",
    "after_sketch_approval",
    "before_final_delivery",
    "custom",
  ]
);

export const installmentStatusEnum = pgEnum(
  "installment_status",
  [
    "pending",
    "due",
    "paid",
    "overdue",
    "waived",
    "cancelled",
  ]
);

export const paymentTypeEnum = pgEnum(
  "payment_type",
  [
    "installment",
    "additional",
    "refund",
    "adjustment",
  ]
);

export const paymentStatusEnum = pgEnum(
  "payment_status",
  [
    "pending",
    "confirmed",
    "failed",
    "partially_refunded",
    "refunded",
    "voided",
  ]
);

export const paymentMethodEnum = pgEnum(
  "payment_method",
  [
    "paypal",
    "bank_transfer",
    "wise",
    "stripe",
    "other",
  ]
);

export const agreementStatusEnum = pgEnum(
  "agreement_status",
  [
    "draft",
    "sent",
    "accepted",
    "superseded",
    "voided",
  ]
);

export const acceptanceMethodEnum = pgEnum(
  "acceptance_method",
  [
    "electronic",
    "manual",
    "external_signature",
  ]
);

export const approvalTypeEnum = pgEnum(
  "approval_type",
  [
    "sketch",
    "final",
    "amendment",
  ]
);

export const approvalStatusEnum = pgEnum(
  "approval_status",
  [
    "pending",
    "approved",
    "changes_requested",
    "superseded",
  ]
);

export const commissionEventTypeEnum = pgEnum(
  "commission_event_type",
  [
    "commission_received",

    "client_contacted",
    "client_details_requested",
    "client_details_received",

    "quote_created",
    "quote_sent",
    "quote_accepted",
    "quote_declined",
    "quote_expired",

    "agreement_created",
    "agreement_sent",
    "agreement_accepted",
    "terms_accepted",

    "payment_due",
    "payment_received",
    "payment_overdue",
    "payment_refunded",

    "work_started",

    "sketch_submitted",
    "sketch_revision_requested",
    "sketch_approved",

    "final_preview_sent",
    "final_delivered",
    "final_revision_requested",
    "final_approved",

    "commission_paused",
    "commission_resumed",

    "document_generated",
    "document_sent",

    "commission_completed",
    "commission_cancelled",
    "commission_declined",
    "commission_expired",

    "note_added",
  ]
);

export const documentTypeEnum = pgEnum(
  "document_type",
  [
    "quote",
    "commission_agreement",
    "commission_confirmation",
    "payment_acknowledgement",
    "commission_amendment",
    "completion_summary",
    "cancellation_summary",
    "refund_acknowledgement",
    "other",
  ]
);

export const documentStatusEnum = pgEnum(
  "document_status",
  [
    "draft",
    "generated",
    "sent",
    "send_failed",
    "voided",
  ]
);

/*
 * ============================================================
 * COMMISSIONS
 * ============================================================
 */

export const commissions = pgTable(
  "commissions",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    /*
     * Human-readable reference.
     *
     * Example:
     * FE-2027-0042
     *
     * The UUID remains the real technical identity.
     */
    reference: varchar(
      "reference",
      { length: 32 }
    ).notNull(),

    /*
     * ========================================================
     * CLIENT SNAPSHOT
     * ========================================================
     *
     * These values belong to this specific commission.
     * A future CRM/client entity must not silently alter
     * historical commission data.
     */

    clientName: varchar(
      "client_name",
      { length: 200 }
    ).notNull(),

    clientEmail: varchar(
      "client_email",
      { length: 320 }
    ).notNull(),

    clientCompanyName: varchar(
      "client_company_name",
      { length: 250 }
    ),

    clientCountry: varchar(
      "client_country",
      { length: 100 }
    ),

    /*
     * ========================================================
     * REQUEST / SERVICE SNAPSHOT
     * ========================================================
     *
     * These values intentionally do not reference the
     * portfolio tables. Historical commissions must preserve
     * what the client originally requested even if the
     * portfolio changes later.
     */

    styleSnapshot: varchar(
      "style_snapshot",
      { length: 200 }
    ),

    collectionSnapshot: varchar(
      "collection_snapshot",
      { length: 200 }
    ),

    categorySnapshot: varchar(
      "category_snapshot",
      { length: 200 }
    ),

    optionSnapshot: varchar(
      "option_snapshot",
      { length: 200 }
    ),

    initialMessage: text(
      "initial_message"
    ).notNull(),

    /*
     * ========================================================
     * WORKFLOW
     * ========================================================
     */

    status: commissionStatusEnum(
      "status"
    )
      .notNull()
      .default("received"),

    closeReason:
      commissionCloseReasonEnum(
        "close_reason"
      ),

    closeReasonNote: text(
      "close_reason_note"
    ),

    closedBy: commissionActorEnum(
      "closed_by"
    ),

    /*
     * Pause is intentionally independent from status.
     *
     * Example:
     * status = sketch_review
     * isOnHold = true
     */
    isOnHold: boolean(
      "is_on_hold"
    )
      .notNull()
      .default(false),

    holdReason: text(
      "hold_reason"
    ),

    holdStartedAt: timestamp(
      "hold_started_at",
      {
        withTimezone: true,
      }
    ),

    /*
     * Terms/agreement information is nullable here because
     * a newly received inquiry has not accepted them yet.
     *
     * The complete acceptance record will later live in
     * commission_agreements.
     */
    termsVersion: varchar(
      "terms_version",
      { length: 50 }
    ),

    agreementVersion: varchar(
      "agreement_version",
      { length: 50 }
    ),

    /*
     * ========================================================
     * BUSINESS DATES
     * ========================================================
     */

    submittedAt: timestamp(
      "submitted_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),

    startedAt: timestamp(
      "started_at",
      {
        withTimezone: true,
      }
    ),

    finalDeliveredAt: timestamp(
      "final_delivered_at",
      {
        withTimezone: true,
      }
    ),

    completedAt: timestamp(
      "completed_at",
      {
        withTimezone: true,
      }
    ),

    closedAt: timestamp(
      "closed_at",
      {
        withTimezone: true,
      }
    ),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      }
    )
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex(
      "commissions_reference_unique"
    ).on(
      table.reference
    ),

    index(
      "commissions_status_idx"
    ).on(
      table.status
    ),

    index(
      "commissions_client_email_idx"
    ).on(
      table.clientEmail
    ),

    index(
      "commissions_created_at_idx"
    ).on(
      table.createdAt
    ),

    /*
     * Prevent partially-populated hold information.
     *
     * If a commission is on hold, holdStartedAt must exist.
     * When it is not on hold, holdStartedAt must be null.
     *
     * holdReason remains optional because a note may not
     * always be required technically.
     */
    check(
      "commissions_hold_state_check",
      sql`
        (
          ${table.isOnHold} = true
          AND ${table.holdStartedAt} IS NOT NULL
        )
        OR
        (
          ${table.isOnHold} = false
          AND ${table.holdStartedAt} IS NULL
        )
      `
    ),

    /*
     * completedAt should only exist for completed
     * commissions.
     *
     * We intentionally do not require completedAt merely
     * because status = completed here. The service layer
     * will perform the atomic status transition and date
     * assignment.
     */
    check(
      "commissions_completed_at_check",
      sql`
        ${table.completedAt} IS NULL
        OR ${table.status} = 'completed'
      `
    ),

    /*
     * closedAt is only valid for terminal states.
     */
    check(
      "commissions_closed_at_check",
      sql`
        ${table.closedAt} IS NULL
        OR ${table.status} IN (
          'completed',
          'cancelled',
          'declined',
          'expired'
        )
      `
    ),
  ]
);

/*
 * ============================================================
 * COMMISSION QUOTES
 * ============================================================
 */

export const commissionQuotes =
  pgTable(
    "commission_quotes",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      /*
       * A commission may have several historical quote
       * versions:
       *
       * v1 -> superseded
       * v2 -> accepted
       */
      version: integer(
        "version"
      ).notNull(),

      status: quoteStatusEnum(
        "status"
      )
        .notNull()
        .default("draft"),

      /*
       * ISO 4217-style currency code:
       * USD, CLP, EUR, etc.
       */
      currency: varchar(
        "currency",
        { length: 3 }
      ).notNull(),

      /*
       * PostgreSQL numeric is intentionally used instead
       * of float/real for money.
       */
      totalAmount: numeric(
        "total_amount",
        {
          precision: 12,
          scale: 2,
        }
      ).notNull(),

      description: text(
        "description"
      ),

      notes: text(
        "notes"
      ),

      validUntil: timestamp(
        "valid_until",
        {
          withTimezone: true,
        }
      ),

      sentAt: timestamp(
        "sent_at",
        {
          withTimezone: true,
        }
      ),

      acceptedAt: timestamp(
        "accepted_at",
        {
          withTimezone: true,
        }
      ),

      declinedAt: timestamp(
        "declined_at",
        {
          withTimezone: true,
        }
      ),

      expiredAt: timestamp(
        "expired_at",
        {
          withTimezone: true,
        }
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      updatedAt: timestamp(
        "updated_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      uniqueIndex(
        "commission_quotes_commission_version_unique"
      ).on(
        table.commissionId,
        table.version
      ),

      index(
        "commission_quotes_commission_id_idx"
      ).on(
        table.commissionId
      ),

      index(
        "commission_quotes_status_idx"
      ).on(
        table.status
      ),

      check(
        "commission_quotes_version_check",
        sql`
          ${table.version} >= 1
        `
      ),

      check(
        "commission_quotes_total_amount_check",
        sql`
          ${table.totalAmount} >= 0
        `
      ),

      check(
        "commission_quotes_currency_check",
        sql`
          ${table.currency}
          =
          upper(${table.currency})
        `
      ),
    ]
  );

/*
 * ============================================================
 * COMMISSION PAYMENT INSTALLMENTS
 * ============================================================
 */

export const commissionPaymentInstallments =
  pgTable(
    "commission_payment_installments",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      quoteId: uuid(
        "quote_id"
      )
        .notNull()
        .references(
          () =>
            commissionQuotes.id,
          {
            onDelete: "restrict",
          }
        ),

      /*
       * Display/payment order:
       *
       * 1 -> initial payment
       * 2 -> after sketch
       * 3 -> before final delivery
       */
      sequence: integer(
        "sequence"
      ).notNull(),

      label: varchar(
        "label",
        { length: 150 }
      ).notNull(),

      /*
       * Optional because custom plans may define only
       * explicit amounts.
       *
       * Examples:
       * 100.00
       * 50.00
       * 40.00
       * 30.00
       */
      percentage: numeric(
        "percentage",
        {
          precision: 5,
          scale: 2,
        }
      ),

      amount: numeric(
        "amount",
        {
          precision: 12,
          scale: 2,
        }
      ).notNull(),

      currency: varchar(
        "currency",
        { length: 3 }
      ).notNull(),

      trigger:
        installmentTriggerEnum(
          "trigger"
        ).notNull(),

      customTriggerNote: text(
        "custom_trigger_note"
      ),

      status:
        installmentStatusEnum(
          "status"
        )
          .notNull()
          .default("pending"),

      dueAt: timestamp(
        "due_at",
        {
          withTimezone: true,
        }
      ),

      becameDueAt: timestamp(
        "became_due_at",
        {
          withTimezone: true,
        }
      ),

      paidAt: timestamp(
        "paid_at",
        {
          withTimezone: true,
        }
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      updatedAt: timestamp(
        "updated_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      uniqueIndex(
        "commission_installments_quote_sequence_unique"
      ).on(
        table.quoteId,
        table.sequence
      ),

      index(
        "commission_installments_commission_id_idx"
      ).on(
        table.commissionId
      ),

      index(
        "commission_installments_quote_id_idx"
      ).on(
        table.quoteId
      ),

      index(
        "commission_installments_status_idx"
      ).on(
        table.status
      ),

      index(
        "commission_installments_due_at_idx"
      ).on(
        table.dueAt
      ),

      check(
        "commission_installments_sequence_check",
        sql`
          ${table.sequence} >= 1
        `
      ),

      check(
        "commission_installments_amount_check",
        sql`
          ${table.amount} >= 0
        `
      ),

      check(
        "commission_installments_percentage_check",
        sql`
          ${table.percentage}
          IS NULL
          OR (
            ${table.percentage} > 0
            AND ${table.percentage} <= 100
          )
        `
      ),

      check(
        "commission_installments_currency_check",
        sql`
          ${table.currency}
          =
          upper(${table.currency})
        `
      ),

      /*
       * A custom trigger must explain what causes the
       * installment to become due.
       */
      check(
        "commission_installments_custom_trigger_check",
        sql`
          ${table.trigger} != 'custom'
          OR ${table.customTriggerNote} IS NOT NULL
        `
      ),

      /*
       * paidAt only makes sense for an installment whose
       * current state is paid.
       */
      check(
        "commission_installments_paid_at_check",
        sql`
          ${table.paidAt} IS NULL
          OR ${table.status} = 'paid'
        `
      ),
    ]
  );


  /*
 * ============================================================
 * COMMISSION PAYMENTS
 * ============================================================
 *
 * Installments describe what the client is expected to pay.
 *
 * Payments describe money that was actually recorded.
 *
 * One installment may therefore have multiple payments:
 *
 * Installment #1: $500
 *   -> Payment A: $300
 *   -> Payment B: $200
 */

export const commissionPayments =
  pgTable(
    "commission_payments",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      /*
       * Nullable because not every financial movement must
       * belong to an installment.
       *
       * Examples:
       * - additional payment
       * - refund
       * - manual adjustment
       */
      installmentId: uuid(
        "installment_id"
      ).references(
        () =>
          commissionPaymentInstallments.id,
        {
          onDelete: "restrict",
        }
      ),

      type: paymentTypeEnum(
        "type"
      ).notNull(),

      status: paymentStatusEnum(
        "status"
      )
        .notNull()
        .default("pending"),

      /*
       * Amounts are always stored as positive values.
       *
       * Whether the movement represents incoming money or
       * a refund is expressed through payment.type rather
       * than a negative number.
       */
      amount: numeric(
        "amount",
        {
          precision: 12,
          scale: 2,
        }
      ).notNull(),

      currency: varchar(
        "currency",
        { length: 3 }
      ).notNull(),

      method: paymentMethodEnum(
        "method"
      ),

      /*
       * Used when method = other, or when we want to retain
       * the provider's human-readable name.
       *
       * Example:
       * "Mercado Pago"
       */
      methodLabel: varchar(
        "method_label",
        { length: 150 }
      ),

      /*
       * Provider/bank transaction identifier.
       *
       * We intentionally do not make this globally unique
       * because reference formats differ between providers
       * and some manually-recorded payments may not have one.
       */
      transactionReference: varchar(
        "transaction_reference",
        { length: 250 }
      ),

      /*
       * The date at which the payment was actually received
       * or financially recognised.
       */
      paidAt: timestamp(
        "paid_at",
        {
          withTimezone: true,
        }
      ),

      notes: text(
        "notes"
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      updatedAt: timestamp(
        "updated_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      index(
        "commission_payments_commission_id_idx"
      ).on(
        table.commissionId
      ),

      index(
        "commission_payments_installment_id_idx"
      ).on(
        table.installmentId
      ),

      index(
        "commission_payments_status_idx"
      ).on(
        table.status
      ),

      index(
        "commission_payments_paid_at_idx"
      ).on(
        table.paidAt
      ),

      check(
        "commission_payments_amount_check",
        sql`
          ${table.amount} > 0
        `
      ),

      check(
        "commission_payments_currency_check",
        sql`
          ${table.currency}
          =
          upper(${table.currency})
        `
      ),

      /*
       * A custom payment method must explain which provider
       * or mechanism was used.
       */
      check(
        "commission_payments_method_label_check",
        sql`
          ${table.method} != 'other'
          OR ${table.methodLabel} IS NOT NULL
        `
      ),

      /*
       * paidAt only makes sense once a payment has actually
       * existed as a confirmed financial transaction.
       *
       * Refunded/partially-refunded payments preserve the
       * original paidAt timestamp.
       */
      check(
        "commission_payments_paid_at_check",
        sql`
          ${table.paidAt} IS NULL
          OR ${table.status} IN (
            'confirmed',
            'partially_refunded',
            'refunded'
          )
        `
      ),
    ]
  );


  /*
 * ============================================================
 * COMMISSION PAYMENT EVIDENCE
 * ============================================================
 *
 * Private supporting files related to a payment.
 *
 * Examples:
 * - PayPal screenshot
 * - bank transfer receipt
 * - Wise transaction confirmation
 *
 * The binary file itself is stored in private R2.
 * PostgreSQL stores only metadata and integrity information.
 */

export const commissionPaymentEvidence =
  pgTable(
    "commission_payment_evidence",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      paymentId: uuid(
        "payment_id"
      )
        .notNull()
        .references(
          () =>
            commissionPayments.id,
          {
            onDelete: "restrict",
          }
        ),

      /*
       * Private R2 object key.
       *
       * Example:
       * commissions/FE-2027-0042/
       * payment-evidence/<uuid>.png
       */
      storageKey: text(
        "storage_key"
      ).notNull(),

      originalFilename: varchar(
        "original_filename",
        { length: 500 }
      ).notNull(),

      mimeType: varchar(
        "mime_type",
        { length: 150 }
      ).notNull(),

      sizeBytes: integer(
        "size_bytes"
      ).notNull(),

      /*
       * SHA-256 hexadecimal digest = 64 characters.
       *
       * This lets us later prove that the stored evidence
       * has not silently changed.
       */
      contentSha256: varchar(
        "content_sha256",
        { length: 64 }
      ).notNull(),

      uploadedAt: timestamp(
        "uploaded_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      index(
        "commission_payment_evidence_payment_id_idx"
      ).on(
        table.paymentId
      ),

      uniqueIndex(
        "commission_payment_evidence_storage_key_unique"
      ).on(
        table.storageKey
      ),

      check(
        "commission_payment_evidence_size_check",
        sql`
          ${table.sizeBytes} > 0
        `
      ),

      /*
       * A hexadecimal SHA-256 digest must contain exactly
       * 64 characters.
       *
       * Actual hexadecimal validation can additionally be
       * enforced when uploading the file.
       */
      check(
        "commission_payment_evidence_sha256_length_check",
        sql`
          char_length(
            ${table.contentSha256}
          ) = 64
        `
      ),
    ]
  );


  /*
 * ============================================================
 * COMMISSION DOCUMENTS
 * ============================================================
 *
 * Generated commercial and contractual documents.
 *
 * Examples:
 * - Commission Agreement
 * - Payment Acknowledgement
 * - Completion Summary
 *
 * Generated files are intended to be immutable in private R2.
 */

export const commissionDocuments =
  pgTable(
    "commission_documents",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      type: documentTypeEnum(
        "type"
      ).notNull(),

      documentNumber: varchar(
        "document_number",
        { length: 100 }
      ),

      version: integer(
        "version"
      ).notNull(),

      status: documentStatusEnum(
        "status"
      )
        .notNull()
        .default("draft"),

      /*
       * Nullable while the document is only a draft record.
       * Once generated, it points to an immutable private
       * R2 object.
       */
      storageKey: text(
        "storage_key"
      ),

      contentSha256: varchar(
        "content_sha256",
        { length: 64 }
      ),

      recipientEmail: varchar(
        "recipient_email",
        { length: 320 }
      ),

      generatedAt: timestamp(
        "generated_at",
        {
          withTimezone: true,
        }
      ),

      sentAt: timestamp(
        "sent_at",
        {
          withTimezone: true,
        }
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      updatedAt: timestamp(
        "updated_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      uniqueIndex(
        "commission_documents_commission_type_version_unique"
      ).on(
        table.commissionId,
        table.type,
        table.version
      ),

      index(
        "commission_documents_commission_id_idx"
      ).on(
        table.commissionId
      ),

      index(
        "commission_documents_status_idx"
      ).on(
        table.status
      ),

      check(
        "commission_documents_version_check",
        sql`
          ${table.version} >= 1
        `
      ),

      check(
        "commission_documents_sha256_check",
        sql`
          ${table.contentSha256} IS NULL
          OR char_length(
            ${table.contentSha256}
          ) = 64
        `
      ),

      /*
       * Once a document reaches a generated/send state,
       * the corresponding immutable file must exist.
       */
      check(
        "commission_documents_generated_file_check",
        sql`
          ${table.status} = 'draft'
          OR (
            ${table.storageKey} IS NOT NULL
            AND ${table.contentSha256} IS NOT NULL
            AND ${table.generatedAt} IS NOT NULL
          )
        `
      ),
    ]
  );


  /*
 * ============================================================
 * COMMISSION AGREEMENTS
 * ============================================================
 *
 * Stores the contractual acceptance record.
 *
 * The actual immutable PDF is represented by documentId.
 */

export const commissionAgreements =
  pgTable(
    "commission_agreements",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      quoteId: uuid(
        "quote_id"
      )
        .notNull()
        .references(
          () => commissionQuotes.id,
          {
            onDelete: "restrict",
          }
        ),

      documentId: uuid(
        "document_id"
      ).references(
        () => commissionDocuments.id,
        {
          onDelete: "restrict",
        }
      ),

      /*
       * Internal revision sequence for this commission.
       *
       * Example:
       * Agreement record 1
       * Agreement record 2
       */
      version: integer(
        "version"
      ).notNull(),

      /*
       * Human/legal template versions.
       *
       * Examples:
       * termsVersion = "2027.1"
       * agreementVersion = "1.0"
       */
      termsVersion: varchar(
        "terms_version",
        { length: 50 }
      ).notNull(),

      agreementVersion: varchar(
        "agreement_version",
        { length: 50 }
      ).notNull(),

      status: agreementStatusEnum(
        "status"
      )
        .notNull()
        .default("draft"),

      acceptedByName: varchar(
        "accepted_by_name",
        { length: 200 }
      ),

      acceptedByEmail: varchar(
        "accepted_by_email",
        { length: 320 }
      ),

      acceptanceMethod:
        acceptanceMethodEnum(
          "acceptance_method"
        ),

      sentAt: timestamp(
        "sent_at",
        {
          withTimezone: true,
        }
      ),

      acceptedAt: timestamp(
        "accepted_at",
        {
          withTimezone: true,
        }
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      updatedAt: timestamp(
        "updated_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      uniqueIndex(
        "commission_agreements_commission_version_unique"
      ).on(
        table.commissionId,
        table.version
      ),

      index(
        "commission_agreements_commission_id_idx"
      ).on(
        table.commissionId
      ),

      index(
        "commission_agreements_quote_id_idx"
      ).on(
        table.quoteId
      ),

      index(
        "commission_agreements_status_idx"
      ).on(
        table.status
      ),

      check(
        "commission_agreements_version_check",
        sql`
          ${table.version} >= 1
        `
      ),

      /*
       * An accepted agreement must identify who accepted it,
       * how, and when.
       */
      check(
        "commission_agreements_acceptance_check",
        sql`
          ${table.status} != 'accepted'
          OR (
            ${table.acceptedByName} IS NOT NULL
            AND ${table.acceptedByEmail} IS NOT NULL
            AND ${table.acceptanceMethod} IS NOT NULL
            AND ${table.acceptedAt} IS NOT NULL
          )
        `
      ),
    ]
  );


  /*
 * ============================================================
 * COMMISSION APPROVALS
 * ============================================================
 */

export const commissionApprovals =
  pgTable(
    "commission_approvals",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      type: approvalTypeEnum(
        "type"
      ).notNull(),

      /*
       * Useful for sketch/final revisions.
       *
       * Example:
       * sketch revision 1
       * sketch revision 2
       */
      revisionNumber: integer(
        "revision_number"
      ),

      status: approvalStatusEnum(
        "status"
      )
        .notNull()
        .default("pending"),

      clientName: varchar(
        "client_name",
        { length: 200 }
      ).notNull(),

      clientEmail: varchar(
        "client_email",
        { length: 320 }
      ).notNull(),

      requestedAt: timestamp(
        "requested_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      respondedAt: timestamp(
        "responded_at",
        {
          withTimezone: true,
        }
      ),

      clientNote: text(
        "client_note"
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      updatedAt: timestamp(
        "updated_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      index(
        "commission_approvals_commission_id_idx"
      ).on(
        table.commissionId
      ),

      index(
        "commission_approvals_status_idx"
      ).on(
        table.status
      ),

      check(
        "commission_approvals_revision_number_check",
        sql`
          ${table.revisionNumber}
          IS NULL
          OR ${table.revisionNumber} >= 1
        `
      ),

      check(
        "commission_approvals_response_check",
        sql`
          ${table.respondedAt} IS NULL
          OR ${table.status} != 'pending'
        `
      ),
    ]
  );


  /*
 * ============================================================
 * COMMISSION STATUS HISTORY
 * ============================================================
 *
 * Immutable audit trail of workflow transitions.
 */

export const commissionStatusHistory =
  pgTable(
    "commission_status_history",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      /*
       * Null is allowed for the initial transition:
       *
       * null -> received
       */
      fromStatus:
        commissionStatusEnum(
          "from_status"
        ),

      toStatus:
        commissionStatusEnum(
          "to_status"
        ).notNull(),

      /*
       * Who originated the business action.
       *
       * This is different from who clicked the admin button.
       */
      initiatedBy:
        commissionActorEnum(
          "initiated_by"
        ).notNull(),

      reason: varchar(
        "reason",
        { length: 150 }
      ),

      note: text(
        "note"
      ),

      /*
       * Neon Auth / administrative account that physically
       * recorded the transition.
       */
      changedByAdminUserId: varchar(
        "changed_by_admin_user_id",
        { length: 255 }
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      index(
        "commission_status_history_commission_created_idx"
      ).on(
        table.commissionId,
        table.createdAt
      ),

      index(
        "commission_status_history_to_status_idx"
      ).on(
        table.toStatus
      ),

      check(
        "commission_status_history_transition_check",
        sql`
          ${table.fromStatus} IS NULL
          OR ${table.fromStatus} != ${table.toStatus}
        `
      ),
    ]
  );


  /*
 * ============================================================
 * COMMISSION EVENTS
 * ============================================================
 *
 * General commission timeline.
 *
 * Important structured business events that do not
 * necessarily change Commission.status.
 */

export const commissionEvents =
  pgTable(
    "commission_events",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      type:
        commissionEventTypeEnum(
          "type"
        ).notNull(),

      actor:
        commissionActorEnum(
          "actor"
        ).notNull(),

      title: varchar(
        "title",
        { length: 250 }
      ).notNull(),

      description: text(
        "description"
      ),

      /*
       * Optional supporting metadata.
       *
       * Important business data should still live in its
       * normal relational table.
       */
      metadata: jsonb(
        "metadata"
      ),

      createdByAdminUserId: varchar(
        "created_by_admin_user_id",
        { length: 255 }
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      index(
        "commission_events_commission_created_idx"
      ).on(
        table.commissionId,
        table.createdAt
      ),

      index(
        "commission_events_type_idx"
      ).on(
        table.type
      ),
    ]
  );


  /*
 * ============================================================
 * COMMISSION TAX DOCUMENTS
 * ============================================================
 *
 * References to official tax/accounting documents.
 *
 * The platform does not assume that every commission always
 * uses the same Chilean tax document type. That depends on
 * Fefierys' tax situation at the time.
 */

export const commissionTaxDocuments =
  pgTable(
    "commission_tax_documents",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      commissionId: uuid(
        "commission_id"
      )
        .notNull()
        .references(
          () => commissions.id,
          {
            onDelete: "restrict",
          }
        ),

      paymentId: uuid(
        "payment_id"
      ).references(
        () => commissionPayments.id,
        {
          onDelete: "restrict",
        }
      ),

      /*
       * Examples:
       *
       * typeCode  = "BHE"
       * typeLabel = "Boleta de Honorarios Electrónica"
       *
       * These are deliberately not PostgreSQL enums.
       */
      typeCode: varchar(
        "type_code",
        { length: 50 }
      ).notNull(),

      typeLabel: varchar(
        "type_label",
        { length: 200 }
      ).notNull(),

      documentNumber: varchar(
        "document_number",
        { length: 150 }
      ).notNull(),

      currency: varchar(
        "currency",
        { length: 3 }
      ).notNull(),

      amount: numeric(
        "amount",
        {
          precision: 12,
          scale: 2,
        }
      ).notNull(),

      issuedAt: timestamp(
        "issued_at",
        {
          withTimezone: true,
        }
      ).notNull(),

      /*
       * Optional private copy of the official document.
       */
      storageKey: text(
        "storage_key"
      ),

      contentSha256: varchar(
        "content_sha256",
        { length: 64 }
      ),

      /*
       * Identifier/URL/reference from an external tax or
       * accounting system when appropriate.
       */
      externalReference: text(
        "external_reference"
      ),

      notes: text(
        "notes"
      ),

      createdAt: timestamp(
        "created_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),

      updatedAt: timestamp(
        "updated_at",
        {
          withTimezone: true,
        }
      )
        .notNull()
        .defaultNow(),
    },
    (table) => [
      index(
        "commission_tax_documents_commission_id_idx"
      ).on(
        table.commissionId
      ),

      index(
        "commission_tax_documents_payment_id_idx"
      ).on(
        table.paymentId
      ),

      index(
        "commission_tax_documents_issued_at_idx"
      ).on(
        table.issuedAt
      ),

      check(
        "commission_tax_documents_amount_check",
        sql`
          ${table.amount} > 0
        `
      ),

      check(
        "commission_tax_documents_currency_check",
        sql`
          ${table.currency}
          =
          upper(${table.currency})
        `
      ),

      check(
        "commission_tax_documents_sha256_check",
        sql`
          ${table.contentSha256} IS NULL
          OR char_length(
            ${table.contentSha256}
          ) = 64
        `
      ),

      /*
       * If a private file is registered, its integrity hash
       * must also be registered.
       */
      check(
        "commission_tax_documents_file_hash_check",
        sql`
          ${table.storageKey} IS NULL
          OR ${table.contentSha256} IS NOT NULL
        `
      ),
    ]
  );