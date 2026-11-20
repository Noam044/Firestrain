"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Children, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Items arriving one by one, after Magic UI's AnimatedList: children are given
 * newest first, revealed oldest first, each newer one landing on top, so the
 * motion mirrors detections coming in. Everything at once when motion is reduced.
 */
export function AnimatedList({ children, className, delay = 420 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const items = useMemo(() => Children.toArray(children), [children]);
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (reduce || count >= items.length) return;
    const timer = window.setTimeout(() => setCount((n) => n + 1), delay);
    return () => window.clearTimeout(timer);
  }, [count, items.length, delay, reduce]);

  const shown = reduce ? items : items.slice(-count);
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      <AnimatePresence initial={false}>
        {shown.map((item) => (
          <motion.li
            key={(item as { key?: string }).key}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
          >
            {item}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
