import { connection } from "next/server";
import { getRecentDetections } from "@/lib/server/firms-recent";

/** GET /api/firms/recent — VIIRS hotspots of the last 72 hours over metropolitan France. */
export async function GET() {
  // Answered at request time (never prerendered); the FIRMS query itself is cached.
  await connection();
  try {
    return Response.json(await getRecentDetections(), {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    // Our own messages only (see getRecentDetections): never a URL, so never the key.
    console.error("firms/recent:", error instanceof Error ? error.message : "unknown error");
    return Response.json(
      { error: "Détections des 72 dernières heures indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
