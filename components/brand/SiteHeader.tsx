"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const PAGES = [
  { href: "/carte", label: "Carte" },
  { href: "/liste", label: "Liste" },
  { href: "/methode", label: "Méthode" },
] as const;

/** The site's bar on every page: the name back home, the three pages, the theme. */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/92 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
        <Link href="/" className="rounded-sm">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label="Pages du site" className="flex items-center gap-0.5 text-sm">
            {PAGES.map((page) => {
              const current = pathname === page.href;
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative rounded-md px-2 py-2 font-semibold transition-colors sm:px-3",
                    current ? "text-ink" : "text-ink-3 hover:bg-raised hover:text-ink",
                  )}
                >
                  {page.label}
                  {current && <span aria-hidden className="absolute inset-x-2 -bottom-[9px] h-0.5 bg-signal sm:inset-x-3" />}
                </Link>
              );
            })}
          </nav>
          <span aria-hidden className="mx-1 h-5 w-px bg-rule-strong" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
