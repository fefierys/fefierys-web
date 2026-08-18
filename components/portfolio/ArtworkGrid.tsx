'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Artwork } from '@/data/portfolio/types';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { buildPortfolioPages } from '@/lib/portfolio/layoutEngine';

const ArtworkLightbox = dynamic(
  () => import('./ArtworkLightbox')
);

interface ArtworkGridProps {
  artworks: Artwork[];
  scrollTargetRef?: () => void;
}

export default function ArtworkGrid({
  artworks,
  scrollTargetRef,
}: ArtworkGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.05,
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
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  };

  /*
   * ============================================================
   * PÁGINAS
   * ============================================================
   */

  const pages = useMemo(() => {
    return buildPortfolioPages(artworks);
  }, [artworks]);

  /*
   * ============================================================
   * ORDEN VISUAL REAL
   * ============================================================
   */

  const orderedArtworks = useMemo(() => {
    return pages.flat();
  }, [pages]);

  const safeCurrentPage = Math.min(
    currentPage,
    Math.max(pages.length - 1, 0)
  );

  const pageArtworks = pages[safeCurrentPage] ?? [];

  const visiblePages = useMemo(() => {
    const totalPages = pages.length;

    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    const current = safeCurrentPage;

    if (current <= 2) {
      return [0, 1, 2, 3, -1, totalPages - 1];
    }

    if (current >= totalPages - 3) {
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
  }, [pages.length, safeCurrentPage]);

  /*
   * ============================================================
   * ÍNDICE GLOBAL
   * ============================================================
   */

  const globalIndex =
    selectedIndex !== null
      ? orderedArtworks.findIndex(
          (artwork) =>
            artwork.id === pageArtworks[selectedIndex]?.id
        )
      : null;

  const selectedArtwork =
    globalIndex !== null && globalIndex >= 0
      ? orderedArtworks[globalIndex]
      : null;

  if (artworks.length === 0) {
    return null;
  }

  /*
   * ============================================================
   * CAMBIAR DE PÁGINA
   * ============================================================
   */

  const changePage = (newPage: number) => {
    if (newPage < 0 || newPage >= pages.length) {
      return;
    }

    setCurrentPage(newPage);

    if (scrollTargetRef) {
      requestAnimationFrame(() => {
        scrollTargetRef();
      });
    }
  };

  /*
   * ============================================================
   * ABRIR LIGHTBOX
   * ============================================================
   */

  const handleArtworkClick = (index: number) => {
    setSelectedIndex(index);
  };

  /*
   * ============================================================
   * CAMBIAR OBRA DESDE EL LIGHTBOX
   * ============================================================
   */

  const goToArtwork = (newIndex: number) => {
    if (orderedArtworks.length === 0) {
      return;
    }

    const normalizedIndex =
      (newIndex + orderedArtworks.length) %
      orderedArtworks.length;

    const newArtwork = orderedArtworks[normalizedIndex];

    const newPage = pages.findIndex((page) =>
      page.some(
        (item) => item.id === newArtwork.id
      )
    );

    if (newPage === -1) {
      return;
    }

    const newLocalIndex = pages[newPage].findIndex(
      (item) => item.id === newArtwork.id
    );

    if (newLocalIndex === -1) {
      return;
    }

    setCurrentPage(newPage);
    setSelectedIndex(newLocalIndex);
  };

  return (
    <>
      {/* ======================================================
          GALERÍA
      ====================================================== */}

      <div>
        <motion.div
          key={safeCurrentPage}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="
            mx-auto
            w-full
            max-w-7xl

            grid
            grid-cols-1
            md:grid-cols-3

            gap-8
            auto-rows-130
          "
        >
          {pageArtworks.map((artwork, index) => {

            const isLcpCandidate =
              safeCurrentPage === 0 && index === 0;
            
            <div className="absolute top-2 left-2 z-50 bg-red-500 text-white p-2">
              {index}
            </div>

            return (
              <motion.div
                variants={isLcpCandidate ? undefined : itemVariants}
                key={artwork.id}
                onClick={() => handleArtworkClick(index)}
                className={`
                  group
                  relative
                  overflow-hidden
                  rounded-2xl
                  cursor-pointer

                  ${
                    artwork.orientation === 'landscape'
                      ? 'md:col-span-3 h-110 md:h-130'
                      : 'h-110 md:h-130'
                  }

                  ${
                    artwork.featured
                      ? 'ring-1 ring-white/10 shadow-2xl'
                      : ''
                  }
                `}
              >
                {/* ==================================================
                    IMAGEN
                ================================================== */}

                <Image
                  src={artwork.src}
                  alt={artwork.alt}
                  fill
                  quality={60}

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
                    artwork.orientation === "landscape"
                      ? "(max-width: 767px) calc(100vw - 48px), (max-width: 1280px) 900px, 1000px"
                      : "(max-width: 767px) calc(100vw - 48px), 30vw"
                  }
                  className="
                    object-cover
                    rounded-2xl

                    transition-transform
                    duration-700

                    group-hover:scale-105
                  "
                />

                {/* ==================================================
                    OVERLAY DEL TÍTULO

                    MÓVIL / TABLET:
                    siempre visible.

                    DESKTOP:
                    aparece únicamente con hover.
                ================================================== */}

                <div
                  className="
                    absolute
                    inset-0

                    flex
                    items-end

                    p-5

                    bg-gradient-to-t
                    from-black/65
                    via-black/15
                    to-transparent

                    opacity-100

                    md:opacity-0
                    md:group-hover:opacity-100

                    transition-opacity
                    duration-500
                    ease-out
                  "
                >
                  <span
                    className="
                      text-sm
                      tracking-[0.12em]
                      uppercase
                      text-white
                      drop-shadow-md
                    "
                  >
                    {artwork.title}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* ======================================================
          PAGINACIÓN
      ====================================================== */}

      {pages.length > 1 && (
        <div className="mt-12 flex items-center justify-center gap-3">
          {/* PREVIOUS */}

          <button
            type="button"
            onClick={() =>
              changePage(
                Math.max(safeCurrentPage - 1, 0)
              )
            }
            disabled={safeCurrentPage === 0}
            className="
              rounded-full
              border
              border-white/10
              bg-white/6

              h-10
              min-w-10
              px-3

              text-sm
              text-white/80

              transition
              hover:bg-white/20

              disabled:opacity-30
            "
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">&lt;</span>
          </button>

          {/* NÚMEROS */}

          {visiblePages.map((page, index) => {
            if (page === -1) {
              return (
                <span
                  key={`ellipsis-${index}`}
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
                key={page}
                onClick={() => changePage(page)}
                className={`
                  h-10
                  w-10
                  rounded-full
                  border
                  text-sm
                  transition
                  ${
                    safeCurrentPage === page
                      ? 'border-white/30 bg-white/35 text-white'
                      : 'border-white/10 bg-white/6 text-white/70 hover:bg-white/20'
                  }
                `}
              >
                {page + 1}
              </button>
            );
          })}

          {/* NEXT */}

          <button
            type="button"
            onClick={() =>
              changePage(
                Math.min(
                  safeCurrentPage + 1,
                  pages.length - 1
                )
              )
            }
            disabled={
              safeCurrentPage === pages.length - 1
            }
            className="
              rounded-full
              border
              border-white/10
              bg-white/6

              h-10
              min-w-10
              px-3

              text-sm
              text-white/80

              transition
              hover:bg-white/20

              disabled:opacity-30
            "
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">&gt;</span>
          </button>
        </div>
      )}

      {/* ======================================================
          LIGHTBOX
      ====================================================== */}

      {selectedArtwork && globalIndex !== null && (
        <ArtworkLightbox
          artwork={selectedArtwork}
          currentIndex={globalIndex}
          total={orderedArtworks.length}

          previous={() => {
            goToArtwork(globalIndex - 1);
          }}

          next={() => {
            goToArtwork(globalIndex + 1);
          }}

          close={() => {
            setSelectedIndex(null);
          }}
        />
      )}
    </>
  );
}