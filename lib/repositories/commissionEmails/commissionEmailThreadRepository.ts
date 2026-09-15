import { eq } from "drizzle-orm";

import { db } from "../../db";
import { commissionEmailThreads } from "../../db/schema/commissions";
import type {
  CommissionEmailThread,
  CreateCommissionEmailThreadInput,
  CreateCommissionEmailThreadResult,
} from "./commissionEmailTypes";

const MAX_COMMISSION_EMAIL_SUBJECT_LENGTH = 350;

function normalizeCommissionId(commissionId: string): string {
  const normalized = commissionId.trim();

  if (!normalized) {
    throw new Error("commissionId is required.");
  }

  return normalized;
}

function normalizeCommissionEmailSubject(subject: string): string {
  const normalized = subject.trim();

  if (!normalized) {
    throw new Error("subject is required.");
  }

  if (normalized.length > MAX_COMMISSION_EMAIL_SUBJECT_LENGTH) {
    throw new Error(
      `subject must be ${MAX_COMMISSION_EMAIL_SUBJECT_LENGTH} characters or fewer.`,
    );
  }

  return normalized;
}

export async function getCommissionEmailThreadByCommissionId(
  commissionId: string,
): Promise<CommissionEmailThread | null> {
  const normalizedCommissionId = normalizeCommissionId(commissionId);

  const rows = await db
    .select()
    .from(commissionEmailThreads)
    .where(eq(commissionEmailThreads.commissionId, normalizedCommissionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function createCommissionEmailThreadIfMissing(
  input: CreateCommissionEmailThreadInput,
): Promise<CreateCommissionEmailThreadResult> {
  const commissionId = normalizeCommissionId(input.commissionId);
  const subject = normalizeCommissionEmailSubject(input.subject);

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
      target: commissionEmailThreads.commissionId,
    })
    .returning();

  const createdThread = createdRows[0];

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
  const existingThread = await getCommissionEmailThreadByCommissionId(
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
