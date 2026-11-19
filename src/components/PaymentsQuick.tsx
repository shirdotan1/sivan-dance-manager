"use client";

import { useId, useOptimistic, useTransition } from "react";
import { StudentLink } from "@/components/StudentLink";
import { SwitchInput } from "@/components/SwitchInput";
import { setPaymentPaid } from "@/lib/actions/sessions";
import { formatCurrency } from "@/lib/format";
import type { Payment, Student } from "@/lib/types";

/**
 * Session page payments: one tap marks paid / not paid and saves right away
 * (optimistic, rolls back if saving fails). Amounts are edited in the form.
 */
export function PaymentsQuick({ sessionId, payments, students }: { sessionId: string; payments: Payment[]; students: Student[] }) {
  const id = useId();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(payments, (state, update: { studentId: string; paid: boolean }) =>
    state.map((p) => (p.studentId === update.studentId ? { ...p, paid: update.paid } : p)),
  );
  const nameOf = (sid: string) => students.find((s) => s.id === sid)?.name ?? "תלמידה";
  const total = optimistic.reduce((s, p) => s + p.amount, 0);
  const paidTotal = optimistic.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);

  return (
    <section aria-labelledby={`${id}-h`} className="card card-section">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-h`}>תשלומים</h2>
        <p className="text-sm text-muted" aria-live="polite">
          שולמו {formatCurrency(paidTotal)} מתוך {formatCurrency(total)}
        </p>
      </div>
      {optimistic.length === 0 ? (
        <p className="empty-state">אין תשלומים במפגש הזה. אפשר להוסיף בעריכה.</p>
      ) : (
        <ul className="divider-list" role="list">
          {optimistic.map((p) => (
            <li key={p.studentId} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span>
                <StudentLink student={{ id: p.studentId, name: nameOf(p.studentId) }} className="block font-semibold" />
                <span className="text-sm text-muted">{formatCurrency(p.amount)}</span>
              </span>
              <span className="flex flex-col items-start gap-1">
                <label htmlFor={`${id}-${p.studentId}`} className="flex cursor-pointer items-center gap-3 font-medium">
                  <SwitchInput
                    id={`${id}-${p.studentId}`}
                    checked={p.paid}
                    onChange={(e) => {
                      const paid = e.target.checked;
                      startTransition(async () => {
                        setOptimistic({ studentId: p.studentId, paid });
                        await setPaymentPaid(sessionId, p.studentId, paid);
                      });
                    }}
                  />
                  שולם<span className="visually-hidden"> — {nameOf(p.studentId)}</span>
                </label>
                <span
                  aria-hidden="true"
                  className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${p.paid ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
                >
                  {p.paid ? "✓ שולם" : "✗ טרם שולם"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
