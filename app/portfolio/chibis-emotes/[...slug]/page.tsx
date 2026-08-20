import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { chibis } from "@/data/portfolio/chibis";

import {
  generatePortfolioMetadata,
  resolvePortfolioRoute,
} from "@/lib/seo/portfolioMetadata";


interface ChibisSlugPageProps {
  params: Promise<{
    slug: string[];
  }>;
}


export async function generateMetadata({
  params,
}: ChibisSlugPageProps): Promise<Metadata> {

  const { slug } = await params;

  return generatePortfolioMetadata(
    chibis,
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


export default async function ChibisSlugPage({
  params,
}: ChibisSlugPageProps) {

  const { slug } = await params;

  const resolved =
    resolvePortfolioRoute(
      chibis,
      slug
    );

  if (
    resolved.type === "invalid"
  ) {
    notFound();
  }

  return (
    <PortfolioCategory
      data={chibis}
      slug={slug}
    />
  );
}