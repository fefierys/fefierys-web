"use server";

import {
  redirect,
} from "next/navigation";

import {
  acceptCommissionAgreementService,
} from "@/lib/commissions/commissionAgreementAcceptService";

export interface PublicAgreementActionState {
  outcome:
    | "idle"
    | "error";

  message:
    string | null;

  field:
    | "acceptedByName"
    | "acceptanceConfirmed"
    | null;

  acceptedByName:
    string;
}

function getAgreementPath(
  token: string,
): string {
  return `/agreement/${encodeURIComponent(token)}`;
}

function getFormText(
  formData: FormData,
  fieldName: string,
): string {
  const value =
    formData.get(
      fieldName,
    );

  return typeof value ===
    "string"
    ? value
    : "";
}

export async function acceptPublicAgreementAction(
  token: string,
  previousState: PublicAgreementActionState,
  formData: FormData,
): Promise<PublicAgreementActionState> {
  void previousState;

  const acceptedByName =
    getFormText(
      formData,
      "acceptedByName",
    );

  /*
   * The checkbox is also validated by the browser, but the
   * server must never trust client-side validation alone.
   */
  const acceptanceConfirmed =
    formData.has(
      "acceptanceConfirmed",
    );

  let result: Awaited<
    ReturnType<
      typeof acceptCommissionAgreementService
    >
  >;

  try {
    result =
      await acceptCommissionAgreementService({
        token,

        acceptedByName,

        acceptanceConfirmed,
      });
  } catch (error) {
    /*
     * Never include the public bearer token, R2 key, document
     * hashes or Client identity in logs.
     */
    const errorName =
      error instanceof Error
        ? error.name
        : "UnknownError";

    console.error(
      `Failed to accept public Commission Agreement (${errorName}).`,
    );

    return {
      outcome:
        "error",

      message:
        "Your Agreement acceptance could not be recorded right now. Please try again.",

      field:
        null,

      acceptedByName,
    };
  }

  switch (
    result.outcome
  ) {
    case "accepted":
    case "conflict":
    case "unavailable":
      /*
       * Reload the canonical GET page.
       *
       * - accepted:
       *     displays the newly accepted state.
       *
       * - conflict:
       *     refreshes whatever state won the race.
       *
       * - unavailable:
       *     the canonical page will resolve the bearer again
       *     and return its normal unavailable/not-found state.
       */
      redirect(
        getAgreementPath(
          token,
        ),
      );

    case "validation_error":
      return {
        outcome:
          "error",

        message:
          result.message,

        field:
          result.field,

        acceptedByName,
      };

    case "not_actionable":
      return {
        outcome:
          "error",

        message:
          "This Agreement cannot be accepted right now. Please reply to the project email if you need help.",

        field:
          null,

        acceptedByName,
      };
  }
}