"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { formatCurrency, type Payment, type Student } from "@/data/demo";

// The HTML `switch` attribute isn't in React's types yet; pass it through as-is.
const switchAttr = { switch: "" } as InputHTMLAttributes<HTMLInputElement>;

interface PaymentsSectionProps {
  students: Student[];
  initial: Payment[];
}

/** Payments for a private lesson: amount + paid switch per student (in memory only). */
export function PaymentsSection({ students, initial }: PaymentsSectionProps) {
  const baseId = useId();
  const [payments, setPayments] = useState(initial);

  const update = (studentId: string, patch: Partial<Payment>) =>
    setPayments((prev) => prev.map((p) => (p.studentId === studentId ? { ...p, ...patch } : p)));

  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidTotal = payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "תלמידה";

  return (
    <section
      aria-labelledby={`${baseId}-heading`}
      className="mb-8 rounded-xl border border-border bg-surface p-4 sm:p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${baseId}-heading`} className="text-xl font-semibold">
          תשלומים
        </h2>
        <p className="text-sm text-muted">
          שולמו {formatCurrency(paidTotal)} מתוך {formatCurrency(total)}
        </p>
      </div>

      {payments.length === 0 ? (
        <p className="text-muted">אין תשלומים לשיעור הזה.</p>
      ) : (
        <ul className="divide-y divide-border" role="list">
          {payments.map((payment) => {
            const name = nameOf(payment.studentId);
            const amountId = `${baseId}-${payment.studentId}-amount`;
            const paidId = `${baseId}-${payment.studentId}-paid`;
            return (
              <li key={payment.studentId} className="py-3">
                <fieldset className="grid gap-3">
                  <legend className="mb-2 font-semibold">{name}</legend>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <label htmlFor={amountId} className="text-sm font-medium">
                        סכום בש״ח
                      </label>
                      <input
                        id={amountId}
                        name={`amount-${payment.studentId}`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        autoComplete="off"
                        dir="ltr"
                        className="w-28 text-end"
                        value={payment.amount === 0 ? "" : String(payment.amount)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          update(payment.studentId, { amount: digits ? Number(digits) : 0 });
                        }}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <label htmlFor={paidId} className="flex cursor-pointer items-center gap-3 font-medium">
                        <input
                          {...switchAttr}
                          type="checkbox"
                          id={paidId}
                          name={`paid-${payment.studentId}`}
                          checked={payment.paid}
                          onChange={(e) => update(payment.studentId, { paid: e.target.checked })}
                        />
                        שולם
                      </label>
                      {/* Visual, non-color status cue; the switch state is announced natively. */}
                      <span
                        aria-hidden="true"
                        className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${
                          payment.paid ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
                        }`}
                      >
                        {payment.paid ? "✓ שולם" : "✗ טרם שולם"}
                      </span>
                    </div>
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted">שינויים כאן נשמרים רק בזיכרון ויתאפסו ברענון (דמו).</p>
    </section>
  );
}
