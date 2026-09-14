"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  PublicCommissionGroup,
  PublicCommissionService,
  PublicCommissionStyle,
} from "@/lib/commissions/publicCommissionCatalog";

interface CommissionCatalogProps {
  groups: PublicCommissionGroup[];
}

interface ChevronIconProps {
  open?: boolean;
  className?: string;
}

/*
 * ============================================================
 * CONTACT CLASSIFICATION
 * ============================================================
 *
 * These values preserve the same classification currently
 * used by Contact / the commission dashboard.
 */

const contactStyleLabels: Record<
  PublicCommissionStyle,
  string
> = {
  "semi-realism": "SEMIREALISM",
  stylized: "STYLIZED",
  "chibis-emotes": "CHIBIS - EMOTES",
};

const contactClassificationByServiceId: Record<
  string,
  {
    collection: string;
    category: string;
  }
> = {
  "book-covers": {
    collection: "BOOK ART",
    category: "COVERS",
  },

  "interior-illustrations": {
    collection: "BOOK ART",
    category: "INTERIOR ILLUSTRATION",
  },

  "character-design": {
    collection: "GENERAL",
    category: "CHARACTER DESIGN",
  },

  "character-illustrations": {
    collection: "GENERAL",
    category: "CHARACTER ILLUSTRATIONS",
  },

  "reference-sheets": {
    collection: "GENERAL",
    category: "REF SHEETS",
  },

  icons: {
    collection: "GENERAL",
    category: "ICONS",
  },

  environments: {
    collection: "GENERAL",
    category: "ENVIRONMENTS",
  },

  "pet-illustrations": {
    collection: "GENERAL",
    category: "PETS",
  },

  chibis: {
    collection: "CHIBIS",
    category: "CHARACTERS",
  },

  emotes: {
    collection: "EMOTES",
    category: "CUSTOM",
  },
};

/*
 * ============================================================
 * CHEVRON
 * ============================================================
 */

function ChevronIcon({
  open = false,
  className = "",
}: ChevronIconProps) {
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
        ${open ? "rotate-180" : ""}
        ${className}
      `}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/*
 * ============================================================
 * GROUP ICONS
 * ============================================================
 */

function GroupIcon({
  groupId,
}: {
  groupId: string;
}) {
  const commonClass =
    "h-7 w-7 shrink-0 text-white/80";

  switch (groupId) {
    case "book-publishing":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={commonClass}
        >
          <path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H11v16H5.5A2.5 2.5 0 0 0 3 21.5v-16Z" />
          <path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H13v16h5.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
        </svg>
      );

    case "character-art":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={commonClass}
        >
          <circle
            cx="12"
            cy="7"
            r="4"
          />

          <path d="M4.5 21c.6-4.7 3.2-7 7.5-7s6.9 2.3 7.5 7" />
        </svg>
      );

    case "environments-scenery":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={commonClass}
        >
          <circle
            cx="17.5"
            cy="6.5"
            r="2.5"
          />

          <path d="m3 20 6-9 4 5 2.5-3 5.5 7H3Z" />
        </svg>
      );

    case "pets-creatures":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
          className={commonClass}
        >
          <ellipse
            cx="12"
            cy="15.3"
            rx="4.3"
            ry="3.7"
          />

          <ellipse
            cx="6.4"
            cy="10"
            rx="2"
            ry="2.7"
            transform="rotate(-25 6.4 10)"
          />

          <ellipse
            cx="17.6"
            cy="10"
            rx="2"
            ry="2.7"
            transform="rotate(25 17.6 10)"
          />

          <ellipse
            cx="9"
            cy="6.5"
            rx="1.8"
            ry="2.4"
            transform="rotate(-10 9 6.5)"
          />

          <ellipse
            cx="15"
            cy="6.5"
            rx="1.8"
            ry="2.4"
            transform="rotate(10 15 6.5)"
          />
        </svg>
      );

    case "chibis-emotes":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={commonClass}
        >
          <circle
            cx="12"
            cy="12"
            r="9"
          />

          <circle
            cx="9"
            cy="10"
            r=".8"
            fill="currentColor"
          />

          <circle
            cx="15"
            cy="10"
            r=".8"
            fill="currentColor"
          />

          <path d="M8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8" />

          <path d="m5.8 5.8 1.3-2.1 1.5 1.8" />

          <path d="m18.2 5.8-1.3-2.1-1.5 1.8" />
        </svg>
      );

    default:
      return null;
  }
}

/*
 * ============================================================
 * INITIAL STYLE
 * ============================================================
 */

function getInitialStyles(
  groups: PublicCommissionGroup[],
): Record<
  string,
  PublicCommissionStyle
> {
  const result: Record<
    string,
    PublicCommissionStyle
  > = {};

  for (const group of groups) {
    for (const service of group.services) {
      const firstVariant =
        service.variants[0];

      if (firstVariant) {
        result[service.id] =
          firstVariant.style;
      }
    }
  }

  return result;
}

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

function Service({
  service,
  open,
  onToggle,
  selectedStyle,
  onStyleChange,
}: {
  service: PublicCommissionService;
  open: boolean;
  onToggle: (
    trigger: HTMLButtonElement,
  ) => void;
  selectedStyle: PublicCommissionStyle;
  onStyleChange: (
    style: PublicCommissionStyle,
  ) => void;
}) {
  const [
    selectedOption,
    setSelectedOption,
  ] = useState<string | null>(null);

  const selectedVariant =
    service.variants.find(
      (variant) =>
        variant.style === selectedStyle,
    ) ?? service.variants[0];

  if (!selectedVariant) {
    return null;
  }

  const commission =
    selectedVariant.data;

  const firstPrice =
    commission.options[0]?.price ?? null;

  /*
   * Classification sent to Contact.
   */

  const classification =
    contactClassificationByServiceId[
      service.id
    ] ?? {
      collection: "GENERAL",
      category:
        service.title.toUpperCase(),
    };

  const contactStyle =
    contactStyleLabels[
      selectedVariant.style
    ];

  const contactHref = selectedOption
    ? {
        pathname: "/contact",
        query: {
          style: contactStyle,
          collection:
            classification.collection,
          category:
            classification.category,
          option: selectedOption,
        },
      }
    : null;

  return (
    <section
      id={service.id}
      className="
        scroll-mt-32
        overflow-hidden
        rounded-[1.5rem]
        border
        border-white/10
        bg-white/[0.045]
        transition
        duration-300
        hover:border-white/15
      "
    >
      {/* =====================================================
          SERVICE HEADER
      ===================================================== */}

      <button
        type="button"
        onClick={(event) =>
          onToggle(event.currentTarget)
        }
        aria-expanded={open}
        className="
          group
          flex
          w-full
          items-center
          justify-between
          gap-3
          p-4
          text-left
          sm:p-5
        "
      >
        {/* NAME */}

        <div className="min-w-0 flex-1">
          <h3
            className="
              text-lg
              font-light
              text-white
              sm:text-xl
            "
          >
            {service.title}
          </h3>
        </div>

        {/* PRICE + EXPAND */}

        <div
          className="
            flex
            shrink-0
            flex-col
            items-end
            gap-2
          "
        >
          {firstPrice && (
            <span
              className="
                text-[0.7rem]
                tracking-wide
                text-white/55
                sm:text-xs
              "
            >
              start at {firstPrice}
            </span>
          )}

          <span
            className="
              inline-flex
              items-center
              gap-1.5
              rounded-full
              border
              border-white/10
              bg-white/[0.045]
              px-3
              py-1.5
              text-[0.65rem]
              tracking-wide
              text-white/60
              transition
              duration-200
              group-hover:bg-white/10
              sm:text-[0.7rem]
            "
          >
            <span className="hidden sm:inline">
              {open
                ? "Hide details"
                : "See details"}
            </span>

            <ChevronIcon open={open} />
          </span>
        </div>
      </button>

      {/* =====================================================
          SERVICE CONTENT
      ===================================================== */}

      <div
        className={`
          grid
          transition-[grid-template-rows]
          duration-300
          ease-out
          ${
            open
              ? "grid-rows-[1fr]"
              : "grid-rows-[0fr]"
          }
        `}
      >
        <div className="overflow-hidden">
          <div
            className="
              border-t
              border-white/10
              px-4
              pb-5
              pt-5
              sm:px-5
              sm:pb-6
            "
          >
            {/* =================================================
                STYLE + DESCRIPTION + ARTWORK
            ================================================= */}

            <div
              className="
                mb-5
                grid
                gap-4
                md:grid-cols-[0.9fr_1.1fr]
              "
            >
              {/* LEFT */}

              <div
                className="
                  flex
                  flex-col
                  justify-center
                  rounded-2xl
                  border
                  border-white/10
                  bg-white/[0.025]
                  p-4
                  sm:p-5
                "
              >
                {service.variants.length >
                  1 && (
                  <div className="mb-5">
                    <p
                      className="
                        mb-2
                        text-[0.65rem]
                        uppercase
                        tracking-[0.18em]
                        text-white/45
                      "
                    >
                      Style
                    </p>

                    <div
                      className="
                        inline-flex
                        rounded-full
                        border
                        border-white/10
                        bg-black/10
                        p-1
                      "
                    >
                      {service.variants.map(
                        (variant) => {
                          const selected =
                            variant.style ===
                            selectedVariant.style;

                          return (
                            <button
                              key={
                                variant.style
                              }
                              type="button"
                              onClick={() => {
                                /*
                                 * A different style can have
                                 * different pricing options.
                                 *
                                 * Reset the selected option
                                 * whenever the style changes.
                                 */
                                if (
                                  variant.style !==
                                  selectedVariant.style
                                ) {
                                  setSelectedOption(
                                    null,
                                  );
                                }

                                onStyleChange(
                                  variant.style,
                                );
                              }}
                              className={`
                                rounded-full
                                px-4
                                py-2
                                text-xs
                                transition
                                duration-200
                                ${
                                  selected
                                    ? "bg-white text-[#353a70] shadow"
                                    : "text-white/65 hover:bg-white/10 hover:text-white"
                                }
                              `}
                            >
                              {
                                variant.styleLabel
                              }
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}

                <p
                  className="
                    whitespace-pre-line
                    text-sm
                    leading-relaxed
                    text-white/70
                  "
                >
                  {commission.subtitle}
                </p>
              </div>

              {/* RIGHT */}

              <div
                className="
                  relative
                  min-h-[220px]
                  overflow-hidden
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/10
                  sm:min-h-[240px]
                "
              >
                <Image
                  src={
                    commission.heroImage
                  }
                  alt={`${commission.title} commission example`}
                  fill
                  sizes="
                    (max-width: 767px) 100vw,
                    (max-width: 1279px) 55vw,
                    460px
                  "
                  className="
                    object-contain
                    p-2
                    sm:p-3
                  "
                />
              </div>
            </div>

            {/* =================================================
                OPTION INTRO
            ================================================= */}

            <div className="mb-4">
              <p
                className="
                  text-[0.65rem]
                  uppercase
                  tracking-[0.18em]
                  text-white/45
                "
              >
                Choose an option
              </p>

              <p
                className="
                  mt-1
                  text-xs
                  leading-relaxed
                  text-white/55
                "
              >
                Select the option
                you&apos;re most interested
                in. You can discuss or
                change the details later.
              </p>
            </div>

            {/* =================================================
                PRICING OPTIONS
            ================================================= */}

            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
              "
            >
              {commission.options.map(
                (option) => {
                  const selected =
                    selectedOption ===
                    option.title;

                  return (
                    <button
                      key={option.title}
                      type="button"
                      aria-pressed={
                        selected
                      }
                      onClick={() =>
                        setSelectedOption(
                          option.title,
                        )
                      }
                      className={`
                        group/option
                        relative
                        rounded-2xl
                        border
                        p-4
                        text-left
                        transition
                        duration-200

                        ${
                          selected
                            ? "border-white/40 bg-white/[0.13] shadow-[0_8px_24px_rgba(20,25,70,0.12)]"
                            : "border-white/10 bg-white/[0.055] hover:border-white/20 hover:bg-white/[0.08]"
                        }
                      `}
                    >
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-4
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
                          {/* RADIO */}

                          <span
                            aria-hidden="true"
                            className={`
                              flex
                              h-4
                              w-4
                              shrink-0
                              items-center
                              justify-center
                              rounded-full
                              border
                              transition

                              ${
                                selected
                                  ? "border-white bg-white"
                                  : "border-white/30"
                              }
                            `}
                          >
                            {selected && (
                              <span
                                className="
                                  h-1.5
                                  w-1.5
                                  rounded-full
                                  bg-[#5966A5]
                                "
                              />
                            )}
                          </span>

                          <h4
                            className="
                              text-sm
                              font-normal
                              text-white
                            "
                          >
                            {
                              option.title
                            }
                          </h4>
                        </div>

                        <span
                          className="
                            shrink-0
                            text-sm
                            font-light
                            text-white
                          "
                        >
                          {option.price}
                        </span>
                      </div>

                      {option.description && (
                        <p
                          className="
                            mt-2
                            pl-7
                            text-xs
                            leading-relaxed
                            text-white/55
                          "
                        >
                          {
                            option.description
                          }
                        </p>
                      )}
                    </button>
                  );
                },
              )}
            </div>

            {/* =================================================
                INQUIRY CTA
            ================================================= */}

            <div
              className="
                mt-5
                rounded-2xl
                border
                border-white/10
                bg-white/[0.025]
                p-4
              "
            >
              {selectedOption &&
              contactHref ? (
                <>
                  <div
                    className="
                      flex
                      flex-col
                      gap-3
                      sm:flex-row
                      sm:items-center
                      sm:justify-between
                    "
                  >
                    <div>
                      <p
                        className="
                          text-xs
                          text-white/50
                        "
                      >
                        Selected option
                      </p>

                      <p
                        className="
                          mt-1
                          text-sm
                          text-white
                        "
                      >
                        {selectedOption}
                      </p>
                    </div>

                    <Link
                      href={contactHref}
                      className="
                        inline-flex
                        items-center
                        justify-center
                        gap-2
                        rounded-full
                        border
                        border-white/20
                        bg-white
                        px-5
                        py-2.5
                        text-xs
                        uppercase
                        tracking-[0.14em]
                        text-[#353a70]
                        transition
                        duration-200
                        hover:bg-white/90
                      "
                    >
                      Inquire about this
                      option

                      <span
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </Link>
                  </div>

                  <p
                    className="
                      mt-3
                      text-[0.7rem]
                      leading-relaxed
                      text-white/45
                    "
                  >
                    Sending an inquiry
                    does not require
                    payment or commit you
                    to a commission.
                  </p>
                </>
              ) : (
                <div
                  className="
                    flex
                    flex-col
                    gap-3
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
                  <div>
                    <p
                      className="
                        text-sm
                        text-white/70
                      "
                    >
                      Select an option to
                      continue
                    </p>

                    <p
                      className="
                        mt-1
                        text-xs
                        leading-relaxed
                        text-white/45
                      "
                    >
                      Choose the option
                      above that best
                      matches what
                      you&apos;re
                      interested in.
                    </p>
                  </div>

                  <span
                    aria-disabled="true"
                    className="
                      inline-flex
                      cursor-not-allowed
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-white/10
                      bg-white/[0.04]
                      px-5
                      py-2.5
                      text-xs
                      uppercase
                      tracking-[0.14em]
                      text-white/30
                    "
                  >
                    Select an option
                  </span>
                </div>
              )}
            </div>

            {/* =================================================
                PRICING DETAILS
            ================================================= */}

            {commission.notes.length >
              0 && (
              <details
                className="
                  group/details
                  mt-5
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/[0.06]
                  px-4
                  py-3
                "
              >
                <summary
                  className="
                    cursor-pointer
                    list-none
                    text-xs
                    tracking-wide
                    text-white/65
                    transition
                    hover:text-white
                  "
                >
                  <span
                    className="
                      flex
                      items-center
                      justify-between
                      gap-4
                    "
                  >
                    <span>
                      Pricing details &amp;
                      usage
                    </span>

                    <ChevronIcon
                      className="
                        group-open/details:rotate-180
                      "
                    />
                  </span>
                </summary>

                <div
                  className="
                    mt-4
                    space-y-4
                    border-t
                    border-white/10
                    pt-4
                  "
                >
                  {commission.notes.map(
                    (note, index) => (
                      <div key={index}>
                        <p
                          className="
                            text-xs
                            font-normal
                            text-white/80
                          "
                        >
                          {note.title}
                        </p>

                        {note.details &&
                          note.details
                            .length > 0 && (
                            <div
                              className="
                                mt-2
                                space-y-1
                                text-xs
                                leading-relaxed
                                text-white/55
                              "
                            >
                              {note.details.map(
                                (
                                  detail,
                                ) => (
                                  <p
                                    key={
                                      detail
                                    }
                                  >
                                    {
                                      detail
                                    }
                                  </p>
                                ),
                              )}
                            </div>
                          )}
                      </div>
                    ),
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/*
 * ============================================================
 * COMMISSION CATALOG
 * ============================================================
 */

export default function CommissionCatalog({
  groups,
}: CommissionCatalogProps) {
  /*
  * Default:
  *
  * All groups closed.
  * All services closed.
  */

  const [openGroups, setOpenGroups] =
    useState<string[]>([]);

  const [
    openServices,
    setOpenServices,
  ] = useState<string[]>([]);

  const [
    selectedStyles,
    setSelectedStyles,
  ] = useState<
    Record<
      string,
      PublicCommissionStyle
    >
  >(() => getInitialStyles(groups));

  /*
   * ============================================================
   * ACCORDION SCROLL ANCHOR
   * ============================================================
   *
   * When a tall group/service closes above the item the user
   * just clicked, the document can become much shorter. Near
   * the bottom of the page the browser can then clamp scrollY
   * to the new maximum and make the viewport jump.
   *
   * The click handler only records the element and its current
   * viewport position. All DOM writes and animation work happen
   * inside the effect, which keeps React's render phase pure.
   */

  const layoutAnchorRequestRef =
    useRef<{
      trigger: HTMLButtonElement;
      top: number;
    } | null>(null);

  const [
    layoutAnchorVersion,
    setLayoutAnchorVersion,
  ] = useState(0);

  const preserveTriggerPosition = (
    trigger: HTMLButtonElement,
  ) => {
    layoutAnchorRequestRef.current = {
      trigger,
      top: trigger.getBoundingClientRect().top,
    };

    setLayoutAnchorVersion(
      (current) => current + 1,
    );
  };

  useEffect(() => {
    const request =
      layoutAnchorRequestRef.current;

    if (!request) {
      return;
    }

    const {
      trigger,
      top: anchorTop,
    } = request;

    const root =
      document.documentElement;

    const previousScrollBehavior =
      root.style.scrollBehavior;

    /*
     * globals.css uses scroll-behavior: smooth.
     * These tiny per-frame corrections must be immediate or
     * multiple smooth-scroll animations would stack up.
     *
     * DOM mutations are intentionally contained in this effect
     * so they do not violate React render purity.
     */
    root.style.scrollBehavior = "auto";

    const duration = 360;
    let startedAt: number | null = null;
    let frameId: number | null = null;

    const finish = () => {
      root.style.scrollBehavior =
        previousScrollBehavior;

      frameId = null;
    };

    const keepAnchored = (
      now: number,
    ) => {
      if (startedAt === null) {
        startedAt = now;
      }

      if (!trigger.isConnected) {
        finish();
        return;
      }

      const currentTop =
        trigger.getBoundingClientRect().top;

      const delta =
        currentTop - anchorTop;

      if (Math.abs(delta) > 0.5) {
        window.scrollBy({
          top: delta,
          left: 0,
          behavior: "auto",
        });
      }

      if (
        now - startedAt <
        duration
      ) {
        frameId =
          window.requestAnimationFrame(
            keepAnchored,
          );
        return;
      }

      finish();
    };

    frameId =
      window.requestAnimationFrame(
        keepAnchored,
      );

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(
          frameId,
        );
      }

      root.style.scrollBehavior =
        previousScrollBehavior;
    };
  }, [layoutAnchorVersion]);

  /*
   * ============================================================
   * HASH + STYLE SUPPORT
   * ============================================================
   *
   * Example:
   *
   * /commissions?style=stylized#character-design
   */

  useEffect(() => {
    let scrollTimeout:
      | number
      | undefined;

    const frame =
      window.requestAnimationFrame(
        () => {
          /*
           * Read and protect the hash.
           *
           * If an old malformed URL contains:
           *
           * #character-design#book-covers
           *
           * keep only the last valid-looking
           * fragment.
           */

          const rawHash =
            decodeURIComponent(
              window.location.hash.replace(
                /^#/,
                "",
              ),
            );

          const hashParts =
            rawHash
              .split("#")
              .filter(Boolean);

          const hash =
            hashParts.at(-1) ?? "";

          if (!hash) {
            return;
          }

          if (hashParts.length > 1) {
            window.history.replaceState(
              window.history.state,
              "",
              `${window.location.pathname}${window.location.search}#${hash}`,
            );
          }

          /*
           * Find the group.
           */

          const group = groups.find(
            (candidate) =>
              candidate.services.some(
                (service) =>
                  service.id === hash,
              ),
          );

          if (!group) {
            return;
          }

          /*
           * Find the service.
           */

          const service =
            group.services.find(
              (candidate) =>
                candidate.id === hash,
            );

          if (!service) {
            return;
          }

          /*
           * Read the style passed from Portfolio.
           */

          const searchParams =
            new URLSearchParams(
              window.location.search,
            );

          const requestedStyle =
            searchParams.get("style");

          const matchingVariant =
            service.variants.find(
              (variant) =>
                variant.style ===
                requestedStyle,
            );

          if (matchingVariant) {
            setSelectedStyles(
              (current) => ({
                ...current,
                [service.id]:
                  matchingVariant.style,
              }),
            );
          }

          /*
           * Only one group and service open.
           */

          setOpenGroups([group.id]);

          setOpenServices([
            service.id,
          ]);

          /*
           * Wait for the 300ms accordion
           * transition to finish before
           * calculating the final position.
           */

          scrollTimeout =
            window.setTimeout(() => {
              const element =
                document.getElementById(
                  service.id,
                );

              if (!element) {
                return;
              }

              const navbar =
                document.querySelector(
                  "nav",
                );

              const navbarHeight =
                navbar?.getBoundingClientRect()
                  .height ?? 90;

              const offset =
                navbarHeight + 18;

              const y =
                element
                  .getBoundingClientRect()
                  .top +
                window.scrollY -
                offset;

              window.scrollTo({
                top: y,
                behavior: "smooth",
              });
            }, 380);
        },
      );

    return () => {
      window.cancelAnimationFrame(
        frame,
      );

      if (
        scrollTimeout !== undefined
      ) {
        window.clearTimeout(
          scrollTimeout,
        );
      }
    };
  }, [groups]);

  /*
   * ============================================================
   * GROUP TOGGLE
   * ============================================================
   */

  const toggleGroup = (
    groupId: string,
    trigger: HTMLButtonElement,
  ) => {
    preserveTriggerPosition(trigger);

    setOpenGroups((current) =>
      current.includes(groupId)
        ? []
        : [groupId],
    );
  };

  /*
   * ============================================================
   * SERVICE TOGGLE
   * ============================================================
   */

  const toggleService = (
    serviceId: string,
    trigger: HTMLButtonElement,
  ) => {
    preserveTriggerPosition(trigger);

    setOpenServices((current) =>
      current.includes(serviceId)
        ? []
        : [serviceId],
    );
  };

  return (
    <div
      id="commission-options"
      className="
        scroll-mt-28
        grid
        gap-6
        lg:grid-cols-[minmax(0,1fr)_320px]
        xl:grid-cols-[minmax(0,1fr)_360px]
      "
    >
      {/* =====================================================
          CATALOG
      ===================================================== */}

      <div
        className="
          order-2
          space-y-4
          [overflow-anchor:none]
          lg:order-1
        "
      >
        {groups.map((group) => {
          const groupOpen =
            openGroups.includes(
              group.id,
            );

          return (
            <section
              key={group.id}
              className="
                overflow-hidden
                rounded-[2rem]
                border
                border-white/10
                bg-[#5966A5]/40
                backdrop-blur-xl
                shadow-[0_10px_40px_rgba(0,0,0,0.12)]
              "
            >
              {/* =============================================
                  GROUP HEADER
              ============================================= */}

              <button
                type="button"
                onClick={(event) =>
                  toggleGroup(
                    group.id,
                    event.currentTarget,
                  )
                }
                aria-expanded={
                  groupOpen
                }
                className="
                  flex
                  w-full
                  items-center
                  justify-between
                  gap-5
                  p-5
                  text-left
                  sm:p-6
                "
              >
                <div className="min-w-0">
                  <div
                    className="
                      flex
                      min-w-0
                      items-start
                      gap-4
                    "
                  >
                    <div
                      className="
                        mt-0.5
                        flex
                        h-10
                        w-10
                        shrink-0
                        items-center
                        justify-center
                        text-white/80
                      "
                    >
                      <GroupIcon
                        groupId={
                          group.id
                        }
                      />
                    </div>

                    <div className="min-w-0">
                      <h2
                        className="
                          text-xl
                          font-light
                          tracking-tight
                          text-white
                          sm:text-2xl
                        "
                      >
                        {group.title}
                      </h2>

                      <p
                        className="
                          mt-1
                          text-xs
                          leading-relaxed
                          text-white/55
                          sm:text-sm
                        "
                      >
                        {
                          group.description
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* GROUP STATE */}

                <span
                  className="
                    inline-flex
                    shrink-0
                    items-center
                    gap-2
                    rounded-full
                    border
                    border-white/10
                    bg-white/[0.055]
                    px-3.5
                    py-2
                    text-[0.65rem]
                    tracking-wide
                    text-white/65
                    transition
                    duration-200
                    sm:px-4
                    sm:text-[0.7rem]
                  "
                >
                  <span className="hidden sm:inline">
                    {groupOpen
                      ? "Expanded"
                      : "Explore options"}
                  </span>

                  <ChevronIcon
                    open={groupOpen}
                  />
                </span>
              </button>

              {/* =============================================
                  GROUP CONTENT
              ============================================= */}

              <div
                className={`
                  grid
                  transition-[grid-template-rows]
                  duration-300
                  ease-out
                  ${
                    groupOpen
                      ? "grid-rows-[1fr]"
                      : "grid-rows-[0fr]"
                  }
                `}
              >
                <div className="overflow-hidden">
                  <div
                    className="
                      space-y-3
                      border-t
                      border-white/10
                      p-4
                      sm:p-5
                    "
                  >
                    {group.services.map(
                      (service) => {
                        const
                          selectedStyle =
                            selectedStyles[
                              service.id
                            ] ??
                            service
                              .variants[0]
                              ?.style;

                        if (
                          !selectedStyle
                        ) {
                          return null;
                        }

                        return (
                          <Service
                            key={
                              service.id
                            }
                            service={
                              service
                            }
                            open={openServices.includes(
                              service.id,
                            )}
                            onToggle={(
                              trigger,
                            ) =>
                              toggleService(
                                service.id,
                                trigger,
                              )
                            }
                            selectedStyle={
                              selectedStyle
                            }
                            onStyleChange={(
                              style,
                            ) =>
                              setSelectedStyles(
                                (
                                  current,
                                ) => ({
                                  ...current,
                                  [service.id]:
                                    style,
                                }),
                              )
                            }
                          />
                        );
                      },
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* =====================================================
          INDIE AUTHOR SIDEBAR
      ===================================================== */}

      <aside
        className="
          order-1
          self-start
          lg:order-2
          lg:sticky
          lg:top-28
        "
      >
        <div
          className="
            overflow-hidden
            rounded-[2rem]
            border
            border-white/10
            bg-[#5966A5]/55
            p-5
            backdrop-blur-2xl
            shadow-[0_20px_60px_rgba(40,40,90,0.18)]
          "
        >
          {/* ===============================================
              CHIBI + INDIE
          =============================================== */}

          <div
            className="
              flex
              items-end
              gap-4
              lg:block
            "
          >
            <Image
              src="/images/commissions/indie-autor/fefi-love.webp"
              alt="Fefierys chibi"
              width={240}
              height={324}
              unoptimized
              className="
                h-auto
                w-24
                shrink-0
                drop-shadow-2xl
                lg:mx-auto
                lg:w-28
              "
            />

            <div className="min-w-0">
              <h2
                className="
                  text-lg
                  font-light
                  text-white
                  lg:mt-3
                  lg:text-center
                  lg:text-xl
                "
              >
                Are you an Indie author?
              </h2>

              <p
                className="
                  mt-2
                  text-xs
                  leading-relaxed
                  text-white/65
                  lg:text-center
                "
              >
                Working with a smaller
                or tighter budget? Feel
                free to tell me about
                your project and budget.
                When possible, we can
                explore options that
                better fit your scope.
              </p>
            </div>
          </div>

          <div
            className="
              my-4
              h-px
              bg-white/10
            "
          />

          {/* ===============================================
              HOW IT WORKS
          =============================================== */}

          <p
            className="
              text-[0.65rem]
              uppercase
              tracking-[0.2em]
              text-white/45
            "
          >
            How it works
          </p>

          <ol
            className="
              mt-4
              space-y-2.5
              text-xs
              text-white/70
            "
          >
            {[
              "Tell me about your project and budget",
              "We discuss the details",
              "You receive a quote",
              "You decide whether to continue",
            ].map(
              (
                step,
                index,
              ) => (
                <li
                  key={step}
                  className="flex gap-3"
                >
                  <span
                    className="
                      flex
                      h-6
                      w-6
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-white/15
                      bg-white/5
                      text-[0.65rem]
                      text-white/70
                    "
                  >
                    {index + 1}
                  </span>

                  <span className="pt-1">
                    {step}
                  </span>
                </li>
              ),
            )}
          </ol>

          <div
            className="
              my-4
              h-px
              bg-white/10
            "
          />

          {/* ===============================================
              REASSURANCE
          =============================================== */}

          <p
            className="
              text-xs
              leading-relaxed
              text-white/60
            "
          >
            Sending an inquiry does not
            require payment or commit you
            to a commission.
          </p>

          {/*
           * This remains the generic inquiry
           * path for Indie authors / users who
           * are not sure which option they need.
           */}

          <Link
            href="/contact"
            className="
              mt-3
              flex
              w-full
              items-center
              justify-center
              rounded-full
              border
              border-white/20
              bg-white/10
              px-5
              py-2.5
              text-center
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
            Tell me about your project
          </Link>
        </div>
      </aside>
    </div>
  );
}