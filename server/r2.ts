import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface R2Configuration {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

const R2_ENVIRONMENT_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

function readEnvironmentValue(key: (typeof R2_ENVIRONMENT_KEYS)[number]): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

export function getMissingR2EnvironmentVariables(): string[] {
  return R2_ENVIRONMENT_KEYS.filter((key) => !readEnvironmentValue(key));
}

export function getR2Configuration(): R2Configuration | undefined {
  const missing = getMissingR2EnvironmentVariables();
  if (missing.length === R2_ENVIRONMENT_KEYS.length) {
    return undefined;
  }
  if (missing.length > 0) {
    throw new Error(
      `R2 configuration is incomplete; missing ${missing.join(", ")}`,
    );
  }

  const publicBaseUrl = readEnvironmentValue("R2_PUBLIC_BASE_URL") as string;
  let parsedPublicBaseUrl: URL;
  try {
    parsedPublicBaseUrl = new URL(publicBaseUrl);
  } catch {
    throw new Error("R2_PUBLIC_BASE_URL must be a valid HTTP or HTTPS URL");
  }
  if (!['http:', 'https:'].includes(parsedPublicBaseUrl.protocol)) {
    throw new Error("R2_PUBLIC_BASE_URL must be an HTTP or HTTPS URL");
  }
  if (
    parsedPublicBaseUrl.username ||
    parsedPublicBaseUrl.password ||
    parsedPublicBaseUrl.search ||
    parsedPublicBaseUrl.hash
  ) {
    throw new Error(
      "R2_PUBLIC_BASE_URL cannot contain credentials, a query string, or a fragment",
    );
  }

  const normalizedPublicBaseUrl = parsedPublicBaseUrl
    .toString()
    .replace(/\/+$/, "");

  return {
    accountId: readEnvironmentValue("R2_ACCOUNT_ID") as string,
    accessKeyId: readEnvironmentValue("R2_ACCESS_KEY_ID") as string,
    secretAccessKey: readEnvironmentValue("R2_SECRET_ACCESS_KEY") as string,
    bucket: readEnvironmentValue("R2_BUCKET") as string,
    publicBaseUrl: normalizedPublicBaseUrl,
  };
}

export function isR2Enabled(): boolean {
  return getR2Configuration() !== undefined;
}

let cachedClient: { signature: string; client: S3Client } | undefined;

function getR2Client(configuration: R2Configuration): S3Client {
  const signature = [
    configuration.accountId,
    configuration.accessKeyId,
    configuration.secretAccessKey,
  ].join("\0");
  if (cachedClient?.signature === signature) {
    return cachedClient.client;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${configuration.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: configuration.accessKeyId,
      secretAccessKey: configuration.secretAccessKey,
    },
  });
  cachedClient = { signature, client };
  return client;
}

function requireR2Configuration(): R2Configuration {
  const configuration = getR2Configuration();
  if (!configuration) {
    throw new Error(
      `R2 is not configured; missing ${getMissingR2EnvironmentVariables().join(", ")}`,
    );
  }
  return configuration;
}

function validateObjectKey(key: string): string {
  if (
    !key ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.includes("\0") ||
    /[\u0000-\u001f\u007f]/.test(key) ||
    key.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid R2 object key");
  }
  return key;
}

function encodeObjectKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export async function uploadToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const configuration = requireR2Configuration();
  const key = validateObjectKey(params.key);
  await getR2Client(configuration).send(
    new PutObjectCommand({
      Bucket: configuration.bucket,
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  return `${configuration.publicBaseUrl}/${encodeObjectKey(key)}`;
}

export function getR2ObjectKey(objectUrl: string): string | undefined {
  const configuration = getR2Configuration();
  if (!configuration) return undefined;

  let base: URL;
  let object: URL;
  try {
    base = new URL(`${configuration.publicBaseUrl}/`);
    object = new URL(objectUrl);
  } catch {
    return undefined;
  }

  if (object.origin !== base.origin || !object.pathname.startsWith(base.pathname)) {
    return undefined;
  }

  if (object.username || object.password) return undefined;

  const encodedKey = object.pathname.slice(base.pathname.length);
  if (!encodedKey || object.search || object.hash) {
    return undefined;
  }

  try {
    const segments = encodedKey.split("/").map(decodeURIComponent);
    if (segments.some((segment) => segment.includes("/") || segment.includes("\\"))) {
      return undefined;
    }
    return validateObjectKey(segments.join("/"));
  } catch {
    return undefined;
  }
}

export async function deleteFromR2(objectUrl: string): Promise<boolean> {
  const configuration = getR2Configuration();
  if (!configuration) return false;

  const key = getR2ObjectKey(objectUrl);
  if (!key) return false;

  await getR2Client(configuration).send(
    new DeleteObjectCommand({
      Bucket: configuration.bucket,
      Key: key,
    }),
  );
  return true;
}
