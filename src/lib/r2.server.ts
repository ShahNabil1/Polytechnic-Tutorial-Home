// Server-only R2 helpers. Do not import from client code.
import { AwsClient } from "aws4fetch";

export function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw new Error("R2 is not configured (missing R2_* environment variables)");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export function getR2Client() {
  const { accessKeyId, secretAccessKey } = getR2Config();
  return new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
}

/**
 * Create a presigned PUT URL the browser can upload to directly.
 * Returns both the signed URL (for PUT) and the eventual public URL.
 */
export async function createPresignedPutUrl(options: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const { accountId, bucket, publicBaseUrl } = getR2Config();
  const client = getR2Client();
  const endpoint = new URL(
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeURI(options.key)}`,
  );
  endpoint.searchParams.set("X-Amz-Expires", String(options.expiresInSeconds ?? 600));
  const signed = await client.sign(
    new Request(endpoint, {
      method: "PUT",
      headers: { "content-type": options.contentType },
    }),
    { aws: { signQuery: true } },
  );
  return {
    uploadUrl: signed.url,
    publicUrl: `${publicBaseUrl}/${options.key}`,
  };
}

/**
 * Create a short-lived presigned GET URL for reading a private object.
 */
export async function createPresignedGetUrl(options: {
  key: string;
  expiresInSeconds?: number;
}) {
  const { accountId, bucket } = getR2Config();
  const client = getR2Client();
  const endpoint = new URL(
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encodeURI(options.key)}`,
  );
  endpoint.searchParams.set("X-Amz-Expires", String(options.expiresInSeconds ?? 300));
  const signed = await client.sign(
    new Request(endpoint, { method: "GET" }),
    { aws: { signQuery: true } },
  );
  return { url: signed.url };
}
