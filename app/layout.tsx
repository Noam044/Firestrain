import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { Providers } from "./providers";
import "./globals.css";

// Source Serif 4 with its optical-size axis for titles and key figures, IBM Plex
// Mono (tabular figures) for data, IBM Plex Sans for the interface.
const serif = Source_Serif_4({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal"],
  variable: "--font-source-serif",
  display: "swap",
});
const sans = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex-sans", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "FireStrain — feux de forêt en France, 2026", template: "%s · FireStrain" },
  description:
    "Visualisation en relief des surfaces brûlées en France métropolitaine en 2026, comparées aux années précédentes, avec la source de chaque chiffre.",
};

export const viewport: Viewport = { themeColor: "#11100e", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-ash-950 text-bone-100">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-ash-950 focus:px-3 focus:py-2"
        >
          Aller au contenu
        </a>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
