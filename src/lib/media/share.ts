/**
 * Sharing a media item as the file itself (Web Share API with files) —
 * never its signed URL, which expires and would not work for the recipient.
 * Browser-only helpers; `nav` is passed in so tests can stand in for it.
 */

/** The parts of `navigator` this module uses. */
export type ShareNavigator = {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
  userActivation?: { isActive: boolean };
};

/**
 * Whether this browser can share a file of this name and type. Decided per
 * item: a browser may share photos but refuse a format (e.g. a .mov video).
 * An empty File of the same name and type is enough to ask.
 */
export function canShareFile(nav: ShareNavigator | undefined, name: string, type: string): boolean {
  if (!nav || typeof nav.canShare !== "function" || typeof nav.share !== "function") return false;
  try {
    return nav.canShare({ files: [new File([], name, { type })] });
  } catch {
    return false;
  }
}

/** What is shared: the file, and the caption as the text when there is one. */
export function shareData(file: File, caption: string): ShareData {
  const text = caption.trim();
  return text ? { files: [file], text } : { files: [file] };
}

/** The tap that started the share has expired (its transient activation is used up or timed out). */
export const activationExpired = (nav: ShareNavigator) => nav.userActivation?.isActive === false;

export type ShareOutcome = "shared" | "cancelled" | "needs-tap";

/**
 * Opens the share sheet with the file. "cancelled": the user closed it.
 * "needs-tap": the browser wants a fresh tap (the download outlived the
 * first one) — the caller asks for a second tap. Anything else throws.
 */
export async function shareFile(nav: ShareNavigator, file: File, caption: string): Promise<ShareOutcome> {
  try {
    await nav.share!(shareData(file, caption));
    return "shared";
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "AbortError") return "cancelled";
    if (name === "NotAllowedError") return "needs-tap";
    throw e;
  }
}

/**
 * Fetches the file for sharing, with progress (0..1) against the known size.
 * `url` is the app's download route: access is checked and the signed URL
 * is fresh at the moment of the tap.
 */
export async function fetchMediaFile(
  url: string,
  opts: { name: string; type: string; size?: number; signal?: AbortSignal; onProgress?: (p: number) => void },
): Promise<File> {
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok || !res.body) throw new Error(res.status === 401 ? "יש להתחבר מחדש." : "הורדת הקובץ לשיתוף נכשלה. כדאי לנסות שוב.");
  const total = opts.size || Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total) opts.onProgress?.(Math.min(received / total, 1));
  }
  return new File(chunks, opts.name, { type: opts.type });
}
