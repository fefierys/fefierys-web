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

function normalizeStaticPortfolio(
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
                  (artwork) => ({
                    ...artwork,

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
      normalizeStaticPortfolio(
        staticSection.data
      );

    const comparableRepositoryData =
      normalizeRepositoryPortfolio(
        repositoryData
      );

    deepStrictEqual(
      comparableRepositoryData,
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