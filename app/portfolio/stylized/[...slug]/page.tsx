import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { stylized } from "@/data/portfolio/stylized";

import {
  generatePortfolioMetadata,
  resolvePortfolioRoute,
} from "@/lib/seo/portfolioMetadata";


interface StylizedSlugPageProps {
  params: Promise<{
    slug: string[];
  }>;
}


export async function generateMetadata({
  params,
}: StylizedSlugPageProps): Promise<Metadata> {

  const { slug } = await params;

  return generatePortfolioMetadata(
    stylized,
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


export default async function StylizedSlugPage({
  params,
}: StylizedSlugPageProps) {

  const { slug } = await params;

  const resolved =
    resolvePortfolioRoute(
      stylized,
      slug
    );

  if (
    resolved.type === "invalid"
  ) {
    notFound();
  }

  return (
    <PortfolioCategory
      data={stylized}
      slug={slug}
    />
  );
}