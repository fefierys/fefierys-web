import {
  createReceivedCommissionEmailMessage,
  type CommissionEmailMessage,
} from "../repositories/commissionEmailRepository";

import {
  parseCommissionInboundEmail,
} from "./commissionInboundEmailParser";

import {
  resendCommissionInboundEmailProvider,
  type CommissionInboundEmailProvider,
} from "./commissionInboundEmailProvider";

import {
  resolveCommissionInboundReply,
} from "./commissionInboundReplyResolver";

const MAX_EMAIL_LENGTH = 320;

export interface ProcessCommissionEmailReceivedEventInput {
  providerEmailId: string;
  expectedRecipientEmail: string;
}

export type ProcessCommissionEmailReceivedEventResult =
  | {
      outcome: "processed";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "already_processed";
      message: CommissionEmailMessage;
    }
  | {
      outcome: "recipient_mismatch";
    }
  | {
      outcome: "no_thread_evidence";
    }
  | {
      outcome: "not_found";
    }
  | {
      outcome: "sender_mismatch";
      commissionId: string;
      threadId: string;
    }
  | {
      outcome: "ambiguous";
      threadIds: string[];
    }
  | {
      outcome: "conflict";
    };

function normalizeRequiredValue(
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

function normalizeExpectedRecipientEmail(
  value: string,
): string {
  const normalized =
    normalizeRequiredValue(
      value,
      "expectedRecipientEmail",
    );

  if (
    normalized.length >
    MAX_EMAIL_LENGTH
  ) {
    throw new Error(
      `expectedRecipientEmail must be ${MAX_EMAIL_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

function normalizeEmailForComparison(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase();
}

function findExpectedRecipient(
  recipientEmails: string[],
  expectedRecipientEmail: string,
): string | null {
  const expected =
    normalizeEmailForComparison(
      expectedRecipientEmail,
    );

  return (
    recipientEmails.find(
      (recipientEmail) =>
        normalizeEmailForComparison(
          recipientEmail,
        ) === expected,
    ) ??
    null
  );
}

export async function processCommissionEmailReceivedEvent(
  input: ProcessCommissionEmailReceivedEventInput,
  provider:
    CommissionInboundEmailProvider =
    resendCommissionInboundEmailProvider,
): Promise<ProcessCommissionEmailReceivedEventResult> {
  const providerEmailId =
    normalizeRequiredValue(
      input.providerEmailId,
      "providerEmailId",
    );

  const expectedRecipientEmail =
    normalizeExpectedRecipientEmail(
      input.expectedRecipientEmail,
    );

  /*
   * The webhook itself contains only the provider email identity needed to
   * retrieve the canonical received email. Body and RFC headers come from
   * the provider retrieval API rather than from unverified caller input.
   */
  const receivedEmail =
    await provider.getReceivedEmail(
      providerEmailId,
    );

  /*
   * A provider implementation must return the exact email requested.
   * Never continue if the retrieval identity unexpectedly changes.
   */
  if (
    receivedEmail.providerEmailId !==
    providerEmailId
  ) {
    return {
      outcome:
        "conflict",
    };
  }

  const parsed =
    parseCommissionInboundEmail(
      receivedEmail,
    );

  /*
   * Receiving may eventually be configured for an entire subdomain or for
   * other addresses. Only the dedicated commission reply mailbox is allowed
   * to enter this conversation pipeline.
   */
  const recipientEmail =
    findExpectedRecipient(
      parsed.recipientEmails,
      expectedRecipientEmail,
    );

  if (!recipientEmail) {
    return {
      outcome:
        "recipient_mismatch",
    };
  }

  /*
   * Correlation is based exclusively on RFC threading evidence. The visible
   * email subject is deliberately not used to locate a commission.
   */
  const resolution =
    await resolveCommissionInboundReply({
      senderEmail:
        parsed.senderEmail,

      inReplyToMessageId:
        parsed.inReplyToMessageId,

      referencesHeader:
        parsed.referencesHeader,
    });

  switch (
    resolution.outcome
  ) {
    case "no_thread_evidence":
      return {
        outcome:
          "no_thread_evidence",
      };

    case "not_found":
      return {
        outcome:
          "not_found",
      };

    case "sender_mismatch":
      return {
        outcome:
          "sender_mismatch",

        commissionId:
          resolution.commissionId,

        threadId:
          resolution.threadId,
      };

    case "ambiguous":
      return {
        outcome:
          "ambiguous",

        threadIds:
          resolution.threadIds,
      };

    case "conflict":
      return {
        outcome:
          "conflict",
      };

    case "matched":
      break;
  }

  const persistence =
    await createReceivedCommissionEmailMessage({
      commissionId:
        resolution.commissionId,

      threadId:
        resolution.threadId,

      senderEmail:
        parsed.senderEmail,

      /*
       * Persist the actual matching recipient from the received email rather
       * than blindly copying configuration into the audit record.
       */
      recipientEmail,

      /*
       * Preserve the received visible subject for auditability. It may contain
       * Re:/Fwd: variants, but it is never used as correlation evidence.
       */
      subject:
        parsed.subject,

      messageText:
        parsed.messageText,

      providerEmailId:
        parsed.providerEmailId,

      providerMessageId:
        parsed.providerMessageId,

      inReplyToMessageId:
        parsed.inReplyToMessageId,

      referencesHeader:
        parsed.referencesHeader,

      receivedAt:
        parsed.receivedAt,
    });

  switch (
    persistence.outcome
  ) {
    case "created":
      return {
        outcome:
          "processed",

        message:
          persistence.message,
      };

    case "already_received":
      return {
        outcome:
          "already_processed",

        message:
          persistence.message,
      };

    case "thread_not_found":
    case "thread_mismatch":
    case "conflict":
      /*
       * The resolver already established one exact thread. If persistence now
       * disagrees, state changed underneath us or provider identity conflicts
       * with an existing row. Never try to repair that automatically.
       */
      return {
        outcome:
          "conflict",
      };
  }
}