import type { Metadata } from "next";

import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { semiRealism } from "@/data/portfolio/semiRealism";

export const metadata: Metadata = {
  title: "Semi-Realism Fantasy Illustration",

  description:
    "Explore the semi-realism, fantasy illustration portfolio by Fefierys, featuring book art, character design, portraits, environments, pet portraits, and custom commissions.",

  alternates: {
    canonical: "/portfolio/semi-realism",
  },

  openGraph: {
    title: "Semi-Realism Fantasy Illustration | Fefierys",
    description:
      "Explore semi-realism fantasy illustration, book art, character design, portraits, environments, pet portraits, and commissions by Fefierys.",
    url: "/portfolio/semi-realism",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Semi-Realism Fantasy Illustration | Fefierys",
    description:
      "Explore semi-realism fantasy illustration, book art, character design, portraits, environments, pet portraits, and commissions by Fefierys.",
  },
};

export default function SemiRealismPage() {
  return (
    <PortfolioCategory
      data={semiRealism}
    />
  );
}