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

  const galleryRef = useRef<HTMLDivElement | null>(null);
  const previousPageRef = useRef(currentPage);

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

  const safeCurrentPage = Math.min(
    currentPage,
    Math.max(pages.length - 1, 0)
  );

  const pageArtworks = pages[safeCurrentPage] ?? [];

  const globalIndex =
    selectedIndex !== null
      ? artworks.findIndex((a) => a.id === pageArtworks[selectedIndex]?.id)
      : null;

  const selectedArtwork =
    globalIndex !== null && globalIndex >= 0
      ? artworks[globalIndex]
      : null;

  // Scroll solo cuando cambia la página
  useEffect(() => {
    if (previousPageRef.current === currentPage) return;

    previousPageRef.current = currentPage;

    if (galleryRef.current) {
      const navbarOffset = 96; // ajusta este valor según la altura de tu navbar
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
          {pageArtworks.map((artwork, index) => (
            <motion.div
              variants={itemVariants}
              key={artwork.id}
              onClick={() => setSelectedIndex(index)}
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
              <Image
                src={artwork.src}
                alt={artwork.alt}
                fill
                className="
                  object-cover
                  rounded-2xl

                  transition
                  duration-700

                  group-hover:scale-105
                "
              />

              <div
                className="
                  absolute inset-0
                  flex items-end
                  p-5
                  bg-gradient-to-t from-black/55 via-black/10 to-transparent
                  opacity-0
                  transition duration-300
                  group-hover:opacity-100
                "
              >
                <span
                  className="
                    text-sm
                    tracking-[0.12em]
                    uppercase
                    text-white
                  "
                >
                  {artwork.title}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {pages.length > 1 && (
        <div className="mt-12 flex items-center justify-center gap-3">
          <button
            onClick={() =>
              setCurrentPage((p) => Math.max(p - 1, 0))
            }
            disabled={safeCurrentPage === 0}
            className="
              rounded-full border border-white/10 bg-white/6
              px-4 py-2 text-sm text-white/80
              transition hover:bg-white/10
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
                h-10 w-10 rounded-full border text-sm transition
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
            disabled={safeCurrentPage === pages.length - 1}
            className="
              rounded-full border border-white/10 bg-white/6
              px-4 py-2 text-sm text-white/80
              transition hover:bg-white/10
              disabled:opacity-30
            "
          >
            Next
          </button>
        </div>
      )}

      {selectedArtwork && globalIndex !== null && (
        <ArtworkLightbox
          artwork={selectedArtwork}
          currentIndex={globalIndex}
          total={artworks.length}
          previous={() => {
            const newIndex =
              (globalIndex - 1 + artworks.length) % artworks.length;

            const newArtwork = artworks[newIndex];

            const newPage = pages.findIndex((page) =>
              page.some((item) => item.id === newArtwork.id)
            );

            const newLocalIndex = pages[newPage].findIndex(
              (item) => item.id === newArtwork.id
            );

            setCurrentPage(newPage);
            setSelectedIndex(newLocalIndex);
          }}
          next={() => {
            const newIndex = (globalIndex + 1) % artworks.length;

            const newArtwork = artworks[newIndex];

            const newPage = pages.findIndex((page) =>
              page.some((item) => item.id === newArtwork.id)
            );

            const newLocalIndex = pages[newPage].findIndex(
              (item) => item.id === newArtwork.id
            );

            setCurrentPage(newPage);
            setSelectedIndex(newLocalIndex);
          }}
          close={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}