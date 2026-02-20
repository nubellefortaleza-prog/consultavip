import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

type LegacyStorageConfig = { baseUrl: string; apiKey: string };

function getS3Config() {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || "us-east-1";
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket) return null;

  const client = new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true" } : {}),
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  });

  return {
    bucket,
    client,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
    signedUrlTtlSeconds: Number(process.env.S3_SIGNED_URL_TTL_SECONDS || 3600),
  };
}

function getLegacyStorageConfig(): LegacyStorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage não configurado. Configure AWS_S3_BUCKET (recomendado) ou fallback BUILT_IN_FORGE_API_URL/KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(data: Buffer | Uint8Array | string, contentType: string, fileName: string): FormData {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

async function storagePutLegacy(relKey: string, data: Buffer | Uint8Array | string, contentType: string) {
  const { baseUrl, apiKey } = getLegacyStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  uploadUrl.searchParams.set("path", key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Legacy storage upload failed (${response.status}): ${message}`);
  }

  const url = (await response.json()).url;
  return { key, url };
}

async function storageGetLegacy(relKey: string) {
  const { baseUrl, apiKey } = getLegacyStorageConfig();
  const key = normalizeKey(relKey);
  const downloadApiUrl = new URL("v1/storage/downloadUrl", ensureTrailingSlash(baseUrl));
  downloadApiUrl.searchParams.set("path", key);

  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Legacy storage download URL failed (${response.status}): ${message}`);
  }

  return { key, url: (await response.json()).url as string };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const s3 = getS3Config();

  if (s3 && ENV.storageProvider !== "forge") {
    const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as Uint8Array);
    await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType }));

    if (s3.publicBaseUrl) {
      return { key, url: `${s3.publicBaseUrl.replace(/\/$/, "")}/${key}` };
    }

    const signedUrl = await getSignedUrl(
      s3.client,
      new GetObjectCommand({ Bucket: s3.bucket, Key: key }),
      { expiresIn: s3.signedUrlTtlSeconds }
    );

    return { key, url: signedUrl };
  }

  return storagePutLegacy(key, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const s3 = getS3Config();

  if (s3 && ENV.storageProvider !== "forge") {
    if (s3.publicBaseUrl) {
      return { key, url: `${s3.publicBaseUrl.replace(/\/$/, "")}/${key}` };
    }
    const signedUrl = await getSignedUrl(
      s3.client,
      new GetObjectCommand({ Bucket: s3.bucket, Key: key }),
      { expiresIn: s3.signedUrlTtlSeconds }
    );
    return { key, url: signedUrl };
  }

  return storageGetLegacy(key);
}
