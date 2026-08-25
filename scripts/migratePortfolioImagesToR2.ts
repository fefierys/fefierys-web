import { config } from "dotenv";

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

config({
  path: ".env.local",
});

/*
 * ============================================================
 * MODE
 * ============================================================
 *
 * Default:
 *
 * npx tsx scripts/migratePortfolioImagesToR2.ts
 *
 * performs a dry run.
 *
 * Actual DEV migration:
 *
 * npx tsx scripts/migratePortfolioImagesToR2.ts --apply-dev
 */

const APPLY =
  process.argv.includes(
    "--apply-dev"
  );

/*
 * ============================================================
 * EXPECTED DEV ENVIRONMENT
 * ============================================================
 */

const EXPECTED_BUCKET =
  "fefierys-assets-dev";

const EXPECTED_MEDIA_URL =
  "https://media-dev.fefierys.com";

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
      .extname(imageSrc)
      .toLowerCase();

  switch (extension) {
    case ".webp":
      return {
        extension: ".webp",
        contentType:
          "image/webp",
      };

    case ".png":
      return {
        extension: ".png",
        contentType:
          "image/png",
      };

    case ".jpg":
    case ".jpeg":
      return {
        extension: ".jpg",
        contentType:
          "image/jpeg",
      };

    case ".avif":
      return {
        extension: ".avif",
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
   * dotenv must load environment variables
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

  if (
    r2BucketName !==
    EXPECTED_BUCKET
  ) {
    throw new Error(
      `Migration aborted. Expected R2 bucket "${EXPECTED_BUCKET}" but received "${r2BucketName}".`
    );
  }

  const mediaUrl =
    process.env
      .NEXT_PUBLIC_MEDIA_URL
      ?.replace(
        /\/+$/,
        ""
      );

  if (
    mediaUrl !==
    EXPECTED_MEDIA_URL
  ) {
    throw new Error(
      `Migration aborted. Expected NEXT_PUBLIC_MEDIA_URL="${EXPECTED_MEDIA_URL}" but received "${mediaUrl}".`
    );
  }

  if (
    !process.env.DATABASE_URL
  ) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  console.log("");
  console.log(
    "Portfolio R2 migration"
  );

  console.log({
    mode:
      APPLY
        ? "APPLY DEV"
        : "DRY RUN",

    bucket:
      r2BucketName,

    mediaUrl,
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
      .from(artworks)
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
   * We verify EVERY local source before
   * uploading anything.
   */

  const plan = [];

  for (
    const artwork of rows
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
     * This preserves the pilot and also
     * makes interrupted migrations safe.
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
    const item of plan
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
      "Dry run successful ✅"
    );

    console.log(
      "No files were uploaded and Neon was not modified."
    );

    console.log("");
    console.log(
      "Run with --apply-dev to perform the DEV migration."
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
    "Starting DEV migration..."
  );

  let uploaded = 0;
  let reused = 0;
  let databaseUpdated = 0;

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
        .update(artworks)
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
      .from(artworks)
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
    "DEV portfolio R2 migration successful ✅"
  );

  console.log({
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