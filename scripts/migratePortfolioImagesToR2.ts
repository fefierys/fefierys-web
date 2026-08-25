import {
  config,
  parse,
} from "dotenv";

import {
  readFileSync,
} from "node:fs";

import {
  access,
  readFile,
} from "node:fs/promises";

import path from "node:path";

import {
  asc,
  eq,
  isNotNull,
} from "drizzle-orm";

import {
  artworks,
} from "../lib/db/schema/portfolio";

/*
 * ============================================================
 * MODE
 * ============================================================
 *
 * DEV dry run:
 *
 * npx tsx scripts/migratePortfolioImagesToR2.ts
 *
 * or:
 *
 * npx tsx scripts/migratePortfolioImagesToR2.ts --dev
 *
 * DEV apply:
 *
 * npx tsx scripts/migratePortfolioImagesToR2.ts --apply-dev
 *
 * QA dry run:
 *
 * npx tsx scripts/migratePortfolioImagesToR2.ts --qa
 *
 * QA apply:
 *
 * npx tsx scripts/migratePortfolioImagesToR2.ts --apply-qa
 */

type MigrationTarget =
  | "dev"
  | "qa";

const hasDevFlag =
  process.argv.includes(
    "--dev"
  );

const hasQaFlag =
  process.argv.includes(
    "--qa"
  );

const hasApplyDevFlag =
  process.argv.includes(
    "--apply-dev"
  );

const hasApplyQaFlag =
  process.argv.includes(
    "--apply-qa"
  );

const modeFlags = [
  hasDevFlag,
  hasQaFlag,
  hasApplyDevFlag,
  hasApplyQaFlag,
].filter(Boolean);

if (modeFlags.length > 1) {
  throw new Error(
    [
      "Migration aborted.",
      "Use only one environment/mode flag:",
      "--dev, --qa, --apply-dev or --apply-qa.",
    ].join(" ")
  );
}

const TARGET: MigrationTarget =
  hasQaFlag ||
  hasApplyQaFlag
    ? "qa"
    : "dev";

const APPLY =
  TARGET === "qa"
    ? hasApplyQaFlag
    : hasApplyDevFlag;

const TARGET_LABEL =
  TARGET.toUpperCase();

const ENV_FILE =
  TARGET === "qa"
    ? ".env.qa.local"
    : ".env.local";

/*
 * ============================================================
 * ENVIRONMENT CONFIGURATION
 * ============================================================
 */

const EXPECTED = {
  dev: {
    bucket:
      "fefierys-assets-dev",

    mediaUrl:
      "https://media-dev.fefierys.com",

    appEnv:
      "dev",
  },

  qa: {
    bucket:
      "fefierys-assets-qa",

    mediaUrl:
      "https://media-qa.fefierys.com",

    appEnv:
      "qa",
  },
} as const;

/*
 * ============================================================
 * DEV DATABASE BASELINE
 * ============================================================
 *
 * When running QA we read the DEV DATABASE_URL only as a
 * safety baseline.
 *
 * It is never printed and is never used for queries.
 *
 * This lets us refuse a QA migration if .env.qa.local
 * accidentally points to the same Neon project as DEV.
 */

let devDatabaseUrlBaseline:
  | string
  | null = null;

if (TARGET === "qa") {
  const devEnvPath =
    path.join(
      process.cwd(),
      ".env.local"
    );

  let devEnvContents:
    string;

  try {
    devEnvContents =
      readFileSync(
        devEnvPath,
        "utf8"
      );
  } catch {
    throw new Error(
      [
        "Migration aborted.",
        "QA safety verification requires",
        '".env.local" to exist so the',
        "QA database can be compared",
        "against the DEV database.",
      ].join(" ")
    );
  }

  const devEnv =
    parse(
      devEnvContents
    );

  devDatabaseUrlBaseline =
    devEnv.DATABASE_URL ??
    null;

  if (
    !devDatabaseUrlBaseline
  ) {
    throw new Error(
      [
        "Migration aborted.",
        '".env.local" does not contain',
        "DATABASE_URL, so the QA",
        "database cannot be verified",
        "against DEV.",
      ].join(" ")
    );
  }
}

/*
 * ============================================================
 * LOAD TARGET ENVIRONMENT
 * ============================================================
 *
 * override=true is intentional:
 *
 * when running QA we want values from .env.qa.local to win
 * over any variables that may already exist in the shell.
 */

const envResult =
  config({
    path:
      path.join(
        process.cwd(),
        ENV_FILE
      ),

    override:
      true,
  });

if (envResult.error) {
  throw new Error(
    `Migration aborted: could not load "${ENV_FILE}".`
  );
}

/*
 * ============================================================
 * DATABASE HOST HELPERS
 * ============================================================
 */

function getDatabaseHost(
  databaseUrl: string,
  label: string
) {
  try {
    return new URL(
      databaseUrl
    ).hostname;
  } catch {
    throw new Error(
      `Migration aborted: ${label} is not a valid database URL.`
    );
  }
}

/*
 * Neon pooled endpoints can contain "-pooler".
 *
 * We remove it before comparison so a pooled and an
 * unpooled URL for the SAME Neon project are still
 * considered the same database.
 */

function normalizeNeonHost(
  hostname: string
) {
  return hostname.replace(
    /-pooler(?=\.)/,
    ""
  );
}

/*
 * ============================================================
 * CONTENT TYPES
 * ============================================================
 */

function getImageInfo(
  imageSrc: string
) {
  const extension =
    path
      .extname(
        imageSrc
      )
      .toLowerCase();

  switch (extension) {
    case ".webp":
      return {
        extension:
          ".webp",

        contentType:
          "image/webp",
      };

    case ".png":
      return {
        extension:
          ".png",

        contentType:
          "image/png",
      };

    case ".jpg":
    case ".jpeg":
      return {
        extension:
          ".jpg",

        contentType:
          "image/jpeg",
      };

    case ".avif":
      return {
        extension:
          ".avif",

        contentType:
          "image/avif",
      };

    default:
      throw new Error(
        `Unsupported image extension "${extension}" for "${imageSrc}"`
      );
  }
}

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main() {
  /*
   * Dynamic imports are intentional.
   *
   * dotenv must load the TARGET environment variables
   * before DB/R2 modules evaluate them.
   */

  const {
    db,
  } =
    await import(
      "../lib/db"
    );

  const {
    r2BucketName,
  } =
    await import(
      "../lib/storage/r2Client"
    );

  const {
    buildPortfolioStorageKey,
    uploadPortfolioObject,
    portfolioObjectExists,
  } =
    await import(
      "../lib/storage/portfolioStorage"
    );

  /*
   * ==========================================================
   * SAFETY GUARDS
   * ==========================================================
   */

  if (process.env.VERCEL) {
    throw new Error(
      "Migration aborted: this script must only run locally."
    );
  }

  const expected =
    EXPECTED[TARGET];

  /*
   * R2 bucket guard.
   */

  if (
    r2BucketName !==
    expected.bucket
  ) {
    throw new Error(
      `Migration aborted. Expected R2 bucket "${expected.bucket}" but received "${r2BucketName}".`
    );
  }

  /*
   * Media domain guard.
   */

  const mediaUrl =
    process.env
      .NEXT_PUBLIC_MEDIA_URL
      ?.replace(
        /\/+$/,
        ""
      );

  if (
    mediaUrl !==
    expected.mediaUrl
  ) {
    throw new Error(
      `Migration aborted. Expected NEXT_PUBLIC_MEDIA_URL="${expected.mediaUrl}" but received "${mediaUrl}".`
    );
  }

  /*
   * Application environment guard.
   *
   * QA requires an explicit QA marker.
   *
   * DEV permits NEXT_PUBLIC_APP_ENV to be absent for
   * backwards compatibility with the existing local setup,
   * but refuses any non-DEV value.
   */

  const appEnv =
    process.env
      .NEXT_PUBLIC_APP_ENV
      ?.trim()
      .toLowerCase();

  if (
    TARGET === "qa" &&
    appEnv !== "qa"
  ) {
    throw new Error(
      `Migration aborted. QA requires NEXT_PUBLIC_APP_ENV="qa" but received "${appEnv}".`
    );
  }

  if (
    TARGET === "dev" &&
    appEnv &&
    appEnv !== "dev"
  ) {
    throw new Error(
      `Migration aborted. DEV expected NEXT_PUBLIC_APP_ENV="dev" but received "${appEnv}".`
    );
  }

  /*
   * Database guard.
   */

  const databaseUrl =
    process.env
      .DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  const targetDatabaseHost =
    normalizeNeonHost(
      getDatabaseHost(
        databaseUrl,
        `${TARGET_LABEL} DATABASE_URL`
      )
    );

  /*
   * For QA, prove that its Neon host is NOT the same
   * project configured in local DEV.
   */

  if (
    TARGET === "qa"
  ) {
    if (
      !devDatabaseUrlBaseline
    ) {
      throw new Error(
        "Migration aborted: DEV database baseline is unavailable."
      );
    }

    const devDatabaseHost =
      normalizeNeonHost(
        getDatabaseHost(
          devDatabaseUrlBaseline,
          "DEV DATABASE_URL"
        )
      );

    if (
      targetDatabaseHost ===
      devDatabaseHost
    ) {
      throw new Error(
        [
          "Migration aborted.",
          "The QA DATABASE_URL points to",
          "the same Neon project as DEV.",
          "Check .env.qa.local before continuing.",
        ].join(" ")
      );
    }
  }

  /*
   * We intentionally print only the hostname,
   * never the full connection string.
   */

  console.log("");
  console.log(
    "Portfolio R2 migration"
  );

  console.log({
    target:
      TARGET_LABEL,

    mode:
      APPLY
        ? `APPLY ${TARGET_LABEL}`
        : `DRY RUN ${TARGET_LABEL}`,

    envFile:
      ENV_FILE,

    bucket:
      r2BucketName,

    mediaUrl,

    databaseHost:
      targetDatabaseHost,
  });

  /*
   * ==========================================================
   * LOAD LEGACY ARTWORKS
   * ==========================================================
   *
   * Only records imported from the current
   * static portfolio are included.
   *
   * Future CMS-created artworks will not be
   * touched by this migration.
   */

  const rows =
    await db
      .select({
        id:
          artworks.id,

        legacyId:
          artworks.legacyId,

        slug:
          artworks.slug,

        imageSrc:
          artworks.imageSrc,

        storageKey:
          artworks.storageKey,
      })
      .from(
        artworks
      )
      .where(
        isNotNull(
          artworks.legacyId
        )
      )
      .orderBy(
        asc(
          artworks.legacyId
        )
      );

  if (
    rows.length === 0
  ) {
    throw new Error(
      "No legacy artworks were found."
    );
  }

  console.log(
    `Legacy artworks found: ${rows.length}`
  );

  /*
   * ==========================================================
   * PREFLIGHT
   * ==========================================================
   *
   * Verify EVERY local source before uploading anything.
   */

  const plan = [];

  for (
    const artwork
    of rows
  ) {
    if (
      !artwork.imageSrc.startsWith(
        "/images/portfolio/"
      )
    ) {
      throw new Error(
        `Unexpected imageSrc for "${artwork.slug}": "${artwork.imageSrc}"`
      );
    }

    const {
      extension,
      contentType,
    } =
      getImageInfo(
        artwork.imageSrc
      );

    const relativePath =
      artwork.imageSrc.replace(
        /^\/+/,
        ""
      );

    const localPath =
      path.join(
        process.cwd(),
        "public",
        relativePath
      );

    try {
      await access(
        localPath
      );
    } catch {
      throw new Error(
        `Local source file not found for "${artwork.slug}": ${localPath}`
      );
    }

    const expectedPrefix =
      `portfolio/artworks/${artwork.id}/`;

    if (
      artwork.storageKey &&
      !artwork.storageKey.startsWith(
        expectedPrefix
      )
    ) {
      throw new Error(
        `Unexpected existing storageKey for "${artwork.slug}": "${artwork.storageKey}"`
      );
    }

    /*
     * Existing storageKey always wins.
     *
     * This preserves completed objects and makes
     * interrupted migrations safe.
     */

    const storageKey =
      artwork.storageKey ??
      buildPortfolioStorageKey(
        artwork.id,
        `master${extension}`
      );

    plan.push({
      ...artwork,
      localPath,
      contentType,
      storageKey,
    });
  }

  console.log(
    "Local source preflight successful ✅"
  );

  /*
   * ==========================================================
   * R2 PREFLIGHT
   * ==========================================================
   */

  let objectsAlreadyPresent =
    0;

  let objectsMissing =
    0;

  for (
    const item
    of plan
  ) {
    const exists =
      await portfolioObjectExists(
        item.storageKey
      );

    if (exists) {
      objectsAlreadyPresent++;
    } else {
      objectsMissing++;
    }
  }

  console.log({
    total:
      plan.length,

    objectsAlreadyPresent,

    objectsMissing,

    databaseStorageKeys:
      plan.filter(
        (item) =>
          Boolean(
            item.storageKey &&
            rows.find(
              (row) =>
                row.id ===
                item.id
            )?.storageKey
          )
      ).length,
  });

  /*
   * ==========================================================
   * DRY RUN ENDS HERE
   * ==========================================================
   */

  if (!APPLY) {
    console.log("");
    console.log(
      `${TARGET_LABEL} dry run successful ✅`
    );

    console.log(
      "No files were uploaded and Neon was not modified."
    );

    console.log("");

    console.log(
      TARGET === "qa"
        ? "Run with --apply-qa to perform the QA migration."
        : "Run with --apply-dev to perform the DEV migration."
    );

    return;
  }

  /*
   * ==========================================================
   * APPLY
   * ==========================================================
   */

  console.log("");
  console.log(
    `Starting ${TARGET_LABEL} migration...`
  );

  let uploaded =
    0;

  let reused =
    0;

  let databaseUpdated =
    0;

  for (
    let index = 0;
    index < plan.length;
    index++
  ) {
    const item =
      plan[index];

    console.log(
      `[${index + 1}/${plan.length}] ${item.slug}`
    );

    let objectExists =
      await portfolioObjectExists(
        item.storageKey
      );

    /*
     * Object missing:
     *
     * upload local source.
     */

    if (!objectExists) {
      const body =
        await readFile(
          item.localPath
        );

      await uploadPortfolioObject({
        key:
          item.storageKey,

        body,

        contentType:
          item.contentType,
      });

      /*
       * Do not update Neon until R2 confirms
       * that the object can actually be read.
       */

      objectExists =
        await portfolioObjectExists(
          item.storageKey
        );

      if (!objectExists) {
        throw new Error(
          `Upload verification failed for "${item.slug}".`
        );
      }

      uploaded++;

      console.log(
        `  uploaded → ${item.storageKey}`
      );
    } else {
      reused++;

      console.log(
        "  R2 object already exists"
      );
    }

    /*
     * Only update Neon when necessary.
     *
     * If the process previously stopped
     * after uploading to R2 but before the
     * DB update, rerunning repairs that state.
     */

    const originalRow =
      rows.find(
        (row) =>
          row.id ===
          item.id
      );

    const currentStorageKey =
      originalRow
        ?.storageKey ??
      null;

    if (
      currentStorageKey !==
      item.storageKey
    ) {
      await db
        .update(
          artworks
        )
        .set({
          storageKey:
            item.storageKey,

          updatedAt:
            new Date(),
        })
        .where(
          eq(
            artworks.id,
            item.id
          )
        );

      databaseUpdated++;

      console.log(
        "  Neon storageKey updated"
      );
    }
  }

  /*
   * ==========================================================
   * FINAL DATABASE VERIFICATION
   * ==========================================================
   */

  const finalRows =
    await db
      .select({
        id:
          artworks.id,

        slug:
          artworks.slug,

        storageKey:
          artworks.storageKey,
      })
      .from(
        artworks
      )
      .where(
        isNotNull(
          artworks.legacyId
        )
      );

  const missingStorageKeys =
    finalRows.filter(
      (artwork) =>
        !artwork.storageKey
    );

  if (
    missingStorageKeys.length >
    0
  ) {
    throw new Error(
      `Migration finished with ${missingStorageKeys.length} artworks missing storageKey.`
    );
  }

  console.log("");
  console.log(
    `${TARGET_LABEL} portfolio R2 migration successful ✅`
  );

  console.log({
    target:
      TARGET_LABEL,

    total:
      plan.length,

    uploaded,

    reused,

    databaseUpdated,

    storageKeysVerified:
      finalRows.length,
  });
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Portfolio R2 migration failed ❌"
    );

    console.error(
      error
    );

    process.exit(1);
  }
);