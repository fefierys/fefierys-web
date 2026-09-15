import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatCommissionDate } from "@/lib/commissions/commissionDate";
import type {
  PublicCommissionQuote,
  PublicCommissionQuoteStatus,
} from "@/lib/commissions/publicCommissionQuote";
import { getPublicCommissionQuoteByToken } from "@/lib/repositories/commissionQuoteRepository";

import PublicQuoteResponseActions from "@/components/quote/PublicQuoteResponseActions";

import {
  acceptPublicQuoteAction,
  declinePublicQuoteAction,
} from "./actions";

import {
  formatCommissionQuoteAmount,
  parseCommissionQuoteAmount,
} from "@/lib/commissions/commissionQuote";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Your Quote | Fefierys Art",
  description: "Secure commission quote from Fefierys Art.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

interface QuotePageProps {
  params: Promise<{
    token: string;
  }>;
}

interface QuoteStatusContent {
  eyebrow: string;
  title: string;
  description: string;
  badgeClassName: string;
}

const STATUS_CONTENT: Record<
  PublicCommissionQuoteStatus,
  QuoteStatusContent
> = {
  sent: {
    eyebrow: "Awaiting your response",
    title: "Your quote is ready",
    description:
        "Please review the details below. You can accept or decline this quote securely from this page.",
    badgeClassName:
      "border-amber-200/25 bg-amber-200/10 text-amber-50",
  },

  accepted: {
    eyebrow: "Accepted",
    title: "Quote accepted",
    description:
      "This quote has been accepted and is now preserved here for your records.",
    badgeClassName:
      "border-emerald-200/25 bg-emerald-200/10 text-emerald-50",
  },

  declined: {
    eyebrow: "Declined",
    title: "Quote declined",
    description:
      "This quote was declined and can no longer be accepted or changed from this page.",
    badgeClassName:
      "border-red-200/25 bg-red-200/10 text-red-50",
  },

  expired: {
    eyebrow: "Expired",
    title: "This quote has expired",
    description:
      "The validity period for this quote has ended. It remains available here for reference.",
    badgeClassName:
      "border-white/15 bg-white/[0.06] text-white/70",
  },

  superseded: {
    eyebrow: "Replaced",
    title: "This quote has been replaced",
    description:
      "A newer version of this quote has been created. This version remains available for reference but can no longer be accepted or declined.",
    badgeClassName:
      "border-violet-200/25 bg-violet-200/10 text-violet-50",
  },
};

function QuoteStatus({
  status,
}: {
  status: PublicCommissionQuoteStatus;
}) {
  const content = STATUS_CONTENT[status];

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] ${content.badgeClassName}`}
    >
      {content.eyebrow}
    </span>
  );
}

function formatLineAmount(
  quantity: number,
  unitAmount: string,
): string {
  const minorUnits =
    parseCommissionQuoteAmount(unitAmount);

  if (minorUnits === null) {
    return unitAmount;
  }

  return formatCommissionQuoteAmount(
    minorUnits * BigInt(quantity),
  );
}

function QuoteItems({
  quote,
}: {
  quote: PublicCommissionQuote;
}) {
  return (
    <section className="glass-card overflow-hidden">
      <div className="border-b border-white/10 px-5 py-5 sm:px-7">
        <h2 className="text-lg font-medium text-white">
          Quote details
        </h2>

        <p className="mt-1 text-sm text-white/50">
          Quote v{quote.version}
        </p>
      </div>

      <div className="divide-y divide-white/10">
        {quote.items.map((item) => (
          <div
            className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-7"
            key={`${item.sequence}-${item.label}`}
          >
            <div className="min-w-0">
              <p className="font-medium text-white/90">
                {item.label}
              </p>

              {item.description && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/50">
                  {item.description}
                </p>
              )}

              <p className="mt-2 text-xs text-white/40">
                {item.quantity} × {item.unitAmount} {quote.currency}
              </p>
            </div>

            <p className="shrink-0 text-sm font-medium text-white/80">
                {formatLineAmount(
                    item.quantity,
                    item.unitAmount,
                )}{" "}
                {quote.currency}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-end justify-between gap-5 border-t border-white/10 bg-white/[0.035] px-5 py-5 sm:px-7 sm:py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-white/40">
            Total
          </p>

          <p className="mt-1 text-sm text-white/50">
            {quote.currency}
          </p>
        </div>

        <p className="text-2xl font-medium text-white sm:text-3xl">
          {quote.totalAmount} {quote.currency}
        </p>
      </div>
    </section>
  );
}

export default async function QuotePage({
  params,
}: QuotePageProps) {
  const { token } = await params;

  const quote = await getPublicCommissionQuoteByToken(token);

  if (!quote) {
    notFound();
  }

  const acceptAction =
    acceptPublicQuoteAction.bind(null, token);

  const declineAction =
    declinePublicQuoteAction.bind(null, token);

  const statusContent = STATUS_CONTENT[quote.status];

  return (
    <main className="min-h-screen px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center sm:mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">
            Fefierys Art
          </p>

          <h1 className="mt-3 text-3xl font-light tracking-tight text-white sm:text-4xl">
            Commission Quote
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">
            Secure quote for {quote.clientName}
          </p>
        </header>

        <div className="space-y-5">
          <section className="glass-card p-5 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <QuoteStatus status={quote.status} />

                <h2 className="mt-5 text-2xl font-medium tracking-tight text-white sm:text-3xl">
                  {statusContent.title}
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
                  {statusContent.description}
                </p>
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                  Reference
                </p>

                <p className="mt-1 text-sm font-medium text-white/75">
                  {quote.reference}
                </p>

                <p className="mt-3 text-xs text-white/40">
                  Quote v{quote.version}
                </p>
              </div>
            </div>
          </section>

          {quote.description && (
            <section className="glass-card p-5 sm:p-7">
              <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                Project
              </p>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/70 sm:text-base">
                {quote.description}
              </p>
            </section>
          )}

          <QuoteItems quote={quote} />

          <section className="glass-card grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                Sent
              </p>

              <p className="mt-2 text-sm text-white/75">
                {formatCommissionDate(quote.sentAt)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                Valid until
              </p>

              <p className="mt-2 text-sm text-white/75">
                {formatCommissionDate(quote.validUntil)}
              </p>
            </div>
          </section>

          {quote.status === "sent" && (
            <PublicQuoteResponseActions
                acceptAction={acceptAction}
                currency={quote.currency}
                declineAction={declineAction}
                totalAmount={quote.totalAmount}
                version={quote.version}
            />
            )}

          <p className="px-3 pt-3 text-center text-xs leading-relaxed text-white/35">
            This secure link is intended for the recipient of this quote.
            Please avoid sharing it with others.
          </p>
        </div>
      </div>
    </main>
  );
}