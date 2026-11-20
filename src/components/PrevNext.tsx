import Link from "next/link";
import { formatDate } from "@/lib/format";

interface Neighbor {
  href: string;
  date: string;
}

/**
 * Previous / next navigation between lessons of a space or sessions of a
 * project ("previous" = earlier date). In RTL the earlier one sits on the right.
 */
export function PrevNext({ prev, next, noun }: { prev?: Neighbor; next?: Neighbor; noun: string }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label={`מעבר בין ${noun}`} className="mb-6 grid grid-cols-2 gap-3">
      {prev ? (
        <Link href={prev.href} className="card card-link py-3! text-start">
          <span className="block text-sm text-muted">
            <span aria-hidden="true">→ </span>הקודם
          </span>
          <span className="font-medium">{formatDate(prev.date)}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="card card-link py-3! text-end">
          <span className="block text-sm text-muted">
            הבא<span aria-hidden="true"> ←</span>
          </span>
          <span className="font-medium">{formatDate(next.date)}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
