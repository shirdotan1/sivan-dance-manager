"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MediaActions } from "@/components/media/MediaActions";
import type { MediaView } from "@/lib/data/media";
import { formatBytes } from "@/lib/format";
import { deleteMediaItem, uploadMedia } from "@/lib/media/upload";
import type { MediaOwner } from "@/lib/storage/r2";

const FREE_BYTES = 10e9; // R2 free tier (10 GB-month)
const tints = ["bg-brand-soft", "bg-success-soft", "bg-danger-soft"];

type QueueItem = { key: string; name: string; progress: number; state: "waiting" | "uploading" | "done" | "error"; error?: string };

/**
 * The lesson/session media section: a grid (photos open in a dialog, videos
 * play inline), download and share of each file, upload straight to
 * private storage with progress and cancel, and delete (file + item).
 */
export function MediaManager({ owner, items, usageBytes }: { owner: MediaOwner; items: MediaView[]; usageBytes: number }) {
  const id = useId();
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<MediaView | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uploading = queue.some((q) => q.state === "uploading" || q.state === "waiting");

  const label = (m: MediaView, i: number) => (m.caption ? m.caption : `${m.kind === "video" ? "סרטון" : "תמונה"} ${i + 1}`);
  const markBroken = (mediaId: string) => setBroken((s) => new Set(s).add(mediaId));

  // Photo dialog: open after render; light dismiss with a fallback where `closedby` is unsupported (Safari).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    if ("closedBy" in HTMLDialogElement.prototype) return;
    const onClick = (e: MouseEvent) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
      if (!inside) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, [open]);

  // While uploading: keep the phone's screen on (where supported) and warn before leaving the page.
  useEffect(() => {
    if (!uploading) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      if ("wakeLock" in navigator && document.visibilityState === "visible") {
        navigator.wakeLock.request("screen").then((l) => (lock = l), () => {});
      }
    };
    const onVisible = () => document.visibilityState === "visible" && acquire(); // the lock drops when the tab is hidden
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
      lock?.release().catch(() => {});
    };
  }, [uploading]);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement;
    const caption = (form.elements.namedItem("caption") as HTMLInputElement).value.trim();
    const files = Array.from(input.files ?? []);
    if (!files.length) {
      setError("יש לבחור קובץ אחד לפחות.");
      input.focus();
      return;
    }
    setError("");
    setStatus("");
    const controller = new AbortController();
    abortRef.current = controller;
    const batch: QueueItem[] = files.map((f) => ({ key: crypto.randomUUID(), name: f.name, progress: 0, state: "waiting" }));
    setQueue(batch);
    let ok = 0;
    for (const [i, file] of files.entries()) {
      const key = batch[i].key;
      const update = (patch: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      if (controller.signal.aborted) {
        update({ state: "error", error: "ההעלאה בוטלה." });
        continue;
      }
      update({ state: "uploading" });
      try {
        await uploadMedia(file, { owner, caption, signal: controller.signal, onProgress: (p) => update({ progress: p }) });
        update({ progress: 1, state: "done" });
        ok++;
        router.refresh();
      } catch (err) {
        update({ state: "error", error: err instanceof Error ? err.message : "ההעלאה נכשלה." });
      }
    }
    abortRef.current = null;
    const one = files.length === 1 ? (files[0].type.startsWith("video/") ? "הסרטון הועלה." : "התמונה הועלתה.") : `${ok} קבצים הועלו.`;
    setStatus(controller.signal.aborted ? `ההעלאה בוטלה. הועלו ${ok} מתוך ${files.length}.` : ok === files.length ? one : `הועלו ${ok} מתוך ${files.length}.`);
    if (ok === files.length) {
      form.reset();
      setQueue([]);
    }
  }

  /** A failure is shown inside the confirm dialog (it stays open). */
  async function onDelete(m: MediaView, name: string) {
    try {
      await deleteMediaItem(m.id);
      setStatus(`״${name}״ נמחק.`);
      router.refresh();
    } catch (err) {
      return { error: err instanceof Error ? err.message : "המחיקה נכשלה." };
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card card-section">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id={`${id}-h`}>מדיה ({items.length})</h2>
        <p className="text-sm text-muted">
          בשימוש באחסון: <bdi dir="ltr">{formatBytes(usageBytes)}</bdi> מתוך <bdi dir="ltr">{formatBytes(FREE_BYTES)}</bdi> בחינם
        </p>
      </div>

      {items.length === 0 ? (
        <p className="empty-state mb-5">אין עדיין תמונות או סרטונים.</p>
      ) : (
        <ul className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3" role="list">
          {items.map((m, i) => {
            const name = label(m, i);
            return (
              <li key={m.id} className={m.kind === "video" && m.url ? "col-span-2 sm:col-span-3" : undefined}>
                <figure className="grid gap-1">
                  {!m.url ? (
                    <div className={`flex aspect-square items-center justify-center rounded-lg text-4xl ${tints[i % tints.length]}`}>
                      <span aria-hidden="true">{m.kind === "video" ? "🎬" : "📷"}</span>
                    </div>
                  ) : broken.has(m.id) ? (
                    <div className="grid place-items-center gap-1 rounded-lg bg-danger-soft p-4 text-center text-sm">
                      <p>{m.kind === "video" ? "הפורמט של הסרטון לא נתמך בדפדפן הזה." : "הפורמט של התמונה לא נתמך בדפדפן הזה."}</p>
                      <p className="text-muted">אפשר להוריד או לשתף את הקובץ.</p>
                    </div>
                  ) : m.kind === "video" ? (
                    <video
                      className="media-video"
                      src={`${m.url}#t=0.1`}
                      controls
                      playsInline
                      preload="metadata"
                      width={640}
                      height={360}
                      aria-label={name}
                      onError={() => markBroken(m.id)}
                      {...({ loading: "lazy" } as object)}
                    />
                  ) : (
                    <button type="button" className="media-thumb" aria-label={`הגדלה: ${name}`} onClick={() => setOpen(m)}>
                      {/* Private signed URL: next/image would proxy and cache it publicly. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="" loading="lazy" decoding="async" onError={() => markBroken(m.id)} />
                    </button>
                  )}
                  <figcaption className="text-sm">
                    <span className="visually-hidden">{m.kind === "video" ? "סרטון: " : "תמונה: "}</span>
                    {m.caption}
                    {!m.url && <span className="block text-muted">מציין מקום — אין קובץ</span>}
                  </figcaption>
                  {m.url && <MediaActions item={m} name={name} />}
                  <div>
                    <ConfirmDialog
                      triggerLabel="מחיקה"
                      triggerContext={`של ${name}`}
                      title={m.url ? "למחוק את הקובץ?" : "למחוק את הפריט?"}
                      description={<p>{m.url ? "הקובץ יימחק מהאחסון לצמיתות. אי אפשר לבטל את זה." : "מציין המקום יוסר מהרשימה."}</p>}
                      confirmLabel="מחיקה"
                      onConfirm={() => onDelete(m, name)}
                    />
                  </div>
                </figure>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onUpload} aria-label="העלאת תמונות וסרטונים" className="grid gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-files`} className="font-medium">
            תמונות וסרטונים מהטלפון או מהמחשב
          </label>
          <input id={`${id}-files`} name="files" type="file" accept="image/*,video/*" multiple disabled={uploading} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-caption`} className="font-medium">
            כיתוב <span className="font-normal text-muted">(לא חובה)</span>
          </label>
          <input id={`${id}-caption`} name="caption" dir="auto" autoComplete="off" maxLength={200} disabled={uploading} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? "מעלה…" : "העלאה"}
          </button>
          {uploading && (
            <button type="button" className="btn btn-secondary" onClick={() => abortRef.current?.abort()}>
              ביטול ההעלאה
            </button>
          )}
        </div>
        {uploading && <p className="text-sm text-muted">כדאי להשאיר את העמוד פתוח עד שההעלאה מסתיימת.</p>}
        {queue.length > 0 && (
          <ul className="grid gap-2" role="list" aria-label="התקדמות ההעלאה">
            {queue.map((q) => (
              <li key={q.key} className="grid gap-1 text-sm">
                <span id={`${id}-q-${q.key}`} className="truncate">
                  <bdi>{q.name}</bdi>
                  {q.state === "uploading" && <span className="text-muted"> · {Math.round(q.progress * 100)}%</span>}
                  {q.state === "done" && <span className="text-success"> · ✓ הועלה</span>}
                  {q.state === "error" && <span className="text-danger"> · ⚠ {q.error}</span>}
                </span>
                <progress aria-labelledby={`${id}-q-${q.key}`} max={1} value={q.progress} className="w-full" />
              </li>
            ))}
          </ul>
        )}
        <p role="alert" className="text-sm font-medium text-danger empty:hidden">
          {error}
        </p>
      </form>
      <p role="status" className="mt-3 text-sm text-success empty:hidden">
        {status}
      </p>

      {open && (
        <dialog
          ref={dialogRef}
          className="media-lightbox"
          aria-label={open.caption || "תמונה"}
          {...({ closedby: "any" } as object)}
          onClose={() => setOpen(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt={open.caption || ""} />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
            <p className="text-sm">{open.caption}</p>
            <MediaActions item={open} name={open.caption || "תמונה"} />
            <button type="button" className="btn btn-secondary btn-compact" autoFocus onClick={() => dialogRef.current?.close()}>
              סגירה
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
