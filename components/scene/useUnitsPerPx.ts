"use client";

import { useEffect, useRef, useState } from "react";

/** SVG user units per CSS pixel of an element showing `viewBox` with preserveAspectRatio "meet". */
export function useUnitsPerPx(viewBox: readonly number[] | undefined) {
  const ref = useRef<SVGSVGElement>(null);
  const [unitsPerPx, setUnitsPerPx] = useState(1);
  useEffect(() => {
    const svg = ref.current;
    if (!svg || !viewBox) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setUnitsPerPx(Math.max(viewBox[2] / width, viewBox[3] / height));
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [viewBox]);
  return { ref, unitsPerPx };
}
