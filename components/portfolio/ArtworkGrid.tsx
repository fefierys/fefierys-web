'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Artwork } from '@/data/portfolio/types';
import ArtworkLightbox from './ArtworkLightbox';
import { motion } from 'framer-motion';
import { buildPortfolioPages } from '@/lib/portfolio/layoutEngine';

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
   *
   * El layoutEngine organiza automáticamente las obras
   * según su orientación y configuración.
   */
  const pages = useMemo(() => {
    return buildPortfolioPages(artworks);
  }, [artworks]);

  /*
   * ============================================================
   * ORDEN VISUAL REAL
   * ============================================================
   *
   * Este es el orden que realmente ve el usuario.
   *
   * Es importante utilizarlo también en el Lightbox para que
   * Previous / Next y el contador sigan exactamente el orden
   * visual de la galería.
   */
  const orderedArtworks = useMemo(() => {
    return pages.flat();
  }, [pages]);

  const safeCurrentPage = Math.min(
    currentPage,
    Math.max(pages.length - 1, 0)
  );

  const pageArtworks = pages[safeCurrentPage] ?? [];

  /*
   * ============================================================
   * ÍNDICE GLOBAL
   * ============================================================
   *
   * selectedIndex es local a la página actual.
   *
   * globalIndex es el índice dentro de orderedArtworks.
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
   *
   * Cambiamos la página y llevamos al usuario nuevamente
   * hacia el botón "Commission this style".
   *
   * No utilizamos useEffect para esto, evitando el error:
   *
   * "Calling setState synchronously within an effect"
   */
  const changePage = (newPage: number) => {
    if (newPage < 0 || newPage >= pages.length) {
      return;
    }

    setCurrentPage(newPage);

    /*
     * Esperamos al siguiente frame para que el layout pueda
     * actualizarse antes de realizar el scroll.
     */
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
   *
   * Desktop:
   *   click → abre Lightbox
   *
   * Tablet:
   *   tap → abre Lightbox
   *
   * Móvil:
   *   tap → abre Lightbox
   *
   * Ya no existe el sistema de doble tap.
   */
  const handleArtworkClick = (index: number) => {
    setSelectedIndex(index);
  };

  /*
   * ============================================================
   * CAMBIAR OBRA DESDE EL LIGHTBOX
   * ============================================================
   *
   * Busca la nueva obra dentro del orden visual real,
   * encuentra la página correspondiente y actualiza ambos
   * índices.
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
            return (
              <motion.div
                variants={itemVariants}
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
                      ? 'md:col-span-3 h-130'
                      : 'h-130'
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
                  sizes="
                    (max-width: 767px) 90vw,
                    (max-width: 1023px) 43vw,
                    30vw
                  "
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

              px-4
              py-2

              text-sm
              text-white/80

              transition
              hover:bg-white/10

              disabled:opacity-30
            "
          >
            Previous
          </button>

          {/* NÚMEROS */}

          {pages.map((_, index) => (
            <button
              type="button"
              key={index}
              onClick={() => changePage(index)}
              className={`
                h-10
                w-10
                rounded-full
                border
                text-sm
                transition

                ${
                  safeCurrentPage === index
                    ? 'border-white/30 bg-white/15 text-white'
                    : 'border-white/10 bg-white/6 text-white/70 hover:bg-white/10'
                }
              `}
            >
              {index + 1}
            </button>
          ))}

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

              px-4
              py-2

              text-sm
              text-white/80

              transition
              hover:bg-white/10

              disabled:opacity-30
            "
          >
            Next
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

          /*
           * OBRA ANTERIOR
           */
          previous={() => {
            goToArtwork(globalIndex - 1);
          }}

          /*
           * SIGUIENTE OBRA
           */
          next={() => {
            goToArtwork(globalIndex + 1);
          }}

          /*
           * CERRAR
           */
          close={() => {
            setSelectedIndex(null);
          }}
        />
      )}
    </>
  );
}