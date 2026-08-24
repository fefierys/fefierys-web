import Navbar, {
  type NavbarPortfolioSection,
} from './Navbar';

import {
  portfolioSections as staticPortfolioSections,
} from '@/data/portfolio';

import {
  getPortfolioNavigation,
} from '@/lib/repositories/portfolioRepository';

export default async function NavbarServer() {
  let portfolioSections:
    NavbarPortfolioSection[];

  try {
    /*
     * ============================================================
     * DATABASE NAVIGATION
     * ============================================================
     */

    portfolioSections =
      await getPortfolioNavigation();
  } catch (error) {
    console.error(
      'Failed to load portfolio navigation from database:',
      error
    );

    /*
     * ============================================================
     * TEMPORARY STATIC FALLBACK
     * ============================================================
     *
     * During the migration, if Neon is temporarily unavailable,
     * the global Navbar can still render from the current
     * static portfolio index.
     */

    portfolioSections =
      staticPortfolioSections.map(
        (section) => ({
          slug:
            section.slug,

          label:
            section.title,
        })
      );
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   *
   * JSX stays outside try/catch.
   */

  return (
    <Navbar
      portfolioSections={
        portfolioSections
      }
    />
  );
}