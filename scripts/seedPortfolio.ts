import { config } from "dotenv";

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

/*
 * ============================================================
 * VALIDATE STATIC SOURCE BEFORE WRITING
 * ============================================================
 */

function validatePortfolioSource() {
  const sectionSlugs = new Set<string>();
  const categoryCodes = new Set<string>();

  let sections = 0;
  let groups = 0;
  let categories = 0;
  let artworkCount = 0;

  for (const section of portfolioSectionsData) {
    sections++;

    if (sectionSlugs.has(section.slug)) {
      throw new Error(
        `Duplicate section slug: "${section.slug}"`
      );
    }

    sectionSlugs.add(section.slug);

    if (section.slug !== section.data.slug) {
      throw new Error(
        `Section slug mismatch: "${section.slug}" !== "${section.data.slug}"`
      );
    }

    const groupSlugs =
      new Set<string>();

    for (
      const group of
      section.data.groups
    ) {
      groups++;

      /*
       * Our DB does not keep a separate
       * legacy group code because current
       * group.id and group.slug are expected
       * to be identical.
       *
       * Verify that assumption instead of
       * silently losing information.
       */
      if (group.id !== group.slug) {
        throw new Error(
          `Group id/slug mismatch in "${section.slug}": "${group.id}" !== "${group.slug}"`
        );
      }

      if (
        groupSlugs.has(group.slug)
      ) {
        throw new Error(
          `Duplicate group slug "${group.slug}" in section "${section.slug}"`
        );
      }

      groupSlugs.add(group.slug);

      const categorySlugs =
        new Set<string>();

      for (
        const category of
        group.subcategories
      ) {
        categories++;

        if (
          categoryCodes.has(
            category.id
          )
        ) {
          throw new Error(
            `Duplicate category code: "${category.id}"`
          );
        }

        categoryCodes.add(
          category.id
        );

        if (
          categorySlugs.has(
            category.slug
          )
        ) {
          throw new Error(
            `Duplicate category slug "${category.slug}" in group "${group.slug}"`
          );
        }

        categorySlugs.add(
          category.slug
        );

        const artworkSlugs =
          new Set<string>();

        const artworkLegacyIds =
          new Set<number>();

        for (
          const artwork of
          category.artworks
        ) {
          artworkCount++;

          if (
            artworkSlugs.has(
              artwork.slug
            )
          ) {
            throw new Error(
              `Duplicate artwork slug "${artwork.slug}" in category "${category.id}"`
            );
          }

          artworkSlugs.add(
            artwork.slug
          );

          if (
            artworkLegacyIds.has(
              artwork.id
            )
          ) {
            throw new Error(
              `Duplicate artwork id "${artwork.id}" in category "${category.id}"`
            );
          }

          artworkLegacyIds.add(
            artwork.id
          );

          if (
            !artwork.orientation
          ) {
            throw new Error(
              `Artwork "${artwork.slug}" has no orientation`
            );
          }

          if (
            artwork.orientation !==
              "portrait" &&
            artwork.orientation !==
              "landscape"
          ) {
            throw new Error(
              `Invalid orientation "${artwork.orientation}" in artwork "${artwork.slug}"`
            );
          }
        }
      }
    }
  }

  return {
    sections,
    groups,
    categories,
    artworks: artworkCount,
  };
}

/*
 * ============================================================
 * SEED
 * ============================================================
 */

async function main() {
  const stats =
    validatePortfolioSource();

  console.log(
    "Portfolio source validation successful ✅"
  );

  console.log(stats);

  const { db } =
    await import("../lib/db");

  for (
    let sectionIndex = 0;
    sectionIndex <
    portfolioSectionsData.length;
    sectionIndex++
  ) {
    const section =
      portfolioSectionsData[
        sectionIndex
      ];

    /*
     * ==========================================================
     * SECTION
     * ==========================================================
     */

    const [sectionRow] =
      await db
        .insert(
          portfolioSectionsTable
        )
        .values({
          slug: section.slug,
          title: section.data.title,
          navLabel: section.title,
          sortOrder: sectionIndex,
          isVisible: true,
        })
        .onConflictDoUpdate({
          target:
            portfolioSectionsTable.slug,

          set: {
            title:
              section.data.title,

            navLabel:
              section.title,

            sortOrder:
              sectionIndex,

            isVisible: true,

            updatedAt:
              new Date(),
          },
        })
        .returning({
          id:
            portfolioSectionsTable.id,
        });

    if (!sectionRow) {
      throw new Error(
        `Could not create section "${section.slug}"`
      );
    }

    /*
     * ==========================================================
     * GROUPS
     * ==========================================================
     */

    for (
      let groupIndex = 0;
      groupIndex <
      section.data.groups.length;
      groupIndex++
    ) {
      const group =
        section.data.groups[
          groupIndex
        ];

      const [groupRow] =
        await db
          .insert(portfolioGroups)
          .values({
            sectionId:
              sectionRow.id,

            slug:
              group.slug,

            title:
              group.title,

            sortOrder:
              groupIndex,

            isVisible: true,
          })
          .onConflictDoUpdate({
            target: [
              portfolioGroups.sectionId,
              portfolioGroups.slug,
            ],

            set: {
              title:
                group.title,

              sortOrder:
                groupIndex,

              isVisible: true,

              updatedAt:
                new Date(),
            },
          })
          .returning({
            id:
              portfolioGroups.id,
          });

      if (!groupRow) {
        throw new Error(
          `Could not create group "${group.slug}"`
        );
      }

      /*
       * ========================================================
       * CATEGORIES
       * ========================================================
       */

      for (
        let categoryIndex = 0;
        categoryIndex <
        group.subcategories.length;
        categoryIndex++
      ) {
        const category =
          group.subcategories[
            categoryIndex
          ];

        const [categoryRow] =
          await db
            .insert(
              portfolioCategories
            )
            .values({
              groupId:
                groupRow.id,

              code:
                category.id,

              slug:
                category.slug,

              title:
                category.title,

              sortOrder:
                categoryIndex,

              isVisible: true,
            })
            .onConflictDoUpdate({
              target:
                portfolioCategories.code,

              set: {
                groupId:
                  groupRow.id,

                slug:
                  category.slug,

                title:
                  category.title,

                sortOrder:
                  categoryIndex,

                isVisible: true,

                updatedAt:
                  new Date(),
              },
            })
            .returning({
              id:
                portfolioCategories.id,
            });

        if (!categoryRow) {
          throw new Error(
            `Could not create category "${category.id}"`
          );
        }

        /*
         * ======================================================
         * ARTWORKS
         * ======================================================
         */

        for (
          let artworkIndex = 0;
          artworkIndex <
          category.artworks.length;
          artworkIndex++
        ) {
          const artwork =
            category.artworks[
              artworkIndex
            ];

          if (
            !artwork.orientation
          ) {
            throw new Error(
              `Artwork "${artwork.slug}" has no orientation`
            );
          }

          await db
            .insert(artworks)
            .values({
              categoryId:
                categoryRow.id,

              legacyId:
                artwork.id,

              slug:
                artwork.slug,

              title:
                artwork.title,

              alt:
                artwork.alt,

              imageSrc:
                artwork.src,

              storageKey:
                null,

              width:
                null,

              height:
                null,

              orientation:
                artwork.orientation,

              featured:
                artwork.featured ??
                false,

              sortOrder:
                artworkIndex,

              status:
                "published",
            })
            .onConflictDoUpdate({
              /*
               * For imported legacy artwork,
               * category + legacyId is the
               * stable migration identity.
               *
               * This also lets us change a
               * slug later without creating
               * a duplicate record.
               */
              target: [
                artworks.categoryId,
                artworks.legacyId,
              ],

              set: {
                slug:
                  artwork.slug,

                title:
                  artwork.title,

                alt:
                  artwork.alt,

                imageSrc:
                  artwork.src,

                orientation:
                  artwork.orientation,

                featured:
                  artwork.featured ??
                  false,

                sortOrder:
                  artworkIndex,

                status:
                  "published",

                updatedAt:
                  new Date(),
              },
            });
        }
      }
    }
  }

  console.log(
    "Full portfolio seed successful ✅"
  );

  console.log(stats);
}

main().catch((error) => {
  console.error(
    "Full portfolio seed failed ❌"
  );

  console.error(error);

  process.exit(1);
});