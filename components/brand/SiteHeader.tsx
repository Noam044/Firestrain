"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const PAGES = [
  { href: "/carte", label: "Carte", short: "Carte" },
  { href: "/liste", label: "Liste des feux", short: "Liste" },
  { href: "/methode", label: "Méthode", short: "Méthode" },
] as const;

/** The site's bar on every page: the name back to the home page, and the three pages. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-rule bg-sheet">
      <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-5">
        <Link href="/" className="rounded-sm">
          <Logo tagline />
        </Link>
        <nav aria-label="Pages du site" className="flex items-center gap-1 text-sm sm:gap-2">
          {PAGES.map((page) => {
            const current = pathname === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={current ? "page" : undefined}
                className={`rounded-md px-2 py-1.5 font-bold ${
                  current ? "text-ink underline decoration-fire-new decoration-2 underline-offset-[6px]" : "text-ink-2 hover:text-ink"
                }`}
              >
                <span className="sm:hidden">{page.short}</span>
                <span className="hidden sm:inline">{page.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
