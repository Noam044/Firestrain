"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Entrance on scroll, after Magic UI's Blur Fade but quieter: 8 px rise, 3 px
 * blur, half a second, once. Static with reduced motion. For section headings
 * and blocks, so a page reads in the order it is built.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section";
}) {
  const reduce = useReducedMotion();
  const Component = motion[as];
  if (reduce) return <Component className={className}>{children}</Component>;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}
