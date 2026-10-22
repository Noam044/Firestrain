import Link from "next/link";

/** Top of the secondary pages: the way back to the map, and the other page. */
export function PageHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-rule py-3">
      <Link href="/" className="flex items-center gap-1.5 text-sm font-medium text-moss hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path d="M8.5 3 4.5 7l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
        Carte des feux
      </Link>
      <nav aria-label="Autres pages" className="flex gap-4 text-sm">
        <Link href="/liste" className="text-ink-2 hover:text-ink">
          Liste
        </Link>
        <Link href="/methode" className="text-ink-2 hover:text-ink">
          Méthode
        </Link>
      </nav>
    </header>
  );
}
