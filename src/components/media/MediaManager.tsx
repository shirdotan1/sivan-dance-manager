"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { MediaView } from "@/lib/data/media";
import { formatBytes } from "@/lib/format";
import { deleteMediaItem, uploadMedia } from "@/lib/media/upload";
import type { MediaOwner } from "@/lib/storage/r2";

const FREE_BYTES = 10e9; // R2 free tier (10 GB-month)
const tints = ["bg-brand-soft", "bg-success-soft", "bg-danger-soft"];

type QueueItem = { key: string; name: string; progress: number; state: "uploading" | "done" | "error"; error?: string };

/**
 * The lesson/session media section: a grid (photos open in a dialog), upload
 * straight to private storage with progress, and delete (file + item).
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
  const uploading = queue.some((q) => q.state === "uploading");

  const label = (m: MediaView, i: number) => (m.caption ? m.caption : `${m.kind === "video" ? "סרטון" : "תמונה"} ${i + 1}`);

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

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement;
    const caption = (form.elements.namedItem("caption") as HTMLInputElement).value.trim();
    const files = Array.from(input.files ?? []);
    if (!files.length) {
      setError("יש לבחור תמונה אחת לפחות.");
      input.focus();
      return;
    }
    setError("");
    setStatus("");
    const batch = files.map((f) => ({ key: crypto.randomUUID(), name: f.name, progress: 0, state: "uploading" as const }));
    setQueue(batch);
    let ok = 0;
    for (const [i, file] of files.entries()) {
      const key = batch[i].key;
      const update = (patch: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      try {
        await uploadMedia(file, { owner, caption, onProgress: (p) => update({ progress: p }) });
        update({ progress: 1, state: "done" });
        ok++;
        router.refresh();
      } catch (err) {
        update({ state: "error", error: err instanceof Error ? err.message : "ההעלאה נכשלה." });
      }
    }
    setStatus(ok === files.length ? `${ok === 1 ? "התמונה הועלתה" : `${ok} תמונות הועלו`}.` : `הועלו ${ok} מתוך ${files.length}.`);
    if (ok === files.length) {
      form.reset();
      setQueue([]);
    }
  }

  async function onDelete(m: MediaView, name: string) {
    setError("");
    try {
      await deleteMediaItem(m.id);
      setStatus(`״${name}״ נמחק.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "המחיקה נכשלה.");
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
              <li key={m.id}>
                <figure className="grid gap-1">
                  {!m.url ? (
                    <div className={`flex aspect-square items-center justify-center rounded-lg text-4xl ${tints[i % tints.length]}`}>
                      <span aria-hidden="true">{m.kind === "video" ? "🎬" : "📷"}</span>
                    </div>
                  ) : broken.has(m.id) ? (
                    <div className="flex aspect-square items-center justify-center rounded-lg bg-danger-soft p-3 text-center text-sm">
                      הפורמט של התמונה לא נתמך בדפדפן הזה.
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="media-thumb"
                      aria-label={`הגדלה: ${name}`}
                      onClick={() => setOpen(m)}
                    >
                      {/* Private signed URL: next/image would proxy and cache it publicly. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onError={() => setBroken((s) => new Set(s).add(m.id))}
                      />
                    </button>
                  )}
                  <figcaption className="text-sm">
                    <span className="visually-hidden">{m.kind === "video" ? "סרטון: " : "תמונה: "}</span>
                    {m.caption}
                    {!m.url && <span className="block text-muted">מציין מקום — אין קובץ</span>}
                  </figcaption>
                  <ConfirmDialog
                    triggerLabel="מחיקה"
                    triggerContext={`של ${name}`}
                    title={m.url ? "למחוק את הקובץ?" : "למחוק את הפריט?"}
                    description={<p>{m.url ? "הקובץ יימחק מהאחסון לצמיתות. אי אפשר לבטל את זה." : "מציין המקום יוסר מהרשימה."}</p>}
                    confirmLabel="מחיקה"
                    onConfirm={() => onDelete(m, name)}
                  />
                </figure>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onUpload} aria-label="העלאת תמונות" className="grid gap-3 rounded-2xl border border-border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-files`} className="font-medium">
            תמונות מהטלפון או מהמחשב
          </label>
          <input id={`${id}-files`} name="files" type="file" accept="image/*" multiple disabled={uploading} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-caption`} className="font-medium">
            כיתוב <span className="font-normal text-muted">(לא חובה)</span>
          </label>
          <input id={`${id}-caption`} name="caption" dir="auto" autoComplete="off" maxLength={200} disabled={uploading} />
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? "מעלה…" : "העלאה"}
          </button>
        </div>
        {queue.length > 0 && (
          <ul className="grid gap-2" role="list" aria-label="התקדמות ההעלאה">
            {queue.map((q) => (
              <li key={q.key} className="grid gap-1 text-sm">
                <span id={`${id}-q-${q.key}`} className="truncate">
                  <bdi>{q.name}</bdi>
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
          <div className="flex items-center justify-between gap-3 pt-3">
            <p className="text-sm">{open.caption}</p>
            <button type="button" className="btn btn-secondary btn-compact" autoFocus onClick={() => dialogRef.current?.close()}>
              סגירה
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
