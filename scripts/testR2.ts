import { config } from "dotenv";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

config({
  path: ".env.local",
});

async function main() {
  /*
   * Dynamic import is intentional.
   *
   * dotenv must load the R2 environment
   * variables before r2Client is evaluated.
   */
  const {
    r2Client,
    r2BucketName,
  } =
    await import(
      "../lib/storage/r2Client"
    );

  /*
   * ============================================================
   * SAFETY
   * ============================================================
   *
   * This script is intentionally DEV-only.
   */
  if (
    r2BucketName !==
    "fefierys-assets-dev"
  ) {
    throw new Error(
      `R2 test aborted. Expected "fefierys-assets-dev" but received "${r2BucketName}".`
    );
  }

  const key =
    `tests/connection-test-${Date.now()}.txt`;

  const expectedContent =
    "Fefierys R2 connection test";

  /*
   * ============================================================
   * UPLOAD
   * ============================================================
   */

  console.log(
    `Uploading "${key}"...`
  );

  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2BucketName,
      Key: key,
      Body: expectedContent,
      ContentType:
        "text/plain; charset=utf-8",
    })
  );

  console.log(
    "Upload successful ✅"
  );

  /*
   * ============================================================
   * READ
   * ============================================================
   */

  console.log(
    "Reading object..."
  );

  const result =
    await r2Client.send(
      new GetObjectCommand({
        Bucket: r2BucketName,
        Key: key,
      })
    );

  if (!result.Body) {
    throw new Error(
      "R2 returned an empty response body"
    );
  }

  const actualContent =
    await result.Body.transformToString();

  if (
    actualContent !==
    expectedContent
  ) {
    throw new Error(
      `R2 content mismatch. Expected "${expectedContent}", received "${actualContent}".`
    );
  }

  console.log(
    "Read verification successful ✅"
  );

  /*
   * ============================================================
   * DELETE
   * ============================================================
   */

  console.log(
    "Deleting test object..."
  );

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    })
  );

  console.log(
    "Delete successful ✅"
  );

  console.log(
    "R2 DEV connection verification successful ✅"
  );
}

main().catch((error) => {
  console.error(
    "R2 DEV connection verification failed ❌"
  );

  console.error(error);

  process.exit(1);
});