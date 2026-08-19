'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

import { PortfolioData } from '@/data/portfolio/types';
import { commissions } from '@/data/portfolio/commissions';

import ArtworkGrid from './ArtworkGrid';

const CommissionModal = dynamic(
  () => import('./CommissionModal')
);

interface PortfolioCategoryProps {
  data: PortfolioData;
  slug?: string[];
}

export default function PortfolioCategory({
  data,
  slug,
}: PortfolioCategoryProps) {
  const router = useRouter();

  /*
   * URL:
   *
   * /portfolio/semi-realism/general/ref-sheets
   *
   * slug[0] = general
   * slug[1] = ref-sheets
   *
   * Y si hay artwork:
   *
   * /portfolio/semi-realism/general/ref-sheets/elf-character-dnd-ref-sheet-essentials
   *
   * slug[2] = elf-character-dnd-ref-sheet-essentials
   */
  const groupSlug = slug?.[0];
  const categorySlug = slug?.[1];
  const artworkSlug = slug?.[2];

  /*
   * COLLECTION seleccionada
   */
  const foundGroupIndex = data.groups.findIndex(
    (group) => group.slug === groupSlug
  );

  const selectedGroupIndex =
    foundGroupIndex === -1
      ? 0
      : foundGroupIndex;

  const selectedGroup =
    data.groups[selectedGroupIndex];

  /*
   * CATEGORY seleccionada
   */
  const foundSubcategoryIndex =
    selectedGroup.subcategories.findIndex(
      (subcategory) =>
        subcategory.slug === categorySlug
    );

  const selectedSubcategoryIndex =
    foundSubcategoryIndex === -1
      ? 0
      : foundSubcategoryIndex;

  const selectedSubcategory =
    selectedGroup.subcategories[
      selectedSubcategoryIndex
    ];

  /*
   * Estado del modal de comisión
   */
  const [commissionOpen, setCommissionOpen] =
    useState(false);

  useEffect(() => {
    if (commissionOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [commissionOpen]);

  /*
   * Comisión asociada a la categoría actual
   */
  const commission =
    commissions[selectedSubcategory.id];

  /*
   * Punto al que vuelve el scroll al cambiar
   * de página dentro de ArtworkGrid.
   */
  const commissionButtonRef =
    useRef<HTMLDivElement | null>(null);

  /*
   * Cambiar COLLECTION
   *
   * Al cambiar de colección entramos a su
   * primera subcategoría.
   */
  function changeGroup(index: number) {
    const group = data.groups[index];

    if (!group) return;

    const firstSubcategory =
      group.subcategories[0];

    if (!firstSubcategory) return;

    router.replace(
      `/portfolio/${data.slug}/${group.slug}/${firstSubcategory.slug}`
    );
  }

  /*
   * Cambiar CATEGORY
   */
  function changeSubcategory(
    subcategorySlug: string
  ) {
    router.replace(
      `/portfolio/${data.slug}/${selectedGroup.slug}/${subcategorySlug}`
    );
  }

  /*
   * Scroll hacia botón de comisión.
   */
  const scrollToCommission = () => {
    if (!commissionButtonRef.current) return;

    const navbarOffset = 100;

    const y =
      commissionButtonRef.current
        .getBoundingClientRect().top +
      window.scrollY -
      navbarOffset;

    window.scrollTo({
      top: y,
      behavior: 'smooth',
    });
  };

  return (
    <>
      <section className="min-h-screen px-6 py-24 md:py-32">
        <div className="mx-auto max-w-6xl text-white">

          {/* TÍTULO */}
          <h1 className="mb-12 text-center text-3xl font-light md:mb-16 md:text-5xl">
            {data.title}
          </h1>

          {/* COLLECTION */}
          <div className="mb-8 flex flex-col items-center">
            <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
              Collection
            </p>

            <div className="flex flex-wrap justify-center gap-6 md:gap-16">
              {data.groups.map(
                (group, index) => (
                  <button
                    type="button"
                    key={group.id}
                    onClick={() =>
                      changeGroup(index)
                    }
                    className="
                      relative
                      pb-2
                      text-sm
                      uppercase
                      tracking-[0.16em]
                      transition-colors
                      duration-300
                      md:text-lg
                    "
                  >
                    <span
                      className={
                        selectedGroupIndex ===
                        index
                          ? 'text-white'
                          : 'text-white/45 hover:text-white'
                      }
                    >
                      {group.title}
                    </span>

                    {selectedGroupIndex ===
                      index && (
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
                )
              )}
            </div>
          </div>

          {/* CATEGORY */}
          <div className="mb-14 flex flex-col items-center md:mb-20">
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
              {selectedGroup.subcategories.map(
                (subcategory, index) => (
                  <button
                    type="button"
                    key={subcategory.id}
                    onClick={() =>
                      changeSubcategory(
                        subcategory.slug
                      )
                    }
                    className="
                      relative
                      pb-2
                      text-[11px]
                      uppercase
                      tracking-[0.15em]
                      transition-colors
                      duration-300
                      md:text-sm
                    "
                  >
                    <span
                      className={
                        selectedSubcategoryIndex ===
                        index
                          ? 'text-white'
                          : 'text-white/50 hover:text-white'
                      }
                    >
                      {subcategory.title}
                    </span>

                    {selectedSubcategoryIndex ===
                      index && (
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
                )
              )}
            </div>
          </div>

          {/* BOTÓN DE COMISIÓN */}
          {commission && (
            <div
              ref={commissionButtonRef}
              className="mb-10 flex justify-center md:mb-12 md:justify-end"
            >
              <button
                type="button"
                onClick={() =>
                  setCommissionOpen(true)
                }
                className="
                  group
                  inline-flex
                  w-full
                  max-w-sm
                  items-center
                  justify-center
                  gap-2
                  rounded-full
                  border
                  border-white/20
                  bg-white/10
                  px-5
                  py-3
                  text-xs
                  uppercase
                  tracking-[0.18em]
                  text-white
                  transition
                  duration-300
                  hover:bg-white
                  hover:text-[#2f3558]
                  md:w-auto
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

          {/* GALERÍA */}
          <div key={selectedSubcategory.id}>
            <ArtworkGrid
              artworks={
                selectedSubcategory.artworks
              }
              scrollTargetRef={
                scrollToCommission
              }
              initialArtworkSlug={
                artworkSlug
              }
              portfolioSlug={
                data.slug
              }
              groupSlug={
                selectedGroup.slug
              }
              categorySlug={
                selectedSubcategory.slug
              }
            />
          </div>
        </div>
      </section>

      {/* MODAL DE COMISIÓN */}
      {commission && (
        <CommissionModal
          key={commission.id}
          open={commissionOpen}
          onClose={() =>
            setCommissionOpen(false)
          }
          commission={commission}
          styleTitle={data.title}
          collectionTitle={
            selectedGroup.title
          }
          categoryTitle={
            selectedSubcategory.title
          }
        />
      )}
    </>
  );
}