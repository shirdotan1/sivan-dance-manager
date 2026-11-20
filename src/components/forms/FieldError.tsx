"use client";

import { useEffect } from "react";
import type { ActionState } from "@/lib/actions/result";

/** Error text shown right under a field (icon has a text alternative). */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-medium text-danger">
      <span role="img" aria-label="שגיאה">
        ⚠️
      </span>{" "}
      {message}
    </p>
  );
}

/**
 * After a failed submit, move focus to the first field (in form order) that
 * has a server error. `targets` maps field name → element id.
 */
export function useFocusFirstError(state: ActionState, targets: [field: string, elementId: string][]) {
  useEffect(() => {
    if (!state.fieldErrors) return;
    const first = targets.find(([field]) => state.fieldErrors?.[field]);
    if (!first) return;
    const el = document.getElementById(first[1]);
    el?.scrollIntoView({ block: "center" });
    el?.focus({ preventScroll: true });
    // Only when a new result arrives (state is a new object per submit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

/** Props for a field with an optional error: aria-invalid + describedby (hint, then error). */
export function errorProps(baseId: string, field: string, state: ActionState, hintId?: string) {
  const message = state.fieldErrors?.[field];
  const describedBy = [hintId, message ? `${baseId}-${field}-error` : undefined].filter(Boolean).join(" ");
  return {
    "aria-invalid": message ? true : undefined,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  } as const;
}
