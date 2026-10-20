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

void main() {
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

void main() {
  gl_FragColor = vec4(uColor, uOpacity);
}
`;
