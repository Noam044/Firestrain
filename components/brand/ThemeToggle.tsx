"use client";

import { CircleHalf } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Switches between the dark instrument (default) and the light one; remembered by next-themes. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known in the browser: the label waits for it, the button does not move.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = !mounted || resolvedTheme !== "light";
  const label = dark ? "Passer en affichage clair" : "Passer en affichage sombre";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-md text-ink-2 transition-colors hover:bg-raised hover:text-ink"
    >
      <CircleHalf size={18} weight="bold" className={dark ? "" : "rotate-180"} />
    </button>
  );
}
