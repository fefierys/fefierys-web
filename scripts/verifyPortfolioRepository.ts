import { config } from "dotenv";
import {
  deepStrictEqual,
  ok,
} from "node:assert/strict";

import {
  portfolioSections as staticPortfolioSections,
} from "../data/portfolio";

config({
  path: ".env.local",
});

async function main() {
  /*
   * Dynamic import is intentional.
   *
   * dotenv must load DATABASE_URL before
   * lib/db is evaluated.
   */
  const {
    getPortfolioNavigation,
    getPortfolioSectionBySlug,
  } =
    await import(
      "../lib/repositories/portfolioRepository"
    );

  /*
   * ==========================================================
   * VERIFY ALL THREE PORTFOLIOS
   * ==========================================================
   */

  for (
    const staticSection of
    staticPortfolioSections
  ) {
    const repositoryData =
      await getPortfolioSectionBySlug(
        staticSection.slug
      );

    ok(
      repositoryData,
      `Repository did not return "${staticSection.slug}"`
    );

    deepStrictEqual(
      repositoryData,
      staticSection.data
    );

    console.log(
      `Repository verified: ${staticSection.slug} ✅`
    );
  }

  /*
   * ==========================================================
   * VERIFY NAVIGATION
   * ==========================================================
   */

  const navigation =
    await getPortfolioNavigation();

  const expectedNavigation =
    staticPortfolioSections.map(
      (section) => ({
        slug: section.slug,
        label: section.title,
      })
    );

  deepStrictEqual(
    navigation,
    expectedNavigation
  );

  console.log(
    "Portfolio navigation verified ✅"
  );

  console.log({
    sections:
      staticPortfolioSections.length,

    navigation,
  });

  console.log(
    "Portfolio repository verification successful ✅"
  );
}

main().catch((error) => {
  console.error(
    "Portfolio repository verification failed ❌"
  );

  console.error(error);

  process.exit(1);
});