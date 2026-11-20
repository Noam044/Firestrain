import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The map lives at /carte. It used to be at /explorer, then at / itself: shared addresses
  // carrying map state (?fire=…, ?annee=…) still open it. The query string is passed through.
  async redirects() {
    const mapKeys = ["fire", "annee", "year", "mois", "fond", "cam", "rendu"];
    return [
      { source: "/explorer", destination: "/carte", permanent: true },
      ...mapKeys.map((key) => ({
        source: "/",
        has: [{ type: "query" as const, key }],
        destination: "/carte",
        permanent: false,
      })),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
