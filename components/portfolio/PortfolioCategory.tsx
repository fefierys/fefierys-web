'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { PortfolioData } from '@/data/portfolio/types';

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
}

export default function PortfolioCategory({
  data,
  slug,
}: PortfolioCategoryProps) {
  const router = useRouter();

  /*
   * URL:
   *
   * /portfolio/semi-realism/general/ref-sheets
   *
   * slug[0] = general
   * slug[1] = ref-sheets
   *
   * Y si hay artwork:
   *
   * /portfolio/semi-realism/general/ref-sheets/elf-character-dnd-ref-sheet-essentials
   *
   * slug[2] = elf-character-dnd-ref-sheet-essentials
   */
  const groupSlug = slug?.[0];
  const categorySlug = slug?.[1];
  const artworkSlug = slug?.[2];

  /*
   * COLLECTION seleccionada
   */
  const foundGroupIndex = data.groups.findIndex(
    (group) => group.slug === groupSlug
  );

  const selectedGroupIndex =
    foundGroupIndex === -1 ? 0 : foundGroupIndex;

  const selectedGroup =
    data.groups[selectedGroupIndex];

  /*
   * CATEGORY seleccionada
   */
  const foundSubcategoryIndex =
    selectedGroup.subcategories.findIndex(
      (subcategory) =>
        subcategory.slug === categorySlug
    );

  const selectedSubcategoryIndex =
    foundSubcategoryIndex === -1
      ? 0
      : foundSubcategoryIndex;

  const selectedSubcategory =
    selectedGroup.subcategories[
      selectedSubcategoryIndex
    ];

  /*
 * ============================================================
 * COMMISSIONS LINK
 * ============================================================
 */

const commissionAnchor =
  commissionAnchorByCategoryId[
    selectedSubcategory.id
  ];

const commissionHref = commissionAnchor
  ? {
      pathname: '/commissions',
      query: {
        style: data.slug,
      },
      hash: commissionAnchor,
    }
  : '/commissions';

/*
 * Punto al que vuelve el scroll al cambiar
 * de página dentro de ArtworkGrid.
 */
const galleryTopRef =
  useRef<HTMLDivElement | null>(null);

  /*
   * Cambiar COLLECTION.
   *
   * Al cambiar de colección entramos a su
   * primera subcategoría.
   */
  function changeGroup(index: number) {
    const group = data.groups[index];

    if (!group) return;

    const firstSubcategory =
      group.subcategories[0];

    if (!firstSubcategory) return;

    router.replace(
      `/portfolio/${data.slug}/${group.slug}/${firstSubcategory.slug}`
    );
  }

  /*
   * Cambiar CATEGORY.
   */
  function changeSubcategory(
    subcategorySlug: string
  ) {
    router.replace(
      `/portfolio/${data.slug}/${selectedGroup.slug}/${subcategorySlug}`
    );
  }


  /*
   * Scroll hacia botón de comisión.
   */
  const scrollToGallery = () => {
    if (!galleryTopRef.current) return;

    const navbarOffset = 100;

    const y =
      galleryTopRef.current
        .getBoundingClientRect().top +
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
        {/* TÍTULO */}
        <h1 className="mb-12 text-center text-3xl font-light md:mb-16 md:text-5xl">
          {data.title}
        </h1>

        {/* COLLECTION */}
        <div className="mb-8 flex flex-col items-center">
          <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
            Collection
          </p>

          <div className="flex flex-wrap justify-center gap-6 md:gap-16">
            {data.groups.map(
              (group, index) => (
                <button
                  type="button"
                  key={group.id}
                  onClick={() =>
                    changeGroup(index)
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
                      selectedGroupIndex ===
                      index
                        ? 'text-white'
                        : 'text-white/45 hover:text-white'
                    }
                  >
                    {group.title}
                  </span>

                  {selectedGroupIndex ===
                    index && (
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
                        type: 'spring',
                        stiffness: 500,
                        damping: 40,
                      }}
                    />
                  )}
                </button>
              )
            )}
          </div>
        </div>

        {/* CATEGORY */}
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
            {selectedGroup.subcategories.map(
              (subcategory, index) => (
                <button
                  type="button"
                  key={subcategory.id}
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
                      selectedSubcategoryIndex ===
                      index
                        ? 'text-white'
                        : 'text-white/50 hover:text-white'
                    }
                  >
                    {subcategory.title}
                  </span>

                  {selectedSubcategoryIndex ===
                    index && (
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
                        type: 'spring',
                        stiffness: 500,
                        damping: 40,
                      }}
                    />
                  )}
                </button>
              )
            )}
          </div>
        </div>
    

        {/* GALERÍA */}
        <div
          key={selectedSubcategory.id}
          ref={galleryTopRef}
        >
          <ArtworkGrid
            artworks={
              selectedSubcategory.artworks
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
              selectedGroup.slug
            }
            categorySlug={
              selectedSubcategory.slug
            }
          />
        </div>

        {/* COMMISSIONS CTA */}
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
            href={commissionHref}
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