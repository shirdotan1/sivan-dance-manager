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
          השיעור של {label} יימחק עם רשימת המשתתפות, השירים, ההערות והמדיה שלו. התלמידות והשירים עצמם נשארים.
        </p>
      }
      confirmLabel="מחיקת השיעור"
      onConfirm={() => deleteLesson(spaceId, lessonId)}
    />
  );
}
