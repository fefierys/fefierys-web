import type { Metadata } from "next";
import Link from "next/link";

import ContactForm from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Project Inquiry | Fefierys",

  description:
    "Tell Fefierys about your illustration project, ask about a commission, or send an inquiry about book art, character art, chibis, emotes and custom artwork.",

  alternates: {
    canonical: "/contact",
  },

  openGraph: {
    title: "Project Inquiry | Fefierys",

    description:
      "Tell Fefierys about your illustration project or send an inquiry about a custom commission.",

    url: "/contact",
  },
};

interface ContactPageProps {
  searchParams: Promise<{
    style?: string;
    collection?: string;
    category?: string;
    option?: string;
  }>;
}

export default async function ContactPage({
  searchParams,
}: ContactPageProps) {
  const {
    style,
    collection,
    category,
    option,
  } = await searchParams;

  /*
   * A catalog selection is only considered valid
   * for presentation/persistence when all four
   * classification values are present.
   *
   * This avoids creating partially classified
   * inquiries from manually edited URLs.
   */

  const hasSelection = Boolean(
    style &&
      collection &&
      category &&
      option,
  );

  const selectedStyle =
    hasSelection ? style : undefined;

  const selectedCollection =
    hasSelection ? collection : undefined;

  const selectedCategory =
    hasSelection ? category : undefined;

  const selectedOption =
    hasSelection ? option : undefined;

  return (
    <main
      className="
        min-h-screen
        px-4
        pb-24
        pt-28
        sm:px-6
        md:pt-32
      "
    >
      <div className="mx-auto max-w-5xl">
        {/* ================================================
            INTRO
        ================================================ */}

        <header
          className="
            mx-auto
            max-w-3xl
            text-center
            text-white
          "
        >
          {hasSelection ? (
            <h1
              className="
                text-4xl
                font-light
                tracking-tight
                text-white
                sm:text-5xl
                lg:text-6xl
              "
            >
              Tell me about your project
            </h1>
          ) : (
            <>
              <p
                className="
                  text-[0.7rem]
                  uppercase
                  tracking-[0.24em]
                  text-white/45
                "
              >
                Project Inquiry
              </p>

              <h1
                className="
                  mt-3
                  text-4xl
                  font-light
                  tracking-tight
                  text-white
                  sm:text-5xl
                  lg:text-6xl
                "
              >
                Tell me about your project
              </h1>

              <p
                className="
                  mx-auto
                  mt-5
                  max-w-2xl
                  text-sm
                  leading-7
                  text-white/65
                  sm:text-base
                "
              >
                Have an idea in mind? Tell me a
                little about your project and what
                you&apos;re looking for. You
                don&apos;t need to have every
                detail figured out before getting
                in touch.
              </p>
            </>
          )}
        </header>

        {/* ================================================
            SELECTED COMMISSION OPTION
        ================================================ */}

        {hasSelection && (
          <section
            className="
              mt-10
              rounded-[2rem]
              border
              border-white/10
              bg-[#5966A5]/45
              p-5
              text-white
              backdrop-blur-xl
              shadow-[0_16px_50px_rgba(40,40,90,0.14)]
              sm:p-6
            "
          >
            <div
              className="
                flex
                flex-col
                gap-3
                sm:flex-row
                sm:items-start
                sm:justify-between
              "
            >
              <div>
                <p
                  className="
                    text-[0.65rem]
                    uppercase
                    tracking-[0.2em]
                    text-white/45
                  "
                >
                  Interested in
                </p>

                <h2
                  className="
                    mt-1
                    text-xl
                    font-light
                    text-white
                    sm:text-2xl
                  "
                >
                  {category}
                </h2>

                <p
                  className="
                    mt-2
                    max-w-2xl
                    text-xs
                    leading-relaxed
                    text-white/55
                    sm:text-sm
                  "
                >
                  This selection helps me
                  understand what you&apos;re
                  interested in. You can still
                  discuss or change any of the
                  details in your message.
                </p>
              </div>

              <Link
                href="/commissions"
                className="
                  shrink-0
                  text-xs
                  text-white/55
                  underline
                  decoration-white/25
                  underline-offset-4
                  transition
                  hover:text-white
                "
              >
                Change selection
              </Link>
            </div>

            <div
              className="
                mt-5
                grid
                gap-2
                sm:grid-cols-2
                lg:grid-cols-4
              "
            >
              <div
                className="
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  p-3.5
                "
              >
                <p
                  className="
                    text-[0.6rem]
                    uppercase
                    tracking-[0.18em]
                    text-white/40
                  "
                >
                  Style
                </p>

                <p className="mt-1 text-sm text-white/85">
                  {style}
                </p>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  p-3.5
                "
              >
                <p
                  className="
                    text-[0.6rem]
                    uppercase
                    tracking-[0.18em]
                    text-white/40
                  "
                >
                  Collection
                </p>

                <p className="mt-1 text-sm text-white/85">
                  {collection}
                </p>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  p-3.5
                "
              >
                <p
                  className="
                    text-[0.6rem]
                    uppercase
                    tracking-[0.18em]
                    text-white/40
                  "
                >
                  Category
                </p>

                <p className="mt-1 text-sm text-white/85">
                  {category}
                </p>
              </div>

              <div
                className="
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  p-3.5
                "
              >
                <p
                  className="
                    text-[0.6rem]
                    uppercase
                    tracking-[0.18em]
                    text-white/40
                  "
                >
                  Option
                </p>

                <p className="mt-1 text-sm text-white/85">
                  {option}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ================================================
            CONTACT FORM
        ================================================ */}

        <section className="mt-6">
          <ContactForm
            style={selectedStyle}
            collection={selectedCollection}
            category={selectedCategory}
            option={selectedOption}
          />
        </section>
      </div>
    </main>
  );
}