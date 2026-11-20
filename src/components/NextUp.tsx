import Link from "next/link";
import type { CalendarEvent } from "@/lib/data/queries";
import { formatCurrency, formatDate, todayIso } from "@/lib/format";

/** Home "next up": the coming lesson or session, and the open payments total. */
export function NextUp({ next, openTotal }: { next?: CalendarEvent; openTotal: number }) {
  return (
    <section aria-labelledby="next-up-h" className="card mb-8 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <h2 id="next-up-h" className="mb-2">
          הבא בתור
        </h2>
        {next ? (
          <Link href={next.href} className="flex items-center gap-3 no-underline hover:underline">
            <span aria-hidden="true" className="h-12 w-1.5 shrink-0 rounded-full" style={{ background: next.color }} />
            <span>
              <span className="block font-semibold">
                {next.label}
                <span className="font-normal text-muted"> · {next.kind === "lesson" ? "שיעור" : "מפגש"} · {next.context}</span>
              </span>
              <span className="text-sm">
                {next.date === todayIso() ? "היום" : formatDate(next.date)}, בשעה{" "}
                <time dateTime={`${next.date}T${next.time}`} dir="ltr">
                  {next.time}
                </time>
              </span>
            </span>
          </Link>
        ) : (
          <p className="text-muted">
            אין שיעורים או מפגשים קרובים.{" "}
            <Link href={`/calendar?day=${todayIso()}`} className="tap-link text-brand-strong underline underline-offset-4">
              + שיעור חדש מלוח השנה
            </Link>
          </p>
        )}
      </div>
      <Link
        href="/spaces/private-lessons/payments"
        className="flex flex-col rounded-2xl border border-border px-4 py-3 no-underline hover:border-brand"
      >
        <span className="text-sm text-muted">תשלומים פתוחים</span>
        <span className={`text-lg font-extrabold ${openTotal > 0 ? "text-danger" : "text-success"}`}>
          {openTotal > 0 ? formatCurrency(openTotal) : "✓ אין"}
        </span>
      </Link>
    </section>
  );
}
