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

interface SemiRealismSlugPageProps {
  params: Promise<{
    slug: string[];
  }>;
}

/*
 * ============================================================
 * PORTFOLIO DATA
 * ============================================================
 */

async function getSemiRealismPortfolio() {
  const data =
    await getPortfolioSectionBySlug(
      "semi-realism"
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
}: SemiRealismSlugPageProps): Promise<Metadata> {
  const {
    slug,
  } = await params;

  const data =
    await getSemiRealismPortfolio();

  return generatePortfolioMetadata(
    data,
    slug,
    {
      portfolioLabel:
        "Semi-Realism",

      categoryTitle: (
        categoryName,
        groupName
      ) =>
        `${categoryName} - Semi-Realism ${groupName}`,

      categoryDescription: (
        categoryName,
        groupName
      ) =>
        `Explore ${categoryName.toLowerCase()} from the semi-realism ${groupName.toLowerCase()} portfolio by Fefierys, featuring fantasy illustration and custom commissioned artwork.`,

      artworkDescription: (
        artworkName
      ) =>
        `${artworkName}. Explore this semi-realism fantasy artwork by Fefierys and discover more character art, book illustration, and custom commissions.`,
    }
  );
}

/*
 * ============================================================
 * PAGE
 * ============================================================
 */

export default async function SemiRealismSlugPage({
  params,
}: SemiRealismSlugPageProps) {
  const {
    slug,
  } = await params;

  const data =
    await getSemiRealismPortfolio();

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
   * Important:
   *
   * The key only contains:
   *
   * group/category
   *
   * NOT artwork.
   *
   * This resets the locally opened Collection
   * when the actual Category changes while
   * preserving ArtworkGrid/Lightbox behaviour
   * inside the same Category.
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