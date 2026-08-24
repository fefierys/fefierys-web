import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/*
 * ============================================================
 * ENUMS
 * ============================================================
 */

export const artworkOrientationEnum = pgEnum(
  "artwork_orientation",
  ["portrait", "landscape"]
);

export const artworkStatusEnum = pgEnum(
  "artwork_status",
  ["draft", "published", "archived"]
);

/*
 * ============================================================
 * PORTFOLIO SECTIONS
 * ============================================================
 *
 * Current examples:
 * - semi-realism
 * - stylized
 * - chibis-emotes
 */

export const portfolioSections = pgTable(
  "portfolio_sections",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    slug: text("slug")
      .notNull(),

    title: text("title")
      .notNull(),

    navLabel: text("nav_label")
      .notNull(),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    isVisible: boolean("is_visible")
      .notNull()
      .default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex(
      "portfolio_sections_slug_unique"
    ).on(table.slug),
  ]
);

/*
 * ============================================================
 * PORTFOLIO GROUPS
 * ============================================================
 *
 * Current examples:
 * - book-art
 * - general
 * - chibis
 * - emotes
 */

export const portfolioGroups = pgTable(
  "portfolio_groups",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    sectionId: uuid("section_id")
      .notNull()
      .references(
        () => portfolioSections.id,
        {
          onDelete: "restrict",
        }
      ),

    slug: text("slug")
      .notNull(),

    title: text("title")
      .notNull(),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    isVisible: boolean("is_visible")
      .notNull()
      .default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex(
      "portfolio_groups_section_slug_unique"
    ).on(
      table.sectionId,
      table.slug
    ),
  ]
);

/*
 * ============================================================
 * PORTFOLIO CATEGORIES
 * ============================================================
 *
 * `code` preserves the current Subcategory.id.
 *
 * Example:
 *
 * code = semi-covers
 * slug = covers
 *
 * The code is also what currently connects
 * the category with commissions.ts.
 */

export const portfolioCategories = pgTable(
  "portfolio_categories",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    groupId: uuid("group_id")
      .notNull()
      .references(
        () => portfolioGroups.id,
        {
          onDelete: "restrict",
        }
      ),

    code: text("code")
      .notNull(),

    slug: text("slug")
      .notNull(),

    title: text("title")
      .notNull(),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    isVisible: boolean("is_visible")
      .notNull()
      .default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex(
      "portfolio_categories_code_unique"
    ).on(table.code),

    uniqueIndex(
      "portfolio_categories_group_slug_unique"
    ).on(
      table.groupId,
      table.slug
    ),
  ]
);

/*
 * ============================================================
 * ARTWORKS
 * ============================================================
 */

export const artworks = pgTable(
  "artworks",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    categoryId: uuid("category_id")
      .notNull()
      .references(
        () => portfolioCategories.id,
        {
          onDelete: "restrict",
        }
      ),

    /*
    * Numeric id from the current static portfolio.
    *
    * Used only during the migration period so the
    * DB can reproduce the existing Artwork shape.
    *
    * New CMS artworks will not need it.
    */
    legacyId: integer("legacy_id"),

    slug: text("slug")
      .notNull(),

    title: text("title")
      .notNull(),

    alt: text("alt")
      .notNull(),

    /*
     * During the first migration this will contain:
     *
     * /images/portfolio/...
     *
     * Later it can contain the public R2/CDN URL.
     */
    imageSrc: text("image_src")
      .notNull(),

    /*
     * R2 object key.
     *
     * null while the artwork still lives in /public.
     */
    storageKey: text("storage_key"),

    /*
     * Current .ts files do not contain dimensions.
     *
     * They remain nullable until Storage migration
     * or the Upload Manager calculates them.
     */
    width: integer("width"),

    height: integer("height"),

    orientation: artworkOrientationEnum(
      "orientation"
    ).notNull(),

    featured: boolean("featured")
      .notNull()
      .default(false),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    /*
     * Existing portfolio records will be imported
     * explicitly as "published".
     *
     * New CMS uploads default to "draft".
     */
    status: artworkStatusEnum("status")
      .notNull()
      .default("draft"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex(
      "artworks_category_slug_unique"
    ).on(
      table.categoryId,
      table.slug
    ),

    uniqueIndex(
      "artworks_category_legacy_id_unique"
    ).on(
        table.categoryId,
        table.legacyId
    ),
  ]
);