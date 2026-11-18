import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumb trail; the last crumb is the current page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="פירורי לחם" className="mb-2 text-sm">
      <ol className="flex flex-wrap gap-1 text-muted">
        <li>
          <Link href="/" className="underline underline-offset-4">
            המרחבים שלי
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`}>
              <span aria-hidden="true">‹ </span>
              {item.href && !isLast ? (
                <Link href={item.href} className="underline underline-offset-4">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
