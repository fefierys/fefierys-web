import { config } from "dotenv";
import {
  deepStrictEqual,
  ok,
} from "node:assert/strict";

import {
  portfolioSections as staticPortfolioSections,
} from "../data/portfolio";

import type {
  PortfolioData,
} from "../data/portfolio/types";

config({
  path: ".env.local",
});

/*
 * ============================================================
 * PORTFOLIO COMPARISON NORMALIZATION
 * ============================================================
 *
 * The static portfolio files are historical migration fixtures.
 *
 * Their Artwork.id values are legacy numeric IDs, while the
 * runtime repository now exposes the PostgreSQL UUID.
 *
 * storageKey is also runtime/storage infrastructure data that
 * does not belong to the original static fixtures.
 *
 * Therefore migration parity compares public portfolio content,
 * structure, order, and presentation fields while intentionally
 * ignoring:
 *
 * - Artwork.id
 * - Artwork.storageKey
 */

function normalizePortfolioForComparison(
  data: PortfolioData
) {
  return {
    slug:
      data.slug,

    title:
      data.title,

    groups:
      data.groups.map(
        (group) => ({
          id:
            group.id,

          slug:
            group.slug,

          title:
            group.title,

          subcategories:
            group.subcategories.map(
              (category) => ({
                id:
                  category.id,

                slug:
                  category.slug,

                title:
                  category.title,

                artworks:
                  category.artworks.map(
                    (artwork) => ({
                      slug:
                        artwork.slug,

                      src:
                        artwork.src,

                      title:
                        artwork.title,

                      orientation:
                        artwork.orientation,

                      featured:
                        artwork.featured,

                      alt:
                        artwork.alt,

                      thumbnailFocusX:
                        artwork.thumbnailFocusX ??
                        50,

                      thumbnailFocusY:
                        artwork.thumbnailFocusY ??
                        50,
                    })
                  ),
              })
            ),
        })
      ),
  };
}

function normalizeRepositoryPortfolio(
  data: PortfolioData
): PortfolioData {
  return {
    ...data,

    groups: data.groups.map(
      (group) => ({
        ...group,

        subcategories:
          group.subcategories.map(
            (category) => ({
              ...category,

              artworks:
                category.artworks.map(
                  ({
                    storageKey:
                      _storageKey,
                    ...artwork
                  }) => artwork
                ),
            })
          ),
      })
    ),
  };
}

async function main() {
  /*
   * Dynamic import is intentional.
   *
   * dotenv must load DATABASE_URL before
   * lib/db is evaluated.
   */
  const {
    getPortfolioNavigation,
    getPortfolioSectionBySlug,
  } =
    await import(
      "../lib/repositories/portfolioRepository"
    );

  /*
   * ==========================================================
   * VERIFY ALL THREE PORTFOLIOS
   * ==========================================================
   */

  for (
    const staticSection of
    staticPortfolioSections
  ) {
    const repositoryData =
      await getPortfolioSectionBySlug(
        staticSection.slug
      );

    ok(
      repositoryData,
      `Repository did not return "${staticSection.slug}"`
    );

    const expectedData =
      normalizePortfolioForComparison(
        staticSection.data
      );

    const actualData =
      normalizePortfolioForComparison(
        repositoryData
      );

    deepStrictEqual(
      actualData,
      expectedData
    );

    console.log(
      `Repository verified: ${staticSection.slug} ✅`
    );
  }

  /*
   * ==========================================================
   * VERIFY NAVIGATION
   * ==========================================================
   */

  const navigation =
    await getPortfolioNavigation();

  const expectedNavigation =
    staticPortfolioSections.map(
      (section) => ({
        slug: section.slug,
        label: section.title,
      })
    );

  deepStrictEqual(
    navigation,
    expectedNavigation
  );

  console.log(
    "Portfolio navigation verified ✅"
  );

  console.log({
    sections:
      staticPortfolioSections.length,

    navigation,
  });

  console.log(
    "Portfolio repository verification successful ✅"
  );
}

main().catch((error) => {
  console.error(
    "Portfolio repository verification failed ❌"
  );

  console.error(error);

  process.exit(1);
});