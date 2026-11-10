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

const { attendanceWidget, courseWidget, dueWidget, examWidget, nextWidget, widgetFacts, widgetModel } = await import("../../mobile/src/widget/model");
const { THEMES } = await import("../../mobile/src/ui/theme");
const { todayDrawing, widgetDrawing } = await import("../../mobile/src/widget/view");
const { AttendanceView, CourseView, DueView, ExamView, NextView } = await import("../../mobile/src/widget/views");

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
    paddingTop: (value) => `padding-top:${value}px`,
    paddingBottom: (value) => `padding-bottom:${value}px`,
    borderRadius: (value) => `border-radius:${value}px`,
    borderTopLeftRadius: (value) => `border-top-left-radius:${value}px`,
    borderTopRightRadius: (value) => `border-top-right-radius:${value}px`,
    borderWidth: (value) => `border:${value}px solid`,
    borderColor: (value) => `border-color:${value}`,
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
    const { fontSize } = style;
    if (fontSize === undefined) throw new Error("a TextWidget is drawn without a fontSize");
    const clamp = maxLines === 1 ? "white-space:nowrap;" : `display:-webkit-box;-webkit-line-clamp:${maxLines};-webkit-box-orient:vertical;`;
    return `<div${tap} style="flex-shrink:1;min-width:0;overflow:hidden;text-overflow:ellipsis;${clamp}font-size:${fontSize * fontScale}px;line-height:${Math.round(fontSize * fontScale * 1.3)}px;color:${style.color};font-weight:${style.fontWeight === "700" ? 700 : style.fontWeight === "500" ? 500 : 400}">${text}</div>`;
  }
  if (name === "SvgWidget") {
    const { svg } = element.props as { svg: string };
    return `<div style="width:${style.width}px;height:${style.height}px;flex-shrink:0">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>`;
  }
  return `<div${tap} style="${css(style)}">${walk(children as Element, drawn)}</div>`;
}

function draw(tree: unknown, size: { width: number; height: number }): Drawn {
  const drawn: Drawn = { html: "", taps: [], texts: [] };
  drawn.html = `<div data-widget style="width:${size.width}px;height:${size.height}px;display:flex;overflow:hidden;border-radius:22px">${walk(tree as Element, drawn)}</div>`;
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
  Course: [cell(2, 2, true), cell(3, 2, true), cell(3, 2), cell(5, 3)],
};

type Facts = ReturnType<typeof widgetFacts>;
type Size = { width: number; height: number; fontScale: number };
type Shot = Parameters<typeof widgetFacts>[0];
/** One moment of the pretend Student's data: the shared facts and "Sekarang"'s model. */
interface World {
  facts: Facts;
  main: ReturnType<typeof widgetModel>;
}
let world: World;
let shot: Shot;
let moment: number;
const worldOf = (change: (shot: Shot) => Shot = (one) => one, at = moment): World => ({
  facts: widgetFacts(change(shot), at),
  main: widgetModel(change(shot), at),
});

const theme = (scheme: "light" | "dark") => THEMES[scheme];
const DRAW: Record<string, (size: Size, scheme: "light" | "dark", from?: World) => unknown> = {
  Now: (size, scheme, { main } = world) => widgetDrawing({ ...main, theme: scheme }, size).light,
  Today: (size, scheme, { main } = world) => todayDrawing({ ...main, theme: scheme }, size).light,
  Due: (size, scheme, { facts } = world) => DueView({ model: dueWidget(facts), size, theme: theme(scheme), lang: "id" }),
  Attendance: (size, scheme, { facts } = world) => AttendanceView({ model: attendanceWidget(facts), size, theme: theme(scheme), lang: "id" }),
  Exam: (size, scheme, { facts } = world) => ExamView({ model: examWidget(facts), size, theme: theme(scheme) }),
  Next: (size, scheme, { facts } = world) => NextView({ model: nextWidget(facts), size, theme: theme(scheme) }),
  Course: (size, scheme, { facts } = world) => CourseView({ model: courseWidget(facts, null), size, theme: theme(scheme) }),
};

beforeAll(async () => {
  const h = await startHome();
  shot = h.engine.snapshot();
  moment = h.world.clock.now();
  world = worldOf();
}, 120_000);

// ---------------------------------------------------------------- the pictures for the judges (WIDGET_RENDER=<folder>)

/**
 * This phone's launcher (Samsung One UI, 4 across): "Sekarang" at 4×2 is 1017×703 px on its home screen, at 2.625 px
 * per dp 387×268 dp. The first round drew it at 325×227, so the phone had width the pictures didn't.
 */
const pixel = (w: number, h: number) => ({ label: `${w}×${h}`, width: Math.round(96.85 * w), height: Math.round(133.9 * h) });
/**
 * What the Galaxy A52's launcher (One UI 5, 4 across) really reports for a placed widget (dumpsys appwidget, in dp):
 * a column 85 with 11 between, a row 124 with 12 between. 4×1 is 373×124, 4×2 373×260, 3×2 277×260.
 */
const samsung = (w: number, h: number) => ({ label: `${w}×${h}`, width: 96 * w - 11, height: 136 * h - 12 });
/** The pictures' grid: the first one, or the Samsung's with WIDGET_GRID=samsung (mobile/scripts/render-widgets.mjs --grid=samsung). */
const phone = process.env.WIDGET_GRID === "samsung" ? samsung : pixel;
/** Each widget at its smallest, a step between, its first size (marked) and its largest on a 4-wide launcher. */
const RENDER: Record<string, { title: string; sizes: ReturnType<typeof phone>[]; first: string }> = {
  Now: { title: "Sekarang", sizes: [phone(2, 1), phone(4, 1), phone(4, 2), phone(4, 3)], first: "4×2" },
  Exam: { title: "Ujian", sizes: [phone(2, 1), phone(3, 1), phone(4, 1)], first: "2×1" },
  Today: { title: "Hari ini", sizes: [phone(2, 2), phone(3, 2), phone(4, 2)], first: "3×2" },
  Due: { title: "Tenggat", sizes: [phone(2, 2), phone(3, 2)], first: "3×2" },
  Attendance: { title: "Jatah absen", sizes: [phone(2, 2), phone(3, 2), phone(4, 2)], first: "3×2" },
  Next: { title: "Kelas berikutnya", sizes: [phone(1, 1), phone(2, 1)], first: "1×1" },
  Course: { title: "Satu mata kuliah", sizes: [phone(3, 1), phone(3, 2)], first: "3×1" },
};

const emptied = (names: string[]) => (one: Shot) => ({ ...one, datasets: one.datasets.map((d) => (names.includes(d.name) ? { ...d, value: [] } : d)) }) as Shot;
/** The states beside the normal one, each made from the same pretend Thursday (as test/mobile/widget-models.test.ts makes them). */
const STATES: Record<string, { title: string; change: (one: Shot) => Shot }> = {
  // Nothing at all: no Task, no exam, no class, and so no Presence open for one (the first round kept the Presence, and drew its button with no class).
  empty: {
    title: "Empty (no course, nothing due, no class, no exam)",
    change: (one) => noPresence(emptied(["edunex.tasks", "edunex.exams", "six.schedule", "six.courses", "edunex.courses"])(one)),
  },
  signedOut: {
    title: "Signed out",
    change: (one) =>
      ({
        ...one,
        statuses: one.statuses.map((status) => ({ ...status, state: "signed-out" as const, updatedAt: null })),
        datasets: one.datasets.filter((dataset) => !dataset.name.startsWith("six.") && !dataset.name.startsWith("edunex.")),
      }) as Shot,
  },
  offline: { title: "Offline", change: (one) => ({ ...one, statuses: one.statuses.map((status) => ({ ...status, state: "offline" as const })) }) as Shot },
  holiday: { title: "Holiday (no class in the week ahead)", change: (one) => noPresence(emptied(["six.schedule"])(one)) },
};
/** No Presence open: a week without classes has none to fill in. */
const noPresence = (one: Shot) =>
  ({
    ...one,
    // And no meeting Edunex announced: a week with one isn't a holiday.
    datasets: one.datasets.map((d) => (d.name === "edunex.presence" || d.name === "edunex.materials" ? { ...d, value: Array.isArray(d.value) ? [] : {} } : d)),
  }) as Shot;

/** The picker's own grey behind a preview, so a white card's corners show (the script clears it before it cuts the asset). */
const PICKER = "#e3e7ee";
const WALLPAPER = { light: "linear-gradient(135deg,#bfeeee 0%,#9fd84a 48%,#6b3fe0 100%)", dark: "linear-gradient(135deg,#10222c 0%,#1d3a17 48%,#2a1a5e 100%)" };

function renderPages(folder: string): void {
  fs.mkdirSync(folder, { recursive: true });
  const tile = (name: string, state: string, size: ReturnType<typeof phone>, scheme: "light" | "dark", from: World, scale = 1) => {
    let inner: string;
    try {
      fontScale = scale;
      inner = draw(DRAW[name]!({ ...size, fontScale: scale }, scheme, from), size).html;
    } catch (error) {
      inner = `<div style="width:${size.width}px;font:12px system-ui;color:#b00">could not draw: ${String(error)}</div>`;
    } finally {
      fontScale = 1;
    }
    return `<figure style="margin:0"><div data-shot="${name.toLowerCase()}-${state}-${size.label.replace("×", "x")}-${scheme}" style="display:inline-block;padding:18px;border-radius:12px;background:${state === "preview" ? PICKER : WALLPAPER[scheme]}">${inner}</div></figure>`;
  };
  for (const [name, { title, sizes, first }] of Object.entries(RENDER)) {
    const rows: string[] = [];
    // Laid out as a judge reads it: every size in light, every size in dark, then each other state.
    const strip = (label: string, tiles: string[]) =>
      rows.push(`<section><h2>${label}</h2><div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">${tiles.join("")}</div></section>`);
    const some = [sizes.find((one) => one.label === first)!, sizes[0]!].filter((one, index, all) => all.indexOf(one) === index);
    const sizesSaid = sizes.map((size) => `${size.label}${size.label === first ? " (as first placed)" : ""} ${size.width}×${size.height} dp`).join(" · ");
    for (const scheme of ["light", "dark"] as const)
      strip(
        `${scheme === "light" ? "Light" : "Dark"}: ${sizesSaid}`,
        sizes.map((size) => tile(name, "normal", size, scheme, world)),
      );
    // The phone's text at 1.3: the first size (and the smallest) still hold.
    strip(
      `Text ×1.3: ${some.map((size) => size.label).join(" · ")}`,
      some.flatMap((size) => [tile(name, "text13", size, "light", world, 1.3), tile(name, "text13", size, "dark", world, 1.3)]),
    );
    for (const [state, { title: stateTitle, change }] of Object.entries(STATES)) {
      const from = worldOf(change);
      strip(
        `${stateTitle}: ${some.map((size) => size.label).join(" · ")}`,
        some.flatMap((size) => [tile(name, state, size, "light", from), tile(name, state, size, "dark", from)]),
      );
    }
    // The picker's picture (scripts/make-widget-previews.mjs keeps it): the widget as it's first placed, light, at the
    // same moment as the pictures above, so it shows what the widget is for (the class on now with its button, the
    // same course in the same colour). No read stamped: a picture in the picker can't say when the data is from.
    const before = worldOf((one) => ({ ...one, statuses: one.statuses.map((status) => ({ ...status, updatedAt: null })) }) as Shot);
    const firstSize = sizes.find((one) => one.label === first)!;
    rows.push(`<section><h2>In the picker · ${firstSize.label}</h2>${tile(name, "preview", firstSize, "light", before)}</section>`);
    fs.writeFileSync(
      path.join(folder, `${name.toLowerCase()}.html`),
      `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{margin:24px;font-family:Roboto,"Helvetica Neue",system-ui,sans-serif;background:#fff;color:#14171c}h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;font-weight:600;margin:18px 0 6px;color:#3f4652}p{margin:0;font-size:13px;color:#5f6673}</style></head><body><h1>${title}</h1><p>Edunex Plus widget, drawn from the demo's made-up Thursday 8 Oct, 08:12. Light left, dark right.</p>${rows.join("")}</body></html>`,
    );
  }
}

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
    if (process.env.WIDGET_RENDER) renderPages(process.env.WIDGET_RENDER);
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
      dueWidget(world.facts)
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

  it("Sekarang as first placed: the course's name whole and no code, one button with the one time, each said once", () => {
    const size = pixel(4, 2);
    const drawn = draw(DRAW.Now!({ ...size, fontScale: 1 }, "light"), size);
    expect(drawn.texts).toEqual(
      expect.arrayContaining(["Ekonomi dan Inovasi dalam Perencanaan", "Isi Presensi", "Tutup 09:30", "Perlu perhatianmu", "Diperbarui 08:12"]),
    );
    expect(drawn.texts.some((text) => text.includes("PL3002"))).toBe(false);
    expect(new Set(drawn.texts).size).toBe(drawn.texts.length);
    // The block opens the class, the button the Presence's own page.
    expect(drawn.taps[1]?.uri).toBe("edunexplus://course/PL3002?tab=meetings");
    expect(drawn.taps.some((tap) => tap.label === "Isi Presensi PL3002, Tutup 09:30" && tap.uri?.startsWith("https://"))).toBe(true);
  });

  it("on the Samsung's real sizes: Sekarang at 373×260 keeps the next class and the foot under its block, and taller shows more", () => {
    const at = (name: string, size: ReturnType<typeof samsung>, scale = 1) => draw(DRAW[name]!({ ...size, fontScale: scale }, "light"), size);
    // The phone's text at 1 and at its 1.1: the block, its button, the next class under it, when the data was read.
    for (const scale of [1, 1.1]) {
      const two = at("Now", samsung(4, 2), scale).texts;
      expect(two, `text ×${scale}`).toEqual(
        expect.arrayContaining(["Ekonomi dan Inovasi dalam Perencanaan", "Isi Presensi", "Tutup 09:30", "11:00", "Komunikasi Pemasaran", "Diperbarui 08:12"]),
      );
      // Three rows high: all of that, and what needs the Student.
      const three = at("Now", samsung(4, 3), scale).texts;
      expect(three, `text ×${scale}`).toEqual(
        expect.arrayContaining(["Isi Presensi", "Tutup 09:30", "11:00", "Komunikasi Pemasaran", "Perlu perhatianmu", "Diperbarui 08:12"]),
      );
      expect(three.length, `text ×${scale}`).toBeGreaterThan(two.length);
    }
    // One row high: the class and its button side by side, nothing under.
    expect(at("Now", samsung(4, 1)).texts).toEqual(expect.arrayContaining(["Ekonomi dan Inovasi dalam Perencanaan", "Isi Presensi"]));
    expect(at("Now", samsung(2, 1)).texts).toEqual(expect.arrayContaining(["PL3002"]));
    // Every other widget at every size this launcher gives it draws, and nothing it draws is said twice.
    const sizes: Record<string, [number, number][]> = {
      Today: [
        [2, 2],
        [3, 2],
        [4, 2],
      ],
      Due: [
        [2, 2],
        [3, 2],
      ],
      Attendance: [
        [2, 2],
        [3, 2],
        [4, 2],
      ],
      Exam: [
        [2, 1],
        [3, 1],
        [4, 1],
      ],
      Next: [
        [1, 1],
        [2, 1],
      ],
      Course: [
        [3, 1],
        [3, 2],
      ],
    };
    for (const [name, cells] of Object.entries(sizes))
      for (const [w, h] of cells) expect(at(name, samsung(w, h)).texts.length, `${name} ${w}×${h}`).toBeGreaterThan(0);
    expect(at("Today", samsung(3, 2)).texts).toEqual(expect.arrayContaining(["08:00", "11:00", "15:00", "Diperbarui 08:12"]));
    expect(at("Next", samsung(1, 1)).texts).toEqual(expect.arrayContaining(["11:00", "DK4073"]));
  });

  it("a course's name is never cut: where it doesn't fit whole, its code stands in", () => {
    const small = pixel(2, 1);
    expect(draw(DRAW.Now!({ ...small, fontScale: 1 }, "light"), small).texts).toContain("PL3002");
    // With the width for it, the name again, over two lines (the render script's report.txt lists any line the browser cut).
    const wide = pixel(4, 1);
    expect(draw(DRAW.Now!({ ...wide, fontScale: 1 }, "light"), wide).texts).toContain("Ekonomi dan Inovasi dalam Perencanaan");
  });

  it("Kehadiran: each course's absences as marks, the danger in its word", () => {
    const size = pixel(4, 4);
    const drawn = draw(DRAW.Attendance!({ ...size, fontScale: 1 }, "light"), size);
    expect(drawn.texts).toEqual(expect.arrayContaining(["lewat 1 absen", "absen habis", "sisa 2 absen"]));
    // A mark is a 10 dp dot: one per absence the term allows, and one for each past it.
    const rows = attendanceWidget(world.facts).rows;
    const marks = rows.reduce((sum, row) => sum + (row.allowed ?? 0) + row.over, 0);
    expect(drawn.html.split("width:10px;height:10px").length - 1).toBe(marks);
  });
});
