"use client";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { deleteSession } from "@/lib/actions/sessions";

export function DeleteSessionButton({ projectId, sessionId, label }: { projectId: string; sessionId: string; label: string }) {
  return (
    <ConfirmDialog
      triggerLabel="מחיקת המפגש"
      title="למחוק את המפגש?"
      description={<p>המפגש של {label} יימחק עם התשלומים, השירים, ההערות והמדיה שלו.</p>}
      confirmLabel="מחיקת המפגש"
      onConfirm={() => deleteSession(projectId, sessionId)}
    />
  );
}
