import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";

import {
  formatCommissionDate,
} from "@/lib/commissions/commissionDate";

import type {
  PublicCommissionAgreementStatus,
} from "@/lib/commissions/publicCommissionAgreement";

import {
  getPublicCommissionAgreementByToken,
  resolveCommissionAgreementExecutedPublicToken,
} from "@/lib/repositories/commissionAgreements/commissionAgreementAccessRepository";

import AgreementAcceptanceForm
  from "./AgreementAcceptanceForm";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export const metadata:
  Metadata = {
    title:
      "Your Commission Agreement | Fefierys Art",

    description:
      "Secure Commission Agreement from Fefierys Art.",

    referrer:
      "no-referrer",

    robots: {
      index:
        false,

      follow:
        false,

      noarchive:
        true,
    },
  };

interface AgreementPageProps {
  params: Promise<{
    token: string;
  }>;
}

interface AgreementStatusContent {
  eyebrow: string;
  title: string;
  description: string;
  badgeClassName: string;
}

const STATUS_CONTENT:
  Record<
    PublicCommissionAgreementStatus,
    AgreementStatusContent
  > = {
    sent: {
      eyebrow:
        "Awaiting your acceptance",

      title:
        "Your Commission Agreement is ready",

      description:
        "Please review the Agreement carefully before accepting it. If anything needs clarification or correction, reply to the project email before continuing.",

      badgeClassName:
        "border-amber-200/25 bg-amber-200/10 text-amber-50",
    },

    accepted: {
      eyebrow:
        "Accepted",

      title:
        "Agreement accepted",

      description:
        "Your acceptance has been recorded. Both the Agreement originally presented to you and the final accepted Agreement remain available here for your records.",

      badgeClassName:
        "border-emerald-200/25 bg-emerald-200/10 text-emerald-50",
    },
  };

function AgreementStatus({
  status,
}: {
  status:
    PublicCommissionAgreementStatus;
}) {
  const content =
    STATUS_CONTENT[
      status
    ];

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.12em] ${content.badgeClassName}`}
    >
      {
        content.eyebrow
      }
    </span>
  );
}

export default async function AgreementPage({
  params,
}: AgreementPageProps) {
  const {
    token,
  } =
    await params;

  const agreement =
    await getPublicCommissionAgreementByToken(
      token,
    );

  if (!agreement) {
    notFound();
  }

  /*
   * Keep the executed document metadata entirely server-side.
   *
   * The browser only receives the public endpoint URL when an
   * accepted Agreement has a valid executed document linked to
   * it.
   */
  const executedAgreementTarget =
    agreement.status === "accepted"
      ? await resolveCommissionAgreementExecutedPublicToken(
          token,
        )
      : null;

  const statusContent =
    STATUS_CONTENT[
      agreement.status
    ];

  const presentedPdfUrl =
    `/api/public/agreements/${encodeURIComponent(token)}/pdf`;

  const executedPdfUrl =
    `/api/public/agreements/${encodeURIComponent(token)}/executed-pdf`;

  return (
    <main className="min-h-screen px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center sm:mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">
            Fefierys Art
          </p>

          <h1 className="mt-3 text-3xl font-light tracking-tight text-white sm:text-4xl">
            Commission Agreement
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">
            Secure Agreement for{" "}
            {
              agreement.clientName
            }
          </p>
        </header>

        <div className="space-y-5">
          <section className="glass-card p-5 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <AgreementStatus
                  status={
                    agreement.status
                  }
                />

                <h2 className="mt-5 text-2xl font-medium tracking-tight text-white sm:text-3xl">
                  {
                    statusContent.title
                  }
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
                  {
                    statusContent.description
                  }
                </p>
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                  Reference
                </p>

                <p className="mt-1 text-sm font-medium text-white/75">
                  {
                    agreement.reference
                  }
                </p>

                <p className="mt-3 text-xs text-white/40">
                  Agreement revision{" "}
                  {
                    agreement.revision
                  }
                </p>
              </div>
            </div>
          </section>

          <section className="glass-card p-5 sm:p-7">
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                  Agreement documents
                </p>

                <h2 className="mt-2 text-xl font-medium text-white">
                  {
                    agreement.status ===
                    "accepted"
                      ? "Your Agreement records"
                      : "Review the presented Agreement"
                  }
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                  {
                    agreement.status ===
                    "accepted"
                      ? "The presented document is the immutable Agreement you reviewed before acceptance. The accepted document is the final executed copy containing the electronic acceptance record."
                      : "This PDF is the immutable Agreement presented for this project. Review it carefully before accepting."
                  }
                </p>
              </div>

              <div
                className={
                  agreement.status ===
                    "accepted" &&
                  executedAgreementTarget
                    ? "grid gap-3 sm:grid-cols-2"
                    : ""
                }
              >
                <a
                  className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                  href={
                    presentedPdfUrl
                  }
                  referrerPolicy="no-referrer"
                  rel="noreferrer"
                  target="_blank"
                >
                  {
                    agreement.status ===
                    "accepted"
                      ? "View Presented Agreement"
                      : "View Agreement PDF"
                  }
                </a>

                {agreement.status ===
                  "accepted" &&
                  executedAgreementTarget && (
                    <a
                      className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200/25 bg-emerald-200/10 px-5 py-3 text-sm font-medium text-emerald-50 transition hover:bg-emerald-200/15"
                      href={
                        executedPdfUrl
                      }
                      referrerPolicy="no-referrer"
                      rel="noreferrer"
                      target="_blank"
                    >
                      View Accepted Agreement
                    </a>
                  )}
              </div>

              {agreement.status ===
                "accepted" &&
                !executedAgreementTarget && (
                  <p className="text-sm leading-relaxed text-amber-100/75">
                    The accepted Agreement record is temporarily
                    unavailable. The originally presented Agreement
                    remains available above.
                  </p>
                )}
            </div>
          </section>

          <section className="glass-card grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                Presented
              </p>

              <p className="mt-2 text-sm text-white/75">
                {
                  formatCommissionDate(
                    agreement.sentAt,
                  )
                }
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                Agreement revision
              </p>

              <p className="mt-2 text-sm text-white/75">
                Version{" "}
                {
                  agreement.revision
                }
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                Agreement template
              </p>

              <p className="mt-2 text-sm text-white/75">
                {
                  agreement.agreementVersion
                }
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/40">
                Terms of Service
              </p>

              <p className="mt-2 text-sm text-white/75">
                {
                  agreement.termsVersion
                }
              </p>
            </div>
          </section>

          {agreement.status ===
            "accepted" &&
            agreement.acceptedAt && (
              <section className="glass-card border border-emerald-200/15 p-5 sm:p-7">
                <p className="text-xs uppercase tracking-[0.12em] text-emerald-100/60">
                  Acceptance recorded
                </p>

                <h2 className="mt-2 text-lg font-medium text-emerald-50">
                  Electronic acceptance completed
                </h2>

                <p className="mt-2 text-sm text-emerald-50/80">
                  {
                    formatCommissionDate(
                      agreement.acceptedAt,
                    )
                  }
                </p>

                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-emerald-50/60">
                  Your electronic acceptance has been recorded
                  for this Agreement. The final accepted copy is
                  available above for your records, and the
                  commission can now proceed to the applicable
                  payment stage.
                </p>
              </section>
            )}

          {agreement.status ===
            "sent" && (
              <AgreementAcceptanceForm
                termsVersion={
                  agreement.termsVersion
                }
                token={
                  token
                }
              />
            )}

          <p className="px-3 pt-3 text-center text-xs leading-relaxed text-white/35">
            This secure link is intended for the recipient of
            this Agreement. Please avoid sharing it with others.
          </p>
        </div>
      </div>
    </main>
  );
}