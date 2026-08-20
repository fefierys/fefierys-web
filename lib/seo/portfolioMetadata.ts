import type { Metadata } from "next";

import type {
  Artwork,
  PortfolioData,
} from "@/data/portfolio/types";


/*
 * ============================================================
 * TYPES
 * ============================================================
 */

interface PortfolioSeoConfig {
  portfolioLabel: string;
  artworkDescription: (
    artworkName: string
  ) => string;
  categoryDescription: (
    categoryName: string,
    groupName: string
  ) => string;
  categoryTitle: (
    categoryName: string,
    groupName: string
  ) => string;
}


type ResolvedPortfolioRoute =
  | {
      type: "invalid";
    }
  | {
      type: "category";
      group: PortfolioData["groups"][number];
      category: PortfolioData["groups"][number]["subcategories"][number];
      categoryPath: string;
    }
  | {
      type: "artwork";
      group: PortfolioData["groups"][number];
      category: PortfolioData["groups"][number]["subcategories"][number];
      artwork: Artwork;
      categoryPath: string;
      artworkPath: string;
    };


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}


function formatArtworkSeoTitle(
  alt: string
) {
  return alt
    .replace(
      /\s+illustration by Fefierys$/i,
      ""
    )
    .trim();
}


/*
 * ============================================================
 * RESOLVE PORTFOLIO ROUTE
 * ============================================================
 */

export function resolvePortfolioRoute(
  data: PortfolioData,
  slug: string[]
): ResolvedPortfolioRoute {

  const groupSlug = slug?.[0];
  const categorySlug = slug?.[1];
  const artworkSlug = slug?.[2];

  if (
    !groupSlug ||
    !categorySlug ||
    slug.length > 3
  ) {
    return {
      type: "invalid",
    };
  }


  const group =
    data.groups.find(
      (item) =>
        item.slug === groupSlug
    );

  if (!group) {
    return {
      type: "invalid",
    };
  }


  const category =
    group.subcategories.find(
      (item) =>
        item.slug === categorySlug
    );

  if (!category) {
    return {
      type: "invalid",
    };
  }


  const categoryPath =
    `/portfolio/${data.slug}/${group.slug}/${category.slug}`;


  /*
   * Categoría
   */

  if (!artworkSlug) {
    return {
      type: "category",
      group,
      category,
      categoryPath,
    };
  }


  /*
   * Artwork
   */

  const artwork =
    category.artworks.find(
      (item) =>
        item.slug === artworkSlug
    );

  if (!artwork) {
    return {
      type: "invalid",
    };
  }


  return {
    type: "artwork",
    group,
    category,
    artwork,
    categoryPath,
    artworkPath:
      `${categoryPath}/${artwork.slug}`,
  };
}


/*
 * ============================================================
 * GENERATE PORTFOLIO METADATA
 * ============================================================
 */

export function generatePortfolioMetadata(
  data: PortfolioData,
  slug: string[],
  config: PortfolioSeoConfig
): Metadata {

  const resolved =
    resolvePortfolioRoute(
      data,
      slug
    );


  /*
   * URL inválida
   */

  if (
    resolved.type === "invalid"
  ) {
    return {
      robots: {
        index: false,
        follow: false,
      },
    };
  }


  /*
   * ============================================================
   * ARTWORK
   * ============================================================
   */

  if (
    resolved.type === "artwork"
  ) {

    const {
      artwork,
      artworkPath,
    } = resolved;

    const artworkName =
      formatArtworkSeoTitle(
        artwork.alt
      );

    const description =
      config.artworkDescription(
        artworkName
      );


    return {
      title: artworkName,

      description,

      alternates: {
        canonical: artworkPath,
      },

      openGraph: {
        title:
          `${artworkName} | Fefierys`,

        description,

        url: artworkPath,

        type: "website",

        images: [
          {
            url: artwork.src,
            alt: artwork.alt,
          },
        ],
      },

      twitter: {
        card:
          "summary_large_image",

        title:
          `${artworkName} | Fefierys`,

        description,

        images: [
          artwork.src,
        ],
      },
    };
  }


  /*
   * ============================================================
   * CATEGORY
   * ============================================================
   */

  const {
    group,
    category,
    categoryPath,
  } = resolved;

  const categoryName =
    toTitleCase(
      category.title
    );

  const groupName =
    toTitleCase(
      group.title
    );

  const title =
    config.categoryTitle(
      categoryName,
      groupName
    );

  const description =
    config.categoryDescription(
      categoryName,
      groupName
    );


  return {
    title,

    description,

    alternates: {
      canonical: categoryPath,
    },

    openGraph: {
      title:
        `${title} | Fefierys`,

      description,

      url: categoryPath,

      type: "website",
    },

    twitter: {
      card:
        "summary_large_image",

      title:
        `${title} | Fefierys`,

      description,
    },
  };
}