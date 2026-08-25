'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';

import {
  useMemo,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  motion,
} from 'framer-motion';

import type {
  Artwork,
} from '@/data/portfolio/types';

import {
  buildPortfolioPages,
} from '@/lib/portfolio/layoutEngine';

import {
  getPortfolioThumbnailUrl,
} from '@/lib/media/portfolioImageUrl';

const ArtworkLightbox = dynamic(
  () => import('./ArtworkLightbox')
);

interface ArtworkGridProps {
  artworks: Artwork[];

  scrollTargetRef?: () => void;

  initialArtworkSlug?: string;

  portfolioSlug: string;

  groupSlug?: string;

  categorySlug?: string;

  /*
   * Used by PortfolioOverview.
   *
   * Overview artworks can belong to
   * different Groups/Categories, so each
   * artwork may need its own destination.
   */
  getArtworkHref?: (
    artwork: Artwork
  ) => string | null;
}

export default function ArtworkGrid({
  artworks,
  scrollTargetRef,
  initialArtworkSlug,
  portfolioSlug,
  groupSlug,
  categorySlug,
  getArtworkHref,
}: ArtworkGridProps) {
  const router =
    useRouter();

  const [
    currentPage,
    setCurrentPage,
  ] = useState(0);

  /*
   * ============================================================
   * ANIMATION
   * ============================================================
   */

  const containerVariants = {
    hidden: {},

    show: {
      transition: {
        staggerChildren:
          0.05,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 18,
    },

    show: {
      opacity: 1,
      y: 0,

      transition: {
        duration:
          0.45,

        ease:
          [
            0.22,
            1,
            0.36,
            1,
          ] as const,
      },
    },
  };

  /*
   * ============================================================
   * PAGES
   * ============================================================
   *
   * Each artwork now has exactly the same
   * visual weight inside the grid.
   *
   * No orientation-based layout is needed.
   */

  const pages =
    useMemo(
      () =>
        buildPortfolioPages(
          artworks
        ),
      [artworks]
    );

  /*
   * ============================================================
   * REAL ARTWORK ORDER
   * ============================================================
   *
   * Because pagination no longer reorganizes
   * artworks, this is effectively the same
   * order received from the repository.
   *
   * We still derive it from pages so Lightbox
   * navigation and pagination stay connected.
   */

  const orderedArtworks =
    useMemo(
      () =>
        pages.flat(),
      [pages]
    );

  /*
   * ============================================================
   * ARTWORK SELECTED FROM URL
   * ============================================================
   */

  const selectedGlobalIndex =
    useMemo(() => {
      if (
        !initialArtworkSlug
      ) {
        return null;
      }

      const index =
        orderedArtworks.findIndex(
          (artwork) =>
            artwork.slug ===
            initialArtworkSlug
        );

      return index === -1
        ? null
        : index;
    }, [
      initialArtworkSlug,
      orderedArtworks,
    ]);

  const selectedArtwork =
    selectedGlobalIndex !==
    null
      ? orderedArtworks[
          selectedGlobalIndex
        ]
      : null;

  /*
   * ============================================================
   * PAGE CONTAINING THE OPEN ARTWORK
   * ============================================================
   */

  const selectedArtworkPage =
    useMemo(() => {
      if (
        !selectedArtwork
      ) {
        return null;
      }

      const pageIndex =
        pages.findIndex(
          (page) =>
            page.some(
              (artwork) =>
                artwork.slug ===
                selectedArtwork.slug
            )
        );

      return pageIndex === -1
        ? null
        : pageIndex;
    }, [
      pages,
      selectedArtwork,
    ]);

  /*
   * If an artwork URL points to an artwork
   * located on another page, that page becomes
   * the visible page automatically.
   */

  const safeCurrentPage =
    Math.min(
      selectedArtworkPage ??
        currentPage,

      Math.max(
        pages.length - 1,
        0
      )
    );

  const pageArtworks =
    pages[
      safeCurrentPage
    ] ?? [];

  /*
   * ============================================================
   * VISIBLE PAGINATION
   * ============================================================
   */

  const visiblePages =
    useMemo(() => {
      const totalPages =
        pages.length;

      if (
        totalPages <= 5
      ) {
        return Array.from(
          {
            length:
              totalPages,
          },
          (_, index) =>
            index
        );
      }

      const current =
        safeCurrentPage;

      if (
        current <= 2
      ) {
        return [
          0,
          1,
          2,
          3,
          -1,
          totalPages - 1,
        ];
      }

      if (
        current >=
        totalPages - 3
      ) {
        return [
          0,
          -1,
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
        ];
      }

      return [
        0,
        -1,
        current - 1,
        current,
        current + 1,
        -1,
        totalPages - 1,
      ];
    }, [
      pages.length,
      safeCurrentPage,
    ]);

  /*
   * ============================================================
   * CATEGORY URL
   * ============================================================
   *
   * In PortfolioOverview there is no single
   * Category URL because artworks can belong
   * to different Categories.
   */

  const categoryUrl =
    groupSlug &&
    categorySlug
      ? `/portfolio/${portfolioSlug}/${groupSlug}/${categorySlug}`
      : null;

  /*
   * ============================================================
   * CHANGE PAGE
   * ============================================================
   */

  const changePage = (
    newPage: number
  ) => {
    if (
      newPage < 0 ||
      newPage >=
        pages.length
    ) {
      return;
    }

    setCurrentPage(
      newPage
    );

    if (
      scrollTargetRef
    ) {
      requestAnimationFrame(
        () => {
          scrollTargetRef();
        }
      );
    }
  };

  /*
   * ============================================================
   * OPEN ARTWORK
   * ============================================================
   */

  const handleArtworkClick = (
    index: number
  ) => {
    const artwork =
      pageArtworks[
        index
      ];

    if (!artwork) {
      return;
    }

    /*
     * PortfolioOverview
     *
     * Each artwork already knows its
     * complete destination.
     */

    const directHref =
      getArtworkHref?.(
        artwork
      );

    if (directHref) {
      router.push(
        directHref
      );

      return;
    }

    /*
     * Category gallery
     *
     * Opening an artwork changes only
     * the artwork slug and opens Lightbox.
     */

    if (
      !categoryUrl
    ) {
      return;
    }

    router.replace(
      `${categoryUrl}/${artwork.slug}`,
      {
        scroll: false,
      }
    );
  };

  /*
   * ============================================================
   * LIGHTBOX NAVIGATION
   * ============================================================
   */

  const goToArtwork = (
    newIndex: number
  ) => {
    if (
      orderedArtworks.length ===
      0
    ) {
      return;
    }

    const normalizedIndex =
      (
        newIndex +
        orderedArtworks.length
      ) %
      orderedArtworks.length;

    const newArtwork =
      orderedArtworks[
        normalizedIndex
      ];

    const newPage =
      pages.findIndex(
        (page) =>
          page.some(
            (item) =>
              item.slug ===
              newArtwork.slug
          )
      );

    if (
      newPage === -1
    ) {
      return;
    }

    setCurrentPage(
      newPage
    );

    if (
      !categoryUrl
    ) {
      return;
    }

    router.replace(
      `${categoryUrl}/${newArtwork.slug}`,
      {
        scroll: false,
      }
    );
  };

  /*
   * ============================================================
   * CLOSE LIGHTBOX
   * ============================================================
   */

  const closeLightbox =
    () => {
      /*
       * If the opened artwork belongs to
       * another page, keep that page visible
       * after closing the Lightbox.
       */

      if (
        selectedArtworkPage !==
        null
      ) {
        setCurrentPage(
          selectedArtworkPage
        );
      }

      if (
        !categoryUrl
      ) {
        return;
      }

      router.replace(
        categoryUrl,
        {
          scroll: false,
        }
      );
    };

  /*
   * ============================================================
   * EMPTY CATEGORY
   * ============================================================
   */

  if (
    artworks.length ===
    0
  ) {
    return null;
  }

  return (
    <>
      {/* ======================================================
          GALLERY
      ====================================================== */}

      <div>
        <motion.div
          key={
            safeCurrentPage
          }
          variants={
            containerVariants
          }
          initial="hidden"
          animate="show"
          className="
            mx-auto
            grid
            w-full
            max-w-6xl

            grid-cols-1
            sm:grid-cols-2
            lg:grid-cols-3

            gap-8
          "
        >
          {pageArtworks.map(
            (
              artwork,
              index
            ) => {
              /*
               * The first visible thumbnail
               * is our image LCP candidate.
               *
               * Unlike the previous layout,
               * it now occupies only one
               * uniform card instead of a
               * possible full-width landscape.
               */

              const isLcpCandidate =
                index === 0;

              const thumbnailFocusX =
                artwork.thumbnailFocusX ??
                50;

              const thumbnailFocusY =
                artwork.thumbnailFocusY ??
                50;

              const thumbnailSrc =
                getPortfolioThumbnailUrl(
                  artwork
                );

              const usesR2 =
                Boolean(
                  artwork.storageKey
                );

              return (
                <motion.div
                  key={
                    getArtworkHref?.(
                      artwork
                    ) ??
                    artwork.slug
                  }
                  variants={
                    isLcpCandidate
                      ? undefined
                      : itemVariants
                  }
                  onClick={() =>
                    handleArtworkClick(
                      index
                    )
                  }
                  className="
                    group
                    relative

                    aspect-[4/5]

                    cursor-pointer
                    overflow-hidden
                    rounded-2xl
                  "
                >
                  {/* ==========================================
                      THUMBNAIL
                  ========================================== */}

                  <Image
                    src={
                      thumbnailSrc
                    }

                    unoptimized={usesR2}

                    alt={
                      artwork.alt
                    }
                    fill
                    quality={
                      60
                    }
                    fetchPriority={
                      isLcpCandidate
                        ? 'high'
                        : undefined
                    }
                    loading={
                      isLcpCandidate
                        ? 'eager'
                        : undefined
                    }
                    sizes={
                      artwork.orientation === 'landscape'
                        ? `
                            (max-width: 639px) 1000px,
                            (max-width: 1023px) 1400px,
                            1100px
                          `
                        : `
                            (max-width: 639px) calc(100vw - 48px),
                            (max-width: 1023px) calc((100vw - 80px) / 2),
                            (max-width: 1279px) calc((100vw - 112px) / 3),
                            363px
                          `
                    }
                    style={{
                      objectPosition:
                        `${thumbnailFocusX}% ${thumbnailFocusY}%`,
                    }}
                    className="
                      object-cover

                      transition-transform
                      duration-700

                      group-hover:scale-105
                    "
                  />

                  {/* ==========================================
                      OVERLAY
                  ========================================== */}

                  <div
                    className="
                      absolute
                      inset-0

                      flex
                      items-end

                      bg-gradient-to-t
                      from-black/65
                      via-black/15
                      to-transparent

                      p-5

                      opacity-100

                      transition-opacity
                      duration-500
                      ease-out

                      pointer-fine:opacity-0
                      pointer-fine:group-hover:opacity-100
                    "
                  >
                    <span
                      className="
                        text-sm
                        uppercase
                        tracking-[0.12em]
                        text-white
                        drop-shadow-md
                      "
                    >
                      {
                        artwork.title
                      }
                    </span>
                  </div>
                </motion.div>
              );
            }
          )}
        </motion.div>
      </div>

      {/* ======================================================
          PAGINATION
      ====================================================== */}

      {pages.length >
        1 && (
        <div className="mt-12 flex items-center justify-center gap-3">

          {/* PREVIOUS */}

          <button
            type="button"
            onClick={() =>
              changePage(
                Math.max(
                  safeCurrentPage -
                    1,
                  0
                )
              )
            }
            disabled={
              safeCurrentPage ===
              0
            }
            className="
              h-10
              min-w-10

              rounded-full

              border
              border-white/10

              bg-white/6

              px-3

              text-sm
              text-white/80

              transition
              hover:bg-white/20

              disabled:opacity-30
            "
          >
            <span className="hidden sm:inline">
              Previous
            </span>

            <span className="sm:hidden">
              &lt;
            </span>
          </button>

          {/* PAGE NUMBERS */}

          {visiblePages.map(
            (
              page,
              index
            ) => {
              if (
                page === -1
              ) {
                return (
                  <span
                    key={
                      `ellipsis-${index}`
                    }
                    className="
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      text-white/60
                    "
                  >
                    ...
                  </span>
                );
              }

              return (
                <button
                  type="button"
                  key={
                    page
                  }
                  onClick={() =>
                    changePage(
                      page
                    )
                  }
                  className={`
                    h-10
                    w-10

                    rounded-full

                    border

                    text-sm
                    transition

                    ${
                      safeCurrentPage ===
                      page
                        ? 'border-white/30 bg-white/35 text-white'
                        : 'border-white/10 bg-white/6 text-white/70 hover:bg-white/20'
                    }
                  `}
                >
                  {page + 1}
                </button>
              );
            }
          )}

          {/* NEXT */}

          <button
            type="button"
            onClick={() =>
              changePage(
                Math.min(
                  safeCurrentPage +
                    1,

                  pages.length -
                    1
                )
              )
            }
            disabled={
              safeCurrentPage ===
              pages.length -
                1
            }
            className="
              h-10
              min-w-10

              rounded-full

              border
              border-white/10

              bg-white/6

              px-3

              text-sm
              text-white/80

              transition
              hover:bg-white/20

              disabled:opacity-30
            "
          >
            <span className="hidden sm:inline">
              Next
            </span>

            <span className="sm:hidden">
              &gt;
            </span>
          </button>
        </div>
      )}

      {/* ======================================================
          LIGHTBOX
      ====================================================== */}

      {selectedArtwork &&
        selectedGlobalIndex !==
          null && (
          <ArtworkLightbox
            artwork={
              selectedArtwork
            }
            currentIndex={
              selectedGlobalIndex
            }
            total={
              orderedArtworks.length
            }
            previous={() => {
              goToArtwork(
                selectedGlobalIndex -
                  1
              );
            }}
            next={() => {
              goToArtwork(
                selectedGlobalIndex +
                  1
              );
            }}
            close={
              closeLightbox
            }
          />
        )}
    </>
  );
}