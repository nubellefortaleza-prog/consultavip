/**
 * Google Drive upload using a service account.
 *
 * Setup:
 * 1. Acesse console.cloud.google.com → crie um projeto
 * 2. Ative "Google Drive API" na biblioteca de APIs
 * 3. Crie uma Conta de Serviço (IAM → Contas de serviço)
 * 4. Baixe a chave JSON da conta de serviço
 * 5. No Google Drive, crie uma pasta, clique em Compartilhar e adicione
 *    o e-mail da conta de serviço (ex: nome@projeto.iam.gserviceaccount.com)
 *    com permissão "Editor"
 * 6. Copie o ID da pasta (parte final da URL do Drive)
 * 7. No .env do servidor, adicione:
 *    GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}   (conteúdo do JSON baixado)
 *    GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWx  (ID da pasta no Drive)
 */

import { SignJWT, importPKCS8 } from "jose";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  })
    .setProtectedHeader({ alg: "RS256" })
    .sign(privateKey);

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!resp.ok) throw new Error(`Google token error: ${await resp.text()}`);
  const data = await resp.json() as any;
  return data.access_token as string;
}

export async function uploadFileToDrive(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<{ fileId: string; webViewLink: string }> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado no .env");

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const accessToken = await getAccessToken(serviceAccountJson);

  const metadata: Record<string, unknown> = { name: filename };
  if (folderId) metadata.parents = [folderId];

  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([fileBuffer], { type: mimeType }));

  const resp = await fetch(DRIVE_UPLOAD_URL + "&fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!resp.ok) throw new Error(`Drive upload falhou: ${resp.status} ${await resp.text()}`);
  const data = await resp.json() as any;
  return { fileId: data.id, webViewLink: data.webViewLink };
}

export function isDriveConfigured(): boolean {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}
