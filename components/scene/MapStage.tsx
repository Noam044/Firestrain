"use client";

import dynamic from "next/dynamic";
import { Component, useState, type ReactNode } from "react";
import type { MapMode } from "@/lib/store";
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

function chooseRender(): RenderChoice {
  if (new URLSearchParams(window.location.search).get("rendu") === "2d") {
    return { kind: "2d", reason: "Rendu 2D demandé dans l’adresse (rendu=2d)." };
  }
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl) {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return { kind: "3d" };
    }
  } catch {
    // Treated as unsupported below.
  }
  return {
    kind: "2d",
    reason: "WebGL 2 n’est pas disponible sur cet appareil : la carte est affichée en 2D, sans relief.",
  };
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
        <Map2D reason="La scène 3D n’a pas pu démarrer sur cet appareil : la carte est affichée en 2D, sans relief." />
      );
    }
    return this.props.children;
  }
}

/** Client-only (see MapStageLoader): picks the 3D scene or the 2D fallback once. */
export default function MapStage({ mode }: { mode: MapMode }) {
  const [choice] = useState(chooseRender);
  if (choice.kind === "2d") return <Map2D reason={choice.reason} />;
  return (
    <SceneErrorBoundary>
      <MapCanvas mode={mode} />
    </SceneErrorBoundary>
  );
}
