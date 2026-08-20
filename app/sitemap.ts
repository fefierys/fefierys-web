import type { MetadataRoute } from "next";

import { semiRealism } from "@/data/portfolio/semiRealism";
import { stylized } from "@/data/portfolio/stylized";
import { chibis } from "@/data/portfolio/chibis";

const BASE_URL = "https://fefierys.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  const portfolios = [
    semiRealism,
    stylized,
    chibis,
  ];

  const portfolioPages: MetadataRoute.Sitemap = [];

  for (const portfolio of portfolios) {
    // Página principal del portfolio
    portfolioPages.push({
      url: `${BASE_URL}/portfolio/${portfolio.slug}`,
      changeFrequency: "monthly",
      priority: 0.9,
    });

    for (const group of portfolio.groups) {
      for (const subcategory of group.subcategories) {
        // Página de categoría
        const categoryUrl =
          `${BASE_URL}/portfolio/${portfolio.slug}/${group.slug}/${subcategory.slug}`;

        portfolioPages.push({
          url: categoryUrl,
          changeFrequency: "monthly",
          priority: 0.8,
        });

        // Página individual de cada artwork
        for (const artwork of subcategory.artworks) {
          portfolioPages.push({
            url: `${categoryUrl}/${artwork.slug}`,
            changeFrequency: "monthly",
            priority: 0.7,
          });
        }
      }
    }
  }

  return [
    ...staticPages,
    ...portfolioPages,
  ];
}