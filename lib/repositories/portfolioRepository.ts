import {
  and,
  asc,
  eq,
} from "drizzle-orm";

import { db } from "../db";

import {
  artworks,
  portfolioCategories,
  portfolioGroups,
  portfolioSections,
} from "../db/schema/portfolio";

import type {
  PortfolioData,
} from "../../data/portfolio/types";

import { cache } from "react";

/*
 * ============================================================
 * PUBLIC PORTFOLIO
 * ============================================================
 *
 * Reconstructs the exact PortfolioData shape currently consumed
 * by PortfolioCategory, ArtworkGrid, SEO helpers, etc.
 *
 * Only public/visible/published records are returned.
 */

async function queryPortfolioSectionBySlug(
  slug: string
): Promise<PortfolioData | null> {

  /*
   * ============================================================
   * ONE DATABASE QUERY
   * ============================================================
   *
   * Instead of:
   *
   * section -> groups -> categories -> artworks
   *
   * as four separate HTTP round trips,
   * PostgreSQL resolves the whole public hierarchy
   * in one query.
   */

  const rows =
    await db
      .select({
        section: {
          id:
            portfolioSections.id,

          slug:
            portfolioSections.slug,

          title:
            portfolioSections.title,
        },

        group: {
          id:
            portfolioGroups.id,

          slug:
            portfolioGroups.slug,

          title:
            portfolioGroups.title,

          sortOrder:
            portfolioGroups.sortOrder,
        },

        category: {
          id:
            portfolioCategories.id,

          code:
            portfolioCategories.code,

          slug:
            portfolioCategories.slug,

          title:
            portfolioCategories.title,

          sortOrder:
            portfolioCategories.sortOrder,
        },

        artwork: {
          id:
            artworks.id,

          slug:
            artworks.slug,

          title:
            artworks.title,

          alt:
            artworks.alt,

          imageSrc:
            artworks.imageSrc,

          storageKey:
            artworks.storageKey,

          orientation:
            artworks.orientation,

          featured:
            artworks.featured,

          thumbnailFocusX:
            artworks.thumbnailFocusX,

          thumbnailFocusY:
            artworks.thumbnailFocusY,

          sortOrder:
            artworks.sortOrder,
        },
      })
      .from(
        portfolioSections
      )

      /*
       * ========================================================
       * GROUPS
       * ========================================================
       *
       * Visibility belongs in the JOIN condition,
       * not the final WHERE.
       *
       * This lets a visible section still exist even
       * if it temporarily has no visible children.
       */

      .leftJoin(
        portfolioGroups,
        and(
          eq(
            portfolioGroups.sectionId,
            portfolioSections.id
          ),
          eq(
            portfolioGroups.isVisible,
            true
          )
        )
      )

      /*
       * ========================================================
       * CATEGORIES
       * ========================================================
       */

      .leftJoin(
        portfolioCategories,
        and(
          eq(
            portfolioCategories.groupId,
            portfolioGroups.id
          ),
          eq(
            portfolioCategories.isVisible,
            true
          )
        )
      )

      /*
       * ========================================================
       * ARTWORKS
       * ========================================================
       */

      .leftJoin(
        artworks,
        and(
          eq(
            artworks.categoryId,
            portfolioCategories.id
          ),
          eq(
            artworks.status,
            "published"
          )
        )
      )

      /*
       * ========================================================
       * SECTION FILTER
       * ========================================================
       */

      .where(
        and(
          eq(
            portfolioSections.slug,
            slug
          ),
          eq(
            portfolioSections.isVisible,
            true
          )
        )
      )

      /*
       * PostgreSQL already gives us everything
       * in public portfolio order.
       */

      .orderBy(
        asc(
          portfolioGroups.sortOrder
        ),
        asc(
          portfolioCategories.sortOrder
        ),
        asc(
          artworks.sortOrder
        )
      );

  if (rows.length === 0) {
    return null;
  }

  /*
   * ============================================================
   * RECONSTRUCT PortfolioData
   * ============================================================
   */

  const firstRow =
    rows[0];

  const result: PortfolioData = {
    slug:
      firstRow.section.slug,

    title:
      firstRow.section.title,

    groups: [],
  };

  type PortfolioGroup =
    PortfolioData["groups"][number];

  type PortfolioCategory =
    PortfolioGroup["subcategories"][number];

  const groupMap =
    new Map<
      string,
      PortfolioGroup
    >();

  const categoryMap =
    new Map<
      string,
      PortfolioCategory
    >();

  for (const row of rows) {
    /*
     * LEFT JOIN means these can legitimately
     * be null if the section has no public
     * children.
     */

    if (!row.group) {
      continue;
    }

    let group =
      groupMap.get(
        row.group.id
      );

    if (!group) {
      group = {
        /*
         * Transitional compatibility:
         *
         * Current static PortfolioGroup.id
         * equals its slug.
         */
        id:
          row.group.slug,

        slug:
          row.group.slug,

        title:
          row.group.title,

        subcategories: [],
      };

      groupMap.set(
        row.group.id,
        group
      );

      result.groups.push(
        group
      );
    }

    if (!row.category) {
      continue;
    }

    let category =
      categoryMap.get(
        row.category.id
      );

    if (!category) {
      category = {
        /*
         * Current Subcategory.id is stored
         * permanently as category.code.
         */
        id:
          row.category.code,

        slug:
          row.category.slug,

        title:
          row.category.title,

        artworks: [],
      };

      categoryMap.set(
        row.category.id,
        category
      );

      group.subcategories.push(
        category
      );
    }

    if (!row.artwork) {
      continue;
    }

    /*
     * During the migration the frontend
     * Artwork.id remains numeric.
     *
     * Future CMS-created artworks will
     * eventually use the PostgreSQL UUID
     * instead, but we are not changing
     * that contract yet.
     */


    category.artworks.push({
      id:
        row.artwork.id,

      slug:
        row.artwork.slug,

      src:
        row.artwork.imageSrc,

      storageKey:
        row.artwork.storageKey,

      title:
        row.artwork.title,

      orientation:
        row.artwork.orientation,

      featured:
        row.artwork.featured,

      thumbnailFocusX:
        row.artwork.thumbnailFocusX,

      thumbnailFocusY:
        row.artwork.thumbnailFocusY,

      alt:
        row.artwork.alt,
    });
  }

  return result;
}

export const getPortfolioSectionBySlug =
  cache(queryPortfolioSectionBySlug);

/*
 * ============================================================
 * PORTFOLIO NAVIGATION
 * ============================================================
 *
 * This is intentionally much lighter than loading PortfolioData.
 *
 * The Navbar only needs:
 *
 * - slug
 * - nav label
 * - order
 *
 * The database is the runtime source of truth.
 */

export interface PortfolioNavigationItem {
  slug: string;
  label: string;
}

export async function getPortfolioNavigation():
Promise<PortfolioNavigationItem[]> {
  const sections =
    await db
      .select({
        slug:
          portfolioSections.slug,

        label:
          portfolioSections.navLabel,

        sortOrder:
          portfolioSections.sortOrder,
      })
      .from(portfolioSections)
      .where(
        eq(
          portfolioSections.isVisible,
          true
        )
      )
      .orderBy(
        asc(
          portfolioSections.sortOrder
        )
      );

  return sections.map(
    (section) => ({
      slug: section.slug,
      label: section.label,
    })
  );
}

/*
 * ============================================================
 * PORTFOLIO SITEMAP
 * ============================================================
 *
 * Lightweight public portfolio hierarchy used by sitemap.xml.
 *
 * This intentionally returns only the slugs required to build
 * public URLs.
 *
 * The database is the runtime source of truth.
 */

export interface PortfolioSitemapEntry {
  sectionSlug: string;
  groupSlug: string | null;
  categorySlug: string | null;
  artworkSlug: string | null;
}

async function queryPortfolioSitemapEntries():
Promise<PortfolioSitemapEntry[]> {
  return db
    .select({
      sectionSlug:
        portfolioSections.slug,

      groupSlug:
        portfolioGroups.slug,

      categorySlug:
        portfolioCategories.slug,

      artworkSlug:
        artworks.slug,
    })
    .from(
      portfolioSections
    )
    .leftJoin(
      portfolioGroups,
      and(
        eq(
          portfolioGroups.sectionId,
          portfolioSections.id
        ),
        eq(
          portfolioGroups.isVisible,
          true
        )
      )
    )
    .leftJoin(
      portfolioCategories,
      and(
        eq(
          portfolioCategories.groupId,
          portfolioGroups.id
        ),
        eq(
          portfolioCategories.isVisible,
          true
        )
      )
    )
    .leftJoin(
      artworks,
      and(
        eq(
          artworks.categoryId,
          portfolioCategories.id
        ),
        eq(
          artworks.status,
          "published"
        )
      )
    )
    .where(
      eq(
        portfolioSections.isVisible,
        true
      )
    )
    .orderBy(
      asc(
        portfolioSections.sortOrder
      ),
      asc(
        portfolioGroups.sortOrder
      ),
      asc(
        portfolioCategories.sortOrder
      ),
      asc(
        artworks.sortOrder
      )
    );
}

export const getPortfolioSitemapEntries =
  cache(
    queryPortfolioSitemapEntries
  );