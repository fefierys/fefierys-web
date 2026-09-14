import "server-only";

import type {
  CommissionPricingAdjustment,
  CommissionPricingServiceWithOptions,
} from "@/lib/repositories/commissionPricingRepository";
import { getActiveCommissionPricingCatalog } from "@/lib/repositories/commissionPricingRepository";

export type PublicCommissionStyle =
  | "semi-realism"
  | "stylized"
  | "chibis-emotes";

export interface PublicCommissionOption {
  id: string;
  code: string;
  title: string;
  publicLabel: string;
  price: string;
  description: string;
}

export interface PublicCommissionNote {
  title: string;
  details?: string[];
}

export interface PublicCommissionData {
  id: string;
  pricingServiceId: string;
  pricingVersionId: string;
  title: string;
  subtitle: string;
  heroImage: string;
  options: PublicCommissionOption[];
  notes: PublicCommissionNote[];
  cta: string;
}

export interface PublicCommissionVariant {
  style: PublicCommissionStyle;
  styleLabel: string;
  data: PublicCommissionData;
}

export interface PublicCommissionService {
  id: string;
  title: string;
  summary: string;
  variants: PublicCommissionVariant[];
}

export interface PublicCommissionGroup {
  id: string;
  title: string;
  description: string;
  services: PublicCommissionService[];
}

interface PublicCommissionVariantDefinition {
  style: PublicCommissionStyle;
  styleLabel: string;
  pricingServiceCode: string;
}

interface PublicCommissionServiceDefinition {
  id: string;
  title: string;
  summary: string;
  variants: PublicCommissionVariantDefinition[];
}

interface PublicCommissionGroupDefinition {
  id: string;
  title: string;
  description: string;
  services: PublicCommissionServiceDefinition[];
}

/*
 * ============================================================
 * PUBLIC PRESENTATION STRUCTURE
 * ============================================================
 *
 * Grouping, public section IDs and style labels are presentation
 * concerns, so they remain intentionally defined here.
 *
 * Prices, options, service copy, artwork and public adjustments
 * come from the active pricing catalog in the database.
 */

const PUBLIC_COMMISSION_GROUP_DEFINITIONS: PublicCommissionGroupDefinition[] = [
  {
    id: "book-publishing",
    title: "Book & Publishing",
    description:
      "Illustration created for stories, novels and publishing projects.",
    services: [
      {
        id: "book-covers",
        title: "Book Covers",
        summary:
          "Front covers and full wraps created around your story and characters.",
        variants: [
          {
            style: "semi-realism",
            styleLabel: "Semirealism",
            pricingServiceCode: "semi-covers",
          },
          {
            style: "stylized",
            styleLabel: "Stylized",
            pricingServiceCode: "sty-covers",
          },
        ],
      },
      {
        id: "interior-illustrations",
        title: "Interior Illustrations",
        summary:
          "Spot, half-page, full-page and spread illustrations for the inside of your book.",
        variants: [
          {
            style: "semi-realism",
            styleLabel: "Semirealism",
            pricingServiceCode: "semi-interior-illustration",
          },
          {
            style: "stylized",
            styleLabel: "Stylized",
            pricingServiceCode: "sty-interior-illustration",
          },
        ],
      },
    ],
  },
  {
    id: "character-art",
    title: "Character Art",
    description:
      "From individual character artwork to full visual references and designs.",
    services: [
      {
        id: "icons",
        title: "Icons",
        summary:
          "Custom portraits for avatars, profile pictures, tokens and similar uses.",
        variants: [
          {
            style: "semi-realism",
            styleLabel: "Semirealism",
            pricingServiceCode: "semi-icons",
          },
          {
            style: "stylized",
            styleLabel: "Stylized",
            pricingServiceCode: "sty-icons",
          },
        ],
      },
      {
        id: "character-design",
        title: "Character Design",
        summary:
          "Develop your character from descriptions, ideas and visual references.",
        variants: [
          {
            style: "semi-realism",
            styleLabel: "Semirealism",
            pricingServiceCode: "semi-character-design",
          },
          {
            style: "stylized",
            styleLabel: "Stylized",
            pricingServiceCode: "sty-character-design",
          },
        ],
      },
      {
        id: "character-illustrations",
        title: "Character Illustrations",
        summary:
          "Finished character-focused scenes for personal, promotional or commercial projects.",
        variants: [
          {
            style: "semi-realism",
            styleLabel: "Semirealism",
            pricingServiceCode: "semi-character-illustrations",
          },
          {
            style: "stylized",
            styleLabel: "Stylized",
            pricingServiceCode: "sty-character-illustrations",
          },
        ],
      },
      {
        id: "reference-sheets",
        title: "Reference Sheets",
        summary:
          "A visual reference presenting the essential information about your character.",
        variants: [
          {
            style: "semi-realism",
            styleLabel: "Semirealism",
            pricingServiceCode: "semi-ref-sheets",
          },
        ],
      },
    ],
  },
  {
    id: "environments-scenery",
    title: "Environments & Scenery",
    description:
      "Landscape and architectural artwork where the world itself is the focus.",
    services: [
      {
        id: "environments",
        title: "Environments",
        summary:
          "Natural landscapes, structures and interiors for personal or commercial projects.",
        variants: [
          {
            style: "semi-realism",
            styleLabel: "Semirealism",
            pricingServiceCode: "semi-environments",
          },
        ],
      },
    ],
  },
  {
    id: "pets-creatures",
    title: "Pets & Creatures",
    description:
      "Custom portraits celebrating pets and animal companions.",
    services: [
      {
        id: "pet-illustrations",
        title: "Pet Illustrations",
        summary:
          "Portraits and full-body artwork of your pet in Fefierys' art styles.",
        variants: [
          {
            style: "semi-realism",
            styleLabel: "Semirealism",
            pricingServiceCode: "semi-pets",
          },
          {
            style: "stylized",
            styleLabel: "Stylized",
            pricingServiceCode: "sty-pets",
          },
        ],
      },
    ],
  },
  {
    id: "chibis-emotes",
    title: "Chibis & Emotes",
    description:
      "Small, expressive artwork for characters, communities and social spaces.",
    services: [
      {
        id: "chibis",
        title: "Chibis",
        summary:
          "Cute half-body and full-body chibi versions of your characters.",
        variants: [
          {
            style: "chibis-emotes",
            styleLabel: "Chibi",
            pricingServiceCode: "characters",
          },
        ],
      },
      {
        id: "emotes",
        title: "Emotes",
        summary:
          "Custom emotes for Discord, Twitch and online communities.",
        variants: [
          {
            style: "chibis-emotes",
            styleLabel: "Emotes",
            pricingServiceCode: "custom",
          },
        ],
      },
    ],
  },
];

function trimNumericValue(value: string): string {
  const normalized = value.trim();

  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return normalized;
  }

  return normalized
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?[1-9])0+$/, "$1");
}

function formatMoney(value: string, currency: string): string {
  const amount = trimNumericValue(value);

  return currency === "USD"
    ? `$${amount} USD`
    : `${amount} ${currency}`;
}

function formatAdjustmentValue(
  adjustment: CommissionPricingAdjustment,
  currency: string,
): string {
  if (
    adjustment.calculationType === "fixed" &&
    adjustment.fixedAmount !== null
  ) {
    return `+${formatMoney(adjustment.fixedAmount, currency)}`;
  }

  if (
    adjustment.calculationType === "percentage" &&
    adjustment.percentageRate !== null
  ) {
    const percentage = trimNumericValue(adjustment.percentageRate);

    const basis =
      adjustment.calculationBasis === "base_price"
        ? " of the base tier price"
        : adjustment.calculationBasis === "base_plus_extras"
          ? " of the base price plus selected extras"
          : adjustment.calculationBasis === "base_items"
            ? " of the selected base items"
            : adjustment.calculationBasis === "pre_discount_subtotal"
              ? " of the pre-discount subtotal"
              : "";

    return `+${percentage}%${basis}`;
  }

  return "Price confirmed in the quote";
}

function formatAdjustmentDetail(
  adjustment: CommissionPricingAdjustment,
  currency: string,
): string {
  const value = formatAdjustmentValue(adjustment, currency);
  const description = adjustment.description?.trim();

  return description
    ? `${adjustment.name}: ${value}. ${description}`
    : `${adjustment.name}: ${value}.`;
}

function createNotes(
  adjustments: CommissionPricingAdjustment[],
  currency: string,
): PublicCommissionNote[] {
  const sections: Array<{
    kind: CommissionPricingAdjustment["kind"];
    title: string;
  }> = [
    { kind: "extra", title: "Extras" },
    { kind: "license", title: "Licenses" },
    { kind: "discount", title: "Discounts" },
  ];

  return sections.flatMap(({ kind, title }) => {
    const matchingAdjustments = adjustments.filter(
      (adjustment) => adjustment.kind === kind,
    );

    if (matchingAdjustments.length === 0) {
      return [];
    }

    return [
      {
        title,
        details: matchingAdjustments.map((adjustment) =>
          formatAdjustmentDetail(adjustment, currency),
        ),
      },
    ];
  });
}

function getCommonAdjustments(
  options: CommissionPricingServiceWithOptions["options"],
): CommissionPricingAdjustment[] {
  const [firstOption, ...remainingOptions] = options;

  if (!firstOption) {
    return [];
  }

  /*
   * CommissionCatalog currently displays pricing notes at service level.
   * Only expose adjustments that apply to every visible option so a
   * future option-specific adjustment is never presented as universal.
   */
  return firstOption.adjustments.filter((adjustment) =>
    remainingOptions.every(({ adjustments }) =>
      adjustments.some(
        (candidate) => candidate.id === adjustment.id,
      ),
    ),
  );
}

function createPublicCommissionData(
  entry: CommissionPricingServiceWithOptions,
  pricingVersionId: string,
  currency: string,
): PublicCommissionData {
  const { service, options } = entry;

  if (!service.heroImage) {
    throw new Error(
      `Public commission pricing service "${service.code}" is missing a hero image.`,
    );
  }

  return {
    id: service.code,
    pricingServiceId: service.id,
    pricingVersionId,
    title: service.title,
    subtitle: service.subtitle ?? "",
    heroImage: service.heroImage,
    options: options.map(({ option }) => ({
      id: option.id,
      code: option.code,
      title: option.title,
      publicLabel: option.publicLabel,
      price: formatMoney(option.baseAmount, currency),
      description: option.description ?? "",
    })),
    notes: createNotes(
      getCommonAdjustments(options),
      currency,
    ),
    cta: service.cta ?? "Send an inquiry",
  };
}

export async function getPublicCommissionGroups(): Promise<
  PublicCommissionGroup[]
> {
  const catalog = await getActiveCommissionPricingCatalog({
    audience: "public",
  });

  if (!catalog) {
    throw new Error(
      "No active commission pricing catalog is available for the public commissions page.",
    );
  }

  const servicesByCode = new Map(
    catalog.services.map((entry) => [
      entry.service.code,
      entry,
    ]),
  );

  return PUBLIC_COMMISSION_GROUP_DEFINITIONS.flatMap((group) => {
    const services = group.services.flatMap((serviceDefinition) => {
      const variants = serviceDefinition.variants.flatMap(
        (variantDefinition) => {
          const pricingService = servicesByCode.get(
            variantDefinition.pricingServiceCode,
          );

          /*
           * A service/variant that is inactive, outside its availability
           * window, admin-only, or has no public options is intentionally
           * omitted from the public page.
           */
          if (
            !pricingService ||
            pricingService.options.length === 0
          ) {
            return [];
          }

          return [
            {
              style: variantDefinition.style,
              styleLabel: variantDefinition.styleLabel,
              data: createPublicCommissionData(
                pricingService,
                catalog.version.id,
                catalog.version.currency,
              ),
            },
          ];
        },
      );

      if (variants.length === 0) {
        return [];
      }

      return [
        {
          id: serviceDefinition.id,
          title: serviceDefinition.title,
          summary: serviceDefinition.summary,
          variants,
        },
      ];
    });

    if (services.length === 0) {
      return [];
    }

    return [
      {
        id: group.id,
        title: group.title,
        description: group.description,
        services,
      },
    ];
  });
}
