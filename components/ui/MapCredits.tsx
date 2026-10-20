import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { Credit } from "@/lib/data/manifest";

/** Source credits at the foot of the map, as on a printed sheet. */
export function MapCredits({ credits, className = "" }: { credits: Credit[]; className?: string }) {
  return (
    <p className={`text-[11px] leading-4 text-ash-400 ${className}`}>
      {credits.map((credit, index) => (
        <span key={credit.label}>
          {index > 0 && " · "}
          {credit.label} : {credit.source} (
          <a href={credit.licenceUrl} className="underline decoration-ash-600 hover:text-bone-300">
            {credit.licence}
          </a>
          , récupéré le {formatDate(credit.retrievedAt)})
        </span>
      ))}
      {" · "}Données reprojetées et simplifiées ·{" "}
      <Link href="/methode" className="underline decoration-ash-600 hover:text-bone-300">
        Méthode et sources
      </Link>
    </p>
  );
}
