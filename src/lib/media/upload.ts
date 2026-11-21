/**
 * Browser side of a media upload (see src/lib/data/media.ts for the order of
 * operations). The file goes straight to R2 with a signed URL; on any
 * failure the upload is aborted so no pending row or object is left behind.
 */
import type { MediaView } from "@/lib/data/media";
import type { MediaOwner } from "@/lib/storage/r2";

export type UploadProgress = (fraction: number) => void;

export class UploadError extends Error {}

async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new UploadError(data.error ?? "ההעלאה נכשלה.");
  return data as T;
}

/** PUT with progress events (fetch has no upload progress). Resolves with the ETag. */
function put(url: string, body: Blob, contentType: string | undefined, onProgress: UploadProgress, signal?: AbortSignal) {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.getResponseHeader("etag") ?? "") : reject(new UploadError(`האחסון החזיר ${xhr.status}.`));
    xhr.onerror = () => reject(new UploadError("החיבור נקטע."));
    xhr.onabort = () => reject(new UploadError("ההעלאה בוטלה."));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

/** Uploads one photo (single signed PUT). Videos use multipart (next stage). */
export async function uploadMedia(
  file: File,
  opts: { owner: MediaOwner; caption: string; onProgress: UploadProgress; signal?: AbortSignal },
): Promise<MediaView> {
  const contentType = file.type;
  const { mediaId, uploadUrl } = await api<{ mediaId: string; uploadUrl: string }>("/api/media/uploads", {
    owner: opts.owner,
    contentType,
    caption: opts.caption,
  });
  try {
    await put(uploadUrl, file, contentType, opts.onProgress, opts.signal);
    const { media } = await api<{ media: MediaView }>(`/api/media/uploads/${mediaId}/complete`, {});
    return media;
  } catch (e) {
    // Best effort: leave no pending row or object behind (24h cleanup covers the rest).
    await api(`/api/media/uploads/${mediaId}/abort`, {}).catch(() => {});
    throw e;
  }
}

export async function deleteMediaItem(mediaId: string) {
  const res = await fetch(`/api/media/${mediaId}`, { method: "DELETE" });
  if (!res.ok) throw new UploadError((await res.json().catch(() => ({}))).error ?? "המחיקה נכשלה.");
}
