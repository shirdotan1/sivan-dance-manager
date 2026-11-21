/**
 * Browser side of a media upload (see src/lib/data/media.ts for the order of
 * operations). Files go straight to R2 with short-lived signed URLs; on any
 * failure or cancel the upload is aborted so no pending row or object is
 * left behind.
 *
 * Photos (≤ 20 MB): one signed PUT. Videos and anything larger: multipart in
 * 10 MB parts, 3 at a time; each part is retried up to 3 times with a fresh
 * signed URL (it may have expired on a slow connection), so a dropped mobile
 * connection costs one part, not the whole video.
 */
import type { MediaView } from "@/lib/data/media";
import type { MediaOwner } from "@/lib/storage/r2";

export type UploadProgress = (fraction: number) => void;

export class UploadError extends Error {}

export const PART_SIZE = 10 * 1024 * 1024; // R2: every part but the last must be ≥ 5 MiB
const PARALLEL = 3;
const ATTEMPTS = 3;
const SINGLE_MAX = 20 * 1000 * 1000;

export const usesMultipart = (file: File) => file.type.startsWith("video/") || file.size > SINGLE_MAX;

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new UploadError(data.error ?? "ההעלאה נכשלה.");
  return data as T;
}

const cancelled = () => new UploadError("ההעלאה בוטלה.");

/** PUT with progress events (fetch has no upload progress). Resolves with the ETag. */
function put(url: string, body: Blob, contentType: string | undefined, onProgress: UploadProgress, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) return reject(cancelled());
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.getResponseHeader("etag") ?? "") : reject(new UploadError(`האחסון החזיר ${xhr.status}.`));
    xhr.onerror = () => reject(new UploadError("החיבור נקטע."));
    xhr.onabort = () => reject(cancelled());
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(cancelled())), { once: true });
  });

type Opts = { owner: MediaOwner; caption: string; onProgress: UploadProgress; signal?: AbortSignal };

/** Uploads one photo or video and returns it as the page shows it. */
export async function uploadMedia(file: File, opts: Opts): Promise<MediaView> {
  return usesMultipart(file) ? uploadMultipart(file, opts) : uploadSingle(file, opts);
}

async function uploadSingle(file: File, opts: Opts): Promise<MediaView> {
  const { mediaId, uploadUrl } = await api<{ mediaId: string; uploadUrl: string }>("/api/media/uploads", {
    owner: opts.owner,
    contentType: file.type,
    caption: opts.caption,
  });
  try {
    await put(uploadUrl, file, file.type, opts.onProgress, opts.signal);
    const { media } = await api<{ media: MediaView }>(`/api/media/uploads/${mediaId}/complete`, {});
    return media;
  } catch (e) {
    await api(`/api/media/uploads/${mediaId}/abort`, {}).catch(() => {}); // 24h cleanup covers the rest
    throw e;
  }
}

async function uploadMultipart(file: File, opts: Opts): Promise<MediaView> {
  const { signal } = opts;
  const { mediaId, uploadId } = await api<{ mediaId: string; uploadId: string }>("/api/media/uploads", {
    owner: opts.owner,
    contentType: file.type,
    caption: opts.caption,
    multipart: true,
  });
  try {
    const count = Math.max(1, Math.ceil(file.size / PART_SIZE));
    const loaded = new Array<number>(count).fill(0);
    const report = () => opts.onProgress(file.size ? loaded.reduce((a, b) => a + b, 0) / file.size : 0);
    const urls = new Map<number, string>();
    const sign = async (numbers: number[]) => {
      const { urls: signed } = await api<{ urls: Record<number, string> }>(`/api/media/uploads/${mediaId}/parts`, { uploadId, partNumbers: numbers });
      for (const [n, url] of Object.entries(signed)) urls.set(Number(n), url);
    };
    const parts: { PartNumber: number; ETag: string }[] = [];
    let next = 1;

    const worker = async () => {
      for (let n = next++; n <= count; n = next++) {
        const blob = file.slice((n - 1) * PART_SIZE, Math.min(n * PART_SIZE, file.size));
        for (let attempt = 1; ; attempt++) {
          if (signal?.aborted) throw cancelled();
          try {
            // Sign ahead in small batches; always re-sign on a retry.
            if (attempt > 1) urls.delete(n);
            if (!urls.has(n)) await sign(Array.from({ length: Math.min(10, count - n + 1) }, (_, i) => n + i).filter((k) => k === n || !urls.has(k)));
            const etag = await put(urls.get(n)!, blob, undefined, (p) => ((loaded[n - 1] = p * blob.size), report()), signal);
            if (!etag) throw new UploadError("האחסון לא אישר את החלק.");
            parts.push({ PartNumber: n, ETag: etag });
            loaded[n - 1] = blob.size;
            report();
            break;
          } catch (e) {
            loaded[n - 1] = 0;
            report();
            if (signal?.aborted || attempt >= ATTEMPTS) throw e;
            await wait(1000 * 2 ** (attempt - 1), signal);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, count) }, worker));

    const { media } = await api<{ media: MediaView }>(`/api/media/uploads/${mediaId}/complete`, { uploadId, parts });
    return media;
  } catch (e) {
    await api(`/api/media/uploads/${mediaId}/abort`, { uploadId }).catch(() => {});
    throw e;
  }
}

export async function deleteMediaItem(mediaId: string) {
  const res = await fetch(`/api/media/${mediaId}`, { method: "DELETE" });
  if (!res.ok) throw new UploadError((await res.json().catch(() => ({}))).error ?? "המחיקה נכשלה.");
}
