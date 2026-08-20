import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { semiRealism } from "@/data/portfolio/semiRealism";

import {
  generatePortfolioMetadata,
  resolvePortfolioRoute,
} from "@/lib/seo/portfolioMetadata";


interface SemiRealismSlugPageProps {
  params: Promise<{
    slug: string[];
  }>;
}


export async function generateMetadata({
  params,
}: SemiRealismSlugPageProps): Promise<Metadata> {

  const { slug } = await params;

  return generatePortfolioMetadata(
    semiRealism,
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


export default async function SemiRealismSlugPage({
  params,
}: SemiRealismSlugPageProps) {

  const { slug } = await params;

  const resolved =
    resolvePortfolioRoute(
      semiRealism,
      slug
    );

  if (
    resolved.type === "invalid"
  ) {
    notFound();
  }

  return (
    <PortfolioCategory
      data={semiRealism}
      slug={slug}
    />
  );
}