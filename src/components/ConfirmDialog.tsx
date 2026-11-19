"use client";

import { useId, useRef, useTransition, type ReactNode } from "react";

interface ConfirmDialogProps {
  /** Visible label of the button that opens the dialog. */
  triggerLabel: ReactNode;
  /** Extra accessible text for the trigger (e.g. which item), visually hidden. */
  triggerContext?: string;
  triggerClassName?: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** Runs when the user confirms (a Server Action call). */
  onConfirm: () => Promise<void> | void;
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
  onConfirm,
}: ConfirmDialogProps) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>
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
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-secondary" autoFocus onClick={() => ref.current?.close()}>
            ביטול
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await onConfirm();
                ref.current?.close();
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
