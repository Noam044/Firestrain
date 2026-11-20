import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { Providers } from "./providers";
import "./globals.css";

// Drawn for legibility (Braille Institute): text in the sans, figures and dates in the mono.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "FireStrain — les feux de forêt en France, vus par satellite", template: "%s · FireStrain" },
  applicationName: "FireStrain",
  description:
    "FireStrain : les feux de forêt des douze derniers mois en France métropolitaine, mois par mois, sur une carte en relief : surfaces brûlées EFFIS (Copernicus) et points chauds NASA FIRMS des dernières 72 heures.",
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${atkinson.variable} ${atkinsonMono.variable}`}>
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
