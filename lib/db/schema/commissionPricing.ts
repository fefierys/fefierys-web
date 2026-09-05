import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { portfolioCategories } from "./portfolio";

/*
 * ============================================================
 * ENUMS
 * ============================================================
 */

export const commissionPricingVersionStatusEnum = pgEnum(
  "commission_pricing_version_status",
  ["draft", "active", "archived"],
);

export const commissionPricingVisibilityEnum = pgEnum(
  "commission_pricing_visibility",
  ["public", "admin_only"],
);

export const commissionPricingAdjustmentKindEnum = pgEnum(
  "commission_pricing_adjustment_kind",
  ["extra", "license", "discount"],
);

export const commissionPricingCalculationTypeEnum = pgEnum(
  "commission_pricing_calculation_type",
  ["fixed", "percentage"],
);

export const commissionPricingCalculationBasisEnum = pgEnum(
  "commission_pricing_calculation_basis",
  [
    "none",
    "base_price",
    "base_plus_extras",
    "base_items",
    "pre_discount_subtotal",
  ],
);

/*
 * ============================================================
 * PRICING VERSIONS
 * ============================================================
 *
 * A published quote must keep the prices that were valid when
 * it was created. New prices are therefore published as a new
 * version instead of modifying historical pricing records.
 *
 * Fefierys currently accepts USD only. The currency column is
 * retained explicitly so every price snapshot remains clear.
 */

export const commissionPricingVersions = pgTable(
  "commission_pricing_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: varchar("name", {
      length: 120,
    }).notNull(),

    currency: varchar("currency", {
      length: 3,
    })
      .notNull()
      .default("USD"),

    status: commissionPricingVersionStatusEnum("status")
      .notNull()
      .default("draft"),

    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }),

    effectiveUntil: timestamp("effective_until", {
      withTimezone: true,
    }),

    publishedAt: timestamp("published_at", {
      withTimezone: true,
    }),

    createdByAdminUserId: varchar("created_by_admin_user_id", {
      length: 255,
    }),

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
    uniqueIndex("commission_pricing_versions_name_unique").on(table.name),

    /* PostgreSQL allows only one row whose status is active. */
    uniqueIndex("commission_pricing_versions_active_unique")
      .on(table.status)
      .where(sql`${table.status} = 'active'`),

    index("commission_pricing_versions_status_idx").on(table.status),

    check(
      "commission_pricing_versions_currency_check",
      sql`${table.currency} = 'USD'`,
    ),

    check(
      "commission_pricing_versions_effective_window_check",
      sql`
        ${table.effectiveUntil} IS NULL
        OR ${table.effectiveFrom} IS NULL
        OR ${table.effectiveUntil} > ${table.effectiveFrom}
      `,
    ),

    check(
      "commission_pricing_versions_publication_check",
      sql`
        (
          ${table.status} = 'draft'
          AND ${table.publishedAt} IS NULL
        )
        OR
        (
          ${table.status} IN ('active', 'archived')
          AND ${table.publishedAt} IS NOT NULL
          AND ${table.effectiveFrom} IS NOT NULL
        )
      `,
    ),
  ],
);

/*
 * ============================================================
 * PRICING SERVICES
 * ============================================================
 *
 * A service represents the commission modal associated with a
 * portfolio category, for example Character Design or Covers.
 * portfolioCategoryId is nullable so an admin-only or seasonal
 * service can be prepared before it receives a public route.
 */

export const commissionPricingServices = pgTable(
  "commission_pricing_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    pricingVersionId: uuid("pricing_version_id")
      .notNull()
      .references(() => commissionPricingVersions.id, {
        onDelete: "restrict",
      }),

    portfolioCategoryId: uuid("portfolio_category_id").references(
      () => portfolioCategories.id,
      {
        onDelete: "restrict",
      },
    ),

    code: varchar("code", {
      length: 120,
    }).notNull(),

    title: varchar("title", {
      length: 200,
    }).notNull(),

    subtitle: text("subtitle"),

    heroImage: text("hero_image"),

    cta: varchar("cta", {
      length: 250,
    }),

    visibility: commissionPricingVisibilityEnum("visibility")
      .notNull()
      .default("public"),

    availableFrom: timestamp("available_from", {
      withTimezone: true,
    }),

    availableUntil: timestamp("available_until", {
      withTimezone: true,
    }),

    sortOrder: integer("sort_order").notNull().default(0),

    isActive: boolean("is_active").notNull().default(true),

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
    uniqueIndex("commission_pricing_services_version_code_unique").on(
      table.pricingVersionId,
      table.code,
    ),

    uniqueIndex("commission_pricing_services_version_category_unique").on(
      table.pricingVersionId,
      table.portfolioCategoryId,
    ),

    index("commission_pricing_services_version_idx").on(table.pricingVersionId),

    index("commission_pricing_services_portfolio_category_idx").on(
      table.portfolioCategoryId,
    ),

    index("commission_pricing_services_public_idx").on(
      table.visibility,
      table.isActive,
      table.sortOrder,
    ),

    check(
      "commission_pricing_services_availability_check",
      sql`
        ${table.availableUntil} IS NULL
        OR ${table.availableFrom} IS NULL
        OR ${table.availableUntil} > ${table.availableFrom}
      `,
    ),
  ],
);

/*
 * ============================================================
 * PRICING OPTIONS
 * ============================================================
 *
 * An option is a selectable base tier, such as Lineart,
 * Full Render, Cover, or a package of ten emotes.
 */

export const commissionPricingOptions = pgTable(
  "commission_pricing_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    serviceId: uuid("service_id")
      .notNull()
      .references(() => commissionPricingServices.id, {
        onDelete: "restrict",
      }),

    code: varchar("code", {
      length: 120,
    }).notNull(),

    title: varchar("title", {
      length: 200,
    }).notNull(),

    publicLabel: varchar("public_label", {
      length: 250,
    }).notNull(),

    quoteLabel: varchar("quote_label", {
      length: 250,
    }).notNull(),

    description: text("description"),

    baseAmount: numeric("base_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),

    visibility: commissionPricingVisibilityEnum("visibility")
      .notNull()
      .default("public"),

    availableFrom: timestamp("available_from", {
      withTimezone: true,
    }),

    availableUntil: timestamp("available_until", {
      withTimezone: true,
    }),

    requiresManualPriceConfirmation: boolean(
      "requires_manual_price_confirmation",
    )
      .notNull()
      .default(false),

    sortOrder: integer("sort_order").notNull().default(0),

    isActive: boolean("is_active").notNull().default(true),

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
    uniqueIndex("commission_pricing_options_service_code_unique").on(
      table.serviceId,
      table.code,
    ),

    index("commission_pricing_options_service_idx").on(table.serviceId),

    index("commission_pricing_options_public_idx").on(
      table.visibility,
      table.isActive,
      table.sortOrder,
    ),

    check(
      "commission_pricing_options_base_amount_check",
      sql`${table.baseAmount} >= 0`,
    ),

    check(
      "commission_pricing_options_availability_check",
      sql`
        ${table.availableUntil} IS NULL
        OR ${table.availableFrom} IS NULL
        OR ${table.availableUntil} > ${table.availableFrom}
      `,
    ),
  ],
);

/*
 * ============================================================
 * PRICING ADJUSTMENTS
 * ============================================================
 *
 * Adjustments represent extras, licenses, and discounts.
 *
 * Examples:
 * - Character: fixed amount or percentage of base_price.
 * - Commercial Use: fixed amount or base_plus_extras.
 * - Merchandising: fixed amount.
 * - Indie Author Discount: percentage of pre_discount_subtotal.
 * - Future volume discount: percentage of base_items.
 *
 * maxQuantity = 1 means it may be selected once.
 * maxQuantity = null means no catalog-level maximum is imposed.
 */

export const commissionPricingAdjustments = pgTable(
  "commission_pricing_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    pricingVersionId: uuid("pricing_version_id")
      .notNull()
      .references(() => commissionPricingVersions.id, {
        onDelete: "restrict",
      }),

    code: varchar("code", {
      length: 160,
    }).notNull(),

    name: varchar("name", {
      length: 200,
    }).notNull(),

    description: text("description"),

    kind: commissionPricingAdjustmentKindEnum("kind").notNull(),

    calculationType:
      commissionPricingCalculationTypeEnum("calculation_type").notNull(),

    calculationBasis: commissionPricingCalculationBasisEnum("calculation_basis")
      .notNull()
      .default("none"),

    fixedAmount: numeric("fixed_amount", {
      precision: 12,
      scale: 2,
    }),

    percentageRate: numeric("percentage_rate", {
      precision: 5,
      scale: 2,
    }),

    isValueEditable: boolean("is_value_editable").notNull().default(false),

    minimumPercentageRate: numeric("minimum_percentage_rate", {
      precision: 5,
      scale: 2,
    }),

    maximumPercentageRate: numeric("maximum_percentage_rate", {
      precision: 5,
      scale: 2,
    }),

    maxQuantity: integer("max_quantity"),

    requiresInternalNote: boolean("requires_internal_note")
      .notNull()
      .default(false),

    stackable: boolean("stackable").notNull().default(true),

    visibility: commissionPricingVisibilityEnum("visibility")
      .notNull()
      .default("admin_only"),

    availableFrom: timestamp("available_from", {
      withTimezone: true,
    }),

    availableUntil: timestamp("available_until", {
      withTimezone: true,
    }),

    sortOrder: integer("sort_order").notNull().default(0),

    isActive: boolean("is_active").notNull().default(true),

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
    uniqueIndex("commission_pricing_adjustments_version_code_unique").on(
      table.pricingVersionId,
      table.code,
    ),

    index("commission_pricing_adjustments_version_idx").on(
      table.pricingVersionId,
    ),

    index("commission_pricing_adjustments_kind_idx").on(table.kind),

    index("commission_pricing_adjustments_available_idx").on(
      table.visibility,
      table.isActive,
      table.sortOrder,
    ),

    check(
      "commission_pricing_adjustments_value_check",
      sql`
        (
          ${table.calculationType} = 'fixed'
          AND ${table.fixedAmount} IS NOT NULL
          AND ${table.fixedAmount} >= 0
          AND ${table.percentageRate} IS NULL
          AND ${table.calculationBasis} = 'none'
        )
        OR
        (
          ${table.calculationType} = 'percentage'
          AND ${table.fixedAmount} IS NULL
          AND ${table.percentageRate} IS NOT NULL
          AND ${table.percentageRate} >= 0
          AND ${table.percentageRate} <= 100
          AND ${table.calculationBasis} != 'none'
        )
      `,
    ),

    check(
      "commission_pricing_adjustments_quantity_check",
      sql`${table.maxQuantity} IS NULL OR ${table.maxQuantity} >= 1`,
    ),

    check(
      "commission_pricing_adjustments_editable_value_check",
      sql`
        (
          ${table.isValueEditable} = false
          AND ${table.minimumPercentageRate} IS NULL
          AND ${table.maximumPercentageRate} IS NULL
        )
        OR
        (
          ${table.isValueEditable} = true
          AND ${table.calculationType} = 'percentage'
          AND ${table.minimumPercentageRate} IS NOT NULL
          AND ${table.maximumPercentageRate} IS NOT NULL
          AND ${table.minimumPercentageRate} >= 0
          AND ${table.maximumPercentageRate} <= 100
          AND ${table.maximumPercentageRate} >= ${table.minimumPercentageRate}
          AND ${table.percentageRate} >= ${table.minimumPercentageRate}
          AND ${table.percentageRate} <= ${table.maximumPercentageRate}
        )
      `,
    ),

    check(
      "commission_pricing_adjustments_discount_quantity_check",
      sql`
        ${table.kind} != 'discount'
        OR (
          ${table.maxQuantity} IS NOT NULL
          AND ${table.maxQuantity} = 1
        )
      `,
    ),

    check(
      "commission_pricing_adjustments_availability_check",
      sql`
        ${table.availableUntil} IS NULL
        OR ${table.availableFrom} IS NULL
        OR ${table.availableUntil} > ${table.availableFrom}
      `,
    ),
  ],
);

/*
 * ============================================================
 * OPTION / ADJUSTMENT APPLICABILITY
 * ============================================================
 *
 * Only adjustments linked here may be offered for an option.
 * Categories with no extras therefore expose only adjustments
 * deliberately linked to them, such as Indie Author Discount.
 */

export const commissionPricingOptionAdjustments = pgTable(
  "commission_pricing_option_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    pricingOptionId: uuid("pricing_option_id")
      .notNull()
      .references(() => commissionPricingOptions.id, {
        onDelete: "restrict",
      }),

    pricingAdjustmentId: uuid("pricing_adjustment_id")
      .notNull()
      .references(() => commissionPricingAdjustments.id, {
        onDelete: "restrict",
      }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("commission_pricing_option_adjustments_unique").on(
      table.pricingOptionId,
      table.pricingAdjustmentId,
    ),

    index("commission_pricing_option_adjustments_option_idx").on(
      table.pricingOptionId,
    ),

    index("commission_pricing_option_adjustments_adjustment_idx").on(
      table.pricingAdjustmentId,
    ),
  ],
);
