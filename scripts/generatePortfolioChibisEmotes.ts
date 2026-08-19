import fs from 'fs';
import path from 'path';
import { imageSize } from 'image-size';

const ROOT = path.join(
  process.cwd(),
  'public',
  'images',
  'portfolio',
  'chibis-emotes'
);

const OUTPUT = path.join(
  process.cwd(),
  'data',
  'portfolio',
  'chibis.ts'
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
  fullbody: 'Full Body',
  halfbody: 'Half Body',
  emotes: 'Emotes',
};

// ------------------
// ALT
// ------------------

const ALT_MAP: Record<string, string> = {
  fullbody: 'full body',
  halfbody: 'half body',
  emotes: 'emotes',
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
  fullbody: 'full-body',
  halfbody: 'half-body',
  bustup: 'bust-up',
  fullpack: 'full-pack',
};

/*
 * En Chibis/Emotes yo sería conservador:
 * no quitaría términos del filename salvo que luego
 * veamos que alguno es claramente redundante.
 */
const SLUG_REMOVE_BY_CATEGORY: Record<string, string[]> = {
  chibis: [],
  emotes: [],
};

// ------------------
// CATEGORY CONFIG
// ------------------

const CATEGORY_CONFIG = [
  {
    groupId: 'chibis',
    groupSlug: 'chibis',
    groupTitle: 'CHIBIS',

    subcategories: [
      {
        folder: 'chibis',
        id: 'characters',
        slug: 'characters',
        title: 'CHARACTERS',
      },
    ],
  },

  {
    groupId: 'emotes',
    groupSlug: 'emotes',
    groupTitle: 'EMOTES',

    subcategories: [
      {
        folder: 'emotes',
        id: 'custom',
        slug: 'custom',
        title: 'CUSTOM',
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

  /*
   * Si la diferencia es menor o igual al 2%,
   * lo tratamos como portrait/cuadrado.
   */
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
      /*
       * Mantener siglas como:
       * D&D, RPG, VTM, etc.
       */
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
   * Separar palabras pegadas.
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
   * Corregir errores ortográficos conocidos.
   */
  slug = slug
    .split('-')
    .map(
      (word) =>
        SLUG_WORD_FIXES[word] ?? word
    )
    .join('-');

  /*
   * Eliminar términos redundantes según categoría,
   * si en el futuro decidimos agregar alguno.
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

  /*
   * Detectamos duplicados dentro de cada subcategoría.
   */
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
        `/images/portfolio/chibis-emotes/${relativeFolder}/${file}`,

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

export const chibis: PortfolioData = ${JSON.stringify(
  {
    slug: 'chibis-emotes',
    title: 'CHIBIS - EMOTES',
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