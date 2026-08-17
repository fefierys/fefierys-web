'use client';

import { useEffect, useState } from 'react';
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

  // Para precargar las imágenes vecinas
  previousArtwork?: Artwork;
  nextArtwork?: Artwork;
}

export default function ArtworkLightbox({
  artwork,
  currentIndex,
  total,
  previous,
  next,
  close,
  previousArtwork,
  nextArtwork,
}: ArtworkLightboxProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  /*
   * Cada vez que cambia la imagen actual,
   * volvemos a esperar su carga.
   */
  useEffect(() => {
    setImageLoaded(false);
  }, [artwork.src]);

  /*
   * Precarga de imagen anterior y siguiente.
   *
   * Esto hace que cuando el usuario navegue,
   * normalmente la imagen ya esté descargada.
   */
  useEffect(() => {
    const preloadImage = (src?: string) => {
      if (!src) return;

      const img = new window.Image();
      img.src = src;
    };

    preloadImage(previousArtwork?.src);
    preloadImage(nextArtwork?.src);
  }, [previousArtwork?.src, nextArtwork?.src]);

  /*
   * Teclado + bloqueo del scroll.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }

      if (e.key === 'ArrowLeft') {
        previous();
      }

      if (e.key === 'ArrowRight') {
        next();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [close, previous, next]);

  return (
    <AnimatePresence>
      <motion.div
        className="
          fixed inset-0 z-100
          flex items-center justify-center
          bg-black/85
          backdrop-blur-lg
          p-6
          md:p-10
        "
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >

        {/* =========================
            FLECHA IZQUIERDA
        ========================== */}
        <button
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

            text-white/80
            hover:text-white

            transition-all
            duration-300
            hover:scale-110
            active:scale-95
          "
          aria-label="Previous image"
        >
          <svg
            width="42"
            height="42"
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

        {/* =========================
            IMAGEN
        ========================== */}
        <motion.div
          className="
            relative
            z-10
            max-w-6xl
            max-h-full
          "
          onClick={(e) => e.stopPropagation()}
          initial={{
            opacity: 0,
            scale: 0.96,
            y: 12,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            scale: 0.98,
            y: 8,
          }}
          transition={{
            duration: 0.28,
            ease: [0.22, 1, 0.36, 1],
          }}
        >

          {/* Loader */}
          {!imageLoaded && (
            <div
              className="
                absolute
                inset-0
                z-20
                flex
                items-center
                justify-center
                rounded-2xl
                bg-black/20
              "
            >
              <div
                className="
                  h-8
                  w-8
                  animate-spin
                  rounded-full
                  border
                  border-white/20
                  border-t-white/80
                "
              />
            </div>
          )}

          <Image
            key={artwork.src}
            src={artwork.src}
            alt={artwork.alt}
            width={2400}
            height={2400}
            className={`
              max-h-[90vh]
              w-auto
              rounded-2xl
              shadow-2xl

              transition-all
              duration-500

              ${
                imageLoaded
                  ? 'opacity-100'
                  : 'opacity-0'
              }
            `}
            priority
            onLoad={() => {
              setImageLoaded(true);
            }}
          />
        </motion.div>

        {/* =========================
            FLECHA DERECHA
        ========================== */}
        <button
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

            text-white/80
            hover:text-white

            transition-all
            duration-300
            hover:scale-110
            active:scale-95
          "
          aria-label="Next image"
        >
          <svg
            width="42"
            height="42"
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

        {/* =========================
            CONTADOR
        ========================== */}
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

            transition-opacity
            duration-300

            ${
              imageLoaded
                ? 'opacity-100'
                : 'opacity-60'
            }
          "
        >
          {imageLoaded
            ? `${currentIndex + 1} / ${total}`
            : '...'}
        </div>

        {/* =========================
            BOTÓN CERRAR
        ========================== */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          className="
            absolute
            top-4
            right-4
            md:top-6
            md:right-6
            z-50

            text-3xl
            text-white/70

            hover:text-white

            transition-all
            duration-300

            hover:scale-110
            active:scale-95
          "
          aria-label="Close image"
        >
          ×
        </button>
      </motion.div>
    </AnimatePresence>
  );
}