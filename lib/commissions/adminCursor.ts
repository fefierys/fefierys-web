import "server-only";

import type { AdminCommissionCursor } from "@/lib/repositories/commissionAdminRepository";

interface SerializedAdminCommissionCursor {
  submittedAt: string;
  id: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeAdminCommissionCursor(
  cursor: AdminCommissionCursor,
): string {
  const serialized: SerializedAdminCommissionCursor = {
    submittedAt: cursor.submittedAt.toISOString(),
    id: cursor.id,
  };

  return Buffer.from(JSON.stringify(serialized), "utf8").toString("base64url");
}

export function decodeAdminCommissionCursor(
  value: string | undefined,
): AdminCommissionCursor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<SerializedAdminCommissionCursor>;

    if (
      typeof parsed.submittedAt !== "string" ||
      typeof parsed.id !== "string" ||
      !UUID_REGEX.test(parsed.id)
    ) {
      return null;
    }

    const submittedAt = new Date(parsed.submittedAt);

    if (Number.isNaN(submittedAt.getTime())) {
      return null;
    }

    return {
      submittedAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}
