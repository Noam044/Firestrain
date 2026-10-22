"use client";

import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import { MapStatus } from "./MapStatus";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <MapStatus>Chargement de la scène 3D…</MapStatus>,
});
const Map2D = dynamic(() => import("./Map2D"), {
  ssr: false,
  loading: () => <MapStatus>Chargement de la carte 2D…</MapStatus>,
});

type RenderChoice = { kind: "3d" } | { kind: "2d"; reason: string };

/** Software rasterisers behind WebGL (no GPU): SwiftShader, Mesa llvmpipe/softpipe, Windows WARP. */
const SOFTWARE_RENDERER = /SwiftShader|llvmpipe|softpipe|Software Rasterizer|Microsoft Basic Render/i;

/**
 * Creates a throwaway WebGL 2 context: "none" when unsupported, "software" without
 * graphics acceleration (Chrome does not always flag SwiftShader as a performance caveat).
 */
function probeWebGL2(): "none" | "software" | "hardware" {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return "none";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    const caveat = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    caveat?.getExtension("WEBGL_lose_context")?.loseContext();
    return !caveat || SOFTWARE_RENDERER.test(renderer) ? "software" : "hardware";
  } catch {
    return "none";
  }
}

function chooseRender(): RenderChoice {
  const requested = new URLSearchParams(window.location.search).get("rendu");
  if (requested === "2d") return { kind: "2d", reason: "Carte 2D : rendu 2D demandé dans l’adresse." };
  const webgl = probeWebGL2();
  if (webgl === "none") {
    return {
      kind: "2d",
      reason: "Carte 2D : WebGL 2 n’est pas disponible sur cet appareil.",
    };
  }
  // Without graphics acceleration (software WebGL), every frame of the relief costs
  // seconds of main thread: the 2D map is the better experience, unless asked otherwise.
  if (requested !== "3d" && webgl === "software") {
    return {
      kind: "2d",
      reason: "Carte 2D : pas d’accélération graphique (rendu=3d pour forcer le relief).",
    };
  }
  return { kind: "3d" };
}

/** Switches to the 2D map if the 3D scene throws (e.g. WebGL context creation fails). */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <Map2D
          reason="Carte 2D : la scène en relief n’a pas pu démarrer."
        />
      );
    }
    return this.props.children;
  }
}

/** Client-only (see MapStageLoader): picks the 3D scene or the 2D fallback once. */
export default function MapStage() {
  const [choice] = useState(chooseRender);
  if (choice.kind === "2d") return <Map2D reason={choice.reason} />;
  return (
    <SceneErrorBoundary>
      <MapCanvas />
    </SceneErrorBoundary>
  );
}
