import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { formatArea, formatDate } from "@/lib/format";
import { findFire } from "@/lib/server/fire-lookup";

/** The site's dark theme (globals.css), written out: the image is drawn outside the page. */
const PAPER = "#0f1112";
const SHEET = "#15181a";
const INK = "#ecebe7";
const INK_3 = "#8a9094";
const SIGNAL = "#ff5b1f";

/**
 * GET /api/apercu/feu/<id>[?annee=2022] — the link preview of one fire
 * (1200 × 630): its EFFIS outline, commune, département, area and date.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const year = Number(new URL(request.url).searchParams.get("annee")) || null;
  const fire = Number.isInteger(id) ? await findFire(id, year) : null;
  if (!fire) return new Response("Feu introuvable", { status: 404 });

  // The outline, framed with a margin, in its own units (scene km).
  const [x0, z0, x1, z1] = fire.bbox;
  const span = Math.max(x1 - x0, z1 - z0) || 1;
  const pad = span * 0.12;
  const viewBox = [x0 - pad, z0 - pad, span + 2 * pad, span + 2 * pad].map((v) => v.toFixed(3)).join(" ");
  const d = fire.rings
    .map((ring) => {
      const points: string[] = [];
      for (let k = 0; k < ring.length; k += 2) points.push(`${ring[k].toFixed(3)} ${ring[k + 1].toFixed(3)}`);
      return `M${points.join("L")}Z`;
    })
    .join("");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, color: INK, fontFamily: "sans-serif" }}>
        <div style={{ width: 630, height: 630, display: "flex", alignItems: "center", justifyContent: "center", background: SHEET }}>
          <svg width="520" height="520" viewBox={viewBox}>
            <path d={d} fill={SIGNAL} fillOpacity={0.28} stroke={SIGNAL} strokeWidth={span / 160} fillRule="evenodd" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px 56px 52px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700 }}>
            <div style={{ width: 14, height: 14, borderRadius: 7, background: SIGNAL }} />
            FireStrain
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 24, color: INK_3 }}>{`Feu de forêt · ${fire.province || "France"}`}</div>
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, marginTop: 10 }}>{fire.commune || "Commune non renseignée"}</div>
            {/* Satori has no baseline alignment: both boxes sit on the bottom edge, the small text
                raised by the difference between the two fonts' descents, so they share a baseline. */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 28 }}>
              <span style={{ fontSize: 88, lineHeight: 1, fontWeight: 700, color: SIGNAL }}>{formatArea(fire.areaHa)}</span>
              <span style={{ fontSize: 34, lineHeight: 1, color: INK_3, paddingBottom: 7 }}>ha brûlés</span>
            </div>
            <div style={{ fontSize: 26, color: INK_3, marginTop: 8 }}>{`Première détection le ${formatDate(fire.firedate)}`}</div>
          </div>
          <div style={{ fontSize: 20, color: INK_3 }}>Contour EFFIS (Copernicus) · firestrain.vercel.app</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // An outline barely changes once mapped: cached a day by the CDN.
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
    },
  );
}
