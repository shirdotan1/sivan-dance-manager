"use client";

import { useId, useState } from "react";
import { KindPicker } from "@/components/materials/KindPicker";
import { MaterialLinkField } from "@/components/materials/MaterialLinkField";
import type { ActionState } from "@/lib/actions/result";
import { useActionForm } from "@/lib/actions/useActionForm";
import type { Material, MaterialKind } from "@/lib/types";

interface MaterialFormProps {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  material?: Material;
  submitLabel: string;
  label: string;
}

/** Full material form (bank page). Song is pre-selected; fields follow the kind. */
export function MaterialForm({ action, material, submitLabel, label }: MaterialFormProps) {
  const id = useId();
  const { state, onSubmit, pending } = useActionForm(action);
  const [kind, setKind] = useState<MaterialKind>(material?.kind ?? "song");
  const isSong = kind === "song";
  // The link survives switching kind (the field remounts to apply the new rules).
  const [linkValue, setLinkValue] = useState(material?.link ?? "");

  return (
    <>
      <form key={material ? undefined : state.done} onSubmit={onSubmit} aria-label={label} className="grid gap-4 px-4 pb-4">
        <KindPicker value={kind} onChange={setKind} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-title`} className="font-medium">
            {isSong ? "שם השיר" : "כותרת"} {isSong || kind === "note" ? <span aria-hidden="true">*</span> : null}
          </label>
          <input
            id={`${id}-title`}
            name="title"
            required={isSong || kind === "note"}
            dir="auto"
            autoComplete="off"
            enterKeyHint="next"
            defaultValue={material?.title}
          />
          {!isSong && kind !== "note" && <span className="text-sm text-muted">אם משאירים ריק, הכותרת נלקחת מהלינק.</span>}
        </div>
        {isSong && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-artist`} className="font-medium">
                מבצע/ת
              </label>
              <input id={`${id}-artist`} name="artist" dir="auto" autoComplete="off" enterKeyHint="next" defaultValue={material?.artist} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-style`} className="font-medium">
                סגנון
              </label>
              <input id={`${id}-style`} name="style" autoComplete="off" enterKeyHint="next" defaultValue={material?.style} />
            </div>
          </div>
        )}
        {/* key: re-run the link rules when the kind changes; the typed link is kept */}
        <div
          onInput={(e) => {
            const el = e.target as HTMLInputElement;
            if (el.name === "link") setLinkValue(el.value);
          }}
        >
          <MaterialLinkField key={kind} kind={kind} defaultValue={linkValue} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-note`} className="font-medium">
            {kind === "note" ? "תוכן ההערה" : "הערה אישית"}
          </label>
          <textarea id={`${id}-note`} name="note" rows={kind === "note" ? 5 : 2} dir="auto" defaultValue={material?.note} />
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "שומרת…" : submitLabel}
          </button>
        </div>
      </form>
      <p role="status" className="px-4 pb-3 text-sm text-success empty:hidden">
        {state.message}
      </p>
      <p role="alert" className="px-4 pb-3 text-sm font-medium text-danger empty:hidden">
        {state.error}
      </p>
    </>
  );
}
