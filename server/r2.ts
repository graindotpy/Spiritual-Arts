import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export function isR2Enabled() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL,
  );
}

function getR2Client() {
  if (!isR2Enabled()) {
    throw new Error("R2 is not configured. Missing required environment variables.");
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
}

export async function uploadToR2(params: {
  key: string;
  body: Buffer;
  contentType?: string;
}) {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET as string,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  const base = (process.env.R2_PUBLIC_BASE_URL as string).replace(/\/+$/, "");
  return `${base}/${params.key}`;
}

export async function deleteFromR2(objectUrl: string) {
  if (!isR2Enabled()) return;
  const base = (process.env.R2_PUBLIC_BASE_URL as string).replace(/\/+$/, "");
  if (!objectUrl.startsWith(base)) return;

  const key = objectUrl.slice(base.length + 1);
  if (!key) return;

  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET as string,
      Key: key,
    }),
  );
}
