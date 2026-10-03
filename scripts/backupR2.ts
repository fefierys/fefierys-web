import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "dotenv";

const args = process.argv.slice(2);

const isDev = args.includes("--dev");
const isQa = args.includes("--qa");

if (isDev === isQa) {
  throw new Error(
    "Choose exactly one environment: --dev or --qa"
  );
}

const environment = isDev ? "dev" : "qa";

const envFile = isDev
  ? ".env.local"
  : ".env.qa.local";

const expectedBucket = isDev
  ? "fefierys-assets-dev"
  : "fefierys-assets-qa";

config({
  path: envFile,
  override: true,
});

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId =
  process.env.R2_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.R2_SECRET_ACCESS_KEY;
const bucket =
  process.env.R2_BUCKET_NAME;

if (!endpoint) {
  throw new Error(
    "R2_ENDPOINT is not configured."
  );
}

if (!accessKeyId) {
  throw new Error(
    "R2_ACCESS_KEY_ID is not configured."
  );
}

if (!secretAccessKey) {
  throw new Error(
    "R2_SECRET_ACCESS_KEY is not configured."
  );
}

if (!bucket) {
  throw new Error(
    "R2_BUCKET_NAME is not configured."
  );
}

if (bucket !== expectedBucket) {
  throw new Error(
    `Safety check failed: expected bucket "${expectedBucket}", got "${bucket}".`
  );
}

const prefix =
  "portfolio/artworks/";

const timestamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot = path.resolve(
  "C:\\web_fefi\\backups",
  `fefierys-r2-${environment}`,
  timestamp
);

const objectsRoot = path.join(
  backupRoot,
  "objects"
);

const client =
  new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

interface BackupObject {
  key: string;
  size: number;
  sha256: string;
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  metadata?: Record<string, string>;
}

async function listObjects() {
  const objects: {
    key: string;
    size: number;
  }[] = [];

  let continuationToken:
    | string
    | undefined;

  do {
    const response =
      await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken:
            continuationToken,
        })
      );

    for (
      const object of
      response.Contents ?? []
    ) {
      if (!object.Key) {
        continue;
      }

      /*
       * Ignore an eventual folder marker.
       */
      if (
        object.Key === prefix
      ) {
        continue;
      }

      objects.push({
        key: object.Key,
        size:
          object.Size ?? 0,
      });
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
  } while (continuationToken);

  return objects;
}

async function downloadObject(
  key: string
) {
  const response =
    await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

  if (!response.Body) {
    throw new Error(
      `Object has no body: ${key}`
    );
  }

  const bytes =
    await response.Body
      .transformToByteArray();

  return {
    data: Buffer.from(bytes),
    contentType:
      response.ContentType,
    cacheControl:
      response.CacheControl,
    contentDisposition:
      response.ContentDisposition,
    contentEncoding:
      response.ContentEncoding,
    metadata:
      response.Metadata,
  };
}

async function main() {
  console.log(
    `R2 backup environment: ${environment}`
  );

  console.log(
    `Bucket: ${bucket}`
  );

  console.log(
    `Prefix: ${prefix}`
  );

  console.log(
    `Destination: ${backupRoot}`
  );

  await mkdir(
    objectsRoot,
    {
      recursive: true,
    }
  );

  console.log(
    "\nListing R2 objects..."
  );

  const objects =
    await listObjects();

  console.log(
    `Found ${objects.length} objects.`
  );

  if (
    objects.length === 0
  ) {
    throw new Error(
      `No objects found under ${prefix}`
    );
  }

  const manifestObjects:
    BackupObject[] = [];

  let totalBytes = 0;

  for (
    let index = 0;
    index < objects.length;
    index += 1
  ) {
    const object =
      objects[index];

    const relativeKey =
      object.key.slice(
        prefix.length
      );

    if (
      !relativeKey ||
      relativeKey.includes("..")
    ) {
      throw new Error(
        `Unsafe object key: ${object.key}`
      );
    }

    console.log(
      `[${index + 1}/${objects.length}] ${object.key}`
    );

    const downloaded =
        await downloadObject(
            object.key
        );

    const data =
        downloaded.data;

    if (
      data.length !== object.size
    ) {
      throw new Error(
        `Size mismatch for ${object.key}: R2=${object.size}, downloaded=${data.length}`
      );
    }

    const sha256 =
      createHash("sha256")
        .update(data)
        .digest("hex");

    const destination =
      path.join(
        objectsRoot,
        ...relativeKey.split("/")
      );

    await mkdir(
      path.dirname(
        destination
      ),
      {
        recursive: true,
      }
    );

    await writeFile(
      destination,
      data
    );

    manifestObjects.push({
        key: object.key,
        size: data.length,
        sha256,
        contentType:
            downloaded.contentType,
        cacheControl:
            downloaded.cacheControl,
        contentDisposition:
            downloaded.contentDisposition,
        contentEncoding:
            downloaded.contentEncoding,
        metadata:
            downloaded.metadata,
        });

    totalBytes +=
      data.length;
  }

  const manifest = {
    version: 1,
    environment,
    bucket,
    prefix,
    generatedAt:
      new Date().toISOString(),
    objectCount:
      manifestObjects.length,
    totalBytes,
    objects:
      manifestObjects,
  };

  const manifestPath =
    path.join(
      backupRoot,
      "manifest.json"
    );

  await writeFile(
    manifestPath,
    JSON.stringify(
      manifest,
      null,
      2
    ),
    "utf8"
  );

  console.log(
    "\nR2 backup successful ✅"
  );

  console.log(
    `Objects: ${manifest.objectCount}`
  );

  console.log(
    `Bytes: ${manifest.totalBytes}`
  );

  console.log(
    `Manifest: ${manifestPath}`
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      "\nR2 backup failed."
    );

    console.error(
      error
    );

    process.exit(1);
  }
);