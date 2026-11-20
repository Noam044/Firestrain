"use client";

import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

const format = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/**
 * A figure that counts up to its value once on screen, after Magic UI's
 * NumberTicker: French formatting, the true value rendered first (screenshots,
 * crawlers, reduced motion), the count only played when it scrolls into view.
 * The motion says "this was just measured", for live figures only.
 */
export function NumberTicker({ value, className, ...props }: { value: number } & ComponentPropsWithoutRef<"span">) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 60, stiffness: 110 });
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || reduce) return;
    // Count up from zero once on screen (the true value was there before, for anyone not scrolling).
    motionValue.jump(0);
    motionValue.set(value);
  }, [inView, reduce, value, motionValue]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = format.format(Math.round(latest));
      }),
    [spring],
  );

  return (
    <span ref={ref} className={cn("tabular-nums", className)} {...props}>
      {format.format(value)}
    </span>
  );
}
