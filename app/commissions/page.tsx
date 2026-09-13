import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import CommissionCatalog from "@/components/commissions/CommissionCatalog";
import { publicCommissionGroups } from "@/lib/commissions/publicCommissionCatalog";

import CommissionTermsButton from "@/components/commissions/CommissionTermsButton";

export const metadata: Metadata = {
  title: "Commissions | Fefierys",
  description:
    "Explore Fefierys commission options, pricing and process for book covers, interior illustrations, character art, pets, chibis, emotes and more.",
};

const faq = [
  {
    question:
      "Do I need to know exactly what I want before contacting you?",
    answer:
      "Having a general idea of what you’d like is always helpful, but you don’t need to have everything figured out. You can tell me about your project, ideas, and references, and we can work together to shape the concept and find the option that fits it best.",
  },
  {
    question:
      "What do I need to know before commissioning?",
    answer:
      "All the information needed to commission can be found in the Terms of Service."
  },
  {
    question:
      "Do you provide raw or layered source files?",
    answer:
      "Layered source files (.PSD, .AI) are not included in standard deliverables. Depending on the client's needs, a special license will have to be purchased.",
  },
  {
    question:
      "Do you use AI in your work?",
    answer:
      "No, my work is 100% human made! You can see my processes on my Instagram or TikTok. Also, for every commission, a timelapse recorded by my drawing app (CSP) is saved, which you can request.",
  },
  {
    question:
      "How does communication work during a commission?",
    answer:
      "Once you submit your commission request through the contact form on my website, we’ll continue the conversation via email. This allows us to keep everything organized in one place and maintain a clear record of the project, including your quote, Commission Agreement, payments, feedback, and other important details.",
  },
];

export default function CommissionsPage() {
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
      <div className="mx-auto max-w-7xl">
        {/* HERO */}
        <section
          className="
            glass-card
            relative
            overflow-hidden
            px-6
            py-10
            sm:px-10
            sm:py-12
            lg:px-14
            lg:py-14
          "
        >
          {/* =====================================================
              HERO ARTWORK
          ===================================================== */}

          <Image
            src="/images/commissions/hero/commissions-hero.webp"
            alt=""
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="
              pointer-events-none
              object-cover
              object-[72%_center]
              opacity-100
              sm:object-center
            "
          />

          {/* =====================================================
              COLOR OVERLAY

              Keeps the artwork integrated with the site palette.
          ===================================================== */}

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              inset-0
              bg-[#46558e]/35
            "
          />

          {/* =====================================================
              TEXT PROTECTION GRADIENT

              Stronger on the left where the copy lives,
              softer toward the artwork on the right.
          ===================================================== */}

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              inset-0

              bg-gradient-to-r
              from-[#5966A5]/95
              via-[#5966A5]/80
              to-[#5966A5]/25

              sm:from-[#5966A5]/95
              sm:via-[#5966A5]/75
              sm:to-[#5966A5]/15
            "
          />

          {/* =====================================================
              SUBTLE BOTTOM FADE
          ===================================================== */}

          <div
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              inset-0
              bg-gradient-to-t
              from-[#4c5790]/35
              via-transparent
              to-transparent
            "
          />

          {/* =====================================================
              HERO CONTENT
          ===================================================== */}

          <div
            className="
              relative
              z-10
              max-w-3xl
            "
          >
            <p
              className="
                text-[0.7rem]
                uppercase
                tracking-[0.24em]
                text-white/55
              "
            >
              Work with Me
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
              Commissions
            </h1>

            <p
              className="
                mt-5
                max-w-2xl
                text-sm
                leading-7
                text-white/75
                sm:text-base
              "
            >
              Explore illustration options,
              starting prices and how the
              commission process works at your
              own pace. You&apos;re always
              welcome to ask about your project
              before making any decision.
            </p>

            <div
              className="
                mt-7
                flex
                flex-col
                gap-3
                sm:flex-row
              "
            >
              <Link
                href="#commission-options"
                className="
                  inline-flex
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-white/20
                  bg-white
                  px-6
                  py-3
                  text-xs
                  uppercase
                  tracking-[0.15em]
                  text-[#353a70]
                  transition
                  hover:bg-white/90
                "
              >
                View portfolio
              </Link>
              <CommissionTermsButton />
            </div>
            <p
              className="
                mt-3
                max-w-xl
                text-[0.7rem]
                leading-relaxed
                text-white/60
              "
            >
              Terms are provided for reference so you can
              learn how I work. Acceptance is only required
              if you decide to move forward with a commission.
            </p>
          </div>
        </section>

        {/* CATALOG + SIDEBAR */}
        <section className="mt-6 sm:mt-8">
          <CommissionCatalog
            groups={publicCommissionGroups}
          />
        </section>

        {/* =========================================================
            FAQ + CUSTOM INQUIRY
        ========================================================= */}

        <section
          className="
            mt-8
            grid
            items-start
            gap-4
            lg:grid-cols-[1.25fr_0.85fr]
          "
        >
          {/* =====================================================
              FAQ
          ===================================================== */}

          <div
            className="
              rounded-[2rem]
              border
              border-white/10
              bg-[#5966A5]/40
              p-5
              backdrop-blur-xl
              shadow-[0_10px_40px_rgba(0,0,0,0.12)]
              sm:p-6
              lg:min-h-[280px]
            "
          >
            <div
              className="
                mb-5
                flex
                items-start
                gap-3
              "
            >
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border-white/15
                  text-white/75
                "
              >
                <span className="text-lg font-light">
                  ?
                </span>
              </div>

              <div>
                <p
                  className="
                    text-[0.65rem]
                    uppercase
                    tracking-[0.2em]
                    text-white/45
                  "
                >
                  Before you inquire
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
                  Frequently Asked Questions
                </h2>
              </div>
            </div>

            <div
              className="
                grid
                items-start
                gap-2
                md:grid-cols-2
              "
            >
              {faq.map((item) => (
                <details
                  key={item.question}
                  className="
                    group
                    self-start
                    rounded-2xl
                    border
                    border-white/10
                    bg-white/[0.035]
                    px-4
                    py-3
                  "
                >
                  <summary
                    className="
                      cursor-pointer
                      list-none
                      text-xs
                      text-white/75
                    "
                  >
                    <span
                      className="
                        flex
                        items-center
                        justify-between
                        gap-3
                      "
                    >
                      <span>{item.question}</span>

                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="
                          h-4
                          w-4
                          shrink-0
                          text-white/45
                          transition-transform
                          duration-300
                          group-open:rotate-180
                        "
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </summary>

                  <p
                    className="
                      mt-3
                      border-t
                      border-white/10
                      pt-3
                      text-xs
                      leading-relaxed
                      text-white/55
                    "
                  >
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>

          {/* =====================================================
              CUSTOM INQUIRY
          ===================================================== */}

          <section
            id="custom-inquiry"
            className="
              self-start
              scroll-mt-28
              overflow-hidden
              rounded-[2rem]
              border
              border-white/10
              bg-[#5966A5]/45
              backdrop-blur-xl
              shadow-[0_10px_40px_rgba(0,0,0,0.12)]
              lg:h-[280px]
            "
          >
            <div
              className="
                grid
                h-full
                sm:grid-cols-[0.8fr_1.2fr]
                lg:grid-cols-1
                xl:grid-cols-[0.8fr_1.2fr]
              "
            >
              {/* IMAGE */}

              <div
                className="
                  relative
                  min-h-44
                  overflow-hidden
                  sm:min-h-full
                  lg:min-h-44
                  xl:min-h-full
                "
              >
                <Image
                  src="/images/commissions/custom/something-else.webp"
                  alt=""
                  fill
                  sizes="
                    (max-width: 1023px) 40vw,
                    (max-width: 1279px) 35vw,
                    18vw
                  "
                  className="
                    object-cover
                    object-bottom
                    sm:object-center
                  "
                />

                <div
                  className="
                    absolute
                    inset-0
                    bg-gradient-to-r
                    from-transparent
                    via-transparent
                    to-[#5966A5]/40
                  "
                />
              </div>

              {/* CONTENT */}

              <div
                className="
                  flex
                  flex-col
                  justify-center
                  p-5
                  sm:p-6
                "
              >
                <p
                  className="
                    text-[0.65rem]
                    uppercase
                    tracking-[0.2em]
                    text-white/45
                  "
                >
                  Custom inquiry
                </p>

                <h2
                  className="
                    mt-2
                    text-xl
                    font-light
                    leading-tight
                    text-white
                    sm:text-2xl
                  "
                >
                  Have something different in mind?
                </h2>

                <p
                  className="
                    mt-3
                    text-xs
                    leading-relaxed
                    text-white/60
                  "
                >
                  Every project is unique. Feel free
                  to tell me what you&apos;re working
                  on, even if it doesn&apos;t fit one
                  of the options above. We can find
                  the best way to bring your idea to
                  life.
                </p>

                <Link
                  href="/contact"
                  className="
                    mt-5
                    inline-flex
                    w-fit
                    items-center
                    gap-2
                    rounded-full
                    border
                    border-white/20
                    bg-white/10
                    px-5
                    py-2.5
                    text-xs
                    uppercase
                    tracking-[0.14em]
                    text-white
                    transition
                    duration-200
                    hover:bg-white
                    hover:text-[#2f3558]
                  "
                >
                  Send an inquiry

                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M5 12h14" />
                    <path d="m13 6 6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}