import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";
import { getPastDueCommissionQuoteCount } from "@/lib/repositories/commissionAdminRepository";

import { logoutAction } from "./actions";

export default async function AdminPage() {
  const session = await requireAdmin();
  const pastDueQuoteCount = await getPastDueCommissionQuoteCount();

  return (
    <main className="min-h-screen px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/50">
              Fefierys workspace
            </p>
            <h1 className="mt-3 text-4xl font-light">Admin</h1>
            <p className="mt-3 text-white/60">
              Signed in as {session.user.email}
            </p>
          </div>

          <form action={logoutAction}>
            <button
              className="rounded-xl border border-white/15 px-4 py-2 transition hover:bg-white/10"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>

        {pastDueQuoteCount > 0 && (
          <section className="mt-10 rounded-2xl border border-amber-200/20 bg-amber-200/[0.08] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-amber-50">
                  Quotes needing attention
                </p>
                <h2 className="mt-2 text-2xl font-light text-white">
                  {pastDueQuoteCount}{" "}
                  {pastDueQuoteCount === 1
                    ? "quote is past its validity date"
                    : "quotes are past their validity date"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
                  {pastDueQuoteCount === 1
                    ? "A sent quote is still awaiting a client response even though its validity period has ended."
                    : "Some sent quotes are still awaiting a client response even though their validity periods have ended."}
                </p>
              </div>

              <span className="inline-flex min-w-10 items-center justify-center self-start rounded-full border border-amber-100/20 bg-amber-100/10 px-3 py-1.5 text-sm font-medium text-amber-50">
                {pastDueQuoteCount}
              </span>
            </div>

            <Link
              className="mt-5 inline-flex text-sm text-amber-50 transition hover:text-white"
              href="/admin/commissions?status=awaiting_quote_response"
            >
              Review commissions →
            </Link>
          </section>
        )}

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <Link
            className="glass-card group p-7 transition hover:border-white/20 hover:bg-white/10"
            href="/admin/commissions"
          >
            <p className="text-sm text-white/50">Commission workflow</p>
            <h2 className="mt-3 text-2xl font-light">Commissions</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
              Review inquiries, inspect client details, and follow each
              commission through its lifecycle.
            </p>
            <p className="mt-6 text-sm transition group-hover:translate-x-1">
              Open commissions →
            </p>
          </Link>

          <div className="glass-card p-7 opacity-70">
            <p className="text-sm text-white/50">Portfolio management</p>
            <h2 className="mt-3 text-2xl font-light">Portfolio CMS</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
              Artwork publishing and organization tools will be connected in a
              later phase.
            </p>
            <p className="mt-6 text-sm text-white/40">Coming later</p>
          </div>
        </section>
      </div>
    </main>
  );
}
