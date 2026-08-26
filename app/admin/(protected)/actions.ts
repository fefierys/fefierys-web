"use server";

import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/lib/auth/server";

export async function logoutAction() {
  await auth.signOut();

  redirect(
    "/admin/login"
  );
}