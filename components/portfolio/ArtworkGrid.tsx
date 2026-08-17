'use client';

import Image from 'next/image';
import { useMemo, useState, useRef, useEffect } from 'react';
import { Artwork } from '@/data/portfolio/types';
import ArtworkLightbox from './ArtworkLightbox';
import { motion } from 'framer-motion';
import { buildPortfolioPages } from '@/lib/portfolio/layoutEngine';

interface ArtworkGridProps {
  artworks: Artwork[];
}

export default function ArtworkGrid({
  artworks,
}: ArtworkGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Imagen que tiene el título visible en dispositivos táctiles
  const [tappedIndex, setTappedIndex] = useState<number | null>(null);

  // Detectamos si el dispositivo no tiene hover real
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const galleryRef = useRef<HTMLDivElement | null>(null);
  const previousPageRef = useRef(currentPage);

  // Timer para ocultar el título después del tap
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const pages = useMemo(() => {
    return buildPortfolioPages(artworks);
  }, [artworks]);

  /*
   * Orden visual real de las obras.
   *
   * El layoutEngine puede reorganizar las obras para construir
   * las composiciones de cada página.
   *
   * Por eso el Lightbox debe utilizar este orden y no el
   * orden original de `artworks`.
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
   * Índice global según el orden visual generado por layoutEngine.
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

  /*
   * Detectamos dispositivos sin hover.
   *
   * Esto es mejor que usar simplemente el ancho de pantalla porque
   * también funciona con tablets, dispositivos híbridos, etc.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(hover: none)');

    const updateTouchState = () => {
      setIsTouchDevice(mediaQuery.matches);
    };

    updateTouchState();

    mediaQuery.addEventListener('change', updateTouchState);

    return () => {
      mediaQuery.removeEventListener('change', updateTouchState);
    };
  }, []);

  /*
   * Limpiamos el timer cuando el componente desaparece.
   */
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  /*
   * Cuando cambiamos de página, ocultamos cualquier título
   * que estuviera activo.
   */
  useEffect(() => {
    setTappedIndex(null);

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
  }, [currentPage]);

  /*
   * Scroll solo cuando cambia la página
   */
  useEffect(() => {
    if (previousPageRef.current === currentPage) return;

    previousPageRef.current = currentPage;

    if (galleryRef.current) {
      const navbarOffset = 96;

      const y =
        galleryRef.current.getBoundingClientRect().top +
        window.pageYOffset -
        navbarOffset;

      window.scrollTo({
        top: y,
        behavior: 'smooth',
      });
    }
  }, [currentPage]);

  if (artworks.length === 0) {
    return null;
  }

  /*
   * Maneja el click/tap sobre una ilustración.
   *
   * DESKTOP:
   *   click → abre directamente el Lightbox.
   *
   * TABLET / MÓVIL:
   *   primer tap → muestra título
   *   segundo tap → abre Lightbox
   */
  const handleArtworkClick = (index: number) => {
    if (!isTouchDevice) {
      setSelectedIndex(index);
      return;
    }

    /*
     * Si tocamos nuevamente la misma imagen mientras
     * su título está visible, abrimos el Lightbox.
     */
    if (tappedIndex === index) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }

      setTappedIndex(null);
      setSelectedIndex(index);

      return;
    }

    /*
     * Si tocamos una imagen diferente, mostramos su título.
     */
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }

    setTappedIndex(index);

    /*
     * Después de 3 segundos el título desaparece.
     */
    tapTimeoutRef.current = setTimeout(() => {
      setTappedIndex(null);
      tapTimeoutRef.current = null;
    }, 3000);
  };

  return (
    <>
      <div ref={galleryRef}>
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
            const titleVisible =
              isTouchDevice && tappedIndex === index;

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
                {/* IMAGEN */}
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

                {/* OVERLAY DEL TÍTULO */}
                <div
                  className={`
                    absolute
                    inset-0
                    flex
                    items-end
                    p-5

                    bg-gradient-to-t
                    from-black/65
                    via-black/15
                    to-transparent

                    transition-all
                    duration-500
                    ease-out

                    ${
                      titleVisible
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    }
                  `}
                >
                  <motion.span
                    initial={false}
                    animate={{
                      opacity: titleVisible ? 1 : undefined,
                      y: titleVisible ? 0 : undefined,
                    }}
                    transition={{
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="
                      text-sm
                      tracking-[0.12em]
                      uppercase
                      text-white
                      drop-shadow-md
                    "
                  >
                    {artwork.title}
                  </motion.span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* PAGINACIÓN */}
      {pages.length > 1 && (
        <div className="mt-12 flex items-center justify-center gap-3">
          <button
            onClick={() =>
              setCurrentPage((p) => Math.max(p - 1, 0))
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

          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
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

          <button
            onClick={() =>
              setCurrentPage((p) =>
                Math.min(p + 1, pages.length - 1)
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

      {/* LIGHTBOX */}
      {selectedArtwork && globalIndex !== null && (
        <ArtworkLightbox
          artwork={selectedArtwork}

          /*
           * Ahora el índice y el total corresponden al orden
           * visual real generado por layoutEngine.
           */
          currentIndex={globalIndex}
          total={orderedArtworks.length}

          previousArtwork={
            artworks[
              (globalIndex - 1 + artworks.length) % artworks.length
            ]
          }

          nextArtwork={
            artworks[
              (globalIndex + 1) % artworks.length
            ]
          }

          previous={() => {
            if (globalIndex === null) return;

            const newIndex =
              (globalIndex - 1 + orderedArtworks.length) %
              orderedArtworks.length;

            const newArtwork = orderedArtworks[newIndex];

            const newPage = pages.findIndex((page) =>
              page.some(
                (item) => item.id === newArtwork.id
              )
            );

            if (newPage === -1) return;

            const newLocalIndex = pages[newPage].findIndex(
              (item) => item.id === newArtwork.id
            );

            if (newLocalIndex === -1) return;

            setCurrentPage(newPage);
            setSelectedIndex(newLocalIndex);
          }}

          next={() => {
            if (globalIndex === null) return;

            const newIndex =
              (globalIndex + 1) %
              orderedArtworks.length;

            const newArtwork = orderedArtworks[newIndex];

            const newPage = pages.findIndex((page) =>
              page.some(
                (item) => item.id === newArtwork.id
              )
            );

            if (newPage === -1) return;

            const newLocalIndex = pages[newPage].findIndex(
              (item) => item.id === newArtwork.id
            );

            if (newLocalIndex === -1) return;

            setCurrentPage(newPage);
            setSelectedIndex(newLocalIndex);
          }}

          close={() => {
            setSelectedIndex(null);
            setTappedIndex(null);

            if (tapTimeoutRef.current) {
              clearTimeout(tapTimeoutRef.current);
              tapTimeoutRef.current = null;
            }
          }}
        />
      )}
    </>
  );
}