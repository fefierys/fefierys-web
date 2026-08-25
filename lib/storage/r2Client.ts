import { S3Client } from "@aws-sdk/client-s3";

const endpoint =
  process.env.R2_ENDPOINT;

const accessKeyId =
  process.env.R2_ACCESS_KEY_ID;

const secretAccessKey =
  process.env.R2_SECRET_ACCESS_KEY;

export const r2BucketName =
  process.env.R2_BUCKET_NAME;

if (!endpoint) {
  throw new Error(
    "R2_ENDPOINT environment variable is not configured"
  );
}

if (!accessKeyId) {
  throw new Error(
    "R2_ACCESS_KEY_ID environment variable is not configured"
  );
}

if (!secretAccessKey) {
  throw new Error(
    "R2_SECRET_ACCESS_KEY environment variable is not configured"
  );
}

if (!r2BucketName) {
  throw new Error(
    "R2_BUCKET_NAME environment variable is not configured"
  );
}

export const r2Client =
  new S3Client({
    region: "auto",

    endpoint,

    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });