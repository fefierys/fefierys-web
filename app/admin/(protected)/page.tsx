import Link from "next/link";

import { requireAdmin } from "@/lib/auth/admin";

import { logoutAction } from "./actions";

export default async function AdminPage() {
  const session = await requireAdmin();

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
