import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Funnel_Display, Funnel_Sans, Martian_Mono } from "next/font/google";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { Providers } from "./providers";
import "./globals.css";

// Funnel Sans for the interface, Funnel Display for titles, Martian Mono (condensed) for every reading.
const funnelSans = Funnel_Sans({ subsets: ["latin"], variable: "--font-funnel-sans", display: "swap" });
const funnelDisplay = Funnel_Display({ subsets: ["latin"], variable: "--font-funnel-display", display: "swap" });
// Martian Mono is not preloaded: readings swap to it as soon as it arrives, the first paint does not wait.
const martian = Martian_Mono({ subsets: ["latin"], axes: ["wdth"], variable: "--font-martian", display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "FireStrain, les feux de forêt en France en direct", template: "%s · FireStrain" },
  applicationName: "FireStrain",
  description:
    "FireStrain : les feux de forêt des douze derniers mois en France métropolitaine, mois par mois, sur une carte en relief : surfaces brûlées EFFIS (Copernicus) et points chauds NASA FIRMS des dernières 72 heures.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f1112" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2ef" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the theme class before the first paint: the attribute differs from the server render.
    <html lang="fr" className={`${funnelSans.variable} ${funnelDisplay.variable} ${martian.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-paper text-ink">
        <a href="#contenu" className="sr-only z-50 rounded-md bg-signal px-3 py-2 font-bold text-on-signal focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Aller au contenu
        </a>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
        {/* Real visitors' Core Web Vitals, collected by Vercel without cookies. The script is served only on Vercel deployments. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
