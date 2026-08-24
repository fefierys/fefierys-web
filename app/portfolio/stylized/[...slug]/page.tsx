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

interface StylizedSlugPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

/*
 * ============================================================
 * PORTFOLIO DATA
 * ============================================================
 */

async function getStylizedPortfolio() {
  const data =
    await getPortfolioSectionBySlug(
      "stylized"
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
}: StylizedSlugPageProps): Promise<Metadata> {
  const {
    slug,
  } = await params;

  const data =
    await getStylizedPortfolio();

  return generatePortfolioMetadata(
    data,
    slug,
    {
      portfolioLabel:
        "Stylized",

      categoryTitle: (
        categoryName,
        groupName
      ) =>
        `${categoryName} - Stylized ${groupName}`,

      categoryDescription: (
        categoryName,
        groupName
      ) =>
        `Explore ${categoryName.toLowerCase()} from the stylized ${groupName.toLowerCase()} portfolio by Fefierys, featuring fantasy illustration and custom commissioned artwork.`,

      artworkDescription: (
        artworkName
      ) =>
        `${artworkName}. Explore this stylized fantasy artwork by Fefierys and discover more character art, book illustration, and custom commissions.`,
    }
  );
}

/*
 * ============================================================
 * PAGE
 * ============================================================
 */

export default async function StylizedSlugPage({
  params,
}: StylizedSlugPageProps) {
  const {
    slug,
  } = await params;

  const data =
    await getStylizedPortfolio();

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