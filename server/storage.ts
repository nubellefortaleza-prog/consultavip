// Local filesystem storage for VPS hosting
// Audio files are saved to UPLOADS_DIR and served via Express static middleware

import fs from "fs/promises";
import path from "path";

function getUploadsDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), "uploads");
}

function getBaseUrl(): string {
  return (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const filePath = path.join(getUploadsDir(), key);

  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data as any);
  await fs.writeFile(filePath, buffer);

  const url = `${getBaseUrl()}/uploads/${key}`;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const url = `${getBaseUrl()}/uploads/${key}`;
  return { key, url };
}
