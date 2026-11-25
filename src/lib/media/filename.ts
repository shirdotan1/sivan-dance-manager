import type { MediaKind } from "@/lib/types";

/**
 * File names for media downloads and shares. The original name is not kept
 * (objects are stored as <uuid>.<ext>), so a name is built from what is:
 * the caption — or "תמונה"/"סרטון" without one — the lesson's or session's
 * date, and the extension of the stored content type.
 * Shared by the server (Content-Disposition) and the browser (the shared File).
 */

/** Stored content type → extension (also the extension of the object key). */
export const MEDIA_EXTENSIONS: Record<string, string> = {
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

export const extensionFor = (contentType: string | null | undefined) => (contentType && MEDIA_EXTENSIONS[contentType]) || "bin";

const MAX_BASE = 80;

/** Characters no file system accepts, control and bidi-override characters, then tidy spaces and dots. */
function clean(s: string) {
  return s
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, MAX_BASE)
    .trim();
}

export type MediaFileName = {
  /** The real name (may be Hebrew). */
  name: string;
  /** ASCII-only fallback for clients that ignore filename*. */
  ascii: string;
};

export function mediaFileName(input: { caption: string; kind: MediaKind; date: string | null; contentType: string | null | undefined }): MediaFileName {
  const ext = extensionFor(input.contentType);
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? ` ${input.date}` : "";
  const base = clean(input.caption) || (input.kind === "video" ? "סרטון" : "תמונה");
  const asciiBase = /^[\x20-\x7e]+$/.test(base) ? base : input.kind === "video" ? "video" : "photo";
  return { name: `${base}${date}.${ext}`, ascii: `${asciiBase}${date}.${ext}` };
}

/** RFC 5987 ext-value: percent-encode everything outside attr-char. */
const encodeRfc5987 = (s: string) => encodeURIComponent(s).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** `attachment` with an ASCII filename and the real one as filename* (RFC 6266 / 5987). */
export function attachmentDisposition(f: MediaFileName) {
  return `attachment; filename="${f.ascii}"; filename*=UTF-8''${encodeRfc5987(f.name)}`;
}
