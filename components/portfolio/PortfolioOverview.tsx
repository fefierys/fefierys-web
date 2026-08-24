'use client';

import Link from 'next/link';

import {
  useMemo,
  useState,
} from 'react';

import type {
  Artwork,
  PortfolioData,
} from '@/data/portfolio/types';

import ArtworkGrid from './ArtworkGrid';

interface PortfolioOverviewProps {
  data: PortfolioData;
  description: string;
  artworkLimit?: number;
}

interface OverviewItem {
  artwork: Artwork;
  href: string;
}

export default function PortfolioOverview({
  data,
  description,
  artworkLimit = 18,
}: PortfolioOverviewProps) {
  /*
   * ============================================================
   * COLLECTION ABIERTA
   * ============================================================
   *
   * Esta selección es únicamente visual.
   *
   * - NO cambia la URL.
   * - NO cambia la galería.
   * - NO selecciona automáticamente una Category.
   *
   * Solo decide qué lista de Categories mostramos.
   */

  const [
    openGroupSlug,
    setOpenGroupSlug,
  ] = useState<string | null>(
    null
  );

  const openGroup =
    data.groups.find(
      (group) =>
        group.slug ===
        openGroupSlug
    ) ?? null;

  /*
   * ============================================================
   * CAMBIAR COLLECTION
   * ============================================================
   *
   * Pulsar nuevamente la misma Collection
   * la cierra.
   */

  function changeGroup(
    groupSlug: string
  ) {
    setOpenGroupSlug(
      (current) =>
        current === groupSlug
          ? null
          : groupSlug
    );
  }

  /*
   * ============================================================
   * OVERVIEW ARTWORKS
   * ============================================================
   *
   * Selección estable y distribuida entre
   * las distintas Categories.
   *
   * No usamos Math.random().
   *
   * Más adelante el CMS decidirá cuáles
   * artworks aparecen en este overview.
   */

  const overviewItems =
    useMemo<OverviewItem[]>(
      () => {
        const buckets =
          data.groups.flatMap(
            (group) =>
              group.subcategories.map(
                (category) => ({
                  group,
                  category,
                })
              )
          );

        const result:
          OverviewItem[] = [];

        let artworkIndex = 0;

        while (
          result.length <
          artworkLimit
        ) {
          let foundArtwork =
            false;

          for (
            const bucket of buckets
          ) {
            const artwork =
              bucket.category
                .artworks[
                artworkIndex
              ];

            if (!artwork) {
              continue;
            }

            foundArtwork = true;

            result.push({
              artwork,

              href:
                `/portfolio/${data.slug}` +
                `/${bucket.group.slug}` +
                `/${bucket.category.slug}` +
                `/${artwork.slug}`,
            });

            if (
              result.length >=
              artworkLimit
            ) {
              break;
            }
          }

          if (!foundArtwork) {
            break;
          }

          artworkIndex++;
        }

        return result;
      },
      [
        data,
        artworkLimit,
      ]
    );

  const overviewArtworks =
    useMemo(
      () =>
        overviewItems.map(
          (item) =>
            item.artwork
        ),
      [overviewItems]
    );

  /*
   * ============================================================
   * ARTWORK URL MAP
   * ============================================================
   *
   * Cada artwork del overview pertenece
   * a una Category distinta.
   *
   * Guardamos su URL completa para que
   * ArtworkGrid pueda navegar al lugar real
   * donde vive esa obra.
   */

  const artworkHrefMap =
    useMemo(() => {
      const map =
        new WeakMap<
          Artwork,
          string
        >();

      for (
        const item of
        overviewItems
      ) {
        map.set(
          item.artwork,
          item.href
        );
      }

      return map;
    }, [overviewItems]);

  return (
    <section className="min-h-screen px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl text-white">

        {/* ==================================================
            TITLE
        ================================================== */}

        <h1 className="mb-5 text-center text-3xl font-light md:text-5xl">
          {data.title}
        </h1>

        {/* ==================================================
            DESCRIPTION
        ================================================== */}

        <p
          className="
            mx-auto
            mb-12
            max-w-3xl

            text-center
            text-sm
            leading-relaxed
            text-white/70

            md:mb-16
            md:text-base
          "
        >
          {description}
        </p>

        {/* ==================================================
            COLLECTION
        ================================================== */}

        <div className="mb-8 flex flex-col items-center">
          <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-white/45">
            Collection
          </p>

          <div className="flex flex-wrap justify-center gap-6 md:gap-16">
            {data.groups.map(
              (group) => {
                const isOpen =
                  openGroupSlug ===
                  group.slug;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() =>
                      changeGroup(
                        group.slug
                      )
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
                        isOpen
                          ? 'text-white'
                          : 'text-white/45 hover:text-white'
                      }
                    >
                      {group.title}
                    </span>

                    {isOpen && (
                      <span
                        className="
                          absolute
                          left-0
                          right-0
                          -bottom-0.5
                          h-px
                          bg-white
                        "
                      />
                    )}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ==================================================
            CATEGORY

            Solo aparece cuando abrimos una Collection.

            Ninguna Category queda seleccionada
            automáticamente.
        ================================================== */}

        {openGroup && (
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
              {openGroup
                .subcategories
                .map(
                  (
                    subcategory
                  ) => (
                    <Link
                      key={
                        subcategory.id
                      }
                      href={
                        `/portfolio/${data.slug}` +
                        `/${openGroup.slug}` +
                        `/${subcategory.slug}`
                      }
                      className="
                        relative
                        pb-2

                        text-[11px]
                        uppercase
                        tracking-[0.15em]

                        text-white/50

                        transition-colors
                        duration-300

                        hover:text-white

                        md:text-sm
                      "
                    >
                      {
                        subcategory.title
                      }
                    </Link>
                  )
                )}
            </div>
          </div>
        )}

        {/* ==================================================
            OVERVIEW GALLERY

            Abrir una Collection NO cambia esta galería.

            Tampoco existe Commission button porque
            todavía no hay una Category real seleccionada.
        ================================================== */}

        <ArtworkGrid
          artworks={
            overviewArtworks
          }
          portfolioSlug={
            data.slug
          }
          getArtworkHref={(
            artwork
          ) =>
            artworkHrefMap.get(
              artwork
            ) ?? null
          }
        />

      </div>
    </section>
  );
}