"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";

/**
 * Tooltip, after shadcn/ui (Radix): a short label that pops in (140 ms, from
 * 96 %) above the control. The control keeps its own accessible name.
 */
export function Tooltip({ label, children, side = "top" }: { label: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 max-w-60 animate-pop-in rounded-md border border-rule-strong bg-raised px-2 py-1 text-xs text-ink shadow-pop"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;
