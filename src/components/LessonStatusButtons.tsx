"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cancelLesson, restoreLesson } from "@/lib/actions/lessons";

/** "ביטול המופע הזה" — one occurrence of a weekly slot (kept, marked cancelled). */
export function CancelLessonButton({ spaceId, lessonId, label }: { spaceId: string; lessonId: string; label: string }) {
  return (
    <ConfirmDialog
      triggerLabel="ביטול המופע הזה"
      title="לבטל את השיעור הזה?"
      description={
        <p>
          השיעור של {label} יסומן כמבוטל ויישאר ברשימות ובלוח השנה; המשבצת לא תיצור אותו מחדש. שאר השיעורים של המשבצת לא משתנים, ואפשר
          להחזיר אותו בכל רגע.
        </p>
      }
      confirmLabel="ביטול המופע הזה"
      dismissLabel="השארת השיעור"
      onConfirm={() => cancelLesson(spaceId, lessonId)}
    />
  );
}

/** Undo a cancellation (one tap; not destructive). */
export function RestoreLessonButton({ spaceId, lessonId }: { spaceId: string; lessonId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        className="btn btn-secondary btn-compact"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError("");
            const r = await restoreLesson(spaceId, lessonId);
            if (r?.error) setError(r.error);
          })
        }
      >
        {pending ? "מחזירה…" : "ביטול הביטול"}
      </button>
      <span role="alert" className="text-sm font-medium text-danger empty:hidden">
        {error}
      </span>
    </span>
  );
}
