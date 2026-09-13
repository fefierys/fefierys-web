'use client';

import {
  useEffect,
  useState,
} from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type TermsContentBlock =
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'list';
      items: string[];
    }
  | {
      type: 'subheading';
      number: string;
      title: string;
    }
  | {
      type: 'numbered-list';
      items: string[];
    };

interface TermsSubsection {
  id: string;
  number: string;
  title: string;
  content: TermsContentBlock[];
}

interface TermsSection {
  id: string;
  number: string;
  title: string;
  subsections: TermsSubsection[];
}

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
}

/*
 * ============================================================
 * TERMS CONTENT
 * ============================================================
 */

const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'booking-payment',
    number: '1',
    title: 'Booking & Payment',
    subsections: [
      {
        id: 'booking-options',
        number: '1.1',
        title: 'Booking Options',
        content: [
          {
            type: 'paragraph',
            text:
              'You can book a commission through Behance, Ko-fi, or by contacting me directly and arranging payment through PayPal.',
          },
        ],
      },
      {
        id: 'quote-response-period',
        number: '1.2',
        title: 'Quote Response Period',
        content: [
          {
            type: 'paragraph',
            text:
              'Once I send you a quote, you have one week to respond by accepting it, rejecting it, or requesting a revised quote.',
          },
          {
            type: 'paragraph',
            text:
              'If you would like to change any part of the proposed scope, pricing, or conditions, you can let me know during this period so we can discuss a revised quote.',
          },
        ],
      },
      {
        id: 'payment-schedule',
        number: '1.3',
        title: 'Payment Schedule',
        content: [
          {
            type: 'paragraph',
            text:
              'A portion of the payment is required upfront, and the remaining balance is due upon receipt of the sketch.',
          },
          {
            type: 'list',
            items: [
              'Small projects under $100: 100% upfront',
              'Medium projects: 50% upfront',
              'Large projects ($1000+): 40% upfront',
            ],
          },
          {
            type: 'paragraph',
            text:
              'The specific project fee, payment amounts, payment stages, and payment method will be stated in your Commission Agreement when applicable.',
          },
        ],
      },
      {
        id: 'payment-deadlines',
        number: '1.4',
        title: 'Payment Deadlines',
        content: [
          {
            type: 'paragraph',
            text:
              'By accepting the quote, you agree to make each payment at the stages previously established for your project.',
          },
          {
            type: 'paragraph',
            text:
              'For each payment stage, you have 48 hours from the time I request the payment to complete it.',
          },
          {
            type: 'paragraph',
            text:
              'If you are unable to make the payment within that timeframe, you have one week to contact me and let me know when you will be able to make it.',
          },
          {
            type: 'paragraph',
            text:
              'If I do not receive a response from you within that period, I may cancel the commission.',
          },
        ],
      },
    ],
  },

  {
    id: 'delivery-time',
    number: '2',
    title: 'Delivery Time',
    subsections: [
      {
        id: 'standard-turnaround-time',
        number: '2.1',
        title: 'Standard Turnaround Time',
        content: [
          {
            type: 'paragraph',
            text:
              'My standard turnaround time ranges from one week to one month, depending on the complexity of the artwork.',
          },
          {
            type: 'paragraph',
            text:
              'For larger or more complex projects, I will discuss the estimated timeline with you directly before the project moves forward.',
          },
        ],
      },
    ],
  },

  {
    id: 'refunds-cancellation',
    number: '3',
    title: 'Refunds & Cancellation',
    subsections: [
      {
        id: 'refund-policy',
        number: '3.1',
        title: 'Refund Policy',
        content: [
          {
            type: 'paragraph',
            text:
              'All payments are final and non-refundable once I have received them.',
          },
          {
            type: 'paragraph',
            text:
              'A refund will only be issued in the exceptional event that I am unable to complete and deliver your commission due to force majeure or unforeseen personal circumstances.',
          },
          {
            type: 'paragraph',
            text:
              'If this happens, I will notify you and issue a full refund.',
          },
        ],
      },
      {
        id: 'cancellation-right',
        number: '3.2',
        title: 'Cancellation Right',
        content: [
          {
            type: 'paragraph',
            text:
              'I reserve the right to decline, pause, or cancel a commission if you display disrespectful or abusive behavior, or if the scope of the project changes drastically from what we originally agreed upon.',
          },
          {
            type: 'paragraph',
            text:
              'If I cancel the commission because of a breach of these Terms, inappropriate conduct, or another issue resulting from your actions, no refund will be issued for work that has already been completed or is currently in progress.',
          },
        ],
      },
    ],
  },

  {
    id: 'brief-revisions',
    number: '4',
    title: 'Brief & Revisions',
    subsections: [
      {
        id: 'brief-references',
        number: '4.1',
        title: 'Brief & References',
        content: [
          {
            type: 'paragraph',
            text:
              'To create your illustration, I will need a clear description of the project and/or reference images.',
          },
          {
            type: 'paragraph',
            text:
              'Pinterest boards, mood boards, visual references, character references, and similar materials are always very helpful and can make it easier for me to understand the direction you have in mind.',
          },
        ],
      },
      {
        id: 'what-counts-as-revision',
        number: '4.2',
        title: 'What Counts as a Revision',
        content: [
          {
            type: 'paragraph',
            text:
              'A revision is a modification that does not require me to redo the entire sketch or significantly change the previously approved direction of the artwork.',
          },
          {
            type: 'paragraph',
            text:
              'Major changes to the concept, composition, pose, design, or other elements that have already been approved may fall outside the included revision scope.',
          },
        ],
      },
      {
        id: 'included-revisions',
        number: '4.3',
        title: 'Included Revisions',
        content: [
          {
            type: 'paragraph',
            text:
              'Your commission includes three revisions:',
          },
          {
            type: 'list',
            items: [
              'Two revisions during the sketch stage.',
              'One revision during the final stage.',
            ],
          },
        ],
      },
      {
        id: 'final-stage-revision',
        number: '4.4',
        title: 'Final-Stage Revision',
        content: [
          {
            type: 'paragraph',
            text:
              'During the final revision stage, you may request minor adjustments to elements such as color, lighting, and smaller details.',
          },
          {
            type: 'paragraph',
            text:
              'Changes that would require me to substantially redraw or redesign the artwork are not considered minor final-stage revisions.',
          },
        ],
      },
      {
        id: 'extra-revisions',
        number: '4.5',
        title: 'Extra Revisions',
        content: [
          {
            type: 'paragraph',
            text:
              'Any additional revisions beyond those included in your commission will cost $10 USD each.',
          },
        ],
      },
    ],
  },

  {
    id: 'personal-commercial-use',
    number: '5',
    title: 'Personal & Commercial Use',
    subsections: [
      {
        id: 'personal-use',
        number: '5.1',
        title: 'Personal Use',
        content: [
          {
            type: 'paragraph',
            text:
              'Unless commercial rights are explicitly requested and purchased, the artwork is licensed for personal use only, with proper credit to me.',
          },
        ],
      },
      {
        id: 'standard-commercial-license',
        number: '5.2',
        title:
          'Standard Commercial License — General / Non-Book Projects',
        content: [
          {
            type: 'paragraph',
            text:
              'For commercial projects outside of book publishing, such as album covers, video games, branding, streaming, or web media, you receive a commercial usage license for the specific project for which the artwork was commissioned.',
          },
          {
            type: 'subheading',
            number: '5.2.1',
            title: 'Scope',
          },
          {
            type: 'paragraph',
            text:
              'The license may be non-exclusive or exclusive, as agreed upon, and includes digital and print promotional materials related to the specified project.',
          },
          {
            type: 'subheading',
            number: '5.2.2',
            title: 'Duration',
          },
          {
            type: 'paragraph',
            text:
              'The license is valid for 3 years from the delivery date and may be renewed upon expiration.',
          },
          {
            type: 'subheading',
            number: '5.2.3',
            title: 'Limitations',
          },
          {
            type: 'paragraph',
            text:
              'The standard commercial license does not include the manufacture or sale of physical merchandise featuring the artwork unless you purchase a separate Merchandising License.',
          },
        ],
      },
      {
        id: 'book-publishing-license',
        number: '5.3',
        title: 'Book Publishing License',
        content: [
          {
            type: 'paragraph',
            text:
              'For artwork created specifically for book covers or interior book illustrations, the applicable publishing license covers the specific book title for which the artwork was commissioned.',
          },
          {
            type: 'paragraph',
            text:
              'The license includes use of the artwork in printed books, digital/e-book editions, and audiobook formats.',
          },
          {
            type: 'subheading',
            number: '5.3.1',
            title: 'Indie / Self-Published Authors',
          },
          {
            type: 'paragraph',
            text:
              'If you are an indie or self-published author, the publishing license remains valid for as long as the specified book title remains published and commercially available.',
          },
          {
            type: 'subheading',
            number: '5.3.2',
            title: 'Traditional Publishers',
          },
          {
            type: 'paragraph',
            text:
              'If you are publishing through a traditional publisher, the publishing license is valid for 3 years from the publication date and may be renewed upon expiration.',
          },
          {
            type: 'subheading',
            number: '5.3.3',
            title: 'Promotional Rights',
          },
          {
            type: 'paragraph',
            text:
              'The publishing license includes unlimited promotional use directly associated with marketing the specified book.',
          },
          {
            type: 'paragraph',
            text:
              'This may include materials such as social media banners, website headers, promotional flyers, and bookmarks.',
          },
          {
            type: 'paragraph',
            text:
              'This promotional use does not include merchandise intended for commercial resale.',
          },
          {
            type: 'subheading',
            number: '5.3.4',
            title:
              'Exclusivity for the Specified Book',
          },
          {
            type: 'paragraph',
            text:
              'For commissioned book cover and interior artwork, the publishing license is exclusive to the specified book title.',
          },
          {
            type: 'paragraph',
            text:
              'I will not license the same commissioned artwork for use as the cover or interior artwork of another book while your publishing license remains active.',
          },
          {
            type: 'paragraph',
            text:
              'The license does not transfer ownership of the artwork or its copyright to you.',
          },
        ],
      },
      {
        id: 'merchandising-license',
        number: '5.4',
        title: 'Merchandising License — Add-On',
        content: [
          {
            type: 'paragraph',
            text:
              'A separate Merchandising License is required if you intend to use the artwork to manufacture physical commercial goods for sale, such as apparel, posters, prints, stickers, pins, mugs, or similar products.',
          },
          {
            type: 'subheading',
            number: '5.4.1',
            title: 'Fee',
          },
          {
            type: 'paragraph',
            text:
              'The Merchandising License fee is +$200 USD per artwork, or as otherwise quoted for the specific project.',
          },
          {
            type: 'subheading',
            number: '5.4.2',
            title:
              'Duration & Production Volume',
          },
          {
            type: 'paragraph',
            text:
              'The Merchandising License is valid for 3 years or up to a maximum production run of 1,000 total physical units, whichever comes first.',
          },
          {
            type: 'subheading',
            number: '5.4.3',
            title: 'Extensions',
          },
          {
            type: 'paragraph',
            text:
              'Manufacturing beyond 1,000 units or continuing sales after the 3-year license period requires a license renewal.',
          },
        ],
      },
      {
        id: 'license-restrictions',
        number: '5.5',
        title:
          'License Restrictions & Usage Rules',
        content: [
          {
            type: 'paragraph',
            text:
              'Unless I explicitly grant permission in writing, you may not:',
          },
          {
            type: 'numbered-list',
            items: [
              'Resell, sublicense, or redistribute the artwork or its source/editable files to third parties.',
              'Use the artwork for a different project, book title, or product from the one for which it was originally commissioned.',
              'Claim authorship of the artwork or register the artwork, in whole or in part, as a trademark or logo without a separate written agreement.',
              'Use, upload, process, or provide the artwork to Artificial Intelligence (AI) models, generators, datasets, or similar systems, as further described in Section 7 — No Generative AI Policy.',
            ],
          },
        ],
      },
    ],
  },

  {
    id: 'copyright-promotion-confidentiality',
    number: '6',
    title: 'Copyright, Promotion & Confidentiality',
    subsections: [
      {
        id: 'copyright-ownership',
        number: '6.1',
        title: 'Copyright & Ownership',
        content: [
          {
            type: 'paragraph',
            text:
              'I retain the copyright and ownership rights to all artwork I create, except for the specific usage rights granted to you under the applicable license.',
          },
          {
            type: 'paragraph',
            text:
              'Receiving a personal, commercial, publishing, or merchandising license does not transfer copyright ownership of the artwork to you.',
          },
        ],
      },
      {
        id: 'portfolio-promotion',
        number: '6.2',
        title: 'Portfolio & Promotion',
        content: [
          {
            type: 'paragraph',
            text:
              'I retain the right to display the artwork and its creative process in my professional portfolio, website, social media, art books, and other self-promotional materials.',
          },
        ],
      },
      {
        id: 'confidentiality-hold-dates',
        number: '6.3',
        title: 'Confidentiality & Hold Dates',
        content: [
          {
            type: 'paragraph',
            text:
              'If you need the artwork to remain private, confidential, or unpublished until a specific date, you must let me know before the project begins.',
          },
          {
            type: 'paragraph',
            text:
              'Any confidentiality requirement, publication restriction, or hold date that applies specifically to your project will be stated in the Commission Agreement.',
          },
        ],
      },
      {
        id: 'portfolio-style-updates',
        number: '6.4',
        title: 'Portfolio Style Updates',
        content: [
          {
            type: 'paragraph',
            text:
              'From time to time, I may update older illustrations in my portfolio to better reflect the evolution of my current artistic style.',
          },
          {
            type: 'paragraph',
            text:
              'If one of your commissioned pieces is updated, you are welcome to check whether a newer portfolio version is available. 💜',
          },
        ],
      },
    ],
  },

  {
    id: 'no-generative-ai-policy',
    number: '7',
    title: 'No Generative AI Policy',
    subsections: [
      {
        id: 'human-created-artwork',
        number: '7.1',
        title: '100% Human-Created Artwork',
        content: [
          {
            type: 'paragraph',
            text:
              'All illustrations, artwork, and design assets I provide are 100% human-created and hand-crafted.',
          },
          {
            type: 'paragraph',
            text:
              'I do not use generative Artificial Intelligence (AI), automated image generators, or machine-learning image-generation tools at any stage of my creative process, including ideation, sketching, line art, coloring, or final rendering.',
          },
          {
            type: 'paragraph',
            text:
              'Every piece I deliver is an original work created by me using manual digital art techniques.',
          },
        ],
      },
      {
        id: 'ai-training-processing',
        number: '7.2',
        title: 'AI Training & Processing Restrictions',
        content: [
          {
            type: 'paragraph',
            text:
              'You agree not to upload, process, submit, host, feed, or otherwise provide any part of the commissioned artwork, sketches, preliminary work, or final deliverables to generative AI tools, machine-learning models, image-generation datasets, or similar algorithms without my explicit prior written consent.',
          },
          {
            type: 'paragraph',
            text:
              'This restriction applies to the artwork in whole or in part and includes use for AI training, model development, image generation, dataset creation, or similar purposes.',
          },
        ],
      },
    ],
  },

  {
    id: 'additional-pricing',
    number: '8',
    title: 'Additional Pricing & Custom Quotes',
    subsections: [
      {
        id: 'complexity-fees',
        number: '8.1',
        title: 'Complexity Fees',
        content: [
          {
            type: 'paragraph',
            text:
              'The base prices listed on my website apply to standard designs and project requirements.',
          },
          {
            type: 'paragraph',
            text:
              'If your request involves highly detailed characters, complex environments, unusual technical requirements, or significantly more work than the standard scope, I may apply an additional complexity fee.',
          },
          {
            type: 'paragraph',
            text:
              'Any additional fee will be discussed with you before you accept the quote.',
          },
        ],
      },
      {
        id: 'custom-quotes',
        number: '8.2',
        title: 'Custom Quotes',
        content: [
          {
            type: 'paragraph',
            text:
              'If your project does not fit one of the services or options listed on my website, you are always welcome to request a custom quote!',
          },
          {
            type: 'paragraph',
            text:
              'I will review your project requirements and prepare pricing based on its specific scope and complexity.',
          },
        ],
      },
    ],
  },
];

/*
 * ============================================================
 * CHEVRON
 * ============================================================
 */

function ChevronIcon({
  open,
}: {
  open: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`
        h-4
        w-4
        shrink-0
        transition-transform
        duration-300
        ${open ? 'rotate-180' : ''}
      `}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/*
 * ============================================================
 * MODAL
 * ============================================================
 */

export default function TermsModal({
  open,
  onClose,
}: TermsModalProps) {
  const [
    openSection,
    setOpenSection,
  ] = useState<string | null>(null);

  const [
    openSubsection,
    setOpenSubsection,
  ] = useState<string | null>(null);

  /*
   * ESC key support.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [open, onClose]);

  function toggleSection(
    sectionId: string,
  ) {
    setOpenSection((current) => {
      if (current === sectionId) {
        setOpenSubsection(null);
        return null;
      }

      setOpenSubsection(null);
      return sectionId;
    });
  }

  function toggleSubsection(
    subsectionId: string,
  ) {
    setOpenSubsection((current) =>
      current === subsectionId
        ? null
        : subsectionId,
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="
            fixed
            inset-0
            z-50

            flex
            items-center
            justify-center

            bg-[#6b6fa8]/85

            p-3
            sm:p-6
          "
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: 0,
          }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-title"
            className="
              relative

              flex
              max-h-[94dvh]
              w-full
              max-w-4xl
              flex-col

              overflow-hidden

              rounded-[2rem]
              border
              border-white/10

              bg-[#4a4594]/45
              text-white
              backdrop-blur-2xl

              shadow-[0_30px_80px_rgba(30,35,90,0.35)]
            "
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: 8,
            }}
            transition={{
              duration: 0.22,
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* ===============================================
                CLOSE
            =============================================== */}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close terms"
              className="
                absolute
                right-3
                top-3
                z-20

                flex
                h-10
                w-10
                items-center
                justify-center

                rounded-full
                bg-white/[0.06]

                text-2xl
                font-light
                leading-none
                text-white/60

                transition

                hover:bg-white/10
                hover:text-white

                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-white/40
              "
            >
              ×
            </button>

            {/* ===============================================
                HEADER
            =============================================== */}

            <header
              className="
                shrink-0
                border-b
                border-white/10

                px-5
                pb-5
                pt-6

                sm:px-7
                sm:pb-6
                sm:pt-7
              "
            >
              <div className="pr-12">
                <p
                  className="
                    text-[0.65rem]
                    uppercase
                    tracking-[0.22em]
                    text-white/45
                  "
                >
                  Commission Terms
                </p>

                <h2
                  id="terms-title"
                  className="
                    mt-1
                    text-3xl
                    font-light
                    text-white
                    sm:text-4xl
                  "
                >
                  Terms of Service
                </h2>

                <p
                  className="
                    mt-3
                    max-w-2xl
                    text-xs
                    leading-relaxed
                    text-white/65
                    sm:text-sm
                  "
                >
                  These terms are here to
                  make the commission
                  process clear,
                  transparent, and
                  enjoyable for both of us.
                </p>
              </div>

              <div
                className="
                  mt-4
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.04]
                  px-4
                  py-3
                "
              >
                <p
                  className="
                    text-xs
                    italic
                    leading-relaxed
                    text-white/65
                  "
                >
                  All my commissions are
                  delivered digitally. The
                  resolution and file format
                  will depend on your
                  project&apos;s specific needs.
                </p>
              </div>
            </header>

            {/* ===============================================
                SCROLLABLE CONTENT
            =============================================== */}

            <div
              className="
                min-h-0
                flex-1
                overflow-y-auto
                overscroll-contain

                px-3
                py-4

                sm:px-5
                sm:py-5
              "
            >
              <div className="space-y-3">
                {TERMS_SECTIONS.map(
                  (section) => {
                    const sectionOpen =
                      openSection ===
                      section.id;

                    return (
                      <section
                        key={section.id}
                        className="
                          overflow-hidden
                          rounded-2xl
                          border
                          border-white/10
                          bg-white/[0.035]
                        "
                      >
                        {/* =================================
                            MAIN SECTION
                        ================================= */}

                        <button
                          type="button"
                          onClick={() =>
                            toggleSection(
                              section.id,
                            )
                          }
                          aria-expanded={
                            sectionOpen
                          }
                          className="
                            flex
                            w-full
                            items-center
                            justify-between
                            gap-4

                            px-4
                            py-4
                            text-left

                            transition

                            hover:bg-white/[0.04]

                            sm:px-5
                          "
                        >
                          <div
                            className="
                              flex
                              min-w-0
                              items-center
                              gap-3
                            "
                          >
                            <span
                              className="
                                flex
                                h-8
                                w-8
                                shrink-0
                                items-center
                                justify-center

                                rounded-full
                                border
                                border-white/10
                                bg-white/[0.04]

                                text-xs
                                text-white/55
                              "
                            >
                              {
                                section.number
                              }
                            </span>

                            <h3
                              className="
                                text-sm
                                font-normal
                                uppercase
                                tracking-[0.08em]
                                text-white/85
                                sm:text-base
                              "
                            >
                              {
                                section.title
                              }
                            </h3>
                          </div>

                          <ChevronIcon
                            open={
                              sectionOpen
                            }
                          />
                        </button>

                        {/* =================================
                            MAIN SECTION CONTENT
                        ================================= */}

                        <div
                          className={`
                            grid
                            transition-[grid-template-rows]
                            duration-300
                            ease-out

                            ${
                              sectionOpen
                                ? 'grid-rows-[1fr]'
                                : 'grid-rows-[0fr]'
                            }
                          `}
                        >
                          <div className="overflow-hidden">
                            <div
                              className="
                                space-y-2
                                border-t
                                border-white/10
                                p-3
                                sm:p-4
                              "
                            >
                              {section.subsections.map(
                                (
                                  subsection,
                                ) => {
                                  const subsectionId =
                                    `${section.id}-${subsection.id}`;

                                  const subsectionOpen =
                                    openSubsection ===
                                    subsectionId;

                                  return (
                                    <div
                                      key={
                                        subsection.id
                                      }
                                      className="
                                        overflow-hidden
                                        rounded-xl
                                        border
                                        border-white/[0.08]
                                        bg-black/[0.06]
                                      "
                                    >
                                      {/* =====================
                                          SUBSECTION
                                      ===================== */}

                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleSubsection(
                                            subsectionId,
                                          )
                                        }
                                        aria-expanded={
                                          subsectionOpen
                                        }
                                        className="
                                          flex
                                          w-full
                                          items-center
                                          justify-between
                                          gap-4

                                          px-4
                                          py-3
                                          text-left

                                          transition

                                          hover:bg-white/[0.035]
                                        "
                                      >
                                        <div
                                          className="
                                            flex
                                            min-w-0
                                            items-start
                                            gap-3
                                          "
                                        >
                                          <span
                                            className="
                                              mt-0.5
                                              shrink-0

                                              text-[0.65rem]
                                              tracking-wide
                                              text-white/35
                                            "
                                          >
                                            {
                                              subsection.number
                                            }
                                          </span>

                                          <h4
                                            className="
                                              text-sm
                                              font-normal
                                              text-white/75
                                            "
                                          >
                                            {
                                              subsection.title
                                            }
                                          </h4>
                                        </div>

                                        <ChevronIcon
                                          open={
                                            subsectionOpen
                                          }
                                        />
                                      </button>

                                      {/* =====================
                                          SUBSECTION CONTENT
                                      ===================== */}

                                      <div
                                        className={`
                                          grid
                                          transition-[grid-template-rows]
                                          duration-300
                                          ease-out

                                          ${
                                            subsectionOpen
                                              ? 'grid-rows-[1fr]'
                                              : 'grid-rows-[0fr]'
                                          }
                                        `}
                                      >
                                        <div className="overflow-hidden">
                                          <div
                                            className="
                                              space-y-3
                                              border-t
                                              border-white/[0.08]

                                              px-4
                                              py-4

                                              text-xs
                                              leading-relaxed
                                              text-white/65

                                              sm:text-sm
                                            "
                                          >
                                            {subsection.content.map(
                                              (
                                                block,
                                                index,
                                              ) => {
                                                if (
                                                  block.type ===
                                                  'subheading'
                                                ) {
                                                  return (
                                                    <div
                                                      key={
                                                        index
                                                      }
                                                      className="
                                                        pt-1
                                                      "
                                                    >
                                                      <p
                                                        className="
                                                          text-[0.65rem]
                                                          tracking-wide
                                                          text-white/35
                                                        "
                                                      >
                                                        {
                                                          block.number
                                                        }
                                                      </p>

                                                      <p
                                                        className="
                                                          mt-0.5
                                                          text-sm
                                                          font-normal
                                                          text-white/80
                                                        "
                                                      >
                                                        {
                                                          block.title
                                                        }
                                                      </p>
                                                    </div>
                                                  );
                                                }

                                                if (
                                                  block.type ===
                                                  'numbered-list'
                                                ) {
                                                  return (
                                                    <ol
                                                      key={
                                                        index
                                                      }
                                                      className="
                                                        list-decimal
                                                        space-y-2
                                                        pl-5
                                                      "
                                                    >
                                                      {block.items.map(
                                                        (
                                                          item,
                                                        ) => (
                                                          <li
                                                            key={
                                                              item
                                                            }
                                                            className="
                                                              pl-1
                                                            "
                                                          >
                                                            {
                                                              item
                                                            }
                                                          </li>
                                                        ),
                                                      )}
                                                    </ol>
                                                  );
                                                }

                                                if (
                                                  block.type ===
                                                  'list'
                                                ) {
                                                  return (
                                                    <ul
                                                      key={
                                                        index
                                                      }
                                                      className="
                                                        space-y-1.5
                                                        pl-4
                                                      "
                                                    >
                                                      {block.items.map(
                                                        (
                                                          item,
                                                        ) => (
                                                          <li
                                                            key={
                                                              item
                                                            }
                                                            className="
                                                              list-disc
                                                              pl-1
                                                            "
                                                          >
                                                            {
                                                              item
                                                            }
                                                          </li>
                                                        ),
                                                      )}
                                                    </ul>
                                                  );
                                                }

                                                return (
                                                  <p
                                                    key={
                                                      index
                                                    }
                                                  >
                                                    {
                                                      block.text
                                                    }
                                                  </p>
                                                );
                                              },
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        </div>
                      </section>
                    );
                  },
                )}
              </div>
            </div>

            {/* ===============================================
                FOOTER
            =============================================== */}

            <footer
              className="
                shrink-0
                border-t
                border-white/10
                bg-[#4a4594]/2
                p-3
                sm:p-4
              "
            >
              <button
                type="button"
                onClick={onClose}
                className="
                  w-full
                  rounded-full
                  border
                  border-white/20
                  bg-white/10

                  px-6
                  py-3

                  text-xs
                  uppercase
                  tracking-[0.15em]
                  text-white

                  transition
                  duration-150

                  hover:bg-white
                  hover:text-[#2f3558]

                  focus:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-white/40
                "
              >
                Close
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}