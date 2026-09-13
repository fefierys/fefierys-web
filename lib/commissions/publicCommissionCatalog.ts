import {
  commissions,
  type CommissionData,
} from "@/data/portfolio/commissions";;

export type PublicCommissionStyle =
  | "semi-realism"
  | "stylized"
  | "chibis-emotes";

export interface PublicCommissionVariant {
  style: PublicCommissionStyle;
  styleLabel: string;
  data: CommissionData;
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

function createVariant(
  style: PublicCommissionStyle,
  styleLabel: string,
  commissionId: string,
): PublicCommissionVariant {
  const data = commissions[commissionId];

  if (!data) {
    throw new Error(
      `Missing hardcoded commission data for "${commissionId}".`,
    );
  }

  return {
    style,
    styleLabel,
    data,
  };
}

export const publicCommissionGroups: PublicCommissionGroup[] = [
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
          createVariant(
            "semi-realism",
            "Semirealism",
            "semi-covers",
          ),
          createVariant(
            "stylized",
            "Stylized",
            "sty-covers",
          ),
        ],
      },
      {
        id: "interior-illustrations",
        title: "Interior Illustrations",
        summary:
          "Spot, half-page, full-page and spread illustrations for the inside of your book.",
        variants: [
          createVariant(
            "semi-realism",
            "Semirealism",
            "semi-interior-illustration",
          ),
          createVariant(
            "stylized",
            "Stylized",
            "sty-interior-illustration",
          ),
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
          createVariant(
            "semi-realism",
            "Semirealism",
            "semi-icons",
          ),
          createVariant(
            "stylized",
            "Stylized",
            "sty-icons",
          ),
        ],
      },
      {
        id: "character-design",
        title: "Character Design",
        summary:
          "Develop your character from descriptions, ideas and visual references.",
        variants: [
          createVariant(
            "semi-realism",
            "Semirealism",
            "semi-character-design",
          ),
          createVariant(
            "stylized",
            "Stylized",
            "sty-character-design",
          ),
        ],
      },
      {
        id: "character-illustrations",
        title: "Character Illustrations",
        summary:
          "Finished character-focused scenes for personal, promotional or commercial projects.",
        variants: [
          createVariant(
            "semi-realism",
            "Semirealism",
            "semi-character-illustrations",
          ),
          createVariant(
            "stylized",
            "Stylized",
            "sty-character-illustrations",
          ),
        ],
      },
      {
        id: "reference-sheets",
        title: "Reference Sheets",
        summary:
          "A visual reference presenting the essential information about your character.",
        variants: [
          createVariant(
            "semi-realism",
            "Semirealism",
            "semi-ref-sheets",
          ),
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
          createVariant(
            "semi-realism",
            "Semirealism",
            "semi-environments",
          ),
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
        id: "pets",
        title: "Pet Illustrations",
        summary:
          "Portraits and full-body artwork of your pet in Fefierys' art styles.",
        variants: [
          createVariant(
            "semi-realism",
            "Semirealism",
            "semi-pets",
          ),
          createVariant(
            "stylized",
            "Stylized",
            "sty-pets",
          ),
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
          createVariant(
            "chibis-emotes",
            "Chibi",
            "characters",
          ),
        ],
      },
      {
        id: "emotes",
        title: "Emotes",
        summary:
          "Custom emotes for Discord, Twitch and online communities.",
        variants: [
          createVariant(
            "chibis-emotes",
            "Emotes",
            "custom",
          ),
        ],
      },
    ],
  },
];