import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";

import PortfolioCategory from "@/components/portfolio/PortfolioCategory";

import {
  generatePortfolioMetadata,
  resolvePortfolioRoute,
} from "@/lib/seo/portfolioMetadata";

import {
  getPortfolioSectionBySlug,
} from "@/lib/repositories/portfolioRepository";

interface ChibisSlugPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

/*
 * ============================================================
 * PORTFOLIO DATA
 * ============================================================
 */

async function getChibisPortfolio() {
  const data =
    await getPortfolioSectionBySlug(
      "chibis-emotes"
    );

  if (!data) {
    notFound();
  }

  return data;
}

/*
 * ============================================================
 * METADATA
 * ============================================================
 */

export async function generateMetadata({
  params,
}: ChibisSlugPageProps): Promise<Metadata> {
  const {
    slug,
  } = await params;

  const data =
    await getChibisPortfolio();

  return generatePortfolioMetadata(
    data,
    slug,
    {
      portfolioLabel:
        "Chibis & Emotes",

      categoryTitle: (
        categoryName,
        groupName
      ) =>
        `${categoryName} - ${groupName}`,

      categoryDescription: (
        categoryName,
        groupName
      ) =>
        `Explore ${categoryName.toLowerCase()} from the ${groupName.toLowerCase()} portfolio by Fefierys, featuring chibi character art, custom emotes, and commissioned illustrations.`,

      artworkDescription: (
        artworkName
      ) =>
        `${artworkName}. Explore this chibi or custom emote artwork by Fefierys and discover more character art, streaming emotes, and custom commissions.`,
    }
  );
}

/*
 * ============================================================
 * PAGE
 * ============================================================
 */

export default async function ChibisSlugPage({
  params,
}: ChibisSlugPageProps) {
  const {
    slug,
  } = await params;

  const data =
    await getChibisPortfolio();

  const resolved =
    resolvePortfolioRoute(
      data,
      slug
    );

  if (
    resolved.type ===
    "invalid"
  ) {
    notFound();
  }

  /*
   * Only Group + Category.
   *
   * Artwork is intentionally excluded so
   * opening/changing the Lightbox does not
   * remount the whole category.
   */

  const categoryKey =
    `${slug[0] ?? ""}/${slug[1] ?? ""}`;

  return (
    <PortfolioCategory
      key={
        categoryKey
      }
      data={
        data
      }
      slug={
        slug
      }
      exploreCollectionsLocally
    />
  );
}