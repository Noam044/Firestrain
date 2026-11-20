import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A keyboard key, after shadcn/ui's Kbd. */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-rule-strong bg-paper px-1 font-mono text-[10px] font-medium text-ink-3",
        className,
      )}
      {...props}
    />
  );
}
