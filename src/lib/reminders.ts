/**
 * WhatsApp payment reminders (private space). One message per student that
 * gathers all her open debts; Sivan opens it in WhatsApp, can edit it there,
 * and sends it herself — nothing is sent automatically.
 *
 * The two drafts below (to the student / to a parent) are proposals: the PM
 * reviews the structure and Sivan approves the final wording.
 */
export interface DebtLine {
  projectName: string;
  /** ISO date of the session. */
  date: string;
  amount: number;
}

export type Recipient = "student" | "parent";

const shekels = (n: number) => `${n.toLocaleString("he-IL")} ₪`;
const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}`;
const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

/** Only lines with something to pay (an unpaid ₪0 is not a debt to remind about). */
export const payable = (lines: DebtLine[]) => lines.filter((l) => l.amount > 0);

export function reminderMessage(opts: { to: Recipient; studentName: string; parentName?: string; lines: DebtLine[] }): string {
  const lines = payable(opts.lines).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const greeting =
    opts.to === "parent"
      ? `היי${opts.parentName ? ` ${firstName(opts.parentName)}` : ""}, תזכורת קטנה לגבי התשלום על המפגשים של ${firstName(opts.studentName)}:`
      : `היי ${firstName(opts.studentName)}, תזכורת קטנה לגבי התשלום על המפגשים:`;
  return [
    greeting,
    ...lines.map((l) => `• ${l.projectName} — ${dayMonth(l.date)} — ${shekels(l.amount)}`),
    `סה״כ לתשלום: ${shekels(total)}`,
    "תודה, סיון",
  ].join("\n");
}

/** wa.me link: international digits + the whole message encoded (Hebrew, spaces, punctuation, new lines). */
export function whatsappLink(internationalDigits: string, message: string): string {
  return `https://wa.me/${internationalDigits}?text=${encodeURIComponent(message)}`;
}
