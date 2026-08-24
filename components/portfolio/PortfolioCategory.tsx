'use client';

import dynamic from 'next/dynamic';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  motion,
} from 'framer-motion';

import type {
  PortfolioData,
} from '@/data/portfolio/types';

import {
  commissions,
} from '@/data/portfolio/commissions';

import ArtworkGrid from './ArtworkGrid';

const CommissionModal = dynamic(
  () => import('./CommissionModal')
);

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
   * Este es el Group del contenido REAL
   * representado por la URL.
   *
   * El fallback al índice 0 se conserva
   * temporalmente porque Stylized/Chibis
   * todavía pueden usar PortfolioCategory
   * directamente en sus páginas raíz.
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
   * Esta es la Category del contenido REAL
   * representado por la URL.
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
   * Este estado NO representa el contenido.
   *
   * Solo representa qué Collection está
   * explorando actualmente el usuario.
   *
   * Ej:
   *
   * URL:
   * /book-art/covers
   *
   * activeGroup = book-art
   *
   * click GENERAL:
   *
   * openGroup = general
   * activeGroup = book-art
   *
   * Covers continúa siendo el contenido real.
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
   * COMMISSION MODAL
   * ============================================================
   */

  const [
    commissionOpen,
    setCommissionOpen,
  ] = useState(false);

  useEffect(() => {
    if (commissionOpen) {
      document.body.style.overflow =
        'hidden';
    } else {
      document.body.style.overflow =
        '';
    }

    return () => {
      document.body.style.overflow =
        '';
    };
  }, [commissionOpen]);

  /*
   * ============================================================
   * ACTIVE COMMISSION
   * ============================================================
   *
   * Siempre pertenece al contenido REAL,
   * no a la Collection que el usuario
   * esté explorando temporalmente.
   */

  const commission =
    commissions[
      activeSubcategory.id
    ];

  /*
   * ============================================================
   * PAGINATION SCROLL TARGET
   * ============================================================
   */

  const commissionButtonRef =
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
     * NEW BEHAVIOUR:
     *
     * Solo abrimos las Categories.
     *
     * No URL.
     * No gallery change.
     * No automatic Category.
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
     * LEGACY BEHAVIOUR:
     *
     * Se mantiene temporalmente para
     * las secciones que todavía no han
     * migrado al nuevo Overview.
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
   * Aquí SÍ cambia:
   *
   * - URL
   * - gallery
   * - active Collection
   * - active Category
   * - Commission
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
   * SCROLL TO COMMISSION
   * ============================================================
   */

  const scrollToCommission =
    () => {
      if (
        !commissionButtonRef.current
      ) {
        return;
      }

      const navbarOffset =
        100;

      const y =
        commissionButtonRef.current
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
    <>
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
                   * En el nuevo modo mostramos
                   * como abierta la Collection que
                   * el usuario está explorando.
                   *
                   * En el modo anterior mostramos
                   * la Collection real de la URL.
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
                            type: 'spring',
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
                     * Solo marcamos una Category
                     * cuando la Collection abierta
                     * es también la Collection REAL
                     * del contenido.
                     *
                     * Ej:
                     *
                     * Estamos en BOOK ART / COVERS
                     * y abrimos GENERAL:
                     *
                     * ninguna Category de GENERAL
                     * queda marcada.
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
              COMMISSION BUTTON

              Sigue perteneciendo a la Category
              REAL actualmente cargada.
          ================================================== */}

          {commission && (
            <div
              ref={
                commissionButtonRef
              }
              className="mb-10 flex justify-center md:mb-12 md:justify-end"
            >
              <button
                type="button"
                onClick={() =>
                  setCommissionOpen(
                    true
                  )
                }
                className="
                  group
                  inline-flex
                  w-full
                  max-w-sm

                  items-center
                  justify-center
                  gap-2

                  rounded-full

                  border
                  border-white/20

                  bg-white/10

                  px-5
                  py-3

                  text-xs
                  uppercase
                  tracking-[0.18em]
                  text-white

                  transition
                  duration-300

                  hover:bg-white
                  hover:text-[#2f3558]

                  md:w-auto
                "
              >
                <svg
                  className="h-4 w-4 transition group-hover:scale-110"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>

                Commission this style
              </button>
            </div>
          )}

          {/* ==================================================
              GALLERY

              Siempre utiliza la Category REAL,
              independientemente de qué Collection
              esté abierta en el menú.
          ================================================== */}

          <div
            key={
              activeSubcategory.id
            }
          >
            <ArtworkGrid
              artworks={
                activeSubcategory.artworks
              }
              scrollTargetRef={
                scrollToCommission
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

        </div>
      </section>

      {/* ====================================================
          COMMISSION MODAL
      ==================================================== */}

      {commission && (
        <CommissionModal
          key={
            commission.id
          }
          open={
            commissionOpen
          }
          onClose={() =>
            setCommissionOpen(
              false
            )
          }
          commission={
            commission
          }
          styleTitle={
            data.title
          }
          collectionTitle={
            activeGroup.title
          }
          categoryTitle={
            activeSubcategory.title
          }
        />
      )}
    </>
  );
}