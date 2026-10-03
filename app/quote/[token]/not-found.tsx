export default function QuoteNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-24 sm:px-6">
      <section className="glass-card w-full max-w-xl p-7 text-center sm:p-10">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
          Fefierys Art
        </p>

        <h1 className="mt-4 text-3xl font-light tracking-tight text-white">
          Quote unavailable
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/60">
          This quote link is invalid or no longer available.
        </p>

        <p className="mt-6 text-xs leading-relaxed text-white/35">
          If you received this link by email and believe it should still be
          available, please reply to that email.
        </p>
      </section>
    </main>
  );
}