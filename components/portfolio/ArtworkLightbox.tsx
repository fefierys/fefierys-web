'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Artwork } from '@/data/portfolio/types';
import { AnimatePresence, motion } from 'framer-motion';

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
   * HISTORIAL
   * ============================================================
   */

  const historyEntryAddedRef = useRef(false);
  const closingRef = useRef(false);

  /*
   * ============================================================
   * CARGA DE IMAGEN
   * ============================================================
   */

  const [imageLoaded, setImageLoaded] = useState(false);

  /*
   * ============================================================
   * CERRAR LIGHTBOX
   * ============================================================
   *
   * Esta función se declara antes de los effects porque
   * el listener de teclado necesita acceder a ella.
   */

  const handleClose = useCallback(() => {
    if (closingRef.current) return;

    closingRef.current = true;

    /*
     * Si añadimos una entrada al historial al abrir el lightbox,
     * retrocedemos una sola vez.
     *
     * El evento popstate será el encargado de ejecutar close().
     */

    if (historyEntryAddedRef.current) {
      window.history.back();
      return;
    }

    /*
     * Fallback de seguridad.
     */
    close();
  }, [close]);

  /*
   * ============================================================
   * HISTORIAL + TECLADO
   * ============================================================
   */

  useEffect(() => {
    /*
     * Creamos una entrada adicional en el historial.
     *
     * La URL permanece exactamente igual.
     *
     * Esto permite que:
     *
     * Portfolio
     *     ↓
     * Lightbox
     *     ↓
     * Atrás
     *
     * cierre primero el Lightbox.
     */

    window.history.pushState(
      { lightbox: true },
      '',
      window.location.href
    );

    historyEntryAddedRef.current = true;

    /*
     * ==========================================================
     * BOTÓN / GESTO "ATRÁS"
     * ==========================================================
     */

    const handlePopState = () => {
      /*
       * El navegador ya hizo el back.
       *
       * No hacemos history.back() nuevamente.
       */

      historyEntryAddedRef.current = false;
      closingRef.current = true;

      close();
    };

    /*
     * ==========================================================
     * TECLADO
     * ==========================================================
     */

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key === 'ArrowLeft') {
        previous();
        return;
      }

      if (e.key === 'ArrowRight') {
        next();
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    /*
     * Bloqueamos el scroll mientras el Lightbox está abierto.
     */

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    /*
     * ==========================================================
     * CLEANUP
     * ==========================================================
     */

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);

      document.body.style.overflow = previousOverflow;
    };
  }, [
    close,
    handleClose,
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
        onClick={handleClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >

        {/* ==================================================
            FLECHA IZQUIERDA
        ================================================== */}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
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
          key={artwork.id}
          className="
            relative
            z-10

            max-w-6xl
            max-h-full
          "
          onClick={(e) => e.stopPropagation()}
          initial={{
            opacity: 0,
            scale: 0.97,
          }}
          animate={{
            opacity: imageLoaded ? 1 : 0,
            scale: imageLoaded ? 1 : 0.97,
          }}
          transition={{
            duration: 0.22,
            ease: 'easeOut',
          }}
        >
          <Image
            src={artwork.src}
            alt={artwork.title}
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
            onLoad={() => setImageLoaded(true)}
          />

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
          onClick={(e) => {
            e.stopPropagation();
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
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
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