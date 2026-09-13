'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useRef,
  useState,
} from 'react';

import type {
  PortfolioData,
} from '@/data/portfolio/types';

import ArtworkGrid from './ArtworkGrid';

const commissionAnchorByCategoryId: Record<
  string,
  string
> = {
  'semi-covers': 'book-covers',
  'sty-covers': 'book-covers',

  'semi-interior-illustration':
    'interior-illustrations',
  'sty-interior-illustration':
    'interior-illustrations',

  'semi-character-illustrations':
    'character-illustrations',
  'sty-character-illustrations':
    'character-illustrations',

  'semi-character-design':
    'character-design',
  'sty-character-design':
    'character-design',

  'semi-ref-sheets': 'reference-sheets',

  'semi-icons': 'icons',
  'sty-icons': 'icons',

  'semi-environments': 'environments',

  'semi-pets': 'pet-illustrations',
  'sty-pets': 'pet-illustrations',

  characters: 'chibis',
  custom: 'emotes',
};

interface PortfolioCategoryProps {
  data: PortfolioData;
  slug?: string[];

  /*
   * Transitional option.
   *
   * true:
   * Collection only opens its Categories.
   * URL/content do not change until a
   * Category is selected.
   *
   * false:
   * Preserve the previous behaviour used
   * temporarily by portfolio sections that
   * have not migrated to Overview yet.
   */
  exploreCollectionsLocally?: boolean;
}

export default function PortfolioCategory({
  data,
  slug,
  exploreCollectionsLocally = false,
}: PortfolioCategoryProps) {
  const router = useRouter();

  /*
   * ============================================================
   * URL
   * ============================================================
   *
   * /portfolio/semi-realism/general/ref-sheets
   *
   * slug[0] = general
   * slug[1] = ref-sheets
   *
   * Artwork:
   *
   * /portfolio/semi-realism/general/ref-sheets/artwork-slug
   *
   * slug[2] = artwork-slug
   */

  const groupSlug =
    slug?.[0];

  const categorySlug =
    slug?.[1];

  const artworkSlug =
    slug?.[2];

  /*
   * ============================================================
   * ACTIVE GROUP
   * ============================================================
   *
   * This is the Group represented by the
   * current URL/content.
   *
   * The fallback to index 0 is kept for
   * portfolio sections that may still render
   * PortfolioCategory from their root page.
   */

  const foundGroupIndex =
    data.groups.findIndex(
      (group) =>
        group.slug ===
        groupSlug
    );

  const activeGroupIndex =
    foundGroupIndex === -1
      ? 0
      : foundGroupIndex;

  const activeGroup =
    data.groups[
      activeGroupIndex
    ];

  /*
   * ============================================================
   * ACTIVE CATEGORY
   * ============================================================
   *
   * This is the Category represented by the
   * current URL/content.
   */

  const foundSubcategoryIndex =
    activeGroup.subcategories.findIndex(
      (subcategory) =>
        subcategory.slug ===
        categorySlug
    );

  const activeSubcategoryIndex =
    foundSubcategoryIndex === -1
      ? 0
      : foundSubcategoryIndex;

  const activeSubcategory =
    activeGroup.subcategories[
      activeSubcategoryIndex
    ];

  /*
   * ============================================================
   * OPEN GROUP
   * ============================================================
   *
   * This state does not represent the
   * currently loaded content.
   *
   * It only tracks which Collection the user
   * is exploring when exploreCollectionsLocally
   * is enabled.
   */

  const [
    openGroupSlug,
    setOpenGroupSlug,
  ] = useState(
    activeGroup.slug
  );

  const openGroup =
    data.groups.find(
      (group) =>
        group.slug ===
        openGroupSlug
    ) ?? activeGroup;

  /*
   * ============================================================
   * COMMISSIONS LINK
   * ============================================================
   *
   * Always use the REAL active Category from
   * the current URL, not the temporarily open
   * Collection.
   */

  const commissionAnchor =
    commissionAnchorByCategoryId[
      activeSubcategory.id
    ];

  const commissionHref =
    commissionAnchor
      ? {
          pathname:
            '/commissions',
          query: {
            style:
              data.slug,
          },
          hash:
            commissionAnchor,
        }
      : '/commissions';

  /*
   * Point ArtworkGrid returns to when its
   * internal pagination changes.
   */

  const galleryTopRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /*
   * ============================================================
   * CHANGE COLLECTION
   * ============================================================
   */

  function changeGroup(
    index: number
  ) {
    const group =
      data.groups[index];

    if (!group) {
      return;
    }

    /*
     * New behaviour:
     *
     * Only open the Collection's Categories.
     * Do not change the URL or gallery until
     * the user chooses a Category.
     */

    if (
      exploreCollectionsLocally
    ) {
      setOpenGroupSlug(
        group.slug
      );

      return;
    }

    /*
     * Legacy behaviour:
     *
     * Enter the first Category when the
     * portfolio section has not migrated to
     * the local Collection explorer yet.
     */

    const firstSubcategory =
      group.subcategories[0];

    if (!firstSubcategory) {
      return;
    }

    router.replace(
      `/portfolio/${data.slug}/${group.slug}/${firstSubcategory.slug}`
    );
  }

  /*
   * ============================================================
   * CHANGE CATEGORY
   * ============================================================
   *
   * This changes the real URL/content to the
   * selected Category inside the Collection
   * currently being explored.
   */

  function changeSubcategory(
    subcategorySlug: string
  ) {
    router.replace(
      `/portfolio/${data.slug}/${openGroup.slug}/${subcategorySlug}`
    );
  }

  /*
   * ============================================================
   * SCROLL TO GALLERY
   * ============================================================
   */

  const scrollToGallery = () => {
    if (!galleryTopRef.current) {
      return;
    }

    const navbarOffset =
      100;

    const y =
      galleryTopRef.current
        .getBoundingClientRect()
        .top +
      window.scrollY -
      navbarOffset;

    window.scrollTo({
      top: y,
      behavior: 'smooth',
    });
  };

  return (
    <section className="min-h-screen px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl text-white">
        {/* ==================================================
            TITLE
        ================================================== */}

        <h1 className="mb-12 text-center text-3xl font-light md:mb-16 md:text-5xl">
          {data.title}
        </h1>

        {/* ==================================================
            COLLECTION
        ================================================== */}

        <div className="mb-8 flex flex-col items-center">
          <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
            Collection
          </p>

          <div className="flex flex-wrap justify-center gap-6 md:gap-16">
            {data.groups.map(
              (
                group,
                index
              ) => {
                /*
                 * In local-explorer mode, highlight
                 * the Collection currently being
                 * explored.
                 *
                 * Otherwise, highlight the Collection
                 * represented by the real URL.
                 */

                const isOpen =
                  exploreCollectionsLocally
                    ? openGroup.slug ===
                      group.slug
                    : activeGroupIndex ===
                      index;

                return (
                  <button
                    type="button"
                    key={
                      group.id
                    }
                    onClick={() =>
                      changeGroup(
                        index
                      )
                    }
                    className="
                      relative
                      pb-2

                      text-sm
                      uppercase
                      tracking-[0.16em]

                      transition-colors
                      duration-300

                      md:text-lg
                    "
                  >
                    <span
                      className={
                        isOpen
                          ? 'text-white'
                          : 'text-white/45 hover:text-white'
                      }
                    >
                      {
                        group.title
                      }
                    </span>

                    {isOpen && (
                      <motion.div
                        layoutId="group-underline"
                        className="
                          absolute
                          left-0
                          right-0
                          -bottom-0.5
                          h-px
                          bg-white
                        "
                        transition={{
                          type:
                            'spring',
                          stiffness:
                            500,
                          damping:
                            40,
                        }}
                      />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ==================================================
            CATEGORY
        ================================================== */}

        <div className="mb-14 flex flex-col items-center md:mb-20">
          <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
            Category
          </p>

          <div
            className="
              flex
              flex-wrap
              justify-center
              gap-4
              md:gap-8
            "
          >
            {openGroup
              .subcategories
              .map(
                (
                  subcategory
                ) => {
                  /*
                   * Only mark a Category active when
                   * the open Collection is also the
                   * real Collection represented by
                   * the URL.
                   */

                  const isActive =
                    openGroup.slug ===
                      activeGroup.slug &&
                    subcategory.slug ===
                      activeSubcategory.slug;

                  return (
                    <button
                      type="button"
                      key={
                        subcategory.id
                      }
                      onClick={() =>
                        changeSubcategory(
                          subcategory.slug
                        )
                      }
                      className="
                        relative
                        pb-2

                        text-[11px]
                        uppercase
                        tracking-[0.15em]

                        transition-colors
                        duration-300

                        md:text-sm
                      "
                    >
                      <span
                        className={
                          isActive
                            ? 'text-white'
                            : 'text-white/50 hover:text-white'
                        }
                      >
                        {
                          subcategory.title
                        }
                      </span>

                      {isActive && (
                        <motion.div
                          layoutId="subcategory-underline"
                          className="
                            absolute
                            left-0
                            right-0
                            -bottom-0.5
                            h-px
                            bg-white
                          "
                          transition={{
                            type:
                              'spring',
                            stiffness:
                              500,
                            damping:
                              40,
                          }}
                        />
                      )}
                    </button>
                  );
                }
              )}
          </div>
        </div>

        {/* ==================================================
            GALLERY

            Always renders the REAL active Category,
            regardless of which Collection is being
            explored temporarily.
        ================================================== */}

        <div
          key={
            activeSubcategory.id
          }
          ref={
            galleryTopRef
          }
        >
          <ArtworkGrid
            artworks={
              activeSubcategory.artworks
            }
            scrollTargetRef={
              scrollToGallery
            }
            initialArtworkSlug={
              artworkSlug
            }
            portfolioSlug={
              data.slug
            }
            groupSlug={
              activeGroup.slug
            }
            categorySlug={
              activeSubcategory.slug
            }
          />
        </div>

        {/* ==================================================
            COMMISSIONS CTA
        ================================================== */}

        <div
          className="
            mx-auto
            mt-14
            max-w-2xl

            rounded-3xl
            border
            border-white/10

            bg-white/[0.04]

            px-6
            py-8
            text-center

            backdrop-blur-xl

            shadow-[0_18px_45px_rgba(24,30,80,0.12)]

            md:mt-16
            md:px-10
            md:py-10
          "
        >
          <p
            className="
              text-lg
              font-light
              text-white

              md:text-xl
            "
          >
            Interested in commissioning
            something like this?
          </p>

          <p
            className="
              mx-auto
              mt-2
              max-w-lg

              text-sm
              font-light
              leading-relaxed
              text-white/60
            "
          >
            Explore pricing, styles and
            commission options for this type
            of artwork.
          </p>

          <Link
            href={
              commissionHref
            }
            className="
              group

              mt-6
              inline-flex
              items-center
              justify-center
              gap-2

              rounded-full
              border
              border-white/15

              bg-white/[0.08]

              px-5
              py-3

              text-xs
              font-light
              uppercase
              tracking-[0.14em]
              text-white

              transition
              duration-300

              hover:bg-white
              hover:text-[#353a70]
            "
          >
            View commission options

            <span
              aria-hidden="true"
              className="
                transition-transform
                duration-300

                group-hover:translate-x-1
              "
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
