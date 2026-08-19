import fs from 'fs';
import path from 'path';
import { imageSize } from 'image-size';

const ROOT = path.join(
  process.cwd(),
  'public',
  'images',
  'portfolio',
  'semi-realism'
);

const OUTPUT = path.join(
  process.cwd(),
  'data',
  'portfolio',
  'semiRealism.ts'
);

const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

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
  custom: 'Custom',
};


/*
 * Palabras que necesitan una separación especial en los ALT.
 */
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
  single: 'single character',
  custom: 'custom',
};


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


/*
 * Correcciones para los slugs públicos.
 *
 * A diferencia del nombre físico del archivo, aquí sí nos
 * interesa que la URL tenga ortografía correcta.
 */
const SLUG_WORD_FIXES: Record<string, string> = {
  porrtait: 'portrait',
  potrait: 'portrait',
  environmet: 'environment',
  constelation: 'constellation',
};


/*
 * Términos que actualmente aparecen unidos en los filenames
 * y queremos mostrar separados en las URLs.
 */
const SLUG_COMPOUND_MAP: Record<string, string> = {
  frontcover: 'front-cover',
  backcover: 'back-cover',
  fullwrap: 'full-wrap',
  fullpage: 'full-page',
  fullbody: 'full-body',
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


/*
 * Solo quitamos información verdaderamente redundante.
 *
 * Por ejemplo:
 *
 * /book-art/covers/...
 *
 * ya nos dice que estamos viendo book covers, así que
 * "fantasy-book-cover" no necesita repetirse en cada URL.
 *
 * En el resto somos conservadores para no perder información
 * ni provocar slugs duplicados.
 */
const SLUG_REMOVE_BY_CATEGORY: Record<string, string[]> = {
  covers: [
    'fantasy-book-cover',
    'book-cover',
  ],

  interior: [],

  icons: [],

  'character-design': [],

  'character-illustrations': [],

  'ref-sheets': [],

  environments: [],

  pets: [],
};


const CATEGORY_CONFIG = [
  {
    groupId: 'book-art',
    groupSlug: 'book-art',
    groupTitle: 'BOOK ART',

    subcategories: [
      {
        folder: 'book-art/covers',
        id: 'semi-covers',
        slug: 'covers',
        title: 'COVERS',
      },

      {
        folder: 'book-art/interior',
        id: 'semi-interior-illustration',
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
        id: 'semi-icons',
        slug: 'icons',
        title: 'ICONS',
      },

      {
        folder: 'general/character-design',
        id: 'semi-character-design',
        slug: 'character-design',
        title: 'CHARACTER DESIGN',
      },

      {
        folder: 'general/character-illustrations',
        id: 'semi-character-illustrations',
        slug: 'character-illustrations',
        title: 'CHARACTER ILLUSTRATIONS',
      },

      {
        folder: 'general/ref-sheets',
        id: 'semi-ref-sheets',
        slug: 'ref-sheets',
        title: 'REF SHEETS',
      },

      {
        folder: 'general/environments',
        id: 'semi-environments',
        slug: 'environments',
        title: 'ENVIRONMENTS',
      },

      {
        folder: 'general/pets',
        id: 'semi-pets',
        slug: 'pets',
        title: 'PETS',
      },
    ],
  },
];


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


function buildTitle(id: string): string {

  const lower = id.toLowerCase();


  if (lower.includes('diorama-texturedlineart')) {
    return 'Lineart - Textured Finish with Diorama';
  }

  if (lower.includes('diorama-texturedflat')) {
    return 'Flat - Textured Finish with Diorama';
  }

  if (lower.includes('diorama-texturedshaded')) {
    return 'Shaded - Textured Finish with Diorama';
  }

  if (lower.includes('diorama-texturedfullrender')) {
    return 'Full Render - Textured Finish with Diorama';
  }

  if (lower.includes('diorama-smoothlineart')) {
    return 'Lineart - Smooth Finish with Diorama';
  }

  if (lower.includes('diorama-smoothflat')) {
    return 'Flat - Smooth Finish with Diorama';
  }

  if (lower.includes('diorama-smoothshaded')) {
    return 'Shaded - Smooth Finish with Diorama';
  }

  if (lower.includes('diorama-smoothfullrender')) {
    return 'Full Render - Smooth Finish with Diorama';
  }


  const parts = lower.split('-');

  const last = parts[parts.length - 1];


  return TITLE_MAP[last] ?? 'Full Render';
}


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
       * Mantener siglas:
       *
       * D&D
       * RPG
       * VTM
       * etc.
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


/*
 * Devuelve el último directorio.
 *
 * Ej:
 *
 * book-art/covers
 *             ↓
 * covers
 *
 * general/ref-sheets
 *         ↓
 * ref-sheets
 */
function getCategoryFolder(
  relativeFolder: string
): string {

  return path
    .basename(relativeFolder)
    .toLowerCase();
}


/*
 * Genera el slug público de un artwork.
 *
 * Ejemplo:
 *
 * elf-glowing-night-fantasy-book-cover-frontcover
 *
 * ↓
 *
 * elf-glowing-night-front-cover
 */
function buildArtworkSlug(
  id: string,
  relativeFolder: string
): string {

  let slug = id
    .toLowerCase()

    /*
     * Espacios o underscores -> guiones.
     */
    .replace(/[\s_]+/g, '-');


  /*
   * Normalizar palabras pegadas.
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
  const slugWords = slug
    .split('-')
    .map(
      (word) =>
        SLUG_WORD_FIXES[word] ?? word
    );

  slug = slugWords.join('-');


  /*
   * Eliminar términos redundantes dependiendo
   * de la categoría.
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


  /*
   * Limpieza final.
   */
  return slug
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}


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
   * Permitimos detectar duplicados dentro de
   * cada subcategoría.
   */
  const usedSlugs = new Map<string, number>();


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


    /*
     * Generamos slug inicial.
     */
    let slug =
      buildArtworkSlug(
        id,
        relativeFolder
      );


    /*
     * Protección por si dos filenames terminan
     * generando el mismo slug.
     *
     * Ej:
     *
     * elf-ref-sheet
     * elf-ref-sheet
     *
     * ↓
     *
     * elf-ref-sheet
     * elf-ref-sheet-2
     */
    const slugCount =
      usedSlugs.get(slug) ?? 0;


    if (slugCount > 0) {
      slug = `${slug}-${slugCount + 1}`;
    }


    usedSlugs.set(
      buildArtworkSlug(
        id,
        relativeFolder
      ),
      slugCount + 1
    );


    return {

      id: index + 1,

      slug,

      src:
        `/images/portfolio/semi-realism/${relativeFolder}/${file}`,

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


/*
 * Construcción de grupos.
 *
 * IMPORTANTE:
 * aquí también escribimos los slugs de grupos
 * y subcategorías.
 */
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


const output = `import { PortfolioData } from './types';

export const semiRealism: PortfolioData = ${JSON.stringify(
  {
    slug: 'semi-realism',
    title: 'SEMIREALISM',
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
console.log(
  `Generated ${OUTPUT}`
);
console.log('');