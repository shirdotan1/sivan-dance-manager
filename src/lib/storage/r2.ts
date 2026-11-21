import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3 API) for media files. Server-only: the keys never reach
 * the browser. The bucket is private; every read and write goes through a
 * short-lived signed URL issued after an access check (src/lib/auth/access.ts).
 */

function config() {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error("Media storage (R2) is not configured.");
  }
  return { endpoint: R2_ENDPOINT, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, bucket: R2_BUCKET_NAME };
}

let client: S3Client | undefined;
function s3() {
  const c = config();
  client ??= new S3Client({
    region: "auto",
    endpoint: c.endpoint,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  return { client, Bucket: c.bucket };
}

/** Whose media: every object lives under its lesson's or session's prefix. */
export type MediaOwner = { kind: "lesson" | "session"; id: string };

export const ownerPrefix = (owner: MediaOwner) => `${owner.kind}s/${owner.id}/`;

const CONTENT_TYPE_RE = /^(image|video)\/[a-z0-9.+-]+$/;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
  "video/x-matroska": "mkv",
};

/** Only photos and videos are accepted (no size limit — product decision). */
export const isMediaContentType = (t: unknown): t is string => typeof t === "string" && CONTENT_TYPE_RE.test(t);

/** A new object key, chosen by the server (never from the file name). */
export function newObjectKey(owner: MediaOwner, contentType: string) {
  return `${ownerPrefix(owner)}${crypto.randomUUID()}.${EXT[contentType] ?? "bin"}`;
}

/** Upload links are short: an upload starts right after it is signed. */
const UPLOAD_URL_TTL = 15 * 60;

/** One direct PUT (photos and small files). The browser must send the same Content-Type. */
export async function signUpload(key: string, contentType: string) {
  const { client, Bucket } = s3();
  // Sign Content-Type too (the SDK signs only `host` by default): the URL then
  // refuses any other type, in addition to the server check on complete.
  return getSignedUrl(client, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_TTL,
    signableHeaders: new Set(["content-type"]),
  });
}

export async function startMultipart(key: string, contentType: string) {
  const { client, Bucket } = s3();
  const out = await client.send(new CreateMultipartUploadCommand({ Bucket, Key: key, ContentType: contentType }));
  if (!out.UploadId) throw new Error("R2 did not return an upload id.");
  return out.UploadId;
}

export async function signParts(key: string, uploadId: string, partNumbers: number[]) {
  const { client, Bucket } = s3();
  const urls: Record<number, string> = {};
  for (const PartNumber of partNumbers) {
    urls[PartNumber] = await getSignedUrl(client, new UploadPartCommand({ Bucket, Key: key, UploadId: uploadId, PartNumber }), {
      expiresIn: UPLOAD_URL_TTL,
    });
  }
  return urls;
}

export async function completeMultipart(key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]) {
  const { client, Bucket } = s3();
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber) },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string) {
  const { client, Bucket } = s3();
  try {
    await client.send(new AbortMultipartUploadCommand({ Bucket, Key: key, UploadId: uploadId }));
  } catch (e) {
    if (!isNotFound(e)) throw e; // already completed / aborted / expired
  }
}

/** The stored object's real size and type, or null when it doesn't exist. */
export async function headObject(key: string) {
  const { client, Bucket } = s3();
  try {
    const h = await client.send(new HeadObjectCommand({ Bucket, Key: key }));
    return { size: h.ContentLength ?? 0, contentType: h.ContentType ?? "" };
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/** Safe to repeat: deleting a missing key succeeds. */
export async function deleteObject(key: string) {
  const { client, Bucket } = s3();
  await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

/**
 * E2E fault injection: lets the tests prove "storage failed → nothing is
 * deleted". Honored ONLY when MEDIA_TEST_FAULT names the operation AND the
 * bucket is a test bucket; production never sets it.
 */
function injectedFault(operation: "deletePrefix") {
  const fault = process.env.MEDIA_TEST_FAULT;
  if (fault === operation && /test/i.test(process.env.R2_BUCKET_NAME ?? "")) throw new Error(`Injected test fault: ${operation}`);
}

/** Deletes every object under a prefix (a whole lesson or session). Returns how many. */
export async function deletePrefix(prefix: string) {
  injectedFault("deletePrefix");
  const { client, Bucket } = s3();
  let deleted = 0;
  let ContinuationToken: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }));
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length) {
      const out = await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }));
      if (out.Errors?.length) throw new Error(`R2 could not delete ${out.Errors.length} object(s) under ${prefix}.`);
      deleted += keys.length;
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return deleted;
}

/**
 * Signed view URL. Signed as of the start of the current hour and valid for
 * two, so the same URL is reused within the hour (the phone can cache the
 * photo) and always has at least an hour left — enough to watch a video.
 */
export async function signView(key: string) {
  const { client, Bucket } = s3();
  const hour = new Date();
  hour.setUTCMinutes(0, 0, 0);
  return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: 2 * 60 * 60, signingDate: hour });
}

function isNotFound(e: unknown) {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === "NotFound" || err?.name === "NoSuchKey" || err?.name === "NoSuchUpload" || err?.$metadata?.httpStatusCode === 404;
}
