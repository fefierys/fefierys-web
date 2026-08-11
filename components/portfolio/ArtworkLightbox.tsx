'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { Artwork } from '@/data/portfolio/types';
import { AnimatePresence, motion } from 'framer-motion';

interface ArtworkLightboxProps {
  artwork: Artwork;
  hasPrevious: boolean;
  hasNext: boolean;
  previous: () => void;
  next: () => void;
  close: () => void;
}

export default function ArtworkLightbox({
  artwork,
  hasPrevious,
  hasNext,
  previous,
  next,
  close,
}: ArtworkLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft' && hasPrevious) previous();
      if (e.key === 'ArrowRight' && hasNext) next();
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [close, previous, next, hasPrevious, hasNext]);

  return (
    <AnimatePresence>
      <motion.div
        className="
          fixed inset-0 z-100
          flex items-center justify-center
          bg-black/85 backdrop-blur-lg
          p-6 md:p-10
        "
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {hasPrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              previous();
            }}
            className="
              absolute left-4 md:left-8
              text-white/80 hover:text-white
              transition
            "
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 6L9 12L15 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <motion.div
          className="relative max-w-6xl max-h-full"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <Image
            src={artwork.src}
            alt={artwork.title}
            width={2400}
            height={2400}
            className="max-h-[90vh] w-auto rounded-2xl shadow-2xl"
            priority
          />
        </motion.div>

        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="
              absolute right-4 md:right-8
              text-white/80 hover:text-white
              transition
            "
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 6L15 12L9 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            close();
          }}
          className="
            absolute top-4 right-4
            md:top-6 md:right-6
            text-2xl text-white/70
            hover:text-white
            transition
          "
        >
          ×
        </button>
      </motion.div>
    </AnimatePresence>
  );
}