import {
  AbortMultipartUploadCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/** The TEST bucket only (checked by name); used to verify from outside the app. */
export function testBucket() {
  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) throw new Error("E2E refused: R2 env missing.");
  if (!/test/i.test(R2_BUCKET_NAME)) throw new Error("E2E refused: R2_BUCKET_NAME is not a test bucket.");
  const client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });
  return { client, Bucket: R2_BUCKET_NAME };
}

export async function objectExists(key: string) {
  const { client, Bucket } = testBucket();
  try {
    await client.send(new HeadObjectCommand({ Bucket, Key: key }));
    return true;
  } catch (e) {
    if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

export async function listKeys(prefix = "") {
  const { client, Bucket } = testBucket();
  const keys: string[] = [];
  let ContinuationToken: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }));
    for (const o of page.Contents ?? []) if (o.Key) keys.push(o.Key);
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

export async function deleteKeys(keys: string[]) {
  const { client, Bucket } = testBucket();
  for (let i = 0; i < keys.length; i += 1000) {
    const Objects = keys.slice(i, i + 1000).map((Key) => ({ Key }));
    if (Objects.length) await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects, Quiet: true } }));
  }
  return keys.length;
}

/** Puts an object directly (e.g. an orphan under an event prefix). */
export async function putObject(key: string, body: Buffer | string = "x") {
  const { client, Bucket } = testBucket();
  await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body }));
}

/** Multipart uploads still open under a prefix (should be none after a cancel). */
export async function openUploads(prefix: string) {
  const { client, Bucket } = testBucket();
  const out = await client.send(new ListMultipartUploadsCommand({ Bucket, Prefix: prefix }));
  return (out.Uploads ?? []).map((u) => ({ key: u.Key!, uploadId: u.UploadId! }));
}

export async function abortUploads(prefix: string) {
  const { client, Bucket } = testBucket();
  const open = await openUploads(prefix);
  for (const u of open) await client.send(new AbortMultipartUploadCommand({ Bucket, Key: u.key, UploadId: u.uploadId }));
  return open.length;
}
