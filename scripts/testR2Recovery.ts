import { createHash } from "node:crypto";
import {
  readFile,
} from "node:fs/promises";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "dotenv";

const args =
  process.argv.slice(2);

const isDev =
  args.includes("--dev");

const isQa =
  args.includes("--qa");

if (isDev === isQa) {
  throw new Error(
    "Choose exactly one environment: --dev or --qa"
  );
}

const manifestIndex =
  args.indexOf("--manifest");

if (
  manifestIndex === -1 ||
  !args[manifestIndex + 1]
) {
  throw new Error(
    'Usage: --manifest "<path-to-manifest.json>"'
  );
}

const manifestPath =
  path.resolve(
    args[manifestIndex + 1]
  );

const environment =
  isDev ? "dev" : "qa";

const envFile =
  isDev
    ? ".env.local"
    : ".env.qa.local";

const expectedBucket =
  isDev
    ? "fefierys-assets-dev"
    : "fefierys-assets-qa";

config({
  path: envFile,
  override: true,
});

const endpoint =
  process.env.R2_ENDPOINT;

const accessKeyId =
  process.env.R2_ACCESS_KEY_ID;

const secretAccessKey =
  process.env.R2_SECRET_ACCESS_KEY;

const bucket =
  process.env.R2_BUCKET_NAME;

if (
  !endpoint ||
  !accessKeyId ||
  !secretAccessKey ||
  !bucket
) {
  throw new Error(
    "R2 configuration is incomplete."
  );
}

if (
  bucket !== expectedBucket
) {
  throw new Error(
    `Safety check failed: expected "${expectedBucket}", got "${bucket}".`
  );
}

interface ManifestObject {
  key: string;
  size: number;
  sha256: string;
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  metadata?: Record<string, string>;
}

interface Manifest {
  environment: string;
  bucket: string;
  prefix: string;
  objectCount: number;
  objects: ManifestObject[];
}

const client =
  new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

function hash(
  data: Buffer
) {
  return createHash("sha256")
    .update(data)
    .digest("hex");
}

function normalizeMetadata(
  metadata:
    | Record<string, string>
    | undefined
) {
  return Object.fromEntries(
    Object.entries(
      metadata ?? {}
    ).sort(
      ([firstKey], [secondKey]) =>
        firstKey.localeCompare(
          secondKey
        )
    )
  );
}

async function main() {
  const rawManifest =
    await readFile(
      manifestPath,
      "utf8"
    );

  const manifest =
    JSON.parse(
      rawManifest
    ) as Manifest;

  if (
    manifest.environment !==
    environment
  ) {
    throw new Error(
      "Manifest environment does not match."
    );
  }

  if (
    manifest.bucket !== bucket
  ) {
    throw new Error(
      "Manifest bucket does not match."
    );
  }

  if (
    manifest.objects.length === 0
  ) {
    throw new Error(
      "Manifest contains no objects."
    );
  }

  const source =
    manifest.objects[0];

  if (
    !source.key.startsWith(
      manifest.prefix
    )
  ) {
    throw new Error(
      "Source key does not belong to manifest prefix."
    );
  }

  const relativeKey =
    source.key.slice(
      manifest.prefix.length
    );

  if (
    !relativeKey ||
    relativeKey.includes("..")
  ) {
    throw new Error(
      "Invalid source key."
    );
  }

  const backupRoot =
    path.dirname(
      manifestPath
    );

  const localPath =
    path.join(
      backupRoot,
      "objects",
      ...relativeKey.split("/")
    );

  console.log(
    `Environment: ${environment}`
  );

  console.log(
    `Source key: ${source.key}`
  );

  console.log(
    `Local backup: ${localPath}`
  );

  const localData =
    await readFile(
      localPath
    );

  const localHash =
    hash(localData);

  if (
    localData.length !==
    source.size
  ) {
    throw new Error(
      "Local backup size does not match manifest."
    );
  }

  if (
    localHash !==
    source.sha256
  ) {
    throw new Error(
      "Local backup SHA-256 does not match manifest."
    );
  }

  console.log(
    "Local backup integrity ✅"
  );

  const timestamp =
    Date.now();

  const recoveryKey =
    `recovery-restore-test/${timestamp}/${relativeKey}`;

  console.log(
    `Temporary recovery key: ${recoveryKey}`
  );

  let uploaded = false;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: recoveryKey,
        Body: localData,

        ContentType:
          source.contentType,

        CacheControl:
          source.cacheControl,

        ContentDisposition:
          source.contentDisposition,

        ContentEncoding:
          source.contentEncoding,

        Metadata:
          source.metadata,
      })
    );

    uploaded = true;

    console.log(
      "Temporary object uploaded ✅"
    );

    const restored =
      await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: recoveryKey,
        })
      );

    if (!restored.Body) {
      throw new Error(
        "Restored object has no body."
      );
    }

    const restoredData =
      Buffer.from(
        await restored.Body
          .transformToByteArray()
      );

    const restoredHash =
      hash(restoredData);

    if (
      restoredData.length !==
      localData.length
    ) {
      throw new Error(
        "Restored object size mismatch."
      );
    }

    if (
      restoredHash !==
      localHash
    ) {
      throw new Error(
        "Restored object SHA-256 mismatch."
      );
    }

    console.log(
      "Restored object integrity ✅"
    );

    if (
      restored.ContentType !==
      source.contentType
    ) {
      throw new Error(
        `Content-Type mismatch: expected "${source.contentType}", got "${restored.ContentType}".`
      );
    }

    if (
      restored.CacheControl !==
      source.cacheControl
    ) {
      throw new Error(
        `Cache-Control mismatch: expected "${source.cacheControl}", got "${restored.CacheControl}".`
      );
    }

    if (
      restored.ContentDisposition !==
      source.contentDisposition
    ) {
      throw new Error(
        `Content-Disposition mismatch: expected "${source.contentDisposition}", got "${restored.ContentDisposition}".`
      );
    }

    if (
      restored.ContentEncoding !==
      source.contentEncoding
    ) {
      throw new Error(
        `Content-Encoding mismatch: expected "${source.contentEncoding}", got "${restored.ContentEncoding}".`
      );
    }

    const originalMetadata =
      normalizeMetadata(
        source.metadata
      );

    const restoredMetadata =
      normalizeMetadata(
        restored.Metadata
      );

    if (
      JSON.stringify(
        originalMetadata
      ) !==
      JSON.stringify(
        restoredMetadata
      )
    ) {
      throw new Error(
        "Custom metadata mismatch."
      );
    }

    console.log(
      "Restored object metadata ✅"
    );

    console.log(
      "\nR2 recovery drill successful ✅"
    );
  } finally {
    if (uploaded) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: recoveryKey,
          })
        );

        console.log(
          "Temporary recovery object deleted ✅"
        );
      } catch (
        cleanupError: unknown
      ) {
        console.error(
          "WARNING: Could not delete temporary recovery object."
        );

        console.error(
          cleanupError
        );
      }
    }
  }
}

main().catch(
  (error: unknown) => {
    console.error(
      "\nR2 recovery drill failed."
    );

    console.error(error);

    process.exit(1);
  }
);