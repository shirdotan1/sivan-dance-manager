"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";

interface ConfirmDialogProps {
  /** Visible label of the button that opens the dialog. */
  triggerLabel: ReactNode;
  /** Extra accessible text for the trigger (e.g. which item), visually hidden. */
  triggerContext?: string;
  triggerClassName?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** The safe button (default "ביטול"); set it when the action itself is a "ביטול…" so the two never read alike. */
  dismissLabel?: string;
  /** Runs when the user confirms (a Server Action call). Returning { error } keeps the dialog open and shows it. */
  onConfirm: () => Promise<{ error: string } | void> | { error: string } | void;
}

/**
 * Destructive-action confirmation using the native modal <dialog>:
 * the browser makes the page inert, traps focus, closes on Esc/back and
 * returns focus to the trigger. Focus starts on the safe "ביטול" button.
 */
export function ConfirmDialog({
  triggerLabel,
  triggerContext,
  triggerClassName = "btn btn-secondary btn-compact",
  title,
  description,
  confirmLabel,
  dismissLabel = "ביטול",
  onConfirm,
}: ConfirmDialogProps) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => {
          setError("");
          ref.current?.showModal();
        }}>
        {triggerLabel}
        {triggerContext && <span className="visually-hidden"> {triggerContext}</span>}
      </button>
      <dialog ref={ref} aria-labelledby={`${id}-title`} aria-describedby={`${id}-desc`} className="confirm-dialog">
        <h2 id={`${id}-title`} className="mb-2">
          {title}
        </h2>
        <div id={`${id}-desc`} className="mb-6 text-muted">
          {description}
        </div>
        <p role="alert" className="mb-4 text-sm font-medium text-danger empty:hidden">
          {error}
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-secondary" autoFocus onClick={() => ref.current?.close()}>
            {dismissLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError("");
                const result = await onConfirm();
                if (result && "error" in result) setError(result.error);
                else ref.current?.close();
              })
            }
          >
            {pending ? "רגע…" : confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
