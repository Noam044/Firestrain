/**
 * GLSL for the relief and the draped lines. Written in GLSL ES 1.0 style;
 * three.js upgrades it to GLSL 3.00 on WebGL 2.
 *
 * Shared conventions: the plane lies in XZ (scene km, north = −Z); texture
 * coordinates are derived from the position, with t = 0 on the north edge,
 * matching the DEM rows and the land-mask canvas (both uploaded unflipped).
 */

export const terrainVertexShader = /* glsl */ `
uniform sampler2D uHeight;
uniform vec2 uSceneSize;
uniform float uExag;
varying vec2 vUv;
varying float vHeightM;

void main() {
  vec3 p = position;
  vUv = vec2(p.x / uSceneSize.x + 0.5, p.z / uSceneSize.y + 0.5);
  vHeightM = texture2D(uHeight, vUv).r;
  p.y = vHeightM * 0.001 * uExag;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const terrainFragmentShader = /* glsl */ `
uniform sampler2D uHeight;
uniform sampler2D uMask;
uniform vec2 uSceneSize;
uniform vec2 uTexel;
uniform float uShadeExag;
uniform vec3 uLightDir;
uniform vec3 uColShadow;
uniform vec3 uColFlat;
uniform vec3 uColLight;
uniform vec3 uColHigh;
uniform vec3 uColWater;
uniform sampler2D uBurn;
uniform vec3 uColChar;
uniform vec3 uColHatch;
uniform float uHistory;
uniform float uPixelRatio;
uniform float uDay;
uniform float uImagery;
uniform sampler2D uImageryFar;
uniform sampler2D uImageryNear;
uniform vec4 uNearRect;
uniform float uHasNear;
uniform float uImageryShade;
varying vec2 vUv;
varying float vHeightM;

void main() {
  // Central differences over the larger of one texel and the pixel footprint:
  // with the mipmapped height texture this keeps the shading free of aliasing
  // when zoomed out, and full-resolution when zoomed in.
  vec2 footprint = max(uTexel, fwidth(vUv));
  float hW = texture2D(uHeight, vUv - vec2(footprint.x, 0.0)).r;
  float hE = texture2D(uHeight, vUv + vec2(footprint.x, 0.0)).r;
  float hN = texture2D(uHeight, vUv - vec2(0.0, footprint.y)).r;
  float hS = texture2D(uHeight, vUv + vec2(0.0, footprint.y)).r;
  float k = 0.001 * uShadeExag;
  float dx = (hE - hW) * k / (2.0 * footprint.x * uSceneSize.x);
  float dz = (hS - hN) * k / (2.0 * footprint.y * uSceneSize.y);
  vec3 normal = normalize(vec3(-dx, 1.0, -dz));

  // Cartographic hillshade: flat ground keeps the neutral tone; slopes facing
  // the north-west light lighten, slopes facing away darken.
  float lit = max(dot(normal, uLightDir), 0.0);
  float relative = lit / uLightDir.y;
  vec3 color = relative < 1.0
    ? mix(uColShadow, uColFlat, relative)
    : mix(uColFlat, uColLight, clamp((relative - 1.0) / (1.0 / uLightDir.y - 1.0), 0.0, 1.0));
  color = mix(color, uColHigh, 0.12 * smoothstep(600.0, 3200.0, vHeightM));

  // Inside the outline but without BD ALTI altitude: sea and lagoons.
  float hasAltitude = texture2D(uHeight, vUv).g;
  color = mix(uColWater, color, step(0.5, hasAltitude));

  // Imagery base map (Plan, Satellite, aerial photos): the sharp image around the
  // camera target, feathered into the whole-France image, with some hillshading
  // laid over so the relief stays readable. Both are always sampled (uniform
  // control flow keeps the mipmap derivatives valid).
  vec2 nearUv = (vUv - uNearRect.xy) / max(uNearRect.zw - uNearRect.xy, vec2(1e-6));
  vec3 farImage = texture2D(uImageryFar, vUv).rgb;
  vec3 nearImage = texture2D(uImageryNear, clamp(nearUv, 0.0, 1.0)).rgb;
  float inset = min(min(nearUv.x, 1.0 - nearUv.x), min(nearUv.y, 1.0 - nearUv.y));
  vec3 image = mix(farImage, nearImage, uHasNear * smoothstep(0.0, 0.03, inset));
  float imageShade = mix(1.0, clamp(0.55 + 0.45 * relative, 0.4, 1.35), uImageryShade);
  color = mix(color, image * imageShade, uImagery);

  // Burnt areas (see BurnMask.ts). Earlier years: thin 45° hatching in a lighter
  // tone, so the distinction never relies on colour alone. Year shown: matt
  // charred tone that keeps a trace of the hillshade so the relief stays legible.
  vec4 burn = texture2D(uBurn, vUv);
  float history = smoothstep(0.08, 0.5, burn.g) * uHistory;
  float hatch = step(mod(gl_FragCoord.x - gl_FragCoord.y, 6.0 * uPixelRatio), 1.2 * uPixelRatio);
  color = mix(color, uColHatch, history * hatch * 0.75);
  // Timeline: B and A hold the first-detection day (high and low bytes), scaled
  // by the coverage once filtered, so dividing by R recovers it on soft edges.
  // uDay = 1000 shows the whole year.
  float coverage = max(burn.r, 0.004);
  float firstDay = floor(burn.b / coverage + 0.5) * 256.0 + floor(burn.a / coverage * 255.0 + 0.5);
  float started = step(firstDay, uDay + 0.5);
  float current = smoothstep(0.08, 0.5, burn.r) * started;
  vec3 charred = uColChar * mix(0.65, 1.45, clamp(relative * 0.5, 0.0, 1.0));
  // Over imagery the charred tone lets a little of the image through.
  color = mix(color, charred, current * mix(1.0, 0.85, uImagery));
  // Thin outline where the coverage crosses one half, about one pixel wide at any
  // zoom: delineates burnt areas like the contour line of a printed map.
  float edge = 1.0 - smoothstep(0.0, 1.5 * fwidth(burn.r) + 1e-4, abs(burn.r - 0.5));
  color = mix(color, uColHatch, edge * 0.55 * started);

  // Outside metropolitan France nothing is drawn and the page shows through.
  // Discarding last keeps derivatives (fwidth, implicit LOD) well defined.
  if (texture2D(uMask, vUv).r < 0.5) discard;
  gl_FragColor = vec4(color, 1.0);
}
`;

export const drapedLineVertexShader = /* glsl */ `
uniform sampler2D uHeight;
uniform vec2 uSceneSize;
uniform float uExag;
uniform float uLift;
attribute float aProgress;
varying float vProgress;

void main() {
  vProgress = aProgress;
  vec3 p = position;
  vec2 uv = vec2(p.x / uSceneSize.x + 0.5, p.z / uSceneSize.y + 0.5);
  p.y = texture2D(uHeight, uv).r * 0.001 * uExag;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Pull slightly towards the camera, proportionally to distance, so the line
  // stays above the relief at every zoom level without visibly floating.
  mv.xyz *= 1.0 - uLift;
  gl_Position = projectionMatrix * mv;
}
`;

export const drapedLineFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uProgress;
varying float vProgress;

void main() {
  // Draw-on reveal: only the first uProgress of each line is visible.
  if (vProgress > uProgress) discard;
  gl_FragColor = vec4(uColor, uOpacity);
}
`;

/**
 * FIRMS hotspots: map symbols of constant screen size (area ∝ fire radiative
 * power), filtered by the timeline in the shader — no geometry rebuild while playing.
 */
export const firePointsVertexShader = /* glsl */ `
uniform sampler2D uHeight;
uniform vec2 uSceneSize;
uniform float uExag;
uniform float uDay;
uniform float uFadeDays;
uniform float uPixelRatio;
uniform float uSizeScale;
attribute float aDay;
attribute float aFrp;
varying float vAlpha;

void main() {
  // Visible from its (local) day of detection, fading out over uFadeDays.
  float age = uDay - aDay;
  vAlpha = age < 0.0 ? 0.0 : 1.0 - clamp(age / uFadeDays, 0.0, 1.0);
  vec3 p = position;
  vec2 uv = vec2(p.x / uSceneSize.x + 0.5, p.z / uSceneSize.y + 0.5);
  p.y = texture2D(uHeight, uv).r * 0.001 * uExag;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xyz *= 1.0 - 0.002;
  gl_Position = projectionMatrix * mv;
  // Diameter ∝ sqrt(FRP) so that the symbol area is proportional to the power.
  gl_PointSize = vAlpha > 0.0 ? clamp(3.0 + 0.6 * sqrt(aFrp), 3.0, 12.0) * uSizeScale * uPixelRatio : 0.0;
}
`;

export const firePointsFragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;

void main() {
  // Open ring rather than a filled disc: dense clusters read as a texture of
  // symbols, not as a solid orange mass.
  float d = length(gl_PointCoord - 0.5);
  float ring = smoothstep(0.22, 0.32, d) * (1.0 - smoothstep(0.42, 0.5, d));
  if (ring <= 0.0 || vAlpha <= 0.0) discard;
  gl_FragColor = vec4(uColor, vAlpha * ring * uOpacity);
}
`;

/** Rasterises fire outlines straight into the burn-mask render target (clip space = scene extent). */
export const burnMaskVertexShader = /* glsl */ `
uniform vec2 uHalfSize;
attribute float aValue;
varying float vValue;

void main() {
  vValue = aValue;
  // North (z = −depth/2) lands on row 0, matching the terrain's texture coordinates.
  gl_Position = vec4(position.x / uHalfSize.x, position.z / uHalfSize.y, 0.0, 1.0);
}
`;

export const burnMaskFragmentShader = /* glsl */ `
uniform float uHistory;
varying float vValue;

void main() {
  if (uHistory > 0.5) {
    gl_FragColor = vec4(0.0, 1.0, 0.0, 0.0);
    return;
  }
  // vValue is a whole day (1 – 366): high byte in B, low byte in A.
  float high = floor(vValue / 256.0 + 0.001);
  gl_FragColor = vec4(1.0, 0.0, high, (vValue - 256.0 * high) / 255.0);
}
`;
