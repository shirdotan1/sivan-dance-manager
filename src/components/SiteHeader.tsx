"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "המרחבים שלי" },
  { href: "/songs", label: "בנק שירים" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
      <a href="#content" className="skip-link visually-hidden">
        דילוג לתוכן הראשי
      </a>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
        <Link href="/" className="text-lg font-bold text-brand-strong no-underline">
          השיעורים של סיון
        </Link>
        <nav aria-label="ראשי">
          <ul className="flex flex-wrap gap-1">
            {links.map(({ href, label }) => {
              const current =
                href === "/" ? pathname === "/" || pathname.startsWith("/spaces") : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    className="inline-flex items-center rounded-md px-3 py-1 font-medium text-foreground underline-offset-4 hover:bg-brand-soft aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong aria-[current=page]:underline aria-[current=page]:decoration-2"
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
