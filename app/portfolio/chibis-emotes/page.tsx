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
    "Chibi Art & Custom Emotes",

  description:
    "Explore the chibi and emote portfolio by Fefierys, featuring cute character illustrations, custom chibi commissions, Twitch emotes, Discord emotes, and streaming artwork.",

  alternates: {
    canonical:
      "/portfolio/chibis-emotes",
  },

  openGraph: {
    title:
      "Chibi Art & Custom Emotes | Fefierys",

    description:
      "Explore custom chibi characters, Twitch emotes, Discord emotes, streaming artwork, and commissions by Fefierys.",

    url:
      "/portfolio/chibis-emotes",

    type:
      "website",
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Chibi Art & Custom Emotes | Fefierys",

    description:
      "Explore custom chibi characters, Twitch emotes, Discord emotes, streaming artwork, and commissions by Fefierys.",
  },
};

export default async function ChibisPage() {
  const data =
    await getPortfolioSectionBySlug(
      "chibis-emotes"
    );

  if (!data) {
    notFound();
  }

  return (
    <PortfolioOverview
      data={data}
      description="Explore a selection of my chibi and custom emote artwork, including cute character illustrations, Twitch emotes, Discord emotes, streaming artwork, and commissioned pieces."
    />
  );
}