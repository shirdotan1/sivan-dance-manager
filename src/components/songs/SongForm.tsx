"use client";

import { useActionState, useId } from "react";
import { SongLinkField } from "@/components/songs/SongLinkField";
import { initialActionState, type ActionState } from "@/lib/actions/result";
import type { Song } from "@/lib/types";

interface SongFormProps {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  song?: Song;
  submitLabel: string;
  label: string;
}

/** Full song form (bank page): title, artist, style, link, personal note. */
export function SongForm({ action, song, submitLabel, label }: SongFormProps) {
  const id = useId();
  const [state, formAction, pending] = useActionState(action, initialActionState);

  return (
    <>
      <form key={song ? undefined : state.done} action={formAction} aria-label={label} className="grid gap-4 px-4 pb-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-title`} className="font-medium">
            שם השיר <span aria-hidden="true">*</span>
          </label>
          <input id={`${id}-title`} name="title" required dir="auto" autoComplete="off" enterKeyHint="next" defaultValue={song?.title} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-artist`} className="font-medium">
              מבצע/ת
            </label>
            <input id={`${id}-artist`} name="artist" dir="auto" autoComplete="off" enterKeyHint="next" defaultValue={song?.artist} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-style`} className="font-medium">
              סגנון
            </label>
            <input id={`${id}-style`} name="style" autoComplete="off" enterKeyHint="next" defaultValue={song?.style} />
          </div>
        </div>
        <SongLinkField defaultValue={song?.link} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-note`} className="font-medium">
            הערה אישית
          </label>
          <textarea id={`${id}-note`} name="note" rows={2} dir="auto" defaultValue={song?.note} />
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
