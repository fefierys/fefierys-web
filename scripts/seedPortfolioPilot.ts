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

async function main() {
  const { db } = await import("../lib/db");

  /*
   * ============================================================
   * FIND CURRENT STATIC DATA
   * ============================================================
   */

  const sectionIndex =
    portfolioSectionsData.findIndex(
      (section) =>
        section.slug === "semi-realism"
    );

  if (sectionIndex === -1) {
    throw new Error(
      'Portfolio section "semi-realism" was not found'
    );
  }

  const section =
    portfolioSectionsData[sectionIndex];

  const groupIndex =
    section.data.groups.findIndex(
      (group) =>
        group.slug === "general"
    );

  if (groupIndex === -1) {
    throw new Error(
      'Portfolio group "general" was not found'
    );
  }

  const group =
    section.data.groups[groupIndex];

  const categoryIndex =
    group.subcategories.findIndex(
      (subcategory) =>
        subcategory.id ===
        "semi-ref-sheets"
    );

  if (categoryIndex === -1) {
    throw new Error(
      'Portfolio category "semi-ref-sheets" was not found'
    );
  }

  const category =
    group.subcategories[categoryIndex];

  /*
   * ============================================================
   * SECTION
   * ============================================================
   */

  const [sectionRow] =
    await db
      .insert(portfolioSectionsTable)
      .values({
        slug: section.slug,

        /*
         * PortfolioData.title
         */
        title: section.data.title,

        /*
         * portfolioSections[].title
         */
        navLabel: section.title,

        sortOrder: sectionIndex,

        isVisible: true,
      })
      .onConflictDoUpdate({
        target:
          portfolioSectionsTable.slug,

        set: {
          title: section.data.title,
          navLabel: section.title,
          sortOrder: sectionIndex,
          isVisible: true,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: portfolioSectionsTable.id,
      });

  if (!sectionRow) {
    throw new Error(
      "Could not create portfolio section"
    );
  }

  /*
   * ============================================================
   * GROUP
   * ============================================================
   */

  const [groupRow] =
    await db
      .insert(portfolioGroups)
      .values({
        sectionId: sectionRow.id,
        slug: group.slug,
        title: group.title,
        sortOrder: groupIndex,
        isVisible: true,
      })
      .onConflictDoUpdate({
        target: [
          portfolioGroups.sectionId,
          portfolioGroups.slug,
        ],

        set: {
          title: group.title,
          sortOrder: groupIndex,
          isVisible: true,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: portfolioGroups.id,
      });

  if (!groupRow) {
    throw new Error(
      "Could not create portfolio group"
    );
  }

  /*
   * ============================================================
   * CATEGORY
   * ============================================================
   */

  const [categoryRow] =
    await db
      .insert(portfolioCategories)
      .values({
        groupId: groupRow.id,

        /*
         * Current Subcategory.id
         *
         * Used by commissions.ts.
         */
        code: category.id,

        slug: category.slug,
        title: category.title,
        sortOrder: categoryIndex,
        isVisible: true,
      })
      .onConflictDoUpdate({
        target:
          portfolioCategories.code,

        set: {
          groupId: groupRow.id,
          slug: category.slug,
          title: category.title,
          sortOrder: categoryIndex,
          isVisible: true,
          updatedAt: new Date(),
        },
      })
      .returning({
        id: portfolioCategories.id,
      });

  if (!categoryRow) {
    throw new Error(
      "Could not create portfolio category"
    );
  }

  /*
   * ============================================================
   * ARTWORKS
   * ============================================================
   */

  for (
    let artworkIndex = 0;
    artworkIndex <
    category.artworks.length;
    artworkIndex++
  ) {
    const artwork =
      category.artworks[artworkIndex];

    if (!artwork.orientation) {
      throw new Error(
        `Artwork "${artwork.slug}" has no orientation`
      );
    }

    await db
      .insert(artworks)
      .values({
        categoryId: categoryRow.id,

        /*
         * Current numeric Artwork.id.
         */
        legacyId: artwork.id,

        slug: artwork.slug,
        title: artwork.title,
        alt: artwork.alt,

        /*
         * Still points to /public during
         * this first migration stage.
         */
        imageSrc: artwork.src,

        /*
         * These will be populated later
         * during the R2 migration.
         */
        storageKey: null,
        width: null,
        height: null,

        orientation:
          artwork.orientation,

        featured:
          artwork.featured ?? false,

        sortOrder: artworkIndex,

        /*
         * These artworks are already live
         * on the current website.
         */
        status: "published",
      })
      .onConflictDoUpdate({
        target: [
          artworks.categoryId,
          artworks.slug,
        ],

        set: {
          legacyId: artwork.id,
          title: artwork.title,
          alt: artwork.alt,
          imageSrc: artwork.src,
          orientation:
            artwork.orientation,
          featured:
            artwork.featured ?? false,
          sortOrder: artworkIndex,
          status: "published",
          updatedAt: new Date(),
        },
      });
  }

  console.log(
    "Portfolio pilot seed successful ✅"
  );

  console.log({
    section: section.slug,
    group: group.slug,
    category: category.id,
    artworks: category.artworks.length,
  });
}

main().catch((error) => {
  console.error(
    "Portfolio pilot seed failed ❌"
  );

  console.error(error);

  process.exit(1);
});