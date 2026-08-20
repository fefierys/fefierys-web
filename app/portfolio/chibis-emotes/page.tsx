import type { Metadata } from "next";

import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { chibis } from "@/data/portfolio/chibis";


export const metadata: Metadata = {
  title: "Chibi Art & Custom Emotes",

  description:
    "Explore the chibi and emote portfolio by Fefierys, featuring cute character illustrations, custom chibi commissions, Twitch emotes, Discord emotes, and streaming artwork.",

  alternates: {
    canonical: "/portfolio/chibis-emotes",
  },

  openGraph: {
    title: "Chibi Art & Custom Emotes | Fefierys",

    description:
      "Explore custom chibi characters, Twitch emotes, Discord emotes, streaming artwork, and commissions by Fefierys.",

    url: "/portfolio/chibis-emotes",

    type: "website",
  },

  twitter: {
    card: "summary_large_image",

    title: "Chibi Art & Custom Emotes | Fefierys",

    description:
      "Explore custom chibi characters, Twitch emotes, Discord emotes, streaming artwork, and commissions by Fefierys.",
  },
};


export default function ChibisPage() {
  return (
    <PortfolioCategory
      data={chibis}
    />
  );
}