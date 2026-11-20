"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteLesson } from "@/lib/actions/lessons";

export function DeleteLessonButton({ spaceId, lessonId, label }: { spaceId: string; lessonId: string; label: string }) {
  return (
    <ConfirmDialog
      triggerLabel="מחיקת השיעור"
      title="למחוק את השיעור?"
      description={
        <p>
          השיעור של {label} יימחק עם רשימת המשתתפות, החומרים, ההערות והמדיה שלו. התלמידות והחומרים בבנק נשארים.
        </p>
      }
      confirmLabel="מחיקת השיעור"
      onConfirm={() => deleteLesson(spaceId, lessonId)}
    />
  );
}
