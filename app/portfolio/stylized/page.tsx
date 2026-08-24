import type {
  Metadata,
} from "next";

import {
  notFound,
} from "next/navigation";

import PortfolioOverview from "@/components/portfolio/PortfolioOverview";

import {
  getPortfolioSectionBySlug,
} from "@/lib/repositories/portfolioRepository";

export const metadata: Metadata = {
  title:
    "Stylized Fantasy Illustration",

  description:
    "Explore the stylized fantasy illustration portfolio by Fefierys, featuring book art, character design, icons, pet artwork, and custom commissions.",

  alternates: {
    canonical:
      "/portfolio/stylized",
  },

  openGraph: {
    title:
      "Stylized Fantasy Illustration | Fefierys",

    description:
      "Explore stylized fantasy illustration, book art, character design, icons, pet artwork, and commissions by Fefierys.",

    url:
      "/portfolio/stylized",

    type:
      "website",
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Stylized Fantasy Illustration | Fefierys",

    description:
      "Explore stylized fantasy illustration, book art, character design, icons, pet artwork, and commissions by Fefierys.",
  },
};

export default async function StylizedPage() {
  const data =
    await getPortfolioSectionBySlug(
      "stylized"
    );

  if (!data) {
    notFound();
  }

  return (
    <PortfolioOverview
      data={data}
      description="Explore a selection of my stylized fantasy illustration work, including book art, character design, icons, pets, and commissioned artwork."
    />
  );
}