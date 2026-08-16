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

//------------------

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
  flat: 'Flat background',
  bustup: 'bust up',
};


//------------------

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

const CATEGORY_CONFIG = [
  {
    groupId: 'book-art',
    groupTitle: 'BOOK ART',
    subcategories: [
      {
        folder: 'book-art/covers',
        id: 'sty-covers',
        title: 'COVERS',
      },
      {
        folder: 'book-art/interior',
        id: 'sty-interior-illustration',
        title: 'INTERIOR ILLUSTRATION',
      },
    ],
  },
  {
    groupId: 'general',
    groupTitle: 'GENERAL',
    subcategories: [
      {
        folder: 'general/icons',
        id: 'sty-icons',
        title: 'ICONS',
      },
      {
        folder: 'general/character-design',
        id: 'sty-character-design',
        title: 'CHARACTER DESIGN',
      },
      {
        folder: 'general/character-illustrations',
        id: 'sty-character-illustrations',
        title: 'CHARACTER ILLUSTRATIONS',
      },
      {
        folder: 'general/pets',
        id: 'semi-pets',
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

  // Si la diferencia es menor o igual al 2%, lo tratamos como cuadrado
  const differenceRatio =
    Math.abs(width - height) / Math.max(width, height);

  if (differenceRatio <= 0.02) {
    return 'portrait';
  }

  return width > height ? 'landscape' : 'portrait';
}

function buildTitle(id: string): string {
  const lower = id.toLowerCase();

  const parts = lower.split('-');
  const last = parts[parts.length - 1];

  return TITLE_MAP[last] ?? 'Full Render';
}

function buildAlt(id: string): string {
  const words = id
    .toLowerCase()
    .split('-')
    .map((word) => {
      // Primero revisamos los casos especiales del ALT.
      if (ALT_MAP[word]) {
        return ALT_MAP[word];
      }

      // Luego aplicamos las palabras especiales generales.
      return WORD_MAP[word] ?? word;
    })
    .map((word) => {
      // Mantener siglas como D&D, RPG, VTM, etc.
      if (/^[A-Z0-9&]+$/.test(word)) {
        return word;
      }

      // Capitalizar la primera letra.
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

  return `${words.join(' ')} illustration by Fefierys`;
}

function generateArtworks(relativeFolder: string) {
  const absoluteFolder = path.join(ROOT, relativeFolder);

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
    .sort((a, b) => a.localeCompare(b));

  return files.map((file, index) => {
    const id = path.basename(
      file,
      path.extname(file)
    );

    const filePath = path.join(
      absoluteFolder,
      file
    );

    const orientation = detectOrientation(filePath);

    return {
      id: index + 1,

      src: `/images/portfolio/stylized/${relativeFolder}/${file}`,

      title: buildTitle(id),

      orientation,

      featured: orientation === 'landscape',

      alt: buildAlt(id),
    };
  });
}

const groups = CATEGORY_CONFIG.map((group) => ({
  id: group.groupId,

  title: group.groupTitle,

  subcategories: group.subcategories.map(
    (subcategory) => ({
      id: subcategory.id,

      title: subcategory.title,

      artworks: generateArtworks(
        subcategory.folder
      ),
    })
  ),
}));

const output = `import { PortfolioData } from './types';

export const stylized: PortfolioData = ${JSON.stringify(
  {
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
  { recursive: true }
);

fs.writeFileSync(
  OUTPUT,
  output
);

console.log(`Generated ${OUTPUT}`);