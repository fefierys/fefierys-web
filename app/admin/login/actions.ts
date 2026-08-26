"use server";

import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/lib/auth/server";

export interface LoginState {
  error:
    | string
    | null;
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email =
    formData
      .get("email")
      ?.toString()
      .trim();

  const password =
    formData
      .get("password")
      ?.toString();

  if (
    !email ||
    !password
  ) {
    return {
      error:
        "Email and password are required.",
    };
  }

  const {
    error,
  } =
    await auth.signIn.email({
      email,
      password,
    });

  if (error) {
    return {
      error:
        "Invalid email or password.",
    };
  }

  redirect(
    "/admin"
  );
}