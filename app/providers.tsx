"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }),
  );
  return (
    // Dark by default (the thermal identity), light on request; the class goes on <html>.
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <NuqsAdapter>
        <QueryClientProvider client={client}>
          <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        </QueryClientProvider>
      </NuqsAdapter>
    </ThemeProvider>
  );
}
