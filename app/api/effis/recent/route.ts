import { gzipSync } from "node:zlib";
import { connection } from "next/server";
import { getRecentFires } from "@/lib/server/effis-recent";

/** GET /api/effis/recent — EFFIS burnt areas of the last twelve months over metropolitan France. */
export async function GET(request: Request) {
  // Answered at request time (never prerendered); the EFFIS query itself is cached.
  await connection();
  try {
    const body = JSON.stringify(await getRecentFires());
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
      Vary: "Accept-Encoding",
    };
    // About 650 kB of outlines: compressed here, since `next start` leaves route answers as they are.
    if (/\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")) {
      return new Response(gzipSync(body), { headers: { ...headers, "Content-Encoding": "gzip" } });
    }
    return new Response(body, { headers });
  } catch (error) {
    console.error("effis/recent:", error instanceof Error ? error.message : "unknown error");
    return Response.json(
      { error: "Surfaces brûlées des douze derniers mois indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
