// The first run's light (docs/design-system.md, Motion): soft glows drawn in ASCII characters that scramble under
// the cursor, radiating from the app's mark on the welcome screen. WebGL2, one canvas, no library; it rests while
// the window is hidden and holds still with Reduce motion (drawn once, then only when it moves).
//
// Adapted from React Bits' GradientASCII (https://reactbits.dev/backgrounds/gradient-ascii,
// github.com/DavidHDev/react-bits). Copyright (c) 2026 David Haz. MIT + Commons Clause License Condition v1.0:
// used here as part of this application. The component itself may not be sold or redistributed on its own.
// Changes: plain TypeScript instead of a React component, a "radiance" shape (light from a point), a movable
// centre, a morph between two shapes, and settings that ease while it runs.
import { stillMotion } from "./animate";

const MAX_COLORS = 8;
const MAX_CLICKS = 4;
const MAX_TRAIL = 24;
const CLICK_LIFE = 1.2;
const TRAIL_LIFE = 0.7;
const TRAIL_STEP = 0.015;
const INTRO_SECONDS = 2.4;
const ATLAS_CELL_W = 60;
const ATLAS_CELL_H = 100;
const ATLAS_COLUMNS = 16;
const FONT_SCALE = 0.78;
const SHAPES = { horizon: 0, pinch: 1, rise: 2, eclipse: 3, radiance: 4 } as const;
export type LightShape = keyof typeof SHAPES;

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const COMMON = `
float hash12(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}`;
const FIELD = `#version 300 es
precision highp float;
precision highp int;
uniform float uAspect;
uniform float uTime;
uniform int uShape;
uniform int uShapeB;
uniform float uMorph;
uniform vec2 uCenter;
uniform vec3 uRamp[8];
uniform int uCount;
uniform float uScale;
uniform float uSoftness;
uniform float uFlow;
uniform vec2 uSeed;
uniform vec4 uTrail[24];
uniform float uRadius;
uniform vec4 uClicks[4];
uniform float uIntro;
uniform float uFrame;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outAux;
${COMMON}
vec2 hash22(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy) * 2.0 - 1.0;
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i), f);
  float b = dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return 0.5 + 0.5 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 labToRgb(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 8.94841775e-2 * lab.y - 1.2914855480 * lab.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 encode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 horizon(vec2 p, float time, out float order) {
  float span = 0.5 * max(uAspect, 1.0);
  float x = p.x / span;
  float arch = -0.17 - 0.2 * x * x + 0.02 * sin(time * 0.6);
  float soft = mix(0.05, 0.22, uSoftness);
  float edge = p.y - arch;
  float rim = 0.38 * smoothstep(-soft, 0.42, edge);
  vec2 sun = vec2(0.08 * sin(time * 0.31) * span, 0.58);
  float spread = length((p - sun) / vec2(0.95 * span, 0.75));
  float sky = mix(0.55, 1.0, smoothstep(0.2, 0.95, spread));
  order = clamp(edge * 1.3, 0.0, 1.0);
  return vec3(rim, sky, smoothstep(0.18, 0.62, edge));
}
vec3 pinch(vec2 p, float time, out float order) {
  float span = 0.5 * max(uAspect, 0.75);
  float x = p.x / span;
  float sway = 0.02 * sin(x * 1.7 + time * 0.55);
  float breathe = 1.0 + 0.06 * sin(time * 0.8);
  float width = (0.13 + 0.22 * x * x) * breathe * mix(0.85, 1.2, uSoftness);
  float y = abs(p.y - sway) / width;
  float t = exp(-pow(y, 2.2)) * (0.42 + 0.58 * exp(-x * x * 1.8));
  order = clamp(abs(p.y - sway) * 2.4 + abs(x) * 0.3, 0.0, 1.0);
  return vec3(t, t, 0.0);
}
vec3 rise(vec2 p, float time, out float order) {
  float wide = max(uAspect, 0.9);
  vec2 center = vec2(0.05 * sin(time * 0.45) * wide, -0.7);
  vec2 radius = vec2(0.82 * wide, 0.64 * (1.0 + 0.04 * sin(time * 0.8)));
  float d = length((p - center) / radius);
  float soft = mix(0.6, 1.15, uSoftness);
  float t = clamp(pow(clamp(1.0 - d, 0.0, 1.0), soft) * 1.35, 0.0, 1.0);
  order = clamp((d - 0.2) * 1.3, 0.0, 1.0);
  return vec3(t, t, 0.0);
}
vec3 eclipse(vec2 p, float time, out float order) {
  float fit = min(1.0, uAspect * 1.25);
  float r = 0.23 * fit * (1.0 + 0.015 * sin(time * 0.9));
  float angle = atan(p.y, p.x);
  float rays = noise(vec2(cos(angle), sin(angle)) * 2.2 + time * 0.08) * 0.8 + 0.6;
  float d = length(p) - r;
  float reach = mix(0.07, 0.15, uSoftness) * rays * fit;
  float t = smoothstep(-0.006, 0.006 + 0.02 * uSoftness, d) * exp(-max(d, 0.0) / reach);
  order = clamp(d * 2.0, 0.0, 1.0);
  return vec3(t, t, 0.0);
}
/* Light from a point (the app's mark): brightest at its source, falling off outward in soft uneven rays. */
vec3 radiance(vec2 p, float time, out float order) {
  float d = length(p);
  float angle = atan(p.y, p.x);
  float rays = noise(vec2(cos(angle), sin(angle)) * 4.0 + time * 0.07) * 0.32 + 0.84;
  float reach = mix(0.16, 0.3, uSoftness) * rays * (1.0 + 0.03 * sin(time * 0.9));
  // A bright core round the source, then a long soft tail.
  float t = 0.62 * exp(-pow(d / (reach * 0.45), 1.3)) + 0.5 * exp(-d / reach);
  order = clamp(d * 1.8, 0.0, 1.0);
  return vec3(t, t, 0.0);
}
vec3 shapeOf(int s, vec2 q, float time, out float order) {
  if (s == 0) return horizon(q, time, order);
  if (s == 1) return pinch(q, time, order);
  if (s == 2) return rise(q, time, order);
  if (s == 4) return radiance(q - uCenter / uScale, time, order);
  return eclipse(q - uCenter / uScale, time, order);
}
vec4 tone(float t) {
  float x = smoothstep(0.3, 1.0, t) * float(uCount - 1);
  int index = int(floor(x));
  return vec4(mix(uRamp[index], uRamp[min(index + 1, uCount - 1)], fract(x)), smoothstep(0.0, 0.38, t));
}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float time = uTime;
  vec2 q = p / uScale;
  vec2 warp = vec2(noise(q * 1.6 + uSeed + vec2(0.0, time * 0.3)), noise(q * 1.6 + uSeed.yx + vec2(4.3, -time * 0.24))) - 0.5;
  float warpA = uShape == 3 ? 0.04 : uShape == 4 ? 0.07 : 0.18;
  float warpB = uShapeB == 3 ? 0.04 : uShapeB == 4 ? 0.07 : 0.18;
  q += warp * uFlow * mix(warpA, warpB, uMorph);
  float orderA = 0.0, orderB = 0.0;
  vec3 a = shapeOf(uShape, q, time, orderA);
  vec3 b = shapeOf(uShapeB, q, time, orderB);
  vec3 shape = mix(a, b, uMorph);
  float order = mix(orderA, orderB, uMorph);
  float reveal = clamp((uIntro * 1.45 - order) / 0.45, 0.0, 1.0);
  reveal = reveal * reveal * (3.0 - 2.0 * reveal);
  float scramble = 0.0;
  for (int i = 0; i < 24; i++) {
    vec4 point = uTrail[i];
    if (point.z <= 0.0) continue;
    vec2 d = p - point.xy;
    scramble = max(scramble, point.z * exp(-dot(d, d) / (uRadius * uRadius)));
  }
  for (int i = 0; i < 4; i++) {
    vec4 c = uClicks[i];
    if (c.w <= 0.0) continue;
    float d = length(p - c.xy);
    scramble = max(scramble, exp(-pow((d - c.z * 0.75) / 0.06, 2.0)) * c.w);
  }
  vec2 t = clamp(shape.xy * mix(0.7, 1.0, reveal), 0.0, 1.0);
  vec4 mixed = mix(tone(t.x), tone(t.y), shape.z);
  vec3 color = encode(labToRgb(mixed.rgb));
  float alpha = mixed.a * reveal;
  float dither = (hash12(gl_FragCoord.xy + uFrame * 13.7) - 0.5) / 255.0;
  outColor = clamp(vec4(color * alpha + dither, alpha + dither), 0.0, 1.0);
  outAux = vec4(reveal, scramble, 0.0, 1.0);
}`;
const GLYPHS = `
uniform sampler2D uField;
uniform sampler2D uAux;
uniform sampler2D uAtlas;
uniform vec2 uResolution;
uniform vec2 uCell;
uniform vec2 uOffset;
uniform vec2 uAtlasGrid;
uniform float uCount;
uniform float uDensity;
uniform float uOpacity;
uniform float uFlicker;
uniform float uDepth;
uniform float uGlyphTime;
uniform float uSeedValue;
${COMMON}
float sampleGlyph(float index, vec2 local, vec2 coord, float soft) {
  float column = mod(index, uAtlasGrid.x);
  float row = floor(index / uAtlasGrid.x);
  vec2 atlasUv = vec2((column + local.x) / uAtlasGrid.x, (row + 1.0 - local.y) / uAtlasGrid.y);
  vec2 continuous = coord / uAtlasGrid;
  float scale = exp2(soft);
  return textureGrad(uAtlas, atlasUv, dFdx(continuous) * scale, dFdy(continuous) * scale).a;
}
vec4 glyphAt(vec2 px) {
  vec2 coord = (px - uOffset) / uCell;
  vec2 cell = floor(coord);
  vec2 local = coord - cell;
  vec2 uv = clamp(((cell + 0.5) * uCell + uOffset) / uResolution, vec2(0.0), vec2(1.0));
  vec4 field = texture(uField, uv);
  vec4 aux = texture(uAux, uv);
  vec3 visible = field.rgb;
  float value = dot(visible, vec3(0.2126, 0.7152, 0.0722));
  float pick = hash12(cell + uSeedValue * 7.31);
  float level = hash12(cell * 1.73 + 4.1 + uSeedValue);
  float tick = floor(uGlyphTime * 9.0 + level * 9.0);
  float wobble = (hash12(cell * 2.31 + tick * 17.7) - 0.5) * uFlicker * 0.4 + (level - 0.5) * 0.1;
  float tone = clamp(pow(value, 0.75) + wobble, 0.0, 1.0);
  float index = floor(tone * (uCount - 1.0) + 0.5);
  float decode = max(aux.g, 1.0 - aux.r);
  if (decode > 0.02) {
    float frame = floor(uGlyphTime * 20.0);
    if (hash12(cell * 3.7 + frame * 5.3) < decode * 1.25) index = 1.0 + floor(hash12(cell + frame * 1.37) * (uCount - 1.0));
  }
  float present = step(pick, uDensity * mix(1.0, 0.3 + tone * 1.1, 0.55));
  float cutoff = smoothstep(0.03, 0.1, value);
  float focus = step(hash12(cell * 0.71 + 9.2 + uSeedValue), uDepth);
  float coverage = sampleGlyph(index, local, coord, focus * 1.2);
  float alpha = uOpacity * present * cutoff * coverage * mix(1.0, 0.35 + 0.65 * level, 0.55) * (1.0 - focus * 0.5);
  vec3 light = field.rgb * 0.55 + vec3(0.03) * field.a;
  return vec4(light * alpha, 0.6 * field.a * alpha);
}`;
const HALO = `#version 300 es
precision highp float;
uniform float uDownscale;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() { outColor = glyphAt(gl_FragCoord.xy * uDownscale); }`;
const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.2270270270;
  sum += texture(uSource, vUv + uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv - uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv + uStep * 3.2307692308) * 0.0702702703;
  sum += texture(uSource, vUv - uStep * 3.2307692308) * 0.0702702703;
  outColor = sum;
}`;
const COMPOSITE = `#version 300 es
precision highp float;
uniform sampler2D uHalo;
uniform float uGlow;
uniform float uGradient;
uniform float uGrain;
uniform float uFrame;
uniform float uFade;
in vec2 vUv;
out vec4 outColor;
${GLYPHS}
void main() {
  vec4 base = texture(uField, vUv) * uGradient;
  vec4 glyph = glyphAt(gl_FragCoord.xy);
  vec4 halo = texture(uHalo, vUv) * uGlow;
  vec4 color = base + glyph + halo;
  float grain = (hash12(gl_FragCoord.xy + uFrame * vec2(17.0, 59.0)) + hash12(gl_FragCoord.xy * 1.31 + uFrame * 7.0) - 1.0) * uGrain;
  float body = clamp(color.a, 0.0, 1.0);
  color.rgb += grain * (0.25 + body) * 0.5;
  color.a = clamp(color.a, 0.0, 1.0);
  color.rgb = clamp(color.rgb, 0.0, color.a);
  outColor = color * uFade;
}`;

type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };
type Target = { textures: WebGLTexture[]; framebuffer: WebGLFramebuffer; width: number; height: number };

const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function toLab([r, g, b]: readonly number[]): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(8.83024619e-2 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

function link(gl: WebGL2RenderingContext, fragment: string): Program | null {
  const vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!vertexShader || !fragmentShader || !program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  const uniforms: Program["uniforms"] = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, "");
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

function createTarget(gl: WebGL2RenderingContext, count: number): Target {
  const textures = Array.from({ length: count }, () => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  });
  return { textures, framebuffer: gl.createFramebuffer()!, width: 0, height: 0 };
}

function sizeTarget(gl: WebGL2RenderingContext, target: Target, width: number, height: number) {
  if (target.width === width && target.height === height) return;
  target.width = width;
  target.height = height;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  target.textures.forEach((texture, i) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, texture, 0);
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function buildAtlas(gl: WebGL2RenderingContext, characters: string, fontFamily: string) {
  const list = [...new Set([...characters])];
  const columns = Math.min(ATLAS_COLUMNS, list.length);
  const rows = Math.ceil(list.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_CELL_W * columns;
  canvas.height = ATLAS_CELL_H * rows;
  const context = canvas.getContext("2d");
  if (context) {
    context.font = `300 ${Math.round(ATLAS_CELL_H * FONT_SCALE)}px ${fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    list.forEach((char, i) => {
      context.fillText(char, (i % columns) * ATLAS_CELL_W + ATLAS_CELL_W / 2, Math.floor(i / columns) * ATLAS_CELL_H + ATLAS_CELL_H / 2 + 3);
    });
  }
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return { texture, count: list.length, grid: [columns, rows] as const };
}

/** What the light looks like; any of it can ease while it runs (`tween`). */
export interface LightSettings {
  colors: string[];
  shape: LightShape;
  shapeB: LightShape;
  /** From `shape` (0) to `shapeB` (1). */
  morph: number;
  /** Where the light comes from, in the shader's units (`lightAt`). */
  center: [number, number];
  scale: number;
  softness: number;
  /** 0 to fade it out, above 1 to brighten it for a moment. */
  fade: number;
  characters: string;
  cellSize: number;
  density: number;
  glyphOpacity: number;
  glow: number;
  depthOfField: number;
  flicker: number;
  flow: number;
  speed: number;
  gradientOpacity: number;
  grain: number;
  variation: number;
  scrambleRadius: number;
  fontFamily: string;
}

type Numeric = { [K in keyof LightSettings as LightSettings[K] extends number | [number, number] ? K : never]: LightSettings[K] };

export interface AsciiLight {
  settings: LightSettings;
  /** Scrambles in from its source outwards (at once with Reduce motion). */
  start(): void;
  /** Eases settings to new values over `ms`. */
  tween(to: Partial<Numeric>, ms: number): Promise<void>;
  stop(): void;
}

/** Where a point `x`, `y` (px) of a `width` by `height` window is, and the scale for a light `radius` px across. */
export function lightAt(x: number, y: number, radius: number, width = window.innerWidth, height = window.innerHeight) {
  return { center: [(x / width - 0.5) * (width / height), 0.5 - y / height] as [number, number], scale: radius / (0.23 * height) };
}

/** Starts the light on `canvas` (sized by its parent), or null where there is no WebGL2 (tests). */
export function createAsciiLight(canvas: HTMLCanvasElement, options: Partial<LightSettings> = {}): AsciiLight | null {
  const s: LightSettings = {
    colors: ["#0b1a6b", "#1f4fe0", "#4f8dff", "#cfe0ff"],
    shape: "radiance",
    shapeB: "radiance",
    morph: 0,
    center: [0, 0],
    scale: 1,
    softness: 0.75,
    fade: 1,
    characters: " =+xX0S8#@",
    cellSize: 14,
    density: 0.8,
    glyphOpacity: 0.85,
    glow: 0.3,
    depthOfField: 0.15,
    flicker: 0.2,
    flow: 0.5,
    speed: 1,
    gradientOpacity: 0.9,
    grain: 0.06,
    variation: 0,
    scrambleRadius: 0.1,
    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
    ...options,
  };
  if (typeof WebGL2RenderingContext === "undefined") return null;
  const gl = canvas.getContext?.("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }) ?? null;
  const parent = canvas.parentElement;
  if (!gl || !parent) return null;
  const field = link(gl, FIELD);
  const halo = link(gl, HALO);
  const blur = link(gl, BLUR);
  const composite = link(gl, COMPOSITE);
  if (!field || !halo || !blur || !composite) return null;
  const vao = gl.createVertexArray();
  const fieldTarget = createTarget(gl, 2);
  const haloA = createTarget(gl, 1);
  const haloB = createTarget(gl, 1);
  const still = stillMotion();
  const view = { width: 1, height: 1, ratio: 1 };
  const ramp = new Float32Array(MAX_COLORS * 3);
  const clickData = new Float32Array(MAX_CLICKS * 4);
  const trailData = new Float32Array(MAX_TRAIL * 4);
  const clicks: { x: number; y: number; age: number }[] = [];
  const trail: { x: number; y: number; age: number }[] = [];
  const pointer = { x: 0, y: 0, inside: false };
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const parse = (value: string) => {
    if (!probe) return [0, 0, 0];
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255];
  };
  let atlas = buildAtlas(gl, s.characters, s.fontFamily);
  let paletteKey = "";
  let time = 0;
  let glyphTime = 0;
  let introClock = still ? 1 : 0;
  let introOn = false;
  let frameSeed = 0;
  let grainClock = 0;
  let raf = 0;
  let last = 0;
  let stopped = false;

  const bindGlyphs = (prog: Program, width: number, height: number) => {
    const u = prog.uniforms;
    const cellH = s.cellSize * view.ratio;
    const cellW = cellH * (ATLAS_CELL_W / ATLAS_CELL_H);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[0]);
    gl.uniform1i(u.uField, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[1]);
    gl.uniform1i(u.uAux, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
    gl.uniform1i(u.uAtlas, 2);
    gl.uniform2f(u.uResolution, width, height);
    gl.uniform2f(u.uCell, cellW, cellH);
    gl.uniform2f(u.uOffset, (width - Math.ceil(width / cellW) * cellW) / 2, (height - Math.ceil(height / cellH) * cellH) / 2);
    gl.uniform2f(u.uAtlasGrid, atlas.grid[0], atlas.grid[1]);
    gl.uniform1f(u.uCount, atlas.count);
    gl.uniform1f(u.uDensity, s.density);
    gl.uniform1f(u.uOpacity, s.glyphOpacity);
    gl.uniform1f(u.uFlicker, still ? 0 : s.flicker);
    gl.uniform1f(u.uDepth, s.depthOfField);
    gl.uniform1f(u.uGlyphTime, glyphTime);
    gl.uniform1f(u.uSeedValue, s.variation);
  };

  // WebGL's gl.useProgram, by a name that doesn't read as a React hook.
  const select = gl.useProgram.bind(gl);
  const program = (p: Program) => select(p.program);
  const draw = () => {
    const key = s.colors.join(",");
    if (key !== paletteKey) {
      paletteKey = key;
      s.colors.forEach((color, i) => {
        ramp.set(toLab(parse(color)), i * 3);
      });
    }
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fieldTarget.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, fieldTarget.width, fieldTarget.height);
    program(field);
    const fu = field.uniforms;
    gl.uniform1f(fu.uAspect, view.width / view.height);
    gl.uniform1f(fu.uTime, time);
    gl.uniform1i(fu.uShape, SHAPES[s.shape]);
    gl.uniform1i(fu.uShapeB, SHAPES[s.shapeB]);
    gl.uniform1f(fu.uMorph, s.morph);
    gl.uniform2f(fu.uCenter, s.center[0], s.center[1]);
    gl.uniform3fv(fu.uRamp, ramp);
    gl.uniform1i(fu.uCount, s.colors.length);
    gl.uniform1f(fu.uScale, s.scale);
    gl.uniform1f(fu.uSoftness, s.softness);
    gl.uniform1f(fu.uFlow, s.flow);
    gl.uniform2f(fu.uSeed, s.variation * 3.17, s.variation * 1.91);
    gl.uniform4fv(fu.uTrail, trailData);
    gl.uniform1f(fu.uRadius, s.scrambleRadius);
    gl.uniform4fv(fu.uClicks, clickData);
    gl.uniform1f(fu.uIntro, introClock);
    gl.uniform1f(fu.uFrame, frameSeed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, haloA.width, haloA.height);
    program(halo);
    bindGlyphs(halo, canvas.width, canvas.height);
    gl.uniform1f(halo.uniforms.uDownscale, canvas.width / haloA.width);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    program(blur);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(blur.uniforms.uSource, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, haloB.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0]);
    gl.uniform2f(blur.uniforms.uStep, 1 / haloA.width, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, haloB.textures[0]);
    gl.uniform2f(blur.uniforms.uStep, 0, 1 / haloA.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    program(composite);
    bindGlyphs(composite, canvas.width, canvas.height);
    const cu = composite.uniforms;
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0]);
    gl.uniform1i(cu.uHalo, 3);
    gl.uniform1f(cu.uGlow, s.glow);
    gl.uniform1f(cu.uGradient, s.gradientOpacity);
    gl.uniform1f(cu.uGrain, s.grain);
    gl.uniform1f(cu.uFrame, frameSeed);
    gl.uniform1f(cu.uFade, s.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    view.width = Math.max(1, parent.clientWidth);
    view.height = Math.max(1, parent.clientHeight);
    view.ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(view.width * view.ratio);
    canvas.height = Math.round(view.height * view.ratio);
    sizeTarget(gl, fieldTarget, Math.max(1, Math.round(canvas.width / 2)), Math.max(1, Math.round(canvas.height / 2)));
    sizeTarget(gl, haloA, Math.max(1, Math.round(canvas.width / 4)), Math.max(1, Math.round(canvas.height / 4)));
    sizeTarget(gl, haloB, Math.max(1, Math.round(canvas.width / 4)), Math.max(1, Math.round(canvas.height / 4)));
    draw();
  };

  const age = (dt: number) => {
    for (const point of trail) point.age += dt;
    while (trail.length && trail[trail.length - 1].age > TRAIL_LIFE) trail.pop();
    for (let i = 0; i < MAX_TRAIL; i++) {
      const point = trail[i];
      if (!point) {
        trailData[i * 4 + 2] = 0;
        continue;
      }
      const k = 1 - point.age / TRAIL_LIFE;
      trailData.set([point.x, point.y, k * k, 0], i * 4);
    }
    for (const click of clicks) click.age += dt;
    while (clicks.length && clicks[clicks.length - 1].age > CLICK_LIFE) clicks.pop();
    for (let i = 0; i < MAX_CLICKS; i++) {
      const click = clicks[i];
      if (!click) {
        clickData[i * 4 + 3] = 0;
        continue;
      }
      const k = click.age / CLICK_LIFE;
      clickData.set([click.x, click.y, click.age, Math.min(1, click.age / 0.08) * (1 - k) * (1 - k)], i * 4);
    }
  };

  // Its own clock (performance.now), not the frame's timestamp, so it keeps time however the page is throttled.
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    if (document.hidden) {
      last = 0;
      return;
    }
    const dt = last ? clamp((now - last) / 1000, 0.001, 0.05) : 1 / 60;
    last = now;
    time += dt * s.speed * 0.5;
    glyphTime += dt * Math.max(s.speed, 0.15);
    if (introOn && introClock < 1) introClock = Math.min(1, introClock + dt / INTRO_SECONDS);
    grainClock += dt;
    if (grainClock > 1 / 24) {
      grainClock = 0;
      frameSeed = (frameSeed + 1) % 97;
    }
    age(dt);
    draw();
  };

  const locate = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(1, rect.width);
    const y = 1 - (event.clientY - rect.top) / Math.max(1, rect.height);
    pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    pointer.x = (x - 0.5) * (rect.width / Math.max(1, rect.height));
    pointer.y = y - 0.5;
  };
  const onMove = (event: PointerEvent) => {
    locate(event);
    if (!pointer.inside || still) return;
    const head = trail[0];
    const gap = head ? Math.hypot(pointer.x - head.x, pointer.y - head.y) : Number.POSITIVE_INFINITY;
    if (gap < TRAIL_STEP) return;
    if (head && head.age < 0.1) {
      const steps = Math.min(6, Math.floor(gap / (TRAIL_STEP * 2)));
      for (let i = 1; i <= steps; i++) {
        const k = i / (steps + 1);
        trail.unshift({ x: head.x + (pointer.x - head.x) * k, y: head.y + (pointer.y - head.y) * k, age: 0 });
      }
    }
    trail.unshift({ x: pointer.x, y: pointer.y, age: 0 });
    trail.length = Math.min(trail.length, MAX_TRAIL);
  };
  const onDown = (event: PointerEvent) => {
    locate(event);
    if (!pointer.inside || still) return;
    clicks.unshift({ x: pointer.x, y: pointer.y, age: 0 });
    if (clicks.length > MAX_CLICKS) clicks.pop();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  resize();
  // With Reduce motion it is drawn once and then only when it moves (`tween`).
  if (!still) raf = requestAnimationFrame(frame);
  void document.fonts?.load?.(`300 64px ${s.fontFamily}`, s.characters).then(() => {
    if (stopped) return;
    atlas = buildAtlas(gl, s.characters, s.fontFamily);
    draw();
  });

  return {
    settings: s,
    start() {
      introOn = true;
      if (still) {
        introClock = 1;
        draw();
      }
    },
    tween(to, ms) {
      const keys = Object.keys(to) as (keyof Numeric)[];
      const from = Object.fromEntries(keys.map((key) => [key, structuredClone(s[key])])) as Partial<Numeric>;
      const start = performance.now();
      const ease = (k: number) => 1 - (1 - k) ** 4;
      return new Promise((done) => {
        const step = () => {
          if (stopped) return done();
          const k = still || !ms ? 1 : clamp((performance.now() - start) / ms, 0, 1);
          const e = ease(k);
          for (const key of keys) {
            const a = from[key] as number | [number, number];
            const b = to[key] as number | [number, number];
            (s as unknown as Record<string, unknown>)[key] =
              Array.isArray(a) && Array.isArray(b) ? a.map((v, i) => v + (b[i] - v) * e) : (a as number) + ((b as number) - (a as number)) * e;
          }
          if (still) draw();
          if (k < 1) requestAnimationFrame(step);
          else done();
        };
        step();
      });
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
