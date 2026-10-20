"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Récit" },
  { href: "/explorer", label: "Explorer" },
  { href: "/liste", label: "Liste" },
  { href: "/methode", label: "Méthode" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale">
      <ul className="flex gap-3.5 sm:gap-5 md:gap-8">
        {LINKS.map(({ href, label }) => {
          const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`label-caps py-2 underline-offset-[6px] transition-colors ${
                  current ? "text-bone-100 underline" : "text-bone-300 no-underline hover:text-bone-100"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
