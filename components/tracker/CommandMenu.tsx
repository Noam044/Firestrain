"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/ui/kbd";

// The palette (cmdk and its dialog) is fetched on first use: it costs nothing to the map's first paint.
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });

/** The search button of the map's bar, and its ⌘K / Ctrl+K shortcut. */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setUsed(true);
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setUsed(true);
          setOpen(true);
        }}
        className="flex h-8 items-center gap-2 rounded-md border border-rule-strong bg-sheet px-2.5 text-sm text-ink-3 transition-colors hover:border-ink-3 hover:text-ink"
      >
        <MagnifyingGlass size={15} weight="bold" aria-hidden />
        <span className="sr-only sm:not-sr-only">Rechercher</span>
        <Kbd aria-hidden className="hidden sm:inline-flex">
          Ctrl K
        </Kbd>
      </button>
      {used && <CommandPalette open={open} setOpen={setOpen} />}
    </>
  );
}
