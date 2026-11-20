import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
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
  title: { default: "Feux de forêt en France — suivi", template: "%s · Feux de forêt en France" },
  description:
    "Les feux de forêt des douze derniers mois en France métropolitaine, mois par mois, sur une carte en relief : surfaces brûlées EFFIS (Copernicus) et points chauds NASA FIRMS des dernières 72 heures.",
};

export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${atkinson.variable} ${atkinsonMono.variable}`}>
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
