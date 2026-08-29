import Navbar, {
  type NavbarPortfolioSection,
} from './Navbar';

import {
  getPortfolioNavigation,
} from '@/lib/repositories/portfolioRepository';

export default async function NavbarServer() {
  const portfolioSections:
    NavbarPortfolioSection[] =
      await getPortfolioNavigation();

  return (
    <Navbar
      portfolioSections={
        portfolioSections
      }
    />
  );
}