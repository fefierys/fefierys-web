import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/lib/auth/server";

const adminUserId =
  process.env.ADMIN_USER_ID;

if (!adminUserId) {
  throw new Error(
    "ADMIN_USER_ID is not configured."
  );
}

export async function getAdminSession() {
  const {
    data: session,
  } =
    await auth.getSession();

  if (
    !session?.user ||
    session.user.id !== adminUserId
  ) {
    return null;
  }

  return session;
}

export async function requireAdmin() {
  const session =
    await getAdminSession();

  if (!session) {
    redirect(
      "/admin/login"
    );
  }

  return session;
}