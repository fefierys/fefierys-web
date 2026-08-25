'use client';

import {
  useEffect,
  useState,
} from 'react';

import Image from 'next/image';
import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import { Artwork } from '@/data/portfolio/types';

import {
  getPortfolioDisplayUrl,
} from '@/lib/media/portfolioImageUrl';

interface ArtworkLightboxProps {
  artwork: Artwork;
  currentIndex: number;
  total: number;

  previous: () => void;
  next: () => void;
  close: () => void;
}

export default function ArtworkLightbox({
  artwork,
  currentIndex,
  total,
  previous,
  next,
  close,
}: ArtworkLightboxProps) {

  /*
   * ============================================================
   * CARGA DE IMAGEN
   * ============================================================
   *
   * Guardamos qué src terminó de cargar.
   *
   * Así, cuando cambiamos de artwork:
   *
   * loadedSrc !== artwork.src
   *
   * y automáticamente vuelve a aparecer
   * el loader sin necesitar un useEffect
   * con setState.
   */

  const [
    loadedSrc,
    setLoadedSrc,
  ] = useState<string | null>(
    null
  );

  const displaySrc =
    getPortfolioDisplayUrl(
      artwork
    );

  const usesR2 =
    Boolean(
      artwork.storageKey
    );

  const imageLoaded =
    loadedSrc === displaySrc;

  /*
   * ============================================================
   * TECLADO + BLOQUEO DE SCROLL
   * ============================================================
   */

  useEffect(() => {

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {

      /*
       * ESC
       */
      if (
        event.key === 'Escape'
      ) {
        close();
        return;
      }

      /*
       * FLECHA IZQUIERDA
       */
      if (
        event.key === 'ArrowLeft'
      ) {
        previous();
        return;
      }

      /*
       * FLECHA DERECHA
       */
      if (
        event.key === 'ArrowRight'
      ) {
        next();
      }
    };

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    /*
     * Bloqueamos scroll mientras
     * el Lightbox está abierto.
     */
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    return () => {

      window.removeEventListener(
        'keydown',
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };

  }, [
    close,
    previous,
    next,
  ]);

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <AnimatePresence>

      {/* BACKDROP */}
      <motion.div
        className="
          fixed
          inset-0
          z-100

          flex
          items-center
          justify-center

          bg-[#6b6fa8]/55
          backdrop-blur-lg

          p-6
          md:p-10
        "

        /*
         * Click en cualquier zona vacía
         * del backdrop = cerrar.
         */
        onClick={close}

        initial={{
          opacity: 0,
        }}

        animate={{
          opacity: 1,
        }}

        exit={{
          opacity: 0,
        }}
      >

        {/* ==================================================
            FLECHA IZQUIERDA
        ================================================== */}

        <button
          type="button"

          onClick={(event) => {
            event.stopPropagation();
            previous();
          }}

          className="
            absolute

            left-3
            sm:left-4
            md:left-8

            top-1/2
            -translate-y-1/2

            z-50

            flex
            h-11
            w-11

            items-center
            justify-center

            rounded-full

            bg-white/10
            backdrop-blur-md

            border
            border-white/15

            text-white/80

            transition-all
            duration-200

            hover:bg-white/10
            hover:text-white

            active:scale-95

            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-white/40
          "

          aria-label="Previous image"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M15 6L9 12L15 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* ==================================================
            IMAGEN
        ================================================== */}

        <motion.div
          key={artwork.slug}

          className="
            relative
            z-10

            max-w-6xl
            max-h-full
          "

          /*
           * Evita que hacer click sobre
           * la propia imagen cierre el modal.
           */
          onClick={(event) =>
            event.stopPropagation()
          }

          initial={{
            opacity: 0,
            scale: 0.97,
          }}

          animate={{
            opacity:
              imageLoaded
                ? 1
                : 0,

            scale:
              imageLoaded
                ? 1
                : 0.97,
          }}

          transition={{
            duration: 0.22,
            ease: 'easeOut',
          }}
        >

          <Image
            src={displaySrc}
            alt={artwork.alt}

            unoptimized={usesR2}

            width={2400}
            height={2400}

            className="
              max-h-[90vh]
              w-auto

              rounded-2xl
              shadow-2xl

              object-contain
            "

            priority

            onLoad={() => {
              setLoadedSrc(
                displaySrc
              );
            }}
          />

          {/* LOADER */}

          {!imageLoaded && (
            <div
              className="
                absolute
                inset-0

                flex
                items-center
                justify-center
              "
            >
              <div
                className="
                  h-7
                  w-7

                  animate-spin

                  rounded-full

                  border-2
                  border-white/20
                  border-t-white/80
                "
              />
            </div>
          )}

        </motion.div>

        {/* ==================================================
            FLECHA DERECHA
        ================================================== */}

        <button
          type="button"

          onClick={(event) => {
            event.stopPropagation();
            next();
          }}

          className="
            absolute

            right-3
            sm:right-4
            md:right-8

            top-1/2
            -translate-y-1/2

            z-50

            flex
            h-11
            w-11

            items-center
            justify-center

            rounded-full

            bg-white/10
            backdrop-blur-md

            border
            border-white/15

            text-white/80

            transition-all
            duration-200

            hover:bg-white/10
            hover:text-white

            active:scale-95

            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-white/40
          "

          aria-label="Next image"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M9 6L15 12L9 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* ==================================================
            CONTADOR
        ================================================== */}

        <div
          className="
            absolute

            top-4
            left-1/2
            -translate-x-1/2

            z-50

            rounded-full

            bg-black/30

            px-4
            py-1

            text-sm
            text-white/90

            backdrop-blur-md
          "
        >
          {currentIndex + 1} / {total}
        </div>

        {/* ==================================================
            BOTÓN CERRAR
        ================================================== */}

        <button
          type="button"

          onClick={(event) => {
            event.stopPropagation();
            close();
          }}

          className="
            absolute

            top-4
            right-4

            md:top-6
            md:right-6

            z-50

            flex
            h-11
            w-11

            items-center
            justify-center

            rounded-full

            bg-white/10
            backdrop-blur-md

            text-2xl
            font-light
            leading-none

            text-white/70

            transition-all
            duration-200

            hover:bg-white/10
            hover:text-white

            active:scale-95

            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-white/40
          "

          aria-label="Close image"
        >
          ×
        </button>

      </motion.div>

    </AnimatePresence>
  );
}