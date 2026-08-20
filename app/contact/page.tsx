import type { Metadata } from "next";
import ContactForm from '@/components/contact/ContactForm';

export const metadata: Metadata = {
  title: "Fantasy Art Commissions",

  description:
    "Contact Fefierys to request a custom fantasy illustration, character artwork, book art, chibi, emote, or other digital art commission.",

  alternates: {
    canonical: "/contact",
  },

  openGraph: {
    title: "Fantasy Art Commissions | Fefierys",

    description:
      "Request a custom fantasy illustration, character artwork, book art, chibi, emote, or digital art commission from Fefierys.",

    url: "/contact",
  },
};

interface ContactPageProps {
  searchParams: Promise<{
    style?: string;
    collection?: string;
    category?: string;
    option?: string;
    sent?: string;
  }>;
}

export default async function ContactPage({
  searchParams,
}: ContactPageProps) {
  const { style, collection, category, option, sent } =
    await searchParams;

  const hasCommission =
    !!style && !!collection && !!category && !!option;

  const initialMessage = hasCommission
    ? `Hello Fefierys,

I'd like to commission a ${style} / ${collection} / ${category} illustration.

Selected option: ${option}

Project details:
`
    : '';

  return (
    <section className="min-h-screen px-6 py-32">
      <div className="mx-auto max-w-3xl text-white">
        <h1 className="mb-10 text-center text-5xl font-light">
          Contact
        </h1>

        {sent === '1' ? (
          <div
            className="
              rounded-3xl border border-white/10 bg-white/10
              p-8 backdrop-blur-2xl
              shadow-[0_20px_60px_rgba(70,70,120,0.18)]
            "
          >
            <h2 className="mb-2 text-2xl font-light text-white">
              Thank you for reaching out
            </h2>

            <p className="leading-relaxed text-white/80">
              Your commission inquiry has been received successfully.
              I&apos;ll review the details of your request and get back
              to you as soon as possible.
            </p>
          </div>
        ) : (
          <>
            {hasCommission && (
              <div
                className="
                  mb-10
                  rounded-3xl
                  border border-white/10
                  bg-white/10
                  p-4
                  backdrop-blur-2xl
                  shadow-[0_20px_60px_rgba(70,70,120,0.20)]
                "
              >
                <h2 className="mb-1 text-xl font-light">
                  Your commission
                </h2>

                <p className="mb-4 text-sm text-white/70">
                  We&apos;ll use this selection to prepare your inquiry.
                </p>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/6 p-4">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
                      Style
                    </p>
                    <p className="text-base font-medium">{style}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/6 p-4">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
                      Collection
                    </p>
                    <p className="text-base font-medium">{collection}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/6 p-4">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
                      Category
                    </p>
                    <p className="text-base font-medium">{category}</p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/6 p-4">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
                      Selected option
                    </p>
                    <p className="text-base font-medium">{option}</p>
                  </div>
                </div>
              </div>
            )}

            <ContactForm
              style={style}
              collection={collection}
              category={category}
              option={option}
              initialMessage={initialMessage}
            />
          </>
        )}
      </div>
    </section>
  );
}