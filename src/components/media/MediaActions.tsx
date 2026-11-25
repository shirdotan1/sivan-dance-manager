"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MediaView } from "@/lib/data/media";
import { formatBytes } from "@/lib/format";
import { activationExpired, canShareFile, fetchMediaFile, shareFile } from "@/lib/media/share";

const noSubscribe = () => () => {};

type ShareState = { step: "idle" } | { step: "loading"; progress: number } | { step: "ready"; file: File };

/**
 * "הורדה" and "שיתוף" for one media item with a file.
 * Download: a plain link to the download route (access check → signed URL
 * served as an attachment). Share: the file itself via the Web Share API,
 * shown only where this browser can share a file of this type. One tap
 * fetches it (progress, cancel) and shares at once while that tap still
 * counts; otherwise the button becomes "הקובץ מוכן: שיתוף" for a second tap.
 */
export function MediaActions({ item, name }: { item: MediaView; name: string }) {
  const [state, setState] = useState<ShareState>({ step: "idle" });
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const href = `/api/media/${item.id}/download`;
  const fileName = item.fileName ?? name;
  const type = item.contentType ?? "";

  // Decided by the browser; false on the server and during hydration (never a dead button).
  const canShare = useSyncExternalStore(
    noSubscribe,
    () => canShareFile(navigator, fileName, type),
    () => false,
  );
  useEffect(() => () => abortRef.current?.abort(), []);

  async function share(file: File) {
    const outcome = await shareFile(navigator, file, item.caption);
    if (outcome === "needs-tap") {
      setState({ step: "ready", file });
      setStatus("הקובץ מוכן. לחיצה נוספת על ״הקובץ מוכן: שיתוף״ תפתח את השיתוף.");
      return;
    }
    setState({ step: "idle" });
    setStatus(outcome === "shared" ? "" : "השיתוף בוטל.");
  }

  async function onShare() {
    try {
      if (state.step === "ready") {
        setStatus("פותח את השיתוף…");
        return await share(state.file);
      }
      if (state.step === "loading") return;
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ step: "loading", progress: 0 });
      setStatus(`מכין את הקובץ לשיתוף${item.sizeBytes ? ` (${formatBytes(item.sizeBytes)})` : ""}…`);
      const file = await fetchMediaFile(href, {
        name: fileName,
        type,
        size: item.sizeBytes,
        signal: controller.signal,
        onProgress: (progress) => setState({ step: "loading", progress }),
      });
      abortRef.current = null;
      if (activationExpired(navigator)) {
        setState({ step: "ready", file });
        setStatus("הקובץ מוכן. לחיצה נוספת על ״הקובץ מוכן: שיתוף״ תפתח את השיתוף.");
        return;
      }
      setStatus("הקובץ מוכן, פותח את השיתוף…");
      await share(file);
    } catch (e) {
      abortRef.current = null;
      setState({ step: "idle" });
      if ((e as { name?: string })?.name === "AbortError") return setStatus("הכנת הקובץ לשיתוף בוטלה.");
      setStatus(e instanceof Error && /[֐-׿]/.test(e.message) ? e.message : "השיתוף נכשל. כדאי לנסות שוב.");
    }
  }

  const loading = state.step === "loading";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={href} className="btn btn-secondary btn-compact">
        הורדה<span className="visually-hidden"> של {name}</span>
      </a>
      {canShare && (
        <button type="button" className="btn btn-secondary btn-compact" onClick={onShare} aria-disabled={loading || undefined}>
          {state.step === "ready" ? "הקובץ מוכן: שיתוף" : loading ? `מכין… ${Math.round(state.progress * 100)}%` : "שיתוף"}
          <span className="visually-hidden"> של {name}</span>
        </button>
      )}
      {loading && (
        <button type="button" className="btn btn-secondary btn-compact" onClick={() => abortRef.current?.abort()}>
          ביטול<span className="visually-hidden"> הכנת השיתוף של {name}</span>
        </button>
      )}
      <p role="status" className="w-full text-sm text-muted empty:hidden">
        {status}
      </p>
    </div>
  );
}
