import type {
  CommissionPricingAdjustmentKind,
  CommissionPricingCalculationBasis,
  CommissionPricingCalculationType,
} from "@/lib/commissions/commissionPricing";

export interface InitialCommissionPricingOption {
  code: string;
  title: string;
  publicLabel: string;
  quoteLabel: string;
  description: string | null;
  baseAmount: string;
}

export interface InitialCommissionPricingAdjustment {
  code: string;
  name: string;
  description: string;
  kind: CommissionPricingAdjustmentKind;
  calculationType: CommissionPricingCalculationType;
  calculationBasis: CommissionPricingCalculationBasis;
  fixedAmount: string | null;
  percentageRate: string | null;
  maxQuantity: number | null;
  isValueEditable: boolean;
  minimumPercentageRate: string | null;
  maximumPercentageRate: string | null;
  requiresInternalNote: boolean;
  stackable: boolean;
}

export interface InitialCommissionPricingService {
  code: string;
  title: string;
  subtitle: string;
  heroImage: string;
  cta: string;
  options: InitialCommissionPricingOption[];
  adjustments: InitialCommissionPricingAdjustment[];
}

const CHARACTER_DESCRIPTION =
  "Can be a human, anthro character, or fantasy creature.";
const CREATURE_DESCRIPTION = "Can be a humanoid or creature.";
const PET_DESCRIPTION = "Smaller than a human.";
const PET_WITH_SIZE_RULE_DESCRIPTION =
  "Smaller than a human. Animals the same size as or larger than a human count as an additional character.";
const COMMERCIAL_USE_DESCRIPTION =
  "Includes monetized streaming (Twitch, YouTube, etc.) and promotional use.";
const MERCHANDISING_DESCRIPTION =
  "Required when the artwork will be used to manufacture physical goods for sale, such as apparel, prints, or stickers.";

function fixedAdjustment(input: {
  code: string;
  description: string;
  kind: "extra" | "license";
  maxQuantity: number | null;
  name: string;
  value: string;
}): InitialCommissionPricingAdjustment {
  const { value, ...adjustment } = input;

  return {
    calculationBasis: "none",
    calculationType: "fixed",
    fixedAmount: value,
    percentageRate: null,
    isValueEditable: false,
    minimumPercentageRate: null,
    maximumPercentageRate: null,
    requiresInternalNote: false,
    stackable: true,
    ...adjustment,
  };
}

function percentageAdjustment(input: {
  basis: "base_plus_extras" | "base_price";
  code: string;
  description: string;
  kind: "extra" | "license";
  maxQuantity: number | null;
  name: string;
  value: string;
}): InitialCommissionPricingAdjustment {
  const { basis, value, ...adjustment } = input;

  return {
    ...adjustment,
    calculationBasis: basis,
    calculationType: "percentage",
    fixedAmount: null,
    percentageRate: value,
    isValueEditable: false,
    minimumPercentageRate: null,
    maximumPercentageRate: null,
    requiresInternalNote: false,
    stackable: true,
  };
}

function option(input: {
  amount: string;
  code: string;
  context: string;
  description?: string;
  title: string;
}): InitialCommissionPricingOption {
  const label = `${input.title} — ${input.context}`;

  return {
    baseAmount: input.amount,
    code: input.code,
    description: input.description ?? null,
    publicLabel: label,
    quoteLabel: label,
    title: input.title,
  };
}

function characterFixed(value: string, code = "character") {
  return fixedAdjustment({
    code,
    description: CHARACTER_DESCRIPTION,
    kind: "extra",
    maxQuantity: null,
    name: "Character",
    value,
  });
}

function petFixed(value: string, description = PET_DESCRIPTION, code = "pet") {
  return fixedAdjustment({
    code,
    description,
    kind: "extra",
    maxQuantity: null,
    name: "Pet",
    value,
  });
}

function characterPercentage(value = "50") {
  return percentageAdjustment({
    basis: "base_price",
    code: "character",
    description: CHARACTER_DESCRIPTION,
    kind: "extra",
    maxQuantity: null,
    name: "Character",
    value,
  });
}

function petPercentage(value = "20", description = PET_DESCRIPTION) {
  return percentageAdjustment({
    basis: "base_price",
    code: "pet",
    description,
    kind: "extra",
    maxQuantity: null,
    name: "Pet",
    value,
  });
}

function commercialPercentage(value = "50") {
  return percentageAdjustment({
    basis: "base_plus_extras",
    code: "commercial-use",
    description: COMMERCIAL_USE_DESCRIPTION,
    kind: "license",
    maxQuantity: 1,
    name: "Commercial Use",
    value,
  });
}

function commercialFixed(value = "100") {
  return fixedAdjustment({
    code: "commercial-use",
    description: COMMERCIAL_USE_DESCRIPTION,
    kind: "license",
    maxQuantity: 1,
    name: "Commercial Use",
    value,
  });
}

function merchandising(value: string) {
  return fixedAdjustment({
    code: "merchandising",
    description: MERCHANDISING_DESCRIPTION,
    kind: "license",
    maxQuantity: 1,
    name: "Merchandising",
    value,
  });
}

export const INITIAL_COMMISSION_PRICING_VERSION_NAME =
  "Fefierys catalog 2026.1";

export const INITIAL_COMMISSION_PRICING_SERVICES: InitialCommissionPricingService[] =
  [
    {
      code: "semi-covers",
      title: "Book Covers",
      subtitle:
        "Illustrated covers in a semirealistic style. Optional text layout and design are available. Base prices include environments and standard commercial rights for book publication.",
      heroImage: "/images/commissions/semi-realism/book-art/covers/cover.webp",
      cta: "Start a cover commission",
      options: [
        option({
          amount: "450",
          code: "cover",
          context: "Book Covers",
          title: "Cover",
          description:
            "Ideal for e-books. For paperbacks, it can include a simple, non-illustrated back cover.",
        }),
        option({
          amount: "600",
          code: "full-wrap",
          context: "Book Covers",
          title: "Full Wrap",
          description:
            "A continuous illustration spanning the front, spine, and back cover. It can include flaps if needed.",
        }),
      ],
      adjustments: [characterFixed("80"), petFixed("30"), merchandising("200")],
    },
    {
      code: "semi-interior-illustration",
      title: "Interior Illustration",
      subtitle:
        "Custom semirealistic artwork for the inside of a book. Base prices include environments and standard commercial rights for book publication.",
      heroImage:
        "/images/commissions/semi-realism/book-art/interior/interior.webp",
      cta: "Start an interior illustration commission",
      options: [
        option({
          amount: "100",
          code: "spot-illustration",
          context: "Book Interior",
          title: "Spot Illustration",
          description:
            "A small, focused artwork highlighting a single object, character, or detail without a background.",
        }),
        option({
          amount: "150",
          code: "half-page",
          context: "Book Interior",
          title: "Half Page",
          description:
            "A mid-sized artwork depicting a detailed environment that fills half of a single interior page.",
        }),
        option({
          amount: "250",
          code: "full-page",
          context: "Book Interior",
          title: "Full Page",
          description:
            "A complete, single-page environmental illustration designed to immerse the reader in the scene.",
        }),
        option({
          amount: "350",
          code: "double-spread",
          context: "Book Interior",
          title: "Double/Spread",
          description:
            "A wide, cinematic environmental artwork spanning two adjacent pages for maximum visual impact.",
        }),
      ],
      adjustments: [characterFixed("60"), petFixed("20"), merchandising("200")],
    },
    {
      code: "semi-icons",
      title: "Icons",
      subtitle:
        "Custom semirealistic avatars, profile pictures, or token designs.",
      heroImage: "/images/commissions/semi-realism/general/icons/icons.webp",
      cta: "Start an icon commission",
      options: [
        option({
          amount: "35",
          code: "lineart",
          context: "Icon",
          title: "Lineart",
          description:
            "A detailed black-and-white drawing without color or shading.",
        }),
        option({
          amount: "45",
          code: "flat",
          context: "Icon",
          title: "Flat",
          description:
            "Lineart filled with solid base colors and soft gradients.",
        }),
        option({
          amount: "60",
          code: "shaded",
          context: "Icon",
          title: "Shaded",
          description:
            "Lineart and color with shadows that add depth and dimension.",
        }),
        option({
          amount: "80",
          code: "full-render",
          context: "Icon",
          title: "Full Render",
          description:
            "Fully polished artwork with complex lighting, detailed textures, soft blending, and atmospheric effects. This option has no lineart for a more realistic finish.",
        }),
      ],
      adjustments: [
        characterPercentage(),
        petPercentage(),
        commercialPercentage(),
        merchandising("100"),
      ],
    },
    {
      code: "semi-character-design",
      title: "Character Design",
      subtitle:
        "Detailed full-body character design including one accessory, created from references or written descriptions.",
      heroImage:
        "/images/commissions/semi-realism/general/character-design/character-design.webp",
      cta: "Start a character design commission",
      options: [
        option({
          amount: "60",
          code: "lineart",
          context: "Character Design",
          title: "Lineart",
          description:
            "A detailed black-and-white drawing without color or shading. It can have a smooth or textured finish.",
        }),
        option({
          amount: "100",
          code: "flat",
          context: "Character Design",
          title: "Flat",
          description:
            "Lineart filled with solid base colors and soft gradients.",
        }),
        option({
          amount: "140",
          code: "shaded",
          context: "Character Design",
          title: "Shaded",
          description:
            "Lineart and color with shadows that add depth and dimension.",
        }),
        option({
          amount: "180",
          code: "full-render",
          context: "Character Design",
          title: "Full Render",
          description:
            "Fully polished artwork with complex lighting, detailed textures, soft blending, and atmospheric effects. This option has no lineart for a more realistic finish.",
        }),
      ],
      adjustments: [
        percentageAdjustment({
          basis: "base_price",
          code: "diorama-with-sky-rectangle",
          description:
            "A small base platform made of terrain or another element. The Lineart option does not include the sky.",
          kind: "extra",
          maxQuantity: 1,
          name: "Diorama with Sky Rectangle",
          value: "30",
        }),
        characterPercentage(),
        petPercentage("20", PET_WITH_SIZE_RULE_DESCRIPTION),
        commercialPercentage(),
        merchandising("100"),
      ],
    },
    {
      code: "semi-character-illustrations",
      title: "Character Illustrations",
      subtitle:
        "Detailed indoor or outdoor semirealistic character scenes in vertical or horizontal format.",
      heroImage:
        "/images/commissions/semi-realism/general/character-illustrations/character-illustration.webp",
      cta: "Start a character illustration commission",
      options: [
        option({
          amount: "300",
          code: "single-character",
          context: "Character Illustration",
          title: "Single Character",
          description:
            "A one-character composition, either half-body or full-body, in vertical or horizontal format.",
        }),
        option({
          amount: "350",
          code: "couple-scene",
          context: "Character Illustration",
          title: "Couple Scene",
          description:
            "Ideal for a romantic couple composition, either half-body or full-body, in vertical or horizontal format.",
        }),
      ],
      adjustments: [
        fixedAdjustment({
          code: "character",
          description: CREATURE_DESCRIPTION,
          kind: "extra",
          maxQuantity: null,
          name: "Character",
          value: "80",
        }),
        petFixed("30", PET_WITH_SIZE_RULE_DESCRIPTION),
        commercialFixed(),
        merchandising("200"),
      ],
    },
    {
      code: "semi-ref-sheets",
      title: "Reference Sheets",
      subtitle:
        "A clear presentation of your character's visual information, with standard packs or a custom selection of elements.",
      heroImage:
        "/images/commissions/semi-realism/general/ref-sheets/ref-sheet.webp",
      cta: "Start a reference sheet commission",
      options: [
        option({
          amount: "240",
          code: "essentials",
          context: "Reference Sheets",
          title: "Essentials",
          description:
            "One shaded front view, one shaded back view, and a color palette.",
        }),
        option({
          amount: "300",
          code: "standard",
          context: "Reference Sheets",
          title: "Standard",
          description:
            "One shaded front view, one shaded back view, one shaded bust, one accessory, and a color palette.",
        }),
        option({
          amount: "500",
          code: "full-pack",
          context: "Reference Sheets",
          title: "Full Pack",
          description:
            "One full-render front view, one full-render back view, one full-render bust, three emotions, accessories and/or a pet, and a color palette.",
        }),
      ],
      adjustments: [commercialFixed()],
    },
    {
      code: "semi-environments",
      title: "Environments",
      subtitle:
        "Landscape-focused semirealistic compositions in vertical or horizontal format.",
      heroImage:
        "/images/commissions/semi-realism/general/environments/environments.webp",
      cta: "Start an environment commission",
      options: [
        option({
          amount: "250",
          code: "natural-landscape",
          context: "Environments",
          title: "Natural Landscape",
          description:
            "A nature-focused composition. It may contain a small or distant structure occupying only a limited portion of the canvas.",
        }),
        option({
          amount: "350",
          code: "structures-interiors",
          context: "Environments",
          title: "Structures & Interiors",
          description:
            "A composition focused on human-made structures, either interior or exterior, in vertical or horizontal format.",
        }),
      ],
      adjustments: [commercialFixed(), merchandising("200")],
    },
    {
      code: "semi-pets",
      title: "Pets",
      subtitle:
        "A semirealistic pet portrait with a blurred or simple background.",
      heroImage: "/images/commissions/semi-realism/general/pets/pets.webp",
      cta: "Start a pet portrait commission",
      options: [
        option({
          amount: "70",
          code: "bust-up",
          context: "Pets",
          title: "Bust Up",
          description: "A portrait focused on your pet's face.",
        }),
        option({
          amount: "120",
          code: "full-body",
          context: "Pets",
          title: "Full Body",
          description: "A complete portrait of your pet from head to toe.",
        }),
      ],
      adjustments: [petPercentage("50")],
    },
    {
      code: "sty-covers",
      title: "Book Covers",
      subtitle:
        "Illustrated covers in a stylized art style. Optional text layout and design are available. Base prices include environments and standard commercial rights for book publication.",
      heroImage: "/images/commissions/stylized/book-art/covers/cover.webp",
      cta: "Start a stylized cover commission",
      options: [
        option({
          amount: "350",
          code: "cover",
          context: "Book Covers",
          title: "Cover",
          description:
            "Ideal for e-books. For paperbacks, it can include a simple, non-illustrated back cover.",
        }),
        option({
          amount: "500",
          code: "full-wrap",
          context: "Book Covers",
          title: "Full Wrap",
          description:
            "A continuous illustration spanning the front, spine, and back cover. It can include flaps if needed.",
        }),
      ],
      adjustments: [characterFixed("60"), petFixed("20"), merchandising("200")],
    },
    {
      code: "sty-interior-illustration",
      title: "Interior Illustration",
      subtitle:
        "Custom stylized artwork for the inside of a book. Base prices include environments and standard commercial rights for book publication.",
      heroImage: "/images/commissions/stylized/book-art/interior/interior.webp",
      cta: "Start a stylized interior illustration commission",
      options: [
        option({
          amount: "50",
          code: "spot-illustration",
          context: "Book Interior",
          title: "Spot Illustration",
          description:
            "A small, focused artwork highlighting a single object, character, or detail without a background.",
        }),
        option({
          amount: "100",
          code: "half-page",
          context: "Book Interior",
          title: "Half Page",
          description:
            "A mid-sized artwork depicting a detailed environment that fills half of a single interior page.",
        }),
        option({
          amount: "150",
          code: "full-page",
          context: "Book Interior",
          title: "Full Page",
          description:
            "A complete, single-page environmental illustration designed to immerse the reader in the scene.",
        }),
        option({
          amount: "250",
          code: "double-spread",
          context: "Book Interior",
          title: "Double/Spread",
          description:
            "A wide, cinematic environmental artwork spanning two adjacent pages for maximum visual impact.",
        }),
      ],
      adjustments: [
        characterFixed("40"),
        petFixed("20", PET_WITH_SIZE_RULE_DESCRIPTION),
        merchandising("200"),
      ],
    },
    {
      code: "sty-icons",
      title: "Icons",
      subtitle: "Custom stylized avatars, profile pictures, or token designs.",
      heroImage: "/images/commissions/stylized/general/icons/icons.webp",
      cta: "Start a stylized icon commission",
      options: [
        option({
          amount: "40",
          code: "circular-frame",
          context: "Icon",
          title: "Circular Frame",
          description: "A simple circular frame in the color of your choice.",
        }),
        option({
          amount: "40",
          code: "flat-background",
          context: "Icon",
          title: "Flat Background",
          description:
            "A flat-colored background behind the character portrait.",
        }),
      ],
      adjustments: [
        characterPercentage(),
        petPercentage(),
        commercialPercentage(),
        merchandising("100"),
      ],
    },
    {
      code: "sty-character-design",
      title: "Character Design",
      subtitle:
        "Detailed stylized character design including one accessory, created from references or written descriptions.",
      heroImage:
        "/images/commissions/stylized/general/character-design/character-design.webp",
      cta: "Start a stylized character design commission",
      options: [
        option({
          amount: "50",
          code: "half-body",
          context: "Character Design",
          title: "Half Body",
          description: "Your character from the head down to the hips.",
        }),
        option({
          amount: "60",
          code: "full-body",
          context: "Character Design",
          title: "Full Body",
          description: "Your character from head to toe.",
        }),
      ],
      adjustments: [
        characterPercentage(),
        petPercentage(),
        commercialPercentage(),
        merchandising("100"),
      ],
    },
    {
      code: "sty-character-illustrations",
      title: "Character Illustrations",
      subtitle:
        "Detailed indoor or outdoor stylized character scenes in vertical or horizontal format.",
      heroImage:
        "/images/commissions/stylized/general/character-illustrations/character-illustration.webp",
      cta: "Start a stylized illustration commission",
      options: [
        option({
          amount: "150",
          code: "single-character",
          context: "Character Illustration",
          title: "Single Character",
          description:
            "A one-character composition, either half-body or full-body, in vertical or horizontal format.",
        }),
        option({
          amount: "180",
          code: "duo-couple",
          context: "Character Illustration",
          title: "Duo/Couple",
          description:
            "A two-character composition, either half-body or full-body, in vertical or horizontal format.",
        }),
      ],
      adjustments: [
        fixedAdjustment({
          code: "character",
          description: CREATURE_DESCRIPTION,
          kind: "extra",
          maxQuantity: null,
          name: "Character",
          value: "40",
        }),
        petFixed("20", PET_WITH_SIZE_RULE_DESCRIPTION),
        commercialFixed(),
        merchandising("200"),
      ],
    },
    {
      code: "sty-pets",
      title: "Pets",
      subtitle: "A stylized pet portrait with a blurred or simple background.",
      heroImage: "/images/commissions/stylized/general/pets/pets.webp",
      cta: "Start a stylized pet portrait commission",
      options: [
        option({
          amount: "25",
          code: "bust-up",
          context: "Pets",
          title: "Bust Up",
          description: "A portrait focused on your pet's face.",
        }),
        option({
          amount: "45",
          code: "full-body",
          context: "Pets",
          title: "Full Body",
          description: "A complete portrait of your pet from head to toe.",
        }),
      ],
      adjustments: [petPercentage("50")],
    },
    {
      code: "characters",
      title: "Characters",
      subtitle:
        "Characters in a classic cute chibi style, including a rectangular frame or flat-color background.",
      heroImage: "/images/commissions/chibis-emotes/chibis/chibis.webp",
      cta: "Start a chibi commission",
      options: [
        option({
          amount: "20",
          code: "half-body",
          context: "Chibis",
          title: "Half Body",
          description: "Your character from the head down to the waist.",
        }),
        option({
          amount: "30",
          code: "full-body",
          context: "Chibis",
          title: "Full Body",
          description: "Your character from head to toe.",
        }),
      ],
      adjustments: [
        characterPercentage(),
        petFixed("15", PET_WITH_SIZE_RULE_DESCRIPTION),
        fixedAdjustment({
          code: "simple-background",
          description: "A simple custom background for your chibi.",
          kind: "extra",
          maxQuantity: 1,
          name: "Simple Background",
          value: "25",
        }),
        commercialPercentage(),
        merchandising("100"),
      ],
    },
    {
      code: "custom",
      title: "Custom Emotes",
      subtitle:
        "Custom emotes delivered in the sizes required for Discord or Twitch.",
      heroImage: "/images/commissions/chibis-emotes/emotes/emotes.webp",
      cta: "Start an emote commission",
      options: [
        option({
          amount: "10",
          code: "1-emote",
          context: "Custom Emote",
          title: "1 Emote",
        }),
        option({
          amount: "25",
          code: "3-emotes",
          context: "Custom Emote",
          title: "3 Emotes",
        }),
        option({
          amount: "30",
          code: "5-emotes",
          context: "Custom Emote",
          title: "5 Emotes",
        }),
        option({
          amount: "50",
          code: "10-emotes",
          context: "Custom Emote",
          title: "10 Emotes",
        }),
      ],
      adjustments: [],
    },
  ];

export const INITIAL_INDIE_AUTHOR_DISCOUNT: InitialCommissionPricingAdjustment =
  {
    calculationBasis: "pre_discount_subtotal",
    calculationType: "percentage",
    code: "indie-author-discount",
    description:
      "A manually selected discount for independent authors, calculated from the complete pre-discount subtotal.",
    fixedAmount: null,
    kind: "discount",
    maxQuantity: 1,
    isValueEditable: true,
    minimumPercentageRate: "0",
    maximumPercentageRate: "100",
    name: "Indie Author Discount",
    percentageRate: "0",
    requiresInternalNote: true,
    stackable: false,
  };
