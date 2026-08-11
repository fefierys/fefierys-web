import { Artwork } from '@/data/portfolio/types';

const PAGE_UNITS = 6;

function isLandscape(artwork: Artwork) {
  return artwork.orientation === 'landscape';
}

function takeNextLandscape(pool: Artwork[]) {
  const index = pool.findIndex(isLandscape);
  if (index === -1) return null;
  return pool.splice(index, 1)[0];
}

function takeNextPortraits(pool: Artwork[], count: number) {
  const portraits: Artwork[] = [];

  for (let i = 0; i < pool.length && portraits.length < count; ) {
    if (!isLandscape(pool[i])) {
      portraits.push(pool.splice(i, 1)[0]);
    } else {
      i++;
    }
  }

  return portraits.length === count ? portraits : null;
}

export function buildPortfolioPages(artworks: Artwork[]): Artwork[][] {
  const remaining = [...artworks];
  const pages: Artwork[][] = [];

  while (remaining.length > 0) {
    const landscapes = remaining.filter(isLandscape).length;
    const portraits = remaining.length - landscapes;

    // 1. Horizontal + 3 verticales
    if (landscapes >= 1 && portraits >= 3) {
      const landscape = takeNextLandscape(remaining)!;
      const portraitGroup = takeNextPortraits(remaining, 3)!;
      pages.push([landscape, ...portraitGroup]);
      continue;
    }

    // 2. Dos horizontales
    if (landscapes >= 2) {
      const first = takeNextLandscape(remaining)!;
      const second = takeNextLandscape(remaining)!;
      pages.push([first, second]);
      continue;
    }

    // 3. Seis verticales
    if (portraits >= 6) {
      const portraitGroup = takeNextPortraits(remaining, 6)!;
      pages.push(portraitGroup);
      continue;
    }

    // 4. Composiciones pequeñas (editoriales)
    if (landscapes === 1 && portraits === 2 && remaining.length === 3) {
      const landscape = takeNextLandscape(remaining)!;
      const portraitGroup = takeNextPortraits(remaining, 2)!;
      pages.push([landscape, ...portraitGroup]);
      continue;
    }

    if (landscapes === 1 && portraits === 1 && remaining.length === 2) {
      const landscape = takeNextLandscape(remaining)!;
      const portraitGroup = takeNextPortraits(remaining, 1)!;
      pages.push([landscape, ...portraitGroup]);
      continue;
    }

    // 5. Fallback por unidades
    const page: Artwork[] = [];
    let units = 0;

    while (remaining.length > 0) {
      const artwork = remaining[0];
      const artworkUnits = isLandscape(artwork) ? 3 : 1;

      if (units + artworkUnits > PAGE_UNITS && page.length > 0) break;

      page.push(remaining.shift()!);
      units += artworkUnits;
    }

    pages.push(page);
  }

  return pages;
}