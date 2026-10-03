import {
  and,
  eq,
  isNull,
} from "drizzle-orm";

import { db } from "../../db";
import { commissionEmailThreads } from "../../db/schema/commissions";
import type {
  CommissionEmailThread,
  CreateCommissionEmailThreadInput,
  CreateCommissionEmailThreadResult,
  SetCommissionEmailThreadRootMessageIdInput,
  SetCommissionEmailThreadRootMessageIdResult,
  SetCommissionEmailThreadRootProviderInput,
  SetCommissionEmailThreadRootProviderResult,
} from "./commissionEmailTypes";

const MAX_COMMISSION_EMAIL_SUBJECT_LENGTH = 350;

function normalizeRequiredValue(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeCommissionId(
  commissionId: string,
): string {
  return normalizeRequiredValue(
    commissionId,
    "commissionId",
  );
}

function normalizeThreadId(
  threadId: string,
): string {
  return normalizeRequiredValue(
    threadId,
    "threadId",
  );
}

function normalizeCommissionEmailSubject(
  subject: string,
): string {
  const normalized = subject.trim();

  if (!normalized) {
    throw new Error("subject is required.");
  }

  if (
    normalized.length >
    MAX_COMMISSION_EMAIL_SUBJECT_LENGTH
  ) {
    throw new Error(
      `subject must be ${MAX_COMMISSION_EMAIL_SUBJECT_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

export async function getCommissionEmailThreadById(
  threadId: string,
): Promise<CommissionEmailThread | null> {
  const normalizedThreadId =
    normalizeThreadId(threadId);

  const rows = await db
    .select()
    .from(commissionEmailThreads)
    .where(
      eq(
        commissionEmailThreads.id,
        normalizedThreadId,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getCommissionEmailThreadByCommissionId(
  commissionId: string,
): Promise<CommissionEmailThread | null> {
  const normalizedCommissionId =
    normalizeCommissionId(
      commissionId,
    );

  const rows = await db
    .select()
    .from(commissionEmailThreads)
    .where(
      eq(
        commissionEmailThreads.commissionId,
        normalizedCommissionId,
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function createCommissionEmailThreadIfMissing(
  input: CreateCommissionEmailThreadInput,
): Promise<CreateCommissionEmailThreadResult> {
  const commissionId =
    normalizeCommissionId(
      input.commissionId,
    );
  const subject =
    normalizeCommissionEmailSubject(
      input.subject,
    );

  /*
   * commission_email_threads has a UNIQUE constraint/index on commission_id.
   *
   * ON CONFLICT DO NOTHING makes thread creation safe when two requests race
   * to initialize the same commission. Exactly one insert can win.
   */
  const createdRows = await db
    .insert(commissionEmailThreads)
    .values({
      commissionId,
      subject,
    })
    .onConflictDoNothing({
      target:
        commissionEmailThreads.commissionId,
    })
    .returning();

  const createdThread =
    createdRows[0];

  if (createdThread) {
    return {
      created: true,
      thread: createdThread,
    };
  }

  /*
   * Another request already created the thread, or won a concurrent race.
   *
   * The original subject remains immutable here. A later caller must not
   * silently rename an established client email conversation.
   */
  const existingThread =
    await getCommissionEmailThreadByCommissionId(
      commissionId,
    );

  if (!existingThread) {
    throw new Error(
      "Commission email thread creation could not be reconciled.",
    );
  }

  return {
    created: false,
    thread: existingThread,
  };
}

function classifyRootProviderState(
  thread: CommissionEmailThread | null,
  providerEmailId: string,
): SetCommissionEmailThreadRootProviderResult {
  if (!thread) {
    return {
      outcome: "not_found",
    };
  }

  if (
    thread.rootProviderEmailId ===
    providerEmailId
  ) {
    return {
      outcome: "already_set",
      thread,
    };
  }

  return {
    outcome: "conflict",
    thread,
  };
}

export async function setCommissionEmailThreadRootProvider(
  input: SetCommissionEmailThreadRootProviderInput,
): Promise<SetCommissionEmailThreadRootProviderResult> {
  const threadId =
    normalizeThreadId(
      input.threadId,
    );
  const providerEmailId =
    normalizeRequiredValue(
      input.providerEmailId,
      "providerEmailId",
    );
  const updatedAt = new Date();

  try {
    const rows = await db
      .update(
        commissionEmailThreads,
      )
      .set({
        rootProviderEmailId:
          providerEmailId,
        updatedAt,
      })
      .where(
        and(
          eq(
            commissionEmailThreads.id,
            threadId,
          ),
          isNull(
            commissionEmailThreads.rootProviderEmailId,
          ),
          isNull(
            commissionEmailThreads.rootMessageId,
          ),
        ),
      )
      .returning();

    const updatedThread =
      rows[0];

    if (updatedThread) {
      return {
        outcome: "set",
        thread: updatedThread,
      };
    }

    const currentThread =
      await getCommissionEmailThreadById(
        threadId,
      );

    return classifyRootProviderState(
      currentThread,
      providerEmailId,
    );
  } catch (error) {
    /*
     * If Neon committed the UPDATE but the response was lost, the exact
     * provider ID lets us reconcile the intended root identity safely.
     */
    try {
      const currentThread =
        await getCommissionEmailThreadById(
          threadId,
        );

      const classified =
        classifyRootProviderState(
          currentThread,
          providerEmailId,
        );

      if (
        classified.outcome ===
        "already_set"
      ) {
        return classified;
      }
    } catch {
      /*
       * Preserve the original database error if reconciliation also fails.
       */
    }

    throw error;
  }
}

function classifyRootMessageState(
  thread: CommissionEmailThread | null,
  providerEmailId: string,
  rootMessageId: string,
): SetCommissionEmailThreadRootMessageIdResult {
  if (!thread) {
    return {
      outcome: "not_found",
    };
  }

  if (
    thread.rootProviderEmailId !==
    providerEmailId
  ) {
    return {
      outcome: "conflict",
      thread,
    };
  }

  if (
    thread.rootMessageId ===
    rootMessageId
  ) {
    return {
      outcome: "already_set",
      thread,
    };
  }

  return {
    outcome: "conflict",
    thread,
  };
}

export async function setCommissionEmailThreadRootMessageId(
  input: SetCommissionEmailThreadRootMessageIdInput,
): Promise<SetCommissionEmailThreadRootMessageIdResult> {
  const threadId =
    normalizeThreadId(
      input.threadId,
    );
  const providerEmailId =
    normalizeRequiredValue(
      input.providerEmailId,
      "providerEmailId",
    );
  const rootMessageId =
    normalizeRequiredValue(
      input.rootMessageId,
      "rootMessageId",
    );
  const updatedAt = new Date();

  try {
    const rows = await db
      .update(
        commissionEmailThreads,
      )
      .set({
        rootMessageId,
        updatedAt,
      })
      .where(
        and(
          eq(
            commissionEmailThreads.id,
            threadId,
          ),
          eq(
            commissionEmailThreads.rootProviderEmailId,
            providerEmailId,
          ),
          isNull(
            commissionEmailThreads.rootMessageId,
          ),
        ),
      )
      .returning();

    const updatedThread =
      rows[0];

    if (updatedThread) {
      return {
        outcome: "set",
        thread: updatedThread,
      };
    }

    const currentThread =
      await getCommissionEmailThreadById(
        threadId,
      );

    return classifyRootMessageState(
      currentThread,
      providerEmailId,
      rootMessageId,
    );
  } catch (error) {
    /*
     * The provider ID + RFC Message-ID identify this exact completion.
     * Reconcile an uncertain Neon response without changing the root.
     */
    try {
      const currentThread =
        await getCommissionEmailThreadById(
          threadId,
        );

      const classified =
        classifyRootMessageState(
          currentThread,
          providerEmailId,
          rootMessageId,
        );

      if (
        classified.outcome ===
        "already_set"
      ) {
        return classified;
      }
    } catch {
      /*
       * Preserve the original database error if reconciliation also fails.
       */
    }

    throw error;
  }
}
