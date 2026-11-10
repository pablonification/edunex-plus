// The iPhone's widgets and Live Activity (mobile/src/widget-ios/), run here on Node: the very functions the widget
// extension runs, bundled as expo-widgets bundles them (no imports at run time; `@expo/ui/swift-ui` and its
// modifiers stand in as plain nodes), on documents from the pretend Edunex and SIX, for every family, light and dark.
// Each must draw without throwing and say something. With WIDGET_IOS_PREVIEW=<folder> it also writes
// `ios-widgets.html` there: a sketch of each one (SwiftUI's stacks as flexbox, iOS's sizes on a 393-point iPhone),
// for looking at before an iPhone can. It is not iOS's drawing: the phone has the last word (mobile/IOS.md).
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build, type Plugin } from "esbuild";
import { beforeAll, describe, expect, it } from "vitest";
import type { WidgetTarget } from "../../mobile/src/widget/model";
import { widgetModel } from "../../mobile/src/widget/model";
import { type IosWidgetDoc, iosWidgetDoc, setupDoc } from "../../mobile/src/widget-ios/doc";
import { type LiveDoc, liveDoc } from "../../mobile/src/widget-ios/live-doc";
import { startEngine } from "../engine/harness";
import { startHome } from "../engine/needs-harness";

// ---------------------------------------------------------------- the widgets' code, as the extension gets it

type Node = { type: string; props: Record<string, unknown>; children: unknown[] };
type Layout = (props: unknown, env: Record<string, unknown>) => unknown;

/** What the widgets use of `@expo/ui/swift-ui` (as mobile/src/widget-ios/expo-widgets.d.ts lists it). */
const VIEWS = ["VStack", "HStack", "ZStack", "Text", "Spacer", "RoundedRectangle", "Capsule", "Circle", "Link", "ProgressView", "AccessoryWidgetBackground"];
const MODIFIERS = [
  "font",
  "foregroundStyle",
  "frame",
  "padding",
  "background",
  "clipShape",
  "lineLimit",
  "monospacedDigit",
  "minimumScaleFactor",
  "opacity",
  "redacted",
  "widgetURL",
  "containerBackground",
  "accessibilityLabel",
  "accessibilityElement",
  "layoutPriority",
  "tint",
  "activityBackgroundTint",
];

/** `@expo/ui/swift-ui`'s views and modifiers as plain data, and the JSX runtime that builds it. */
const STUBS: Record<string, string> = {
  "@expo/ui/swift-ui": `
    for (const name of ${JSON.stringify(VIEWS)}) exports[name] = Object.assign((props) => ({ __view: name, props }), { __native: true });`,
  "@expo/ui/swift-ui/modifiers": `
    for (const name of ${JSON.stringify(MODIFIERS)}) exports[name] = (...args) => ({ $type: name, args });`,
  "expo-widgets": `
    exports.createWidget = (name, layout) => ({ name, layout });
    exports.createLiveActivity = (name, layout) => ({ name, layout });`,
  "stub/jsx-runtime": `
    const make = (type, config) => {
      const { children, ...props } = config ?? {};
      if (typeof type === "function" && !type.__native) return { __call: type, props: config };
      return { __el: type, props, children: children === undefined ? [] : [children].flat(Infinity) };
    };
    exports.jsx = make; exports.jsxs = make; exports.Fragment = "Fragment";`,
};

const stubs: Plugin = {
  name: "widget-stubs",
  setup(b) {
    b.onResolve({ filter: /^(@expo\/ui\/swift-ui(\/modifiers)?|expo-widgets|stub\/jsx-runtime)$/ }, (args) => ({ path: args.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: STUBS[args.path], loader: "js" }));
  },
};

async function load(file: string): Promise<Layout> {
  const out = await build({
    entryPoints: [resolve(__dirname, "../../mobile/src/widget-ios", file)],
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
    jsx: "automatic",
    jsxImportSource: "stub",
    define: { "process.env.EXPO_PUBLIC_DEMO": '"1"' },
    plugins: [stubs],
    logLevel: "silent",
  });
  const module = { exports: {} as { default: { layout: Layout } } };
  new Function("module", "exports", "require", out.outputFiles[0]!.text)(module, module.exports, require);
  return module.exports.default.layout;
}

/** The JSX as a tree of views: a `{__view}` element is a SwiftUI view; Fragments flatten. */
function tree(node: unknown): unknown[] {
  if (node === null || node === undefined || node === false || node === true) return [];
  if (Array.isArray(node)) return node.flatMap(tree);
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  const el = node as { __el?: unknown; __call?: (p: unknown) => unknown; props?: Record<string, unknown>; children?: unknown[] };
  if (el.__call) return tree(el.__call(el.props));
  if (el.__el === "Fragment") return tree(el.children);
  const view = el.__el as ((props: unknown) => { __view: string }) | undefined;
  if (typeof view === "function") {
    const { __view } = view({});
    return [{ type: __view, props: el.props ?? {}, children: tree(el.children) } satisfies Node];
  }
  return [];
}

const texts = (nodes: unknown[]): string[] =>
  nodes
    .flatMap((n) =>
      typeof n === "string"
        ? [n]
        : (n as Node).type === "Text"
          ? [...texts((n as Node).children), (n as Node).props.timerInterval ? "0:00" : ""]
          : texts((n as Node).children),
    )
    .filter(Boolean);

// ---------------------------------------------------------------- the states, from the pretend Edunex and SIX

const link = (open: WidgetTarget) => `edunexplusdemo://${open.kind}`;
type Harness = { engine: { snapshot(): Parameters<typeof widgetModel>[0] }; world: { clock: { now(): number } } };
const docOf = (h: Harness): IosWidgetDoc => iosWidgetDoc(widgetModel(h.engine.snapshot(), h.world.clock.now()), "Edunex Plus Demo", link);

const states: { name: string; doc: IosWidgetDoc; live: LiveDoc | null; now: number }[] = [];
let now: Layout;
let today: Layout;
let live: Layout;

beforeAll(async () => {
  [now, today, live] = await Promise.all([load("now.tsx"), load("today.tsx"), load("live.tsx")]);
  const take = (name: string, h: Harness) => {
    const doc = docOf(h);
    states.push({ name, doc, live: liveDoc(h.engine.snapshot(), h.world.clock.now(), doc), now: h.world.clock.now() });
  };
  const h = await startHome();
  take("Kam pagi · kuliah berlangsung, Presensi terbuka", h);
  h.world.six.openCheckIn("2194342");
  await h.until("2026-10-08T08:40:00+07:00");
  take("Kam 08:40 · Tandai Hadir dibuka di SIX", h);
  await h.until("2026-10-08T10:30:00+07:00");
  take("Kam 10:30 · kuliah berikutnya hari ini", h);
  await h.until("2026-10-08T18:00:00+07:00");
  take("Kam 18:00 · kuliah berikutnya besok", h);
  await h.until("2026-10-10T09:00:00+07:00");
  take("Sab 09:00 · tidak ada kuliah hari ini", h);
  take("Belum masuk ke mana pun", await startEngine());
  states.push({
    name: "Belum ada data",
    doc: setupDoc("Edunex Plus Demo", "Hubungkan Edunex atau SIX dulu", "edunexplusdemo://"),
    live: null,
    now: Date.now(),
  });
  states.push({ name: "Galeri widget (sebelum aplikasi dibuka)", doc: setupDoc("Edunex Plus Demo", null, ""), live: null, now: Date.now() });
}, 120_000);

const HOME = ["systemSmall", "systemMedium", "systemLarge"] as const;
const LOCK = ["accessoryRectangular", "accessoryCircular", "accessoryInline"] as const;
const MARGINS = { top: 16, bottom: 16, leading: 16, trailing: 16 };
const envOf = (family: string, scheme: "light" | "dark") => ({
  widgetFamily: family,
  colorScheme: scheme,
  widgetContentMargins: MARGINS,
  configuration: undefined,
});

describe("the iPhone widgets, run as the extension runs them", () => {
  it("every widget draws every state, in every family, light and dark, and says something", () => {
    expect(states.length).toBe(8);
    for (const state of states)
      for (const [name, layout, families] of [
        ["EdunexNow", now, [...HOME, ...LOCK]],
        ["EdunexToday", today, [...HOME, "accessoryRectangular", "accessoryInline"]],
      ] as const)
        for (const family of families)
          for (const scheme of ["light", "dark"] as const) {
            const drawn = tree(layout(state.doc, envOf(family, scheme)));
            expect(drawn.length, `${name} ${family} ${scheme}: ${state.name}`).toBeGreaterThan(0);
            expect(texts(drawn).length, `${name} ${family} ${scheme}: ${state.name}`).toBeGreaterThan(0);
          }
  });

  it("the Live Activity draws each of its places while a class is on", () => {
    const on = states.flatMap(({ name, live: doc, now }) => (doc ? [{ name, doc, now }] : []));
    expect(on.length).toBe(2);
    for (const state of on)
      for (const scheme of ["light", "dark"] as const) {
        const regions = live(onPhoneClock(state.doc, state.now), { colorScheme: scheme }) as Record<string, unknown>;
        for (const region of ["banner", "compactLeading", "compactTrailing", "minimal", "expandedLeading", "expandedTrailing", "expandedBottom"])
          expect(tree(regions[region]).length, `${region} ${scheme}: ${state.name}`).toBeGreaterThan(0);
      }
  });

  it.runIf(Boolean(process.env.WIDGET_IOS_PREVIEW))("writes the sketches", () => {
    const folder = resolve(process.env.WIDGET_IOS_PREVIEW!);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "ios-widgets.html"), page());
    for (const index of states.keys()) writeFileSync(join(folder, `ios-widgets-${index + 1}.html`), page([index]));
  });
});

// ---------------------------------------------------------------- the sketch: SwiftUI's stacks as flexbox

/** A 393-point iPhone (15, 16): the Home Screen's three sizes and the Lock Screen's, in points. */
const SIZE: Record<string, [number, number]> = {
  systemSmall: [170, 170],
  systemMedium: [364, 170],
  systemLarge: [364, 382],
  accessoryRectangular: [172, 76],
  accessoryCircular: [76, 76],
  accessoryInline: [240, 22],
};
const TYPE: Record<string, [number, number]> = {
  caption2: [11, 13],
  caption: [12, 16],
  footnote: [13, 18],
  subheadline: [15, 20],
  body: [17, 22],
  headline: [17, 22],
  title3: [20, 25],
};
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mods = (node: Node) => ((node.props.modifiers as { $type: string; args: unknown[] }[] | undefined) ?? []).map((m) => [m.$type, m.args] as const);

function css(node: Node, lock: boolean): { style: string[]; bg: string | null; url: string | null } {
  const style: string[] = [];
  let bg: string | null = null;
  let url: string | null = null;
  const colour = (value: unknown) =>
    value === "primary"
      ? lock
        ? "#fff"
        : "inherit"
      : value === "secondary"
        ? lock
          ? "rgba(255,255,255,.62)"
          : "#8a8f98"
        : value === "clear"
          ? "transparent"
          : String(value);
  for (const [type, args] of mods(node)) {
    const a = args[0] as Record<string, number | string> | string | number | undefined;
    if (type === "frame" && typeof a === "object") {
      if (a.width) style.push(`width:${a.width}px;flex:none`);
      if (a.height) style.push(`height:${a.height}px`);
      if (Number(a.maxWidth) >= 1000) style.push("align-self:stretch;width:100%");
      if (Number(a.maxHeight) >= 1000) style.push("flex:1 1 auto;min-height:0");
    } else if (type === "padding" && typeof a === "object") {
      const all = Number(a.all ?? 0);
      const h = Number(a.horizontal ?? all);
      const v = Number(a.vertical ?? all);
      style.push(`padding:${v}px ${h}px`);
    } else if (type === "background") style.push(`background:${colour(a)}`);
    else if (type === "clipShape") style.push(`border-radius:${args[1] ?? 999}px`);
    else if (type === "foregroundStyle") style.push(`color:${colour(a)}`);
    else if (type === "font" && typeof a === "object") {
      const [size, line] = TYPE[String(a.textStyle)] ?? [17, 22];
      const weight = { regular: 400, medium: 500, semibold: 600, bold: 700 }[String(a.weight ?? (a.textStyle === "headline" ? "semibold" : "regular"))];
      style.push(`font-size:${size}px;line-height:${line}px;font-weight:${weight}`);
    } else if (type === "lineLimit") style.push(`display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${a};overflow:hidden`);
    else if (type === "redacted") style.push("color:transparent!important;background:currentColor;opacity:.18;border-radius:4px");
    else if (type === "monospacedDigit") style.push("font-variant-numeric:tabular-nums");
    else if (type === "containerBackground") bg = colour(a);
    else if (type === "widgetURL") url = String(a);
    else if (type === "tint") style.push(`--tint:${colour(a)}`);
  }
  return { style, bg, url };
}

function html(node: unknown, lock: boolean, nowAt: number): string {
  if (typeof node === "string") return esc(node);
  const n = node as Node;
  const { style } = css(n, lock);
  const inner = n.children.map((child) => html(child, lock, nowAt)).join("");
  const gap = n.props.spacing ?? 8;
  const align = (value: unknown, axis: "v" | "h") =>
    ({ leading: "flex-start", trailing: "flex-end", top: "flex-start", bottom: "flex-end", center: "center" })[String(value ?? "center")] ??
    (axis ? "center" : "center");
  switch (n.type) {
    case "VStack":
      return `<div style="display:flex;flex-direction:column;gap:${gap}px;align-items:${align(n.props.alignment, "v")};min-width:0;${style.join(";")}">${inner}</div>`;
    case "HStack":
      return `<div style="display:flex;flex-direction:row;gap:${gap}px;align-items:${align(n.props.alignment, "h")};min-width:0;${style.join(";")}">${inner}</div>`;
    case "ZStack":
      return `<div style="display:grid;place-items:center;${style.join(";")}">${n.children.map((c) => `<div style="grid-area:1/1">${html(c, lock, nowAt)}</div>`).join("")}</div>`;
    case "Text": {
      const interval = n.props.timerInterval as { upper: Date } | undefined;
      const body = interval ? clock(interval.upper.getTime() - nowAt) : inner;
      return `<span style="display:block;min-width:0;${style.join(";")}">${body}</span>`;
    }
    case "Spacer":
      return `<div style="flex:1 1 0;min-width:${n.props.minLength ?? 8}px;min-height:${n.props.minLength ?? 8}px"></div>`;
    case "RoundedRectangle":
      return `<div style="border-radius:${n.props.cornerRadius ?? 0}px;${style.join(";").replace(/(^|;)color:/, "$1background:")}"></div>`;
    case "AccessoryWidgetBackground":
      return `<div style="width:76px;height:76px;border-radius:50%;background:rgba(255,255,255,.18)"></div>`;
    case "ProgressView": {
      const range = n.props.timerInterval as { lower: Date; upper: Date };
      const done = Math.max(0, Math.min(1, (nowAt - range.lower.getTime()) / (range.upper.getTime() - range.lower.getTime())));
      const tint = style.find((s) => s.startsWith("--tint:"))?.slice(7) ?? "#2f6feb";
      return `<div style="display:flex;flex-direction:column;gap:4px;align-self:stretch">${inner}<div style="height:4px;border-radius:2px;background:rgba(127,127,127,.25)"><div style="height:4px;border-radius:2px;width:${done * 100}%;background:${tint}"></div></div></div>`;
    }
    case "Link":
      return `<div style="outline:1px dashed rgba(47,111,235,.35);outline-offset:2px;border-radius:6px;${style.join(";")}">${inner}</div>`;
    default:
      return `<div>${inner}</div>`;
  }
}

/** iOS's countdown: "9:05", "1:47:27". */
const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60];
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

/** The activity reads the phone's clock (Date.now): its moments moved onto it, as the app's writer does for the demo. */
function onPhoneClock(doc: LiveDoc, at: number): LiveDoc {
  const offset = at - Date.now();
  return {
    ...doc,
    startsAt: doc.startsAt - offset,
    endsAt: doc.endsAt - offset,
    presence: doc.presence ? { ...doc.presence, closesAt: doc.presence.closesAt - offset } : null,
  };
}

function card(layout: Layout, doc: unknown, family: string, scheme: "light" | "dark", nowAt: number): string {
  const lock = family.startsWith("accessory");
  const [w, h] = SIZE[family]!;
  const root = tree(layout(doc, envOf(family, scheme)))[0] as Node;
  const { bg } = css(root, lock);
  const pad = lock ? 0 : 16;
  const face = `font-family:-apple-system,'SF Pro Text',system-ui,sans-serif;color:${lock ? "#fff" : scheme === "dark" ? "#f2f3f5" : "#14171c"}`;
  return `<figure><div style="${face};width:${w}px;height:${h}px;box-sizing:border-box;padding:${pad}px;border-radius:${lock ? (family === "accessoryCircular" ? 999 : 12) : 22}px;overflow:hidden;display:flex;flex-direction:column;background:${lock ? "transparent" : (bg ?? "#fff")};${lock ? "" : "box-shadow:0 1px 3px rgba(0,0,0,.12)"}">${html(root, lock, nowAt)}</div><figcaption>${family.replace(/^(system|accessory)/, "")}</figcaption></figure>`;
}

function page(only?: number[]): string {
  const rows = states
    .filter((_, index) => !only || only.includes(index))
    .map((state) => {
      const home = (layout: Layout, scheme: "light" | "dark") => HOME.map((f) => card(layout, state.doc, f, scheme, state.now)).join("");
      const lock = (layout: Layout, families: readonly string[]) => families.map((f) => card(layout, state.doc, f, "dark", state.now)).join("");
      const activity = state.live
        ? (["light", "dark"] as const)
            .map((scheme) => {
              const regions = live(onPhoneClock(state.live!, state.now), { colorScheme: scheme }) as Record<string, unknown>;
              const banner = tree(regions.banner)[0];
              const island = ["compactLeading", "compactTrailing"].map((r) => html(tree(regions[r])[0], true, Date.now())).join('<span style="flex:1"></span>');
              return `<figure><div style="font-family:-apple-system,system-ui;width:364px;border-radius:22px;background:${scheme === "dark" ? "#1c1c1e" : "#f2f2f7"};color:${scheme === "dark" ? "#fff" : "#000"}">${html(banner, false, Date.now())}</div><figcaption>Live Activity · Lock Screen · ${scheme}</figcaption></figure>
            <figure><div style="font-family:-apple-system,system-ui;width:250px;height:37px;border-radius:20px;background:#000;color:#fff;display:flex;align-items:center;padding:0 14px;box-sizing:border-box">${island}</div><figcaption>Dynamic Island</figcaption></figure>`;
            })
            .join("")
        : "";
      return `<section><h2>${esc(state.name)}</h2>
      <h3>Edunex Plus</h3><div class="row light">${home(now, "light")}</div><div class="row dark">${home(now, "dark")}</div><div class="row lock">${lock(now, LOCK)}</div>
      <h3>Hari ini</h3><div class="row light">${home(today, "light")}</div><div class="row dark">${home(today, "dark")}</div><div class="row lock">${lock(today, ["accessoryRectangular", "accessoryInline"])}</div>
      ${activity ? `<h3>Live Activity</h3><div class="row lock">${activity}</div>` : ""}</section>`;
    });
  return `<!doctype html><html><head><meta charset="utf-8"><title>iPhone widgets (sketch)</title><style>
    body{margin:0;padding:24px;font:14px system-ui;background:#fafafa;color:#222}
    h1{font-size:20px} h2{font-size:16px;margin:32px 0 8px} h3{font-size:13px;color:#666;margin:14px 0 6px}
    .row{display:flex;flex-wrap:wrap;gap:16px;padding:16px;border-radius:12px;align-items:flex-start}
    .light{background:#dfe6ee}.dark{background:#20242b}.lock{background:#1f2c46}
    figure{margin:0}figcaption{font-size:11px;color:#888;margin-top:4px}
  </style></head><body><h1>iPhone widgets: a sketch from the demo's data</h1>
  <p>The widgets' own code on the pretend Edunex and SIX, drawn with flexbox, not by iOS. Dashed outlines are links.
  Sizes are a 393-point iPhone's. The phone has the last word.</p>${rows.join("")}</body></html>`;
}
