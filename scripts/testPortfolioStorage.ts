import { config } from "dotenv";

config({
  path: ".env.local",
});

async function main() {
  /*
   * Dynamic imports are intentional.
   *
   * dotenv must load the environment
   * variables before storage modules
   * are evaluated.
   */

  const {
    r2BucketName,
  } =
    await import(
      "../lib/storage/r2Client"
    );

  const {
    buildPortfolioStorageKey,
    deletePortfolioObject,
    portfolioObjectExists,
    uploadPortfolioObject,
  } =
    await import(
      "../lib/storage/portfolioStorage"
    );

  /*
   * ============================================================
   * SAFETY
   * ============================================================
   */

  if (
    r2BucketName !==
    "fefierys-assets-dev"
  ) {
    throw new Error(
      `Storage test aborted. Expected "fefierys-assets-dev" but received "${r2BucketName}".`
    );
  }

  /*
   * Fake UUID only for testing the key structure.
   */
  const testArtworkId =
    "00000000-0000-0000-0000-000000000000";

  const key =
    buildPortfolioStorageKey(
      testArtworkId,
      "connection-test.txt"
    );

  /*
   * ============================================================
   * INITIAL STATE
   * ============================================================
   */

  const existedBefore =
    await portfolioObjectExists(key);

  if (existedBefore) {
    throw new Error(
      `Test object already exists: "${key}"`
    );
  }

  console.log(
    "Initial state verified ✅"
  );

  /*
   * ============================================================
   * UPLOAD
   * ============================================================
   */

  await uploadPortfolioObject({
    key,
    body:
      "Fefierys portfolio storage test",
    contentType:
      "text/plain; charset=utf-8",
  });

  console.log(
    "Upload successful ✅"
  );

  /*
   * ============================================================
   * VERIFY
   * ============================================================
   */

  const existsAfterUpload =
    await portfolioObjectExists(key);

  if (!existsAfterUpload) {
    throw new Error(
      "Uploaded object could not be found"
    );
  }

  console.log(
    "Object existence verified ✅"
  );

  /*
   * ============================================================
   * DELETE
   * ============================================================
   */

  await deletePortfolioObject(key);

  const existsAfterDelete =
    await portfolioObjectExists(key);

  if (existsAfterDelete) {
    throw new Error(
      "Test object still exists after deletion"
    );
  }

  console.log(
    "Delete verified ✅"
  );

  console.log(
    "Portfolio storage verification successful ✅"
  );
}

main().catch((error) => {
  console.error(
    "Portfolio storage verification failed ❌"
  );

  console.error(error);

  process.exit(1);
});