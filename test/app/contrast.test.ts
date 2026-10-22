// Every text color the design system pairs with a background is readable in
// both themes: WCAG AA, 4.5:1 for text and 3:1 for the focus ring. The values
// are read from the stylesheet itself, so a token change that breaks
// readability fails here.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(import.meta.dirname, "../../src/app/styles.css"), "utf8");

function block(source: string, start: number): string {
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(source.indexOf("{", start) + 1, i);
  }
  throw new Error("unbalanced stylesheet");
}

function variables(text: string): Map<string, string> {
  return new Map([...text.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const light = variables(block(css, css.indexOf(":root")));
const darkMedia = css.indexOf("@media (prefers-color-scheme: dark)");
const dark = new Map([...light, ...variables(block(css, css.indexOf(":root", darkMedia)))]);

function lookup(theme: Map<string, string>, name: string): string {
  let value = theme.get(name);
  for (let guard = 0; value?.startsWith("var("); guard++) {
    if (guard > 5) throw new Error(`circular ${name}`);
    value = theme.get(value.slice(4, -1).trim());
  }
  if (!value) throw new Error(`${name} is not defined`);
  return value;
}

const hex = (channels: number[]) => `#${channels.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/**
 * A token as the plain color the eye sees. A see-through token ("rgb(0 0 0 /
 * 0.065)", --selected) is blended over the background it sits on, given as
 * "--selected@--sidebar".
 */
function resolve(theme: Map<string, string>, token: string): string {
  const [name, over] = token.split("@");
  const value = lookup(theme, name);
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const rgba = value.match(/^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/);
  if (!rgba || !over) throw new Error(`${name} is not a plain color: ${value}`);
  const base = resolve(theme, over);
  const alpha = Number(rgba[4]);
  return hex([1, 2, 3].map((i) => Number(rgba[i]) * alpha + Number.parseInt(base.slice(i * 2 - 1, i * 2 + 1), 16) * (1 - alpha)));
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_ON = ["--canvas", "--sidebar", "--surface", "--raised", "--welcome", "--fill"];
// Where rows and controls show they're hovered, picked or quiet: text keeps reading there too
// (--selected@--raised: the picked result in ⌘K search, a raised dialog).
const STATE_ON = ["--hover", "--sunken", "--selected@--sidebar", "--selected@--surface", "--selected@--raised"];
const pairs: [string, string, number][] = [
  ...["--fg", "--muted", "--faint"].flatMap((fg) => [...TEXT_ON, ...STATE_ON].map((bg) => [fg, bg, 4.5] as [string, string, number])),
  ...["--canvas", "--surface", "--raised", "--hover", "--sunken", "--selected@--surface"].map((bg) => ["--accent-fg", bg, 4.5] as [string, string, number]),
  ["--on-accent", "--accent", 4.5],
  ["--on-accent", "--accent-hover", 4.5],
  ...["danger", "warning", "success", "info", "neutral"].map((tone) => [`--${tone}-fg`, `--${tone}-bg`, 4.5] as [string, string, number]),
  ...["not-started", "draft", "submitted", "overdue", "closed", "review"].map((s) => [`--status-${s}-fg`, `--status-${s}-bg`, 4.5] as [string, string, number]),
  ["--source-itb-fg", "--source-itb-bg", 4.5],
  ["--tooltip-fg", "--tooltip-bg", 4.5],
  ["--focus", "--canvas", 3],
  ["--focus", "--raised", 3],
  // A meter's fill on its track (attendance, a window's time left): 3:1, like any mark that carries meaning.
  ...["--meter-warning", "--meter-success", "--danger-fg", "--accent"].map((fill) => [fill, "--meter-track", 3] as [string, string, number]),
  // A field's edge and a switch that's off show where the control is: 3:1 on what they sit on.
  ...["--canvas", "--surface", "--raised", "--sunken", "--fill"].map((bg) => ["--field-edge", bg, 3] as [string, string, number]),
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme", (_name, theme) => {
  it.each(pairs)("%s on %s is readable", (fg, bg, minimum) => {
    expect(contrast(resolve(theme, fg), resolve(theme, bg))).toBeGreaterThanOrEqual(minimum);
  });
});
