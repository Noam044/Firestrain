"use client";

import { CameraControls } from "@react-three/drei";
import { useEffect, useState, type RefObject } from "react";
import * as THREE from "three";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { lonLatToScene } from "@/lib/geo/projection";
import { CAMERA_PRESETS, type CameraPreset, type CameraPresetId } from "@/lib/geo/presets";
import type { MapMode } from "@/lib/store";

/** Values of camera-controls' ACTION enum (public API, stable across v2–v3). */
const ACTION = {
  ROTATE: 1,
  // In camera-controls v3, SCREEN_PAN moves the target along the ground (truck +
  // forward), i.e. map-like panning — the replacement for verticalDragToForward.
  SCREEN_PAN: 4,
  DOLLY: 16,
  TOUCH_ROTATE: 64,
  TOUCH_SCREEN_PAN: 256,
  TOUCH_DOLLY_ROTATE: 32768,
} as const;

/** Maximum tilt from the vertical: the camera never goes level with the ground. */
export const MAX_TILT_DEG = 65;

export function presetLookAt(preset: CameraPreset) {
  const target = lonLatToScene(preset.target);
  const polar = THREE.MathUtils.degToRad(preset.polarDeg);
  const azimuth = THREE.MathUtils.degToRad(preset.azimuthDeg);
  const d = preset.distanceKm;
  return {
    position: [
      target.x + d * Math.sin(polar) * Math.sin(azimuth),
      d * Math.cos(polar),
      target.z + d * Math.sin(polar) * Math.cos(azimuth),
    ] as const,
    target: [target.x, 0, target.z] as const,
  };
}

/**
 * Presets are framed for landscape screens, where the height is the limiting
 * dimension; below this aspect ratio the width limits and the camera backs off.
 */
const REFERENCE_ASPECT = 1.2;
const MAX_DISTANCE_KM = 2600;

function fitDistance(preset: CameraPreset, aspect: number): number {
  return preset.distanceKm * Math.max(1, REFERENCE_ASPECT / aspect);
}

/** Moves the camera to a preset fitted to the viewport; returns the distance used. */
export function resetView(
  controls: CameraControls,
  enableTransition: boolean,
  presetId: CameraPresetId = "france",
): number {
  const camera = controls.camera as THREE.PerspectiveCamera;
  const preset = CAMERA_PRESETS[presetId];
  const distanceKm = fitDistance(preset, camera.aspect);
  controls.maxDistance = Math.max(MAX_DISTANCE_KM, distanceKm * 1.2);
  const { position, target } = presetLookAt({ ...preset, distanceKm });
  void controls.setLookAt(...position, ...target, enableTransition);
  return distanceKm;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type CameraRigProps = {
  mode: MapMode;
  controlsRef: RefObject<CameraControls | null>;
};

export function CameraRig({ mode, controlsRef }: CameraRigProps) {
  const [reduceMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.setBoundary(
      new THREE.Box3(
        new THREE.Vector3(-SCENE_SIZE.width / 2, -1, -SCENE_SIZE.depth / 2),
        new THREE.Vector3(SCENE_SIZE.width / 2, 20, SCENE_SIZE.depth / 2),
      ),
    );
    controls.boundaryEnclosesCamera = false;
    controls.minDistance = 20;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = THREE.MathUtils.degToRad(MAX_TILT_DEG);
    controls.dollyToCursor = true;
    controls.smoothTime = reduceMotion ? 0 : 0.25;
    controls.draggingSmoothTime = reduceMotion ? 0 : 0.08;

    // Map-like gestures: drag pans along the ground, right-drag orbits, wheel zooms.
    controls.mouseButtons.left = ACTION.SCREEN_PAN;
    controls.mouseButtons.right = ACTION.ROTATE;
    controls.mouseButtons.middle = ACTION.DOLLY;
    controls.mouseButtons.wheel = ACTION.DOLLY;
    controls.touches.one = ACTION.TOUCH_SCREEN_PAN;
    controls.touches.two = ACTION.TOUCH_DOLLY_ROTATE;
    controls.touches.three = ACTION.TOUCH_ROTATE;

    const distance = resetView(controls, false, mode === "story" ? "franceStory" : "france");
    // In the story, France sits right of the title column on wide screens and
    // above the text on narrow ones (a positive vertical offset lifts the content).
    const wide = window.matchMedia("(min-width: 768px)").matches;
    if (mode === "story") {
      void controls.setFocalOffset(wide ? -190 : 0, wide ? 0 : 0.15 * distance, 0, false);
    }
  }, [controlsRef, mode, reduceMotion]);

  return <CameraControls ref={controlsRef} makeDefault enabled={mode === "explore"} regress />;
}
