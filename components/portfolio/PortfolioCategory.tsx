'use client';

import { useState } from 'react';
import { PortfolioData } from '@/data/portfolio/types';
import ArtworkGrid from './ArtworkGrid';
import { AnimatePresence, motion } from 'framer-motion';
import { commissions } from '@/data/portfolio/commissions';
import CommissionModal from './CommissionModal';

interface PortfolioCategoryProps {
  data: PortfolioData;
}

export default function PortfolioCategory({
  data,
}: PortfolioCategoryProps) {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const selectedGroup = data.groups[selectedGroupIndex];

  const [selectedSubcategoryIndex, setSelectedSubcategoryIndex] = useState(0);

  const selectedSubcategory =
    selectedGroup.subcategories[selectedSubcategoryIndex];

  // Estado del modal de comisión
  const [commissionOpen, setCommissionOpen] = useState(false);

  // Comisión asociada a la subcategoría actual
  const commission = commissions[selectedSubcategory.id];

  function changeGroup(index: number) {
    setSelectedGroupIndex(index);

    // Cuando cambiamos de grupo volvemos a la primera subcategoría
    setSelectedSubcategoryIndex(0);
  }

  return (
    <>
      <section className="min-h-screen px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl text-white">
          {/* Título */}
          <h1 className="mb-12 text-center text-3xl font-light md:mb-16 md:text-5xl">
            {data.title}
          </h1>

          {/* COLLECTION */}
          <div className="mb-8 flex flex-col items-center">
            <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
              Collection
            </p>

            <div className="flex flex-wrap justify-center gap-6 md:gap-16">
              {data.groups.map((group, index) => (
                <button
                  key={group.id}
                  onClick={() => changeGroup(index)}
                  className="
                    relative
                    pb-2
                    text-sm
                    md:text-lg
                    uppercase
                    tracking-[0.16em]
                    transition-colors
                    duration-300
                  "
                >
                  <span
                    className={
                      selectedGroupIndex === index
                        ? 'text-white'
                        : 'text-white/45 hover:text-white'
                    }
                  >
                    {group.title}
                  </span>

                  {selectedGroupIndex === index && (
                    <motion.div
                      layoutId="group-underline"
                      className="
                        absolute
                        left-0
                        right-0
                        -bottom-0.5
                        h-px
                        bg-white
                      "
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 40,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* CATEGORY */}
          <div className="mb-14 md:mb-20 flex flex-col items-center">
            <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
              Category
            </p>

            <div
              className="
                flex
                flex-wrap
                justify-center
                gap-4
                md:gap-8
              "
            >
              {selectedGroup.subcategories.map((subcategory, index) => (
                <button
                  key={subcategory.id}
                  onClick={() => setSelectedSubcategoryIndex(index)}
                  className="
                    relative
                    pb-2
                    text-[11px]
                    md:text-sm
                    tracking-[0.15em]
                    uppercase
                    transition-colors
                    duration-300
                  "
                >
                  <span
                    className={
                      selectedSubcategoryIndex === index
                        ? 'text-white'
                        : 'text-white/50 hover:text-white'
                    }
                  >
                    {subcategory.title}
                  </span>

                  {selectedSubcategoryIndex === index && (
                    <motion.div
                      layoutId="subcategory-underline"
                      className="
                        absolute
                        left-0
                        right-0
                        -bottom-0.5
                        h-px
                        bg-white
                      "
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 40,
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* BOTÓN DE COMISIÓN */}
          {commission && (
            <div className="mb-10 flex justify-center md:mb-12 md:justify-end">
              <button
                onClick={() => setCommissionOpen(true)}
                className="
                  group inline-flex w-full max-w-sm md:w-auto
                  items-center justify-center gap-2
                  rounded-full border border-white/20
                  bg-white/10 px-5 py-3
                  text-xs uppercase tracking-[0.18em]
                  text-white transition duration-300
                  hover:bg-white hover:text-[#2f3558]
                "
              >
                <svg
                  className="h-4 w-4 transition group-hover:scale-110"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>

                Commission this style
              </button>
            </div>
          )}

          {/* Galería */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedSubcategory.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{
                duration: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <ArtworkGrid artworks={selectedSubcategory.artworks} />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Modal de comisión */}
      {commission && (
        <CommissionModal
          open={commissionOpen}
          onClose={() => setCommissionOpen(false)}
          commission={commission}
          styleTitle={data.title}
          collectionTitle={selectedGroup.title}
          categoryTitle={selectedSubcategory.title}
        />
      )}
    </>
  );
}