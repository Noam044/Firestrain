import Link from "next/link";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="relative z-20 flex h-(--header-h) items-center justify-between gap-6 border-b border-ash-800 bg-ash-950 px-4 md:px-8">
      <Link href="/" className="font-serif text-xl font-semibold tracking-tight text-bone-100 no-underline">
        FireStrain
      </Link>
      <NavLinks />
    </header>
  );
}
