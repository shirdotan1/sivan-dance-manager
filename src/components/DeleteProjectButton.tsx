"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteProject } from "@/lib/actions/projects";

export function DeleteProjectButton({ projectId, name, sessions }: { projectId: string; name: string; sessions: number }) {
  return (
    <ConfirmDialog
      triggerLabel="מחיקת הפרויקט"
      title={`למחוק את ״${name}״?`}
      description={
        <p>
          הפרויקט יימחק יחד עם {sessions} המפגשים שלו והתשלומים שנרשמו בהם. התלמידות והחומרים בבנק נשארים. אי אפשר לבטל את זה.
        </p>
      }
      confirmLabel="מחיקת הפרויקט"
      onConfirm={() => deleteProject(projectId)}
    />
  );
}
