import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

// One family, used across its width axis: condensed for labels, normal for
// reading, wide for key figures.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Feux de forêt en France, 2006–2026", template: "%s · Feux de forêt en France" },
  description:
    "Carte interactive des surfaces brûlées en France métropolitaine, année par année depuis 2006, à partir des données satellite EFFIS.",
};

export const viewport: Viewport = { themeColor: "#f2f3ee", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={archivo.variable}>
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
