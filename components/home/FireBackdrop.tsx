"use client";

import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { readColorToken } from "@/lib/tokens";

/**
 * The home page's backdrop: a forest fire along the whole width of the opening,
 * drawn by a small shader (flames from fractal noise, in the site's thermal
 * ramp) behind a treeline in the page's own colour. Kept faint, rendered at a
 * fraction of the screen resolution, paused off screen and in hidden tabs.
 * Reduced motion: one still frame. No GPU (software WebGL) or no WebGL: a
 * still glow, so the page never pays for a software-rendered animation.
 */

const VERTEX = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uOpacity;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uHot;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 5; k++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
  float t = uTime;
  // Height of the flame front along the width, slowly changing.
  float front = 0.34 + 0.2 * fbm(vec2(p.x * 1.1, t * 0.06));
  float turbulence = fbm(vec2(p.x * 2.4, p.y * 3.2 - t * 0.85));
  float detail = fbm(vec2(p.x * 6.0 + t * 0.1, p.y * 7.0 - t * 1.5));
  float f = clamp(1.0 - uv.y / front + (turbulence - 0.5) * 0.85 + (detail - 0.5) * 0.35, 0.0, 1.0);
  vec3 colour = mix(uDeep, uMid, smoothstep(0.15, 0.55, f));
  colour = mix(colour, uHot, smoothstep(0.6, 0.97, f));
  float alpha = smoothstep(0.04, 0.5, f);
  // A faint glow above the flames.
  float glow = exp(-max(uv.y - front * 0.8, 0.0) * 5.0) * 0.16 * (0.6 + 0.4 * turbulence);
  alpha = max(alpha, glow);
  gl_FragColor = vec4(colour * alpha, alpha) * uOpacity;
}
`;

const SOFTWARE_RENDERER =
  /SwiftShader|llvmpipe|softpipe|Software Rasterizer|Microsoft Basic Render/i;
/** Frames per second of the animation: flames read as fluid well below 60. */
const FPS = 30;

/** Pines along the bottom edge, from a fixed seed: the same treeline on every visit. */
function treeline(
  seed: number,
  width: number,
  height: number,
  minH: number,
  maxH: number,
  step: [number, number],
) {
  let state = seed;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M0 ${height}`;
  for (let x = -10; x < width + 20;) {
    const w = step[0] + random() * (step[1] - step[0]);
    const h = minH + random() * (maxH - minH);
    // A pine: three tiers narrowing to the tip.
    const tiers: [number, number][] = [
      [0, 0.18], [0.18, 0.48], [0.08, 0.48], [0.3, 0.78], [0.22, 0.78], [0.5, 1],
      [0.78, 0.78], [0.7, 0.78], [0.92, 0.48], [0.82, 0.48], [1, 0.18],
    ];
    for (const [dx, dy] of tiers) d += ` L${r(x + w * dx)} ${r(height - h * dy)}`;
    x += w * (0.55 + random() * 0.35);
  }
  return `${d} L${width + 40} ${height} Z`;
}
/**
 * The treeline is drawn wider than any screen and scaled to its strip's height
 * (`slice` then trims the sides only): a narrower drawing would be scaled to
 * the width on wide screens and lose the tops of the tallest pines.
 */
const TREES_WIDTH = 4800;
const TREES_HEIGHT = 150;
const FAR_TREES = treeline(7, TREES_WIDTH, TREES_HEIGHT, 40, 95, [18, 34]);
const NEAR_TREES = treeline(23, TREES_WIDTH, TREES_HEIGHT, 28, 70, [22, 42]);

/** True only with a GPU: one probing context, refused at once when WebGL would be software-rendered. */
function hasGpu(): boolean {
  try {
    const gl = document
      .createElement("canvas")
      .getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    );
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !SOFTWARE_RENDERER.test(renderer);
  } catch {
    return false;
  }
}

export function FireBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Started once the page is idle: the opening's text and picture come first.
    let cleanup: (() => void) | undefined;
    const idle =
      window.requestIdleCallback ??
      ((callback: () => void) => window.setTimeout(callback, 200));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => {
      cleanup = start();
    });
    return () => {
      cancelIdle(handle);
      cleanup?.();
    };

    function start(): (() => void) | undefined {
      const canvas = canvasRef.current;
      if (!canvas || !hasGpu()) return;
      const gl = canvas.getContext("webgl", {
        premultipliedAlpha: true,
        antialias: false,
      });
      if (!gl) return;

      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
      };
      const program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const uniform = (name: string) => gl.getUniformLocation(program, name);
      const light = resolvedTheme === "light";
      gl.uniform3fv(uniform("uDeep"), readColorToken("--scorch"));
      gl.uniform3fv(uniform("uMid"), readColorToken("--signal"));
      gl.uniform3fv(uniform("uHot"), readColorToken("--fire-new"));
      gl.uniform1f(uniform("uOpacity"), light ? 0.3 : 0.42);
      const uRes = uniform("uRes");
      const uTime = uniform("uTime");

      // A fraction of the screen resolution: the flames are soft, the GPU stays quiet.
      const scale = window.matchMedia("(max-width: 767px)").matches
        ? 0.35
        : 0.5;
      const resize = () => {
        const width = Math.max(1, Math.round(canvas.clientWidth * scale));
        const height = Math.max(1, Math.round(canvas.clientHeight * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          gl.viewport(0, 0, width, height);
          gl.uniform2f(uRes, width, height);
        }
      };
      const draw = (seconds: number) => {
        resize();
        gl.uniform1f(uTime, seconds);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      setAnimated(true);
      if (reduce) {
        draw(12);
        return () => setAnimated(false);
      }

      let frame = 0;
      let visible = true;
      let elapsed = 12;
      let last = performance.now();
      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        if (now - last < 1000 / FPS) return;
        elapsed += Math.min(now - last, 100) / 1000;
        last = now;
        draw(elapsed);
      };
      const play = () => {
        if (frame || !visible || document.hidden) return;
        last = performance.now();
        frame = requestAnimationFrame(loop);
      };
      const stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
      };
      const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) play();
        else stop();
      });
      observer.observe(canvas);
      const onVisibility = () => (document.hidden ? stop() : play());
      document.addEventListener("visibilitychange", onVisibility);
      draw(elapsed);
      play();
      return () => {
        stop();
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        setAnimated(false);
      };
    }
  }, [reduce, resolvedTheme]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* Without the animation: a still glow where the flames would be. */}
      <div
        className={`absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(70%_100%_at_50%_100%,color-mix(in_oklab,var(--signal)_22%,transparent),transparent_75%)] transition-opacity duration-700 ${
          animated ? "opacity-0" : "opacity-100"
        }`}
      />
      <canvas
        ref={canvasRef}
        className={`absolute inset-x-0 bottom-0 h-[62%] w-full transition-opacity duration-1000 ${animated ? "opacity-100" : "opacity-0"}`}
      />
      {/* Treeline: the far trees take a little of the fire's light, the near ones are the page itself. */}
      <svg
        viewBox={`0 0 ${TREES_WIDTH} ${TREES_HEIGHT}`}
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-24 w-full sm:h-32"
      >
        <path
          d={FAR_TREES}
          fill="color-mix(in oklab, var(--paper) 78%, var(--scorch))"
        />
        <path d={NEAR_TREES} fill="var(--paper)" />
      </svg>
      {/* Keeps the text side readable. */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--paper)_0%,color-mix(in_oklab,var(--paper)_55%,transparent)_45%,transparent_75%)] opacity-70" />
    </div>
  );
}
