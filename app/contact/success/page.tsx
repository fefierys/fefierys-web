import Link from 'next/link';
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ContactSuccessPage() {
  return (
    <section className="min-h-screen px-6 py-32">
      <div className="mx-auto max-w-2xl text-white">
        <div
          className="
            rounded-3xl border border-white/10 bg-white/10
            p-8 backdrop-blur-2xl
            shadow-[0_20px_60px_rgba(70,70,120,0.18)]
            text-center
          "
        >
          <h1 className="mb-4 text-4xl font-light">
            Thank you for reaching out
          </h1>

          <p className="mb-8 leading-relaxed text-white/80">
            Your commission inquiry has been received successfully. I&apos;ll
            review the details of your request and get back to you as soon as
            possible.
          </p>

          <Link
            href="/"
            className="
              inline-flex items-center justify-center
              rounded-full border border-white/20 bg-white/10
              px-8 py-3 text-sm uppercase tracking-[0.15em]
              text-white transition duration-300
              hover:bg-white hover:text-[#2f3558]
            "
          >
            Return to Home
          </Link>
        </div>
      </div>
    </section>
  );
}