import { gzipSync } from "node:zlib";
import { connection } from "next/server";
import { getRecentFires } from "@/lib/server/effis-recent";

/**
 * GET /api/effis/recent — EFFIS burnt areas of the last twelve months over metropolitan France,
 * as a gzip file (≈ 150 kB instead of ≈ 650 kB of JSON). Compressed here and declared as a file,
 * not as a Content-Encoding: servers and hosts compress responses differently (some
 * twice), and the page inflates it itself (lib/data/queries.ts).
 */
export async function GET() {
  // Answered at request time (never prerendered); the EFFIS query itself is cached.
  await connection();
  try {
    return new Response(gzipSync(JSON.stringify(await getRecentFires())), {
      headers: {
        "Content-Type": "application/gzip",
        // The CDN keeps the answer 15 min, then serves it while it fetches a fresh one (up to a day):
        // a visitor only waits on EFFIS when nothing at all is cached.
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("effis/recent:", error instanceof Error ? error.message : "unknown error");
    return Response.json(
      { error: "Surfaces brûlées des douze derniers mois indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
