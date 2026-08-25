import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  r2BucketName,
  r2Client,
} from "./r2Client";

/*
 * ============================================================
 * STORAGE KEYS
 * ============================================================
 */

export function buildPortfolioStorageKey(
  artworkId: string,
  filename: string
) {
  return `portfolio/artworks/${artworkId}/${filename}`;
}

/*
 * ============================================================
 * UPLOAD
 * ============================================================
 */

export async function uploadPortfolioObject({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Uint8Array | string;
  contentType: string;
}) {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: r2BucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return key;
}

/*
 * ============================================================
 * EXISTS
 * ============================================================
 */

export async function portfolioObjectExists(
  key: string
) {
  try {
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: r2BucketName,
        Key: key,
      })
    );

    return true;
  } catch (error) {
    const status =
      (
        error as {
          $metadata?: {
            httpStatusCode?: number;
          };
        }
      ).$metadata?.httpStatusCode;

    if (status === 404) {
      return false;
    }

    throw error;
  }
}

/*
 * ============================================================
 * DELETE
 * ============================================================
 */

export async function deletePortfolioObject(
  key: string
) {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    })
  );
}