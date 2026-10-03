"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { PublicQuoteActionState } from "@/app/quote/[token]/actions";

type PublicQuoteServerAction = (
  state: PublicQuoteActionState,
  formData: FormData,
) => Promise<PublicQuoteActionState>;

interface PublicQuoteResponseActionsProps {
  acceptAction: PublicQuoteServerAction;
  declineAction: PublicQuoteServerAction;
  currency: string;
  totalAmount: string;
  version: number;
}

interface ConfirmSubmitButtonProps {
  children: React.ReactNode;
  variant: "accept" | "decline";
}

function ConfirmSubmitButton({
  children,
  variant,
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  const className =
    variant === "accept"
      ? "bg-white text-[#5966A5] hover:bg-white/90"
      : "border border-white/20 bg-white/[0.06] text-white hover:bg-white/10";

  return (
    <button
      className={`rounded-xl px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      disabled={pending}
      type="submit"
    >
      {pending ? "Recording response..." : children}
    </button>
  );
}

function formatQuoteAmount(
  amount: string,
  currency: string,
): string {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return `${amount} ${currency}`;
  }

  try {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numericAmount);

    return `${formatted} ${currency}`;
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function PublicQuoteResponseActions({
  acceptAction,
  declineAction,
  currency,
  totalAmount,
  version,
}: PublicQuoteResponseActionsProps) {
  const [confirmation, setConfirmation] = useState<
    "accept" | "decline" | null
  >(null);

  const [acceptState, acceptFormAction] = useActionState(
    acceptAction,
    {
      outcome: "idle",
      message: null,
    },
  );

  const [declineState, declineFormAction] = useActionState(
    declineAction,
    {
      outcome: "idle",
      message: null,
    },
  );

  const errorMessage =
    acceptState.outcome === "error"
      ? acceptState.message
      : declineState.outcome === "error"
        ? declineState.message
        : null;

  const formattedAmount = formatQuoteAmount(
    totalAmount,
    currency,
  );

  return (
    <section className="glass-card p-5 sm:p-7">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.16em] text-white/45">
          Your response
        </p>

        <h2 className="mt-2 text-xl font-light text-white sm:text-2xl">
          Ready to continue?
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/60">
          Please review the quote carefully before choosing how you would like
          to proceed.
        </p>
      </div>

      {errorMessage && (
        <div
          className="mt-5 rounded-2xl border border-red-200/20 bg-red-200/10 px-4 py-3 text-sm text-red-50"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {confirmation === null ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-[#5966A5] transition hover:bg-white/90"
              onClick={() => setConfirmation("accept")}
              type="button"
            >
              Accept quote
            </button>

            <button
              className="rounded-xl border border-white/20 bg-white/[0.06] px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              onClick={() => setConfirmation("decline")}
              type="button"
            >
              Decline quote
            </button>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5 text-center">
            <p className="text-sm text-white/65">
              Need something changed?
            </p>

            <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-white/45">
              Reply to the quote email to request adjustments. Requesting
              changes does not decline or cancel your quote.
            </p>
          </div>
        </>
      ) : confirmation === "accept" ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] p-5">
          <h3 className="text-lg font-medium text-white">
            Accept this quote?
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-white/65">
            You are accepting Quote v{version} for {formattedAmount}.
          </p>

          <p className="mt-2 text-xs leading-relaxed text-white/45">
            Accepting this quote confirms the quoted scope and price. It does
            not separately accept the Terms of Service or Commission Agreement.
          </p>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-xl border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={() => setConfirmation(null)}
              type="button"
            >
              Go back
            </button>

            <form action={acceptFormAction}>
              <ConfirmSubmitButton variant="accept">
                Yes, accept quote
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-red-200/15 bg-red-200/[0.06] p-5">
          <h3 className="text-lg font-medium text-white">
            Decline this quote?
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-white/65">
            This will close the current commission request.
          </p>

          <p className="mt-2 text-xs leading-relaxed text-white/45">
            If you only need changes to the quote, go back and request
            adjustments by replying to the quote email instead.
          </p>

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="rounded-xl border border-white/15 px-5 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              onClick={() => setConfirmation(null)}
              type="button"
            >
              Go back
            </button>

            <form action={declineFormAction}>
              <ConfirmSubmitButton variant="decline">
                Yes, decline quote
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}