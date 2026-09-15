"use server";

import { redirect } from "next/navigation";

import {
  acceptCommissionQuotePublicly,
  declineCommissionQuotePublicly,
} from "@/lib/repositories/commissionQuoteRepository";

export interface PublicQuoteActionState {
  outcome: "idle" | "error";
  message: string | null;
}

function getQuotePath(token: string): string {
  return `/quote/${encodeURIComponent(token)}`;
}

export async function acceptPublicQuoteAction(
  token: string,
  previousState: PublicQuoteActionState,
  formData: FormData,
): Promise<PublicQuoteActionState> {
  void previousState;
  void formData;

  let result: Awaited<
    ReturnType<typeof acceptCommissionQuotePublicly>
  >;

  try {
    result = await acceptCommissionQuotePublicly(token);
  } catch (error) {
    /*
     * Never include the token in logs or error messages.
     */
    console.error(
      "Failed to accept public commission quote:",
      error,
    );

    return {
      outcome: "error",
      message:
        "Your response could not be recorded right now. Please try again.",
    };
  }

  /*
   * Reload the canonical GET page after outcomes where
   * the public quote state may have changed.
   */
  switch (result.outcome) {
    case "accepted":
    case "expired":
    case "conflict":
    case "unavailable":
      redirect(getQuotePath(token));

    case "not_actionable":
      return {
        outcome: "error",
        message:
          "This quote cannot be accepted right now. Please contact me if you need help.",
      };
  }
}

export async function declinePublicQuoteAction(
  token: string,
  previousState: PublicQuoteActionState,
  formData: FormData,
): Promise<PublicQuoteActionState> {
  void previousState;
  void formData;

  let result: Awaited<
    ReturnType<typeof declineCommissionQuotePublicly>
  >;

  try {
    result = await declineCommissionQuotePublicly(token);
  } catch (error) {
    /*
     * Never include the token in logs or error messages.
     */
    console.error(
      "Failed to decline public commission quote:",
      error,
    );

    return {
      outcome: "error",
      message:
        "Your response could not be recorded right now. Please try again.",
    };
  }

  switch (result.outcome) {
    case "declined":
    case "expired":
    case "conflict":
    case "unavailable":
      redirect(getQuotePath(token));

    case "not_actionable":
      return {
        outcome: "error",
        message:
          "This quote cannot be declined right now. Please contact me if you need help.",
      };
  }
}