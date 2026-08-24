import type {
  Artwork,
} from '@/data/portfolio/types';

/*
 * ============================================================
 * PORTFOLIO PAGINATION
 * ============================================================
 *
 * Todas las miniaturas del nuevo grid tienen el mismo peso
 * visual y el mismo aspect ratio.
 *
 * Por eso ya no necesitamos diferenciar:
 *
 * - portrait
 * - landscape
 * - featured
 *
 * para construir las páginas.
 *
 * Conservamos este archivo porque ArtworkGrid sigue necesitando
 * una función responsable de dividir los artworks en páginas.
 */

const ARTWORKS_PER_PAGE = 6;

export function buildPortfolioPages(
  artworks: Artwork[]
): Artwork[][] {
  const pages: Artwork[][] = [];

  for (
    let index = 0;
    index < artworks.length;
    index += ARTWORKS_PER_PAGE
  ) {
    pages.push(
      artworks.slice(
        index,
        index + ARTWORKS_PER_PAGE
      )
    );
  }

  return pages;
}