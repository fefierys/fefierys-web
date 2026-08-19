import fs from 'fs';
import path from 'path';
import { imageSize } from 'image-size';

const ROOT = path.join(
  process.cwd(),
  'public',
  'images',
  'portfolio',
  'stylized'
);

const OUTPUT = path.join(
  process.cwd(),
  'data',
  'portfolio',
  'stylized.ts'
);

const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

// ------------------
// TITLES
// ------------------

const TITLE_MAP: Record<string, string> = {
  texturedlineart: 'Lineart - Textured Finish',
  texturedflat: 'Flat - Textured Finish',
  texturedshaded: 'Shaded - Textured Finish',
  texturedfullrender: 'Full Render - Textured Finish',

  smoothlineart: 'Lineart - Smooth Finish',
  smoothflat: 'Flat - Smooth Finish',
  smoothshaded: 'Shaded - Smooth Finish',
  smoothfullrender: 'Full Render - Smooth Finish',

  fullwrap: 'Full Wrap Cover',
  frontcover: 'Front Cover',
  fullpage: 'Full Page',
  spread: 'Spread',
  single: 'Single Character',
  couple: 'Couple Scene',
  essentials: 'Essentials',
  fullpack: 'Full Pack',
  standard: 'Standard',
  bustup: 'Bust Up',
  fullbody: 'Full Body',
  circular: 'Circular Frame',
  flat: 'Flat Background',
  natural: 'Natural Landscape',
  structures: 'Structure & Interiors',

  bust: 'Bust Up',
  halfbody: 'Half Body',
  duo: 'Duo/Couple',
};

// ------------------
// ALT
// ------------------

const ALT_MAP: Record<string, string> = {
  frontcover: 'front cover',
  backcover: 'back cover',
  fullwrap: 'full wrap',
  fullpage: 'full page',
  fullbody: 'full body',

  texturedlineart: 'lineart textured finish',
  texturedfullrender: 'full render textured finish',
  texturedflat: 'flat textured finish',
  texturedshaded: 'shaded textured finish',

  smoothfullrender: 'full render smooth finish',
  smoothlineart: 'lineart smooth finish',
  smoothflat: 'flat smooth finish',
  smoothshaded: 'shaded smooth finish',

  fullpack: 'full pack',
  halfbody: 'half body',
  single: 'single character',
  duo: 'couple',
  circular: 'circular frame',
  flat: 'flat background',
  bustup: 'bust up',
};

// ------------------
// WORD NORMALIZATION
// ------------------

const WORD_MAP: Record<string, string> = {
  dnd: 'D&D',
  vtm: 'VTM',
  rpg: 'RPG',
  mmorpg: 'MMORPG',
  oc: 'Original Character',
  poc: 'POC',

  porrtait: 'portrait',
  potrait: 'portrait',
  environmet: 'environment',
};

// ------------------
// SLUG NORMALIZATION
// ------------------

const SLUG_WORD_FIXES: Record<string, string> = {
  porrtait: 'portrait',
  potrait: 'portrait',
  environmet: 'environment',
  constelation: 'constellation',
};

const SLUG_COMPOUND_MAP: Record<string, string> = {
  frontcover: 'front-cover',
  backcover: 'back-cover',
  fullwrap: 'full-wrap',
  fullpage: 'full-page',
  fullbody: 'full-body',
  halfbody: 'half-body',
  bustup: 'bust-up',
  fullpack: 'full-pack',

  texturedlineart: 'textured-lineart',
  texturedflat: 'textured-flat',
  texturedshaded: 'textured-shaded',
  texturedfullrender: 'textured-full-render',

  smoothlineart: 'smooth-lineart',
  smoothflat: 'smooth-flat',
  smoothshaded: 'smooth-shaded',
  smoothfullrender: 'smooth-full-render',
};

const SLUG_REMOVE_BY_CATEGORY: Record<string, string[]> = {
  covers: [
    'fantasy-book-cover',
    'book-cover',
  ],

  interior: [],

  icons: [],

  'character-design': [],

  'character-illustrations': [],

  pets: [],
};

// ------------------
// CATEGORY CONFIG
// ------------------

const CATEGORY_CONFIG = [
  {
    groupId: 'book-art',
    groupSlug: 'book-art',
    groupTitle: 'BOOK ART',

    subcategories: [
      {
        folder: 'book-art/covers',
        id: 'sty-covers',
        slug: 'covers',
        title: 'COVERS',
      },

      {
        folder: 'book-art/interior',
        id: 'sty-interior-illustration',
        slug: 'interior-illustration',
        title: 'INTERIOR ILLUSTRATION',
      },
    ],
  },

  {
    groupId: 'general',
    groupSlug: 'general',
    groupTitle: 'GENERAL',

    subcategories: [
      {
        folder: 'general/icons',
        id: 'sty-icons',
        slug: 'icons',
        title: 'ICONS',
      },

      {
        folder: 'general/character-design',
        id: 'sty-character-design',
        slug: 'character-design',
        title: 'CHARACTER DESIGN',
      },

      {
        folder: 'general/character-illustrations',
        id: 'sty-character-illustrations',
        slug: 'character-illustrations',
        title: 'CHARACTER ILLUSTRATIONS',
      },

      {
        folder: 'general/pets',
        id: 'sty-pets',
        slug: 'pets',
        title: 'PETS',
      },
    ],
  },
];

// ------------------
// ORIENTATION
// ------------------

function detectOrientation(
  filePath: string
): 'portrait' | 'landscape' {
  const buffer = fs.readFileSync(filePath);
  const dimensions = imageSize(buffer);

  if (!dimensions.width || !dimensions.height) {
    return 'portrait';
  }

  const { width, height } = dimensions;

  const differenceRatio =
    Math.abs(width - height) /
    Math.max(width, height);

  if (differenceRatio <= 0.02) {
    return 'portrait';
  }

  return width > height
    ? 'landscape'
    : 'portrait';
}

// ------------------
// TITLE
// ------------------

function buildTitle(id: string): string {
  const lower = id.toLowerCase();

  const parts = lower.split('-');
  const last = parts[parts.length - 1];

  return TITLE_MAP[last] ?? 'Full Render';
}

// ------------------
// ALT
// ------------------

function buildAlt(id: string): string {
  const words = id
    .toLowerCase()
    .split('-')

    .map((word) => {
      if (ALT_MAP[word]) {
        return ALT_MAP[word];
      }

      return WORD_MAP[word] ?? word;
    })

    .map((word) => {
      if (/^[A-Z0-9&]+$/.test(word)) {
        return word;
      }

      return (
        word.charAt(0).toUpperCase() +
        word.slice(1)
      );
    });

  return `${words.join(' ')} illustration by Fefierys`;
}

// ------------------
// CATEGORY FOLDER
// ------------------

function getCategoryFolder(
  relativeFolder: string
): string {
  return path
    .basename(relativeFolder)
    .toLowerCase();
}

// ------------------
// ARTWORK SLUG
// ------------------

function buildArtworkSlug(
  id: string,
  relativeFolder: string
): string {
  let slug = id
    .toLowerCase()
    .replace(/[\s_]+/g, '-');

  /*
   * Separar palabras actualmente pegadas
   * dentro de los filenames.
   */
  for (
    const [from, to]
    of Object.entries(SLUG_COMPOUND_MAP)
  ) {
    slug = slug.replace(
      new RegExp(
        `(^|-)${from}(?=-|$)`,
        'g'
      ),
      `$1${to}`
    );
  }

  /*
   * Corregir errores conocidos.
   */
  slug = slug
    .split('-')
    .map(
      (word) =>
        SLUG_WORD_FIXES[word] ?? word
    )
    .join('-');

  /*
   * Eliminar información redundante
   * según la categoría.
   */
  const category =
    getCategoryFolder(relativeFolder);

  const removeTerms =
    SLUG_REMOVE_BY_CATEGORY[category] ?? [];

  for (const term of removeTerms) {
    slug = slug.replace(
      new RegExp(
        `(^|-)${term}(?=-|$)`,
        'g'
      ),
      '$1'
    );
  }

  return slug
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ------------------
// GENERATE ARTWORKS
// ------------------

function generateArtworks(
  relativeFolder: string
) {
  const absoluteFolder =
    path.join(ROOT, relativeFolder);

  if (!fs.existsSync(absoluteFolder)) {
    return [];
  }

  const files = fs
    .readdirSync(absoluteFolder)

    .filter((file) =>
      ALLOWED_EXTENSIONS.has(
        path.extname(file).toLowerCase()
      )
    )

    .sort((a, b) =>
      a.localeCompare(b)
    );

  const usedSlugs =
    new Map<string, number>();

  return files.map((file, index) => {
    const id = path.basename(
      file,
      path.extname(file)
    );

    const filePath = path.join(
      absoluteFolder,
      file
    );

    const orientation =
      detectOrientation(filePath);

    const baseSlug =
      buildArtworkSlug(
        id,
        relativeFolder
      );

    const slugCount =
      usedSlugs.get(baseSlug) ?? 0;

    const slug =
      slugCount === 0
        ? baseSlug
        : `${baseSlug}-${slugCount + 1}`;

    usedSlugs.set(
      baseSlug,
      slugCount + 1
    );

    return {
      id: index + 1,

      slug,

      src:
        `/images/portfolio/stylized/${relativeFolder}/${file}`,

      title:
        buildTitle(id),

      orientation,

      featured:
        orientation === 'landscape',

      alt:
        buildAlt(id),
    };
  });
}

// ------------------
// GROUPS
// ------------------

const groups = CATEGORY_CONFIG.map(
  (group) => ({
    id:
      group.groupId,

    slug:
      group.groupSlug,

    title:
      group.groupTitle,

    subcategories:
      group.subcategories.map(
        (subcategory) => ({
          id:
            subcategory.id,

          slug:
            subcategory.slug,

          title:
            subcategory.title,

          artworks:
            generateArtworks(
              subcategory.folder
            ),
        })
      ),
  })
);

// ------------------
// OUTPUT
// ------------------

const output = `import { PortfolioData } from './types';

export const stylized: PortfolioData = ${JSON.stringify(
  {
    slug: 'stylized',
    title: 'STYLIZED',
    groups,
  },
  null,
  2
)}
;
`;

fs.mkdirSync(
  path.dirname(OUTPUT),
  {
    recursive: true,
  }
);

fs.writeFileSync(
  OUTPUT,
  output
);

console.log('');
console.log(`Generated ${OUTPUT}`);
console.log('');