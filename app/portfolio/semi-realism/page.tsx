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
    "Semi-Realism Fantasy Illustration",

  description:
    "Explore the semi-realism, fantasy illustration portfolio by Fefierys, featuring book art, character design, portraits, environments, pet portraits, and custom commissions.",

  alternates: {
    canonical:
      "/portfolio/semi-realism",
  },

  openGraph: {
    title:
      "Semi-Realism Fantasy Illustration | Fefierys",

    description:
      "Explore semi-realism fantasy illustration, book art, character design, portraits, environments, pet portraits, and commissions by Fefierys.",

    url:
      "/portfolio/semi-realism",

    type:
      "website",
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Semi-Realism Fantasy Illustration | Fefierys",

    description:
      "Explore semi-realism fantasy illustration, book art, character design, portraits, environments, pet portraits, and commissions by Fefierys.",
  },
};

export default async function SemiRealismPage() {
  const data =
    await getPortfolioSectionBySlug(
      "semi-realism"
    );

  if (!data) {
    notFound();
  }

  return (
    <PortfolioOverview
      data={data}
      description="Explore a selection of my semi-realism fantasy illustration work, including book art, character design, portraits, environments, reference sheets, pets, and commissioned artwork."
    />
  );
}