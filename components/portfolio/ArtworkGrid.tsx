'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
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
  const PAGE_UNITS = 6;

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

  const pages = useMemo(() => {
    return buildPortfolioPages(artworks);
  }, [artworks]);

  const safeCurrentPage = Math.min(
    currentPage,
    Math.max(pages.length - 1, 0)
  );

  const pageArtworks = pages[safeCurrentPage] ?? [];

  const selectedArtwork =
    selectedIndex !== null
      ? pageArtworks[selectedIndex]
      : null;

  return (
    <>
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

      {selectedArtwork && (
        <ArtworkLightbox
          artwork={selectedArtwork}
          hasPrevious={
            !(safeCurrentPage === 0 && selectedIndex === 0)
          }
          hasNext={
            !(
              safeCurrentPage === pages.length - 1 &&
              selectedIndex === pageArtworks.length - 1
            )
          }
          previous={() => {
            if (selectedIndex === null) return;

            if (selectedIndex > 0) {
              setSelectedIndex(selectedIndex - 1);
            } else if (safeCurrentPage > 0) {
              const previousPage = safeCurrentPage - 1;
              setCurrentPage(previousPage);
              setSelectedIndex(
                pages[previousPage].length - 1
              );
            }
          }}
          next={() => {
            if (selectedIndex === null) return;

            if (selectedIndex < pageArtworks.length - 1) {
              setSelectedIndex(selectedIndex + 1);
            } else if (safeCurrentPage < pages.length - 1) {
              const nextPage = safeCurrentPage + 1;
              setCurrentPage(nextPage);
              setSelectedIndex(0);
            }
          }}
          close={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}