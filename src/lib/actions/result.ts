/** Result returned by form Server Actions to useActionState. */
export interface ActionState {
  /** Shown in a polite status region on success. */
  message?: string;
  /** Shown as an error (role="alert"). */
  error?: string;
  /** Increments on success so forms can reset (used as a React key). */
  done?: number;
  /** Per-field errors (field name → message), shown next to the field. */
  fieldErrors?: Record<string, string>;
}

export const initialActionState: ActionState = {};

/** Reads a trimmed string field from FormData. */
export function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

/** All string values for a repeated field (e.g. checkboxes / hidden inputs). */
export function fields(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}
