"use client";

import { useId, useState } from "react";
import { SwitchInput } from "@/components/SwitchInput";
import { formatCurrency } from "@/lib/format";
import type { Payment, Student } from "@/lib/types";

interface PaymentsFieldProps {
  /** The space's student pool (for names). */
  students: Student[];
  /** One payment row per participant. */
  participantIds: string[];
  initial: Payment[];
}

/**
 * Session payments inside the session form: amount + paid switch per
 * project participant, with a live paid-of-total summary. Submitted as
 * amount_<studentId> / paid_<studentId> fields.
 */
export function PaymentsField({ students, participantIds, initial }: PaymentsFieldProps) {
  const baseId = useId();
  const [payments, setPayments] = useState<Payment[]>(() =>
    participantIds.map(
      (studentId) => initial.find((p) => p.studentId === studentId) ?? { studentId, amount: 0, paid: false },
    ),
  );

  const update = (studentId: string, patch: Partial<Payment>) =>
    setPayments((prev) => prev.map((p) => (p.studentId === studentId ? { ...p, ...patch } : p)));

  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const paidTotal = payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "תלמידה";

  return (
    <fieldset className="card card-section">
      <legend className="card-legend">תשלומים</legend>
      <p className="mb-3 text-sm text-muted" aria-live="polite">
        שולמו {formatCurrency(paidTotal)} מתוך {formatCurrency(total)}
      </p>

      {payments.length === 0 ? (
        <p className="empty-state">אין משתתפות בפרויקט. אפשר להוסיף בעריכת הפרויקט.</p>
      ) : (
        <ul className="divider-list" role="list">
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
                        name={`amount_${payment.studentId}`}
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

                    {/* Switch above its status badge: same footprint for paid and unpaid,
                        so every row keeps the amount and switch side by side. */}
                    <div className="flex flex-col items-start gap-1">
                      <label htmlFor={paidId} className="flex cursor-pointer items-center gap-3 font-medium">
                        <SwitchInput
                          id={paidId}
                          name={`paid_${payment.studentId}`}
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
    </fieldset>
  );
}
