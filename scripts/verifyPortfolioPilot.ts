import { config } from "dotenv";
import {
  deepStrictEqual,
  equal,
  ok,
} from "node:assert/strict";

import {
  and,
  asc,
  eq,
} from "drizzle-orm";

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
   * STATIC SOURCE
   * ============================================================
   */

  const sourceSection =
    portfolioSectionsData.find(
      (section) =>
        section.slug === "semi-realism"
    );

  ok(
    sourceSection,
    'Static section "semi-realism" was not found'
  );

  const sourceGroup =
    sourceSection.data.groups.find(
      (group) =>
        group.slug === "general"
    );

  ok(
    sourceGroup,
    'Static group "general" was not found'
  );

  const sourceCategory =
    sourceGroup.subcategories.find(
      (subcategory) =>
        subcategory.id ===
        "semi-ref-sheets"
    );

  ok(
    sourceCategory,
    'Static category "semi-ref-sheets" was not found'
  );

  /*
   * ============================================================
   * DATABASE
   * ============================================================
   */

  const [sectionRow] =
    await db
      .select()
      .from(portfolioSectionsTable)
      .where(
        eq(
          portfolioSectionsTable.slug,
          "semi-realism"
        )
      )
      .limit(1);

  ok(
    sectionRow,
    'DB section "semi-realism" was not found'
  );

  const [groupRow] =
    await db
      .select()
      .from(portfolioGroups)
      .where(
        and(
          eq(
            portfolioGroups.sectionId,
            sectionRow.id
          ),
          eq(
            portfolioGroups.slug,
            "general"
          )
        )
      )
      .limit(1);

  ok(
    groupRow,
    'DB group "general" was not found'
  );

  const [categoryRow] =
    await db
      .select()
      .from(portfolioCategories)
      .where(
        and(
          eq(
            portfolioCategories.groupId,
            groupRow.id
          ),
          eq(
            portfolioCategories.code,
            "semi-ref-sheets"
          )
        )
      )
      .limit(1);

  ok(
    categoryRow,
    'DB category "semi-ref-sheets" was not found'
  );

  const artworkRows =
    await db
      .select()
      .from(artworks)
      .where(
        eq(
          artworks.categoryId,
          categoryRow.id
        )
      )
      .orderBy(
        asc(artworks.sortOrder)
      );

  /*
   * ============================================================
   * REBUILD CURRENT FRONTEND SHAPE
   * ============================================================
   */

  const reconstructedCategory = {
    id: categoryRow.code,
    slug: categoryRow.slug,
    title: categoryRow.title,

    artworks: artworkRows.map(
      (artwork) => {
        ok(
          artwork.legacyId !== null,
          `Artwork "${artwork.slug}" has no legacyId`
        );

        return {
          id: artwork.legacyId,
          slug: artwork.slug,
          src: artwork.imageSrc,
          title: artwork.title,
          orientation:
            artwork.orientation,
          featured:
            artwork.featured,
          alt: artwork.alt,
        };
      }
    ),
  };

  const reconstructedPortfolio = {
    slug: sectionRow.slug,
    title: sectionRow.title,

    groups: [
      {
        /*
         * In the current portfolio data,
         * group id and slug are the same.
         */
        id: groupRow.slug,
        slug: groupRow.slug,
        title: groupRow.title,

        subcategories: [
          reconstructedCategory,
        ],
      },
    ],
  };

  /*
   * ============================================================
   * BUILD SAME PILOT FROM STATIC SOURCE
   * ============================================================
   */

  const expectedPortfolio = {
    slug: sourceSection.data.slug,
    title: sourceSection.data.title,

    groups: [
      {
        id: sourceGroup.id,
        slug: sourceGroup.slug,
        title: sourceGroup.title,

        subcategories: [
          sourceCategory,
        ],
      },
    ],
  };

  /*
   * ============================================================
   * VALIDATION
   * ============================================================
   */

  equal(
    sectionRow.navLabel,
    sourceSection.title,
    "Section navLabel does not match"
  );

  deepStrictEqual(
    reconstructedPortfolio,
    expectedPortfolio
  );

  console.log(
    "Portfolio pilot verification successful ✅"
  );

  console.log({
    section: sectionRow.slug,
    navLabel: sectionRow.navLabel,
    group: groupRow.slug,
    category: categoryRow.code,
    artworks: artworkRows.length,
  });
}

main().catch((error) => {
  console.error(
    "Portfolio pilot verification failed ❌"
  );

  console.error(error);

  process.exit(1);
});