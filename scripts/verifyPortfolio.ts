import { config } from "dotenv";
import {
  deepStrictEqual,
  equal,
  ok,
} from "node:assert/strict";

import {
  artworks,
  portfolioCategories,
  portfolioGroups,
  portfolioSections as portfolioSectionsTable,
} from "../lib/db/schema/portfolio";

import {
  portfolioSections as portfolioSectionsData,
} from "../data/portfolio";

config({
  path: ".env.local",
});

async function main() {
  const { db } =
    await import("../lib/db");

  /*
   * ============================================================
   * READ COMPLETE DATABASE
   * ============================================================
   */

  const sectionRows =
    await db
      .select()
      .from(portfolioSectionsTable);

  const groupRows =
    await db
      .select()
      .from(portfolioGroups);

  const categoryRows =
    await db
      .select()
      .from(portfolioCategories);

  const artworkRows =
    await db
      .select()
      .from(artworks);

  /*
   * ============================================================
   * EXPECTED COUNTS FROM STATIC SOURCE
   * ============================================================
   */

  const expectedStats = {
    sections:
      portfolioSectionsData.length,

    groups:
      portfolioSectionsData.reduce(
        (total, section) =>
          total +
          section.data.groups.length,
        0
      ),

    categories:
      portfolioSectionsData.reduce(
        (total, section) =>
          total +
          section.data.groups.reduce(
            (groupTotal, group) =>
              groupTotal +
              group.subcategories.length,
            0
          ),
        0
      ),

    artworks:
      portfolioSectionsData.reduce(
        (total, section) =>
          total +
          section.data.groups.reduce(
            (groupTotal, group) =>
              groupTotal +
              group.subcategories.reduce(
                (
                  categoryTotal,
                  category
                ) =>
                  categoryTotal +
                  category.artworks.length,
                0
              ),
            0
          ),
        0
      ),
  };

  /*
   * ============================================================
   * COUNT VALIDATION
   * ============================================================
   */

  equal(
    sectionRows.length,
    expectedStats.sections,
    "Section count does not match"
  );

  equal(
    groupRows.length,
    expectedStats.groups,
    "Group count does not match"
  );

  equal(
    categoryRows.length,
    expectedStats.categories,
    "Category count does not match"
  );

  equal(
    artworkRows.length,
    expectedStats.artworks,
    "Artwork count does not match"
  );

  /*
   * ============================================================
   * TRANSITIONAL STATE VALIDATION
   * ============================================================
   */

  for (const section of sectionRows) {
    equal(
      section.isVisible,
      true,
      `Section "${section.slug}" is not visible`
    );
  }

  for (const group of groupRows) {
    equal(
      group.isVisible,
      true,
      `Group "${group.slug}" is not visible`
    );
  }

  for (const category of categoryRows) {
    equal(
      category.isVisible,
      true,
      `Category "${category.code}" is not visible`
    );
  }

  for (const artwork of artworkRows) {
    equal(
      artwork.status,
      "published",
      `Artwork "${artwork.slug}" is not published`
    );

    ok(
      artwork.legacyId !== null,
      `Artwork "${artwork.slug}" has no legacyId`
    );

    /*
     * Images have not moved to R2 yet.
     */
    equal(
      artwork.storageKey,
      null,
      `Artwork "${artwork.slug}" already has a storageKey`
    );

    equal(
      artwork.width,
      null,
      `Artwork "${artwork.slug}" already has width`
    );

    equal(
      artwork.height,
      null,
      `Artwork "${artwork.slug}" already has height`
    );
  }

  /*
   * ============================================================
   * RECONSTRUCT CURRENT FRONTEND SHAPE
   * ============================================================
   */

  const reconstructedPortfolio =
    [...sectionRows]
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder
      )
      .map((section) => {
        const sectionGroups =
          groupRows
            .filter(
              (group) =>
                group.sectionId ===
                section.id
            )
            .sort(
              (a, b) =>
                a.sortOrder -
                b.sortOrder
            );

        return {
          title:
            section.navLabel,

          slug:
            section.slug,

          data: {
            slug:
              section.slug,

            title:
              section.title,

            groups:
              sectionGroups.map(
                (group) => {
                  const groupCategories =
                    categoryRows
                      .filter(
                        (category) =>
                          category.groupId ===
                          group.id
                      )
                      .sort(
                        (a, b) =>
                          a.sortOrder -
                          b.sortOrder
                      );

                  return {
                    /*
                     * Current static data uses
                     * the same value for group
                     * id and slug.
                     */
                    id:
                      group.slug,

                    slug:
                      group.slug,

                    title:
                      group.title,

                    subcategories:
                      groupCategories.map(
                        (category) => {
                          const categoryArtworks =
                            artworkRows
                              .filter(
                                (artwork) =>
                                  artwork.categoryId ===
                                  category.id
                              )
                              .sort(
                                (a, b) =>
                                  a.sortOrder -
                                  b.sortOrder
                              );

                          return {
                            /*
                             * Current Subcategory.id
                             * was preserved as code.
                             */
                            id:
                              category.code,

                            slug:
                              category.slug,

                            title:
                              category.title,

                            artworks:
                              categoryArtworks.map(
                                (
                                  artwork
                                ) => {
                                  ok(
                                    artwork.legacyId !==
                                      null,
                                    `Artwork "${artwork.slug}" has no legacyId`
                                  );

                                  return {
                                    id:
                                      artwork.legacyId,

                                    slug:
                                      artwork.slug,

                                    src:
                                      artwork.imageSrc,

                                    title:
                                      artwork.title,

                                    orientation:
                                      artwork.orientation,

                                    featured:
                                      artwork.featured,

                                    alt:
                                      artwork.alt,
                                  };
                                }
                              ),
                          };
                        }
                      ),
                  };
                }
              ),
          },
        };
      });

  /*
   * ============================================================
   * COMPLETE DATA COMPARISON
   * ============================================================
   */

  deepStrictEqual(
    reconstructedPortfolio,
    portfolioSectionsData
  );

  console.log(
    "Full portfolio verification successful ✅"
  );

  console.log(expectedStats);
}

main().catch((error) => {
  console.error(
    "Full portfolio verification failed ❌"
  );

  console.error(error);

  process.exit(1);
});