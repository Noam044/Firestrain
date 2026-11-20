"use client";

import type { ComponentProps, PointerEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * A card lit faintly where the pointer is, after Magic UI's Magic Card: the
 * position goes to CSS variables (no React render), the light is a 7 % signal
 * tint that fades in on hover. Touch and reduced motion see a plain card.
 */
export function SpotlightCard({ className, children, ...props }: ComponentProps<"article">) {
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };
  return (
    <article
      onPointerMove={onPointerMove}
      className={cn(
        "group/spot relative transition-colors duration-300 hover:border-rule-strong",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100 motion-reduce:before:hidden",
        "before:bg-[radial-gradient(420px_circle_at_var(--spot-x,50%)_var(--spot-y,50%),color-mix(in_oklab,var(--signal)_7%,transparent),transparent_70%)]",
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}
