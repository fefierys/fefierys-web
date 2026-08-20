import type { Metadata } from "next";

import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { stylized } from "@/data/portfolio/stylized";


export const metadata: Metadata = {
  title: "Stylized Fantasy Illustration",

  description:
    "Explore the stylized fantasy illustration portfolio by Fefierys, featuring book art, character design, icons, pet artwork, and custom commissions.",

  alternates: {
    canonical: "/portfolio/stylized",
  },

  openGraph: {
    title: "Stylized Fantasy Illustration | Fefierys",
    description:
      "Explore stylized fantasy illustration, book art, character design, icons, pet artwork, and commissions by Fefierys.",
    url: "/portfolio/stylized",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Stylized Fantasy Illustration | Fefierys",
    description:
      "Explore stylized fantasy illustration, book art, character design, icons, pet artwork, and commissions by Fefierys.",
  },
};


export default function StylizedPage() {
  return (
    <PortfolioCategory
      data={stylized}
    />
  );
}