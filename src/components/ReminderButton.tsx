"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { normalizePhone } from "@/lib/phone";
import { payable, reminderMessage, whatsappLink, type DebtLine, type Recipient } from "@/lib/reminders";

interface Props {
  studentId: string;
  studentName: string;
  phone: string;
  parentName?: string;
  parentPhone?: string;
  lines: DebtLine[];
}

/**
 * "תזכורת בוואטסאפ": one message gathering all of a student's open debts.
 * A confirm step inside the site first — recipient name, relation and the
 * full international number; with two valid numbers the choice is an
 * explicit click; an invalid or missing number is explained and gets no
 * link. WhatsApp opens with the message ready; Sivan sends it herself.
 */
export function ReminderButton({ studentId, studentName, phone, parentName, parentPhone, lines }: Props) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState<Recipient | null>(null);
  const debts = payable(lines);
  const options = [
    { key: "student" as const, relation: "התלמידה", name: studentName, raw: phone },
    { key: "parent" as const, relation: "ההורה", name: parentName || "הורה", raw: parentPhone ?? "" },
  ].map((o) => ({ ...o, check: normalizePhone(o.raw) }));
  const valid = options.filter((o) => o.check.ok);
  const recipient = valid.length === 1 ? valid[0] : valid.find((o) => o.key === chosen);

  // Light dismiss where `closedby` is unsupported (Safari).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;
    const onClick = (e: MouseEvent) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (!(r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right)) dialog.close();
    };
    dialog.addEventListener("click", onClick);
    return () => dialog.removeEventListener("click", onClick);
  }, []);

  if (!debts.length) return null;
  const message = recipient
    ? reminderMessage({ to: recipient.key, studentName, parentName, lines: debts })
    : null;

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-compact"
        onClick={() => {
          setChosen(null);
          ref.current?.showModal();
        }}
      >
        תזכורת בוואטסאפ<span className="visually-hidden"> ל{studentName}</span>
      </button>
      <dialog ref={ref} aria-labelledby={`${id}-title`} className="confirm-dialog" {...({ closedby: "any" } as object)}>
        <h2 id={`${id}-title`} className="mb-3">
          תזכורת לתשלום — {studentName}
        </h2>

        {valid.length === 2 && (
          <fieldset className="mb-4 grid gap-2">
            <legend className="mb-1 font-medium">למי לשלוח?</legend>
            {valid.map((o) => (
              <label key={o.key} className="flex items-center gap-2">
                <input type="radio" name={`${id}-to`} value={o.key} checked={chosen === o.key} onChange={() => setChosen(o.key)} />
                <span>
                  {o.relation}: {o.name} · <bdi dir="ltr" className="whitespace-nowrap">{o.check.ok && o.check.display}</bdi>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {options
          .filter((o) => !o.check.ok && o.raw.trim())
          .map((o) => (
            <p key={o.key} className="mb-2 rounded-2xl bg-coral-soft p-3 text-sm">
              {o.relation} ({o.name}): {!o.check.ok && o.check.message}
            </p>
          ))}

        {valid.length === 0 ? (
          <p className="mb-4 text-sm font-medium">
            אין מספר שוואטסאפ יכול לפתוח.{" "}
            <Link href={`/students/${studentId}`} className="tap-link text-brand-strong underline underline-offset-4">
              לתיקון בכרטיס התלמידה
            </Link>
          </p>
        ) : recipient && message ? (
          <>
            <p role="status" className="mb-3 font-medium">
              נמען: {recipient.name} ({recipient.relation}) · <bdi dir="ltr" className="whitespace-nowrap">{recipient.check.ok && recipient.check.display}</bdi>
            </p>
            <p className="mb-1 text-sm text-muted">ההודעה (אפשר לערוך בוואטסאפ לפני השליחה):</p>
            <pre dir="rtl" className="mb-4 rounded-2xl border border-border p-3 text-sm whitespace-pre-wrap" style={{ fontFamily: "inherit" }}>
              {message}
            </pre>
          </>
        ) : (
          <p className="mb-4 text-sm">יש לבחור למי לשלוח.</p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-secondary" autoFocus onClick={() => ref.current?.close()}>
            סגירה
          </button>
          {recipient?.check.ok && message && (
            <a href={whatsappLink(recipient.check.international, message)} target="_blank" rel="noopener" className="btn btn-primary">
              פתיחה בוואטסאפ
            </a>
          )}
        </div>
      </dialog>
    </>
  );
}
