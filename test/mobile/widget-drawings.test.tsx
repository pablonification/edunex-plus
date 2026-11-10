// The widgets' drawings (mobile/src/widget/view.tsx, views.tsx) at every size a launcher gives them, light and dark,
// from the pretend Thursday's models: every tap lands on its own place, and nothing is drawn that doesn't fit. Android's
// renderer needs a phone, so the same trees are walked here, and written out as a page of pictures when
// WIDGET_GALLERY=<file.html> is set (open it, or screenshot it, to see each layout).
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Route } from "../../src/core/route";
import { startHome } from "../engine/needs-harness";

const paths = vi.hoisted(() => {
  const phone = process.getBuiltinModule("node:module").createRequire(`${process.cwd()}/mobile/package.json`);
  return { reactNative: phone.resolve("react-native") };
});

// The library's parts as plain markers (the walk below reads their props); Android's own modules as the little they're used for.
vi.mock("../../mobile/src/widget/kit", () => {
  const part = (name: string) => Object.assign(() => null, { __name__: name });
  return { FlexWidget: part("FlexWidget"), TextWidget: part("TextWidget"), SvgWidget: part("SvgWidget") };
});
vi.mock(paths.reactNative, () => ({ Platform: { OS: "android", select: (options: Record<string, unknown>) => options.android ?? options.default } }));
vi.mock("../../mobile/src/host/version", () => ({ DEMO: false }));
vi.mock("../../mobile/src/nav", () => ({
  // ../nav.ts's paths, for the routes a widget opens.
  hrefOf: (route: Route) => {
    switch (route.screen) {
      case "home":
        return "/";
      case "task":
        return `/task/${route.taskId}`;
      case "exam":
        return `/exam/${encodeURIComponent(route.examId)}`;
      case "course":
        return `/course/${encodeURIComponent(route.code)}${route.tab ? `?tab=${route.tab}` : ""}`;
      case "presence":
        return "/courses";
      default:
        return `/${route.screen}`;
    }
  },
}));

const { attendanceWidget, courseWidget, dueWidget, examWidget, nextWidget, servicesWidget, widgetFacts, widgetModel } = await import(
  "../../mobile/src/widget/model"
);
const { THEMES } = await import("../../mobile/src/ui/theme");
const { todayDrawing, widgetDrawing } = await import("../../mobile/src/widget/view");
const { AttendanceView, CourseView, DueView, ExamView, NextView, ServicesView } = await import("../../mobile/src/widget/views");

// ---------------------------------------------------------------- the walk

type Element = { type: unknown; props: Record<string, unknown> } | string | number | null | undefined | false | Element[];
interface Drawn {
  html: string;
  /** Every tap area: what it opens, and what TalkBack says for it. */
  taps: { action: string; uri: string | null; label: string | null }[];
  texts: string[];
}

const px = (value: unknown) => (typeof value === "number" ? `${value}px` : value === "match_parent" ? "100%" : "auto");

function css(style: Record<string, unknown> = {}): string {
  const out: string[] = ["display:flex", "box-sizing:border-box", "flex-shrink:0", "min-width:0"];
  const map: Record<string, (value: unknown) => string> = {
    width: (value) => `width:${px(value)}`,
    height: (value) => `height:${px(value)}`,
    flex: (value) => `flex:${value} 1 0;min-height:0`,
    flexDirection: (value) => `flex-direction:${value}`,
    justifyContent: (value) => `justify-content:${value}`,
    alignItems: (value) => `align-items:${value}`,
    flexGap: (value) => `gap:${value}px`,
    padding: (value) => `padding:${value}px`,
    paddingHorizontal: (value) => `padding-left:${value}px;padding-right:${value}px`,
    paddingVertical: (value) => `padding-top:${value}px;padding-bottom:${value}px`,
    borderRadius: (value) => `border-radius:${value}px`,
    backgroundColor: (value) => `background:${value}`,
  };
  if (!style.flexDirection) out.push("flex-direction:column");
  for (const [key, value] of Object.entries(style)) if (map[key]) out.push(map[key](value));
  return out.join(";");
}

/** The phone's text size: Android draws a widget's text in sp. */
let fontScale = 1;

function walk(node: Element, drawn: Drawn): string {
  if (node === null || node === undefined || node === false) return "";
  if (Array.isArray(node)) return node.map((one) => walk(one, drawn)).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  let element = node;
  while (typeof element.type === "function" && !(element.type as { __name__?: string }).__name__) {
    element = (element.type as (props: unknown) => Element)(element.props) as typeof element;
    if (!element || typeof element !== "object" || Array.isArray(element)) return walk(element, drawn);
  }
  const name = (element.type as { __name__: string }).__name__;
  const {
    style = {},
    children,
    clickAction,
    clickActionData,
    accessibilityLabel,
  } = element.props as {
    style?: Record<string, unknown> & { fontSize?: number; fontWeight?: string; color?: string; width?: number; height?: number };
    children?: unknown;
    clickAction?: string;
    clickActionData?: { uri?: string };
    accessibilityLabel?: string;
  };
  if (clickAction) drawn.taps.push({ action: clickAction, uri: clickActionData?.uri ?? null, label: accessibilityLabel ?? null });
  const tap = clickAction ? ` data-tap="${clickActionData?.uri ?? clickAction}"` : "";
  if (name === "TextWidget") {
    const { text, maxLines = 1 } = element.props as { text: string; maxLines?: number };
    drawn.texts.push(text);
    const clamp = maxLines === 1 ? "white-space:nowrap;" : `display:-webkit-box;-webkit-line-clamp:${maxLines};-webkit-box-orient:vertical;`;
    return `<div${tap} style="flex-shrink:1;min-width:0;overflow:hidden;text-overflow:ellipsis;${clamp}font-size:${style.fontSize * fontScale}px;line-height:${Math.round(style.fontSize * fontScale * 1.3)}px;color:${style.color};font-weight:${style.fontWeight === "700" ? 700 : style.fontWeight === "500" ? 600 : 400}">${text}</div>`;
  }
  if (name === "SvgWidget") {
    const { svg } = element.props as { svg: string };
    return `<div style="width:${style.width}px;height:${style.height}px;flex-shrink:0">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>`;
  }
  return `<div${tap} style="${css(style)}">${walk(children as Element, drawn)}</div>`;
}

function draw(tree: unknown, size: { width: number; height: number }): Drawn {
  const drawn: Drawn = { html: "", taps: [], texts: [] };
  drawn.html = `<div style="width:${size.width}px;height:${size.height}px;display:flex;overflow:hidden;border-radius:20px">${walk(tree as Element, drawn)}</div>`;
  return drawn;
}

// ---------------------------------------------------------------- the sizes

/** Cells to dp, as Android's table estimates a phone in portrait (73n − 16 wide, 118m − 16 high), and a tighter launcher's rows. */
const cell = (w: number, h: number, tight = false) => ({
  label: `${w}×${h}${tight ? " (tight)" : ""}`,
  width: 73 * w - 16,
  height: (tight ? 86 : 118) * h - 16,
});
const SIZES: Record<string, ReturnType<typeof cell>[]> = {
  Now: [cell(2, 1), cell(4, 1), cell(4, 2, true), cell(4, 2), cell(5, 3)],
  Today: [cell(2, 2, true), cell(3, 2, true), cell(3, 2), cell(4, 3)],
  Due: [cell(2, 2, true), cell(3, 2, true), cell(3, 2), cell(4, 4)],
  Attendance: [cell(2, 2, true), cell(3, 2, true), cell(4, 2), cell(4, 3)],
  Exam: [cell(2, 1), cell(2, 2, true), cell(2, 2), cell(4, 2, true)],
  Next: [cell(1, 1, true), cell(1, 1), cell(2, 1), cell(2, 2, true)],
  Services: [cell(2, 1, true), cell(4, 1, true), cell(4, 1), cell(5, 2, true)],
  Course: [cell(2, 2, true), cell(3, 2, true), cell(3, 2), cell(5, 3)],
};

type Facts = ReturnType<typeof widgetFacts>;
type Size = { width: number; height: number; fontScale: number };
let facts: Facts;
let main: ReturnType<typeof widgetModel>;

const theme = (scheme: "light" | "dark") => THEMES[scheme];
const DRAW: Record<string, (size: Size, scheme: "light" | "dark") => unknown> = {
  Now: (size, scheme) => widgetDrawing({ ...main, theme: scheme }, size).light,
  Today: (size, scheme) => todayDrawing({ ...main, theme: scheme }, size).light,
  Due: (size, scheme) => DueView({ model: dueWidget(facts), size, theme: theme(scheme), lang: "id" }),
  Attendance: (size, scheme) => AttendanceView({ model: attendanceWidget(facts), size, theme: theme(scheme), lang: "id" }),
  Exam: (size, scheme) => ExamView({ model: examWidget(facts), size, theme: theme(scheme) }),
  Next: (size, scheme) => NextView({ model: nextWidget(facts), size, theme: theme(scheme) }),
  Services: (size, scheme) => ServicesView({ model: servicesWidget(facts), size, theme: theme(scheme) }),
  Course: (size, scheme) => CourseView({ model: courseWidget(facts, null), size, theme: theme(scheme) }),
};

beforeAll(async () => {
  const h = await startHome();
  facts = widgetFacts(h.engine.snapshot(), h.world.clock.now());
  main = widgetModel(h.engine.snapshot(), h.world.clock.now());
}, 120_000);

describe("every widget at every size", () => {
  it("each tap opens a place in the app, or a page; every tap area has a name TalkBack reads, or its own words", () => {
    const pictures: string[] = [];
    for (const [name, sizes] of Object.entries(SIZES)) {
      for (const scale of [1, 1.3]) {
        for (const size of sizes) {
          const row: string[] = [];
          for (const scheme of ["light", "dark"] as const) {
            fontScale = scale;
            const drawn = draw(DRAW[name]!({ ...size, fontScale: scale }, scheme), size);
            fontScale = 1;
            for (const tap of drawn.taps) {
              if (tap.action === "OPEN_APP") continue;
              expect(tap.action, `${name} ${size.label}`).toBe("OPEN_URI");
              expect(tap.uri, `${name} ${size.label}`).toMatch(/^(edunexplus:\/\/|https:\/\/)/);
            }
            expect(drawn.texts.length + drawn.taps.length, `${name} ${size.label}: something drawn`).toBeGreaterThan(0);
            row.push(`<div style="padding:12px;background:${scheme === "light" ? "#e9e4dc" : "#1b1d22"}">${drawn.html}</div>`);
          }
          pictures.push(
            `<section style="margin:8px 0"><div style="font:600 13px system-ui;margin:4px 0">${name} · ${size.label} · ${size.width}×${size.height} dp · text ×${scale}</div><div style="display:flex;gap:8px;align-items:flex-start">${row.join("")}</div></section>`,
          );
        }
      }
    }
    const out = process.env.WIDGET_GALLERY;
    if (out) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, `<html><body style="margin:16px;font-family:Roboto,system-ui,sans-serif;background:#fff">${pictures.join("")}</body></html>`);
    }
  });

  it("Tenggat: each row opens its own Task, the heading Tugas", () => {
    const drawn = draw(DRAW.Due!({ ...cell(4, 4), fontScale: 1 }, "light"), cell(4, 4));
    const tasks = drawn.taps.filter((tap) => tap.uri?.startsWith("edunexplus://task/"));
    expect(tasks.map((tap) => tap.uri)).toEqual(
      dueWidget(facts)
        .rows.slice(0, tasks.length)
        .map((row) => `edunexplus://task/${(row.open as { route: { taskId: number } }).route.taskId}`),
    );
    expect(drawn.taps.some((tap) => tap.uri === "edunexplus://tasks")).toBe(true);
  });

  it("Kelas berikutnya in one cell: its time and code, opening the class's sheet on Jadwal", () => {
    const drawn = draw(DRAW.Next!({ ...cell(1, 1, true), fontScale: 1 }, "light"), cell(1, 1, true));
    expect(drawn.texts).toEqual(expect.arrayContaining(["11:00", "DK4073"]));
    expect(drawn.taps[0]).toMatchObject({ uri: "edunexplus://schedule?class=2153983", label: "Hari ini, 11:00–12:59, DK4073, TVST C" });
  });

  it("Pintasan: as many as fit, each opening its tab", () => {
    expect(
      draw(DRAW.Services!({ ...cell(4, 1), fontScale: 1 }, "light"), cell(4, 1))
        .taps.slice(1)
        .map((tap) => tap.uri),
    ).toEqual(["edunexplus://schedule", "edunexplus://tasks", "edunexplus://courses", "edunexplus://grades"]);
    expect(draw(DRAW.Services!({ ...cell(2, 1, true), fontScale: 1 }, "light"), cell(2, 1, true)).taps.length - 1).toBe(2);
  });
});
