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
    <header className="safe-header sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-md">
      <a href="#content" className="skip-link visually-hidden">
        דילוג לתוכן הראשי
      </a>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
        <Link href="/" className="text-lg font-extrabold tracking-wide text-foreground no-underline">
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
                    className="relative inline-flex items-center rounded-full px-4 font-medium text-muted transition-colors hover:bg-brand-soft hover:text-brand-strong active:bg-brand-soft aria-[current=page]:font-bold aria-[current=page]:text-brand-strong aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-4 aria-[current=page]:after:bottom-1.5 aria-[current=page]:after:h-[3px] aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-coral"
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
