import type {
  MetadataRoute,
} from "next";

import {
  getPortfolioSitemapEntries,
} from "@/lib/repositories/portfolioRepository";

const BASE_URL =
  "https://fefierys.com";

export default async function sitemap():
Promise<MetadataRoute.Sitemap> {
  const staticPages:
    MetadataRoute.Sitemap = [
      {
        url: BASE_URL,
        changeFrequency:
          "monthly",
        priority: 1,
      },
      {
        url:
          `${BASE_URL}/about`,
        changeFrequency:
          "monthly",
        priority: 0.7,
      },
      {
        url:
          `${BASE_URL}/contact`,
        changeFrequency:
          "monthly",
        priority: 0.7,
      },
    ];

  const entries =
    await getPortfolioSitemapEntries();

  const portfolioPages:
    MetadataRoute.Sitemap = [];

  /*
   * The joined query returns one row per
   * public artwork hierarchy.
   *
   * Sets prevent section/category URLs
   * from being emitted multiple times.
   */

  const sectionUrls =
    new Set<string>();

  const categoryUrls =
    new Set<string>();

  for (const entry of entries) {
    const sectionUrl =
      `${BASE_URL}/portfolio/${entry.sectionSlug}`;

    if (
      !sectionUrls.has(
        sectionUrl
      )
    ) {
      portfolioPages.push({
        url: sectionUrl,
        changeFrequency:
          "monthly",
        priority: 0.9,
      });

      sectionUrls.add(
        sectionUrl
      );
    }

    if (
      !entry.groupSlug ||
      !entry.categorySlug
    ) {
      continue;
    }

    const categoryUrl =
      `${sectionUrl}/${entry.groupSlug}/${entry.categorySlug}`;

    if (
      !categoryUrls.has(
        categoryUrl
      )
    ) {
      portfolioPages.push({
        url: categoryUrl,
        changeFrequency:
          "monthly",
        priority: 0.8,
      });

      categoryUrls.add(
        categoryUrl
      );
    }

    if (
      !entry.artworkSlug
    ) {
      continue;
    }

    portfolioPages.push({
      url:
        `${categoryUrl}/${entry.artworkSlug}`,
      changeFrequency:
        "monthly",
      priority: 0.7,
    });
  }

  return [
    ...staticPages,
    ...portfolioPages,
  ];
}