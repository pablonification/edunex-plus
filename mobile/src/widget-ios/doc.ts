// The one document the iPhone's widgets draw from (mobile/qa/superapp-ios-widgets.md, "The document"). It is
// Android's widget model (../widget/model.ts) made ready for a widget that can't import anything: every tap is
// already a link, every colour already a hex for both looks. The app writes it into the shared store (the App
// Group) through expo-widgets (../host/widget-ios.ios.ts); ./now.tsx and ./today.tsx draw it. Pure: the model,
// the moment and how a tap becomes a link in, the document out.
import { COURSE_TILE, dark, GREY_TILE, light, NOW, V4 } from "../ui/palette";
import type { WidgetClass, WidgetLine, WidgetModel, WidgetTarget } from "../widget/model";

/** The document's shape; a widget given another one draws its setup state. */
export const DOC_VERSION = 1;

/** One colour, in the light look and the dark one. */
export interface Pair {
  light: string;
  dark: string;
}

export interface DocLine {
  label: string;
  detail: string | null;
  /** What VoiceOver says, when the line alone doesn't say what a tap does. */
  a11y: string | null;
  url: string;
}

export interface DocClass {
  kind: "class";
  /** "Sedang berlangsung", or "Kuliah berikutnya · Besok". */
  heading: string;
  live: boolean;
  code: string;
  name: string | null;
  /** "08:00–10:00", and its start alone ("08:00") for the Lock Screen's round widget. */
  time: string;
  start: string;
  where: string | null;
  color: Pair;
  url: string;
}

export interface DocTodayClass {
  time: string;
  code: string;
  room: string | null;
  live: boolean;
  past: boolean;
  color: Pair;
  url: string;
}

export interface IosWidgetDoc {
  v: typeof DOC_VERSION;
  /** "ready": drawn from the app's data; "setup": nothing saved yet, `hint` says what to do. */
  state: "ready" | "setup";
  /** The Student's pick in the app; "system" follows the phone. */
  scheme: "system" | "light" | "dark";
  /** "Edunex Plus" (the demo's own name in the demo). */
  title: string;
  hint: string | null;
  /** The app's Beranda: where a tap on the widget's empty space goes. */
  url: string;
  status: { text: string; problem: boolean };
  /** The class on now or next; a line when there's none in a week; null without SIX. */
  now: DocClass | (DocLine & { kind: "line" }) | null;
  /** "Tandai Hadir" in SIX first (`primary`), then the Presence to fill in. */
  actions: (DocLine & { primary: boolean })[];
  needs: { heading: string; items: DocLine[]; empty: DocLine | null; all: DocLine | null } | null;
  today: { heading: string; classes: DocTodayClass[]; none: DocLine | null; deadline: DocLine | null } | null;
  colors: { light: DocPalette; dark: DocPalette };
}

/** The few colours a widget uses, from the app's palette (../ui/palette.ts, DESIGN.md). */
export interface DocPalette {
  surface: string;
  fg: string;
  muted: string;
  /** The class on now, and "Hari ini"'s heading. */
  live: string;
  today: string;
  warn: string;
  /** "Tandai Hadir": the app's main button. */
  accent: string;
  onAccent: string;
  /** A quieter pill (the Presence to fill in). */
  chip: string;
  link: string;
}

/** How the app turns a widget's tap into a link (../host/widget-ios.ios.ts: the app's scheme and ../nav.ts's paths). */
export type LinkOf = (open: WidgetTarget) => string;

function palette(scheme: "light" | "dark"): DocPalette {
  const v = V4[scheme];
  const c = scheme === "light" ? light : dark;
  return {
    surface: v.card,
    fg: v.fg,
    muted: v.muted,
    live: v.okFg,
    today: NOW[scheme].now,
    warn: v.ambFg,
    accent: c.accent,
    onAccent: c.onAccent,
    chip: v.chip,
    link: c.accentFg,
  };
}

/** Both looks' colours, as every document carries them. */
export const DOC_COLORS = { light: palette("light"), dark: palette("dark") };

/** A course's colour as its tile's ink (the app's course colours), light and dark; grey before it has one. */
export function courseColor(tone: string | undefined): Pair {
  const id = tone?.match(/--course-([a-z]+)/)?.[1] as keyof typeof COURSE_TILE | undefined;
  const tile = id && COURSE_TILE[id] ? COURSE_TILE[id] : GREY_TILE;
  return { light: tile[0], dark: tile[1] };
}

/**
 * The document as the shared store can keep it. On an iPhone that store is a property list, which has no null: handed
 * a document with one anywhere, iOS refuses the whole of it, and that refusal closed the app as it opened. So an
 * empty field is left out, and the widgets read a missing field as an empty one (they only ever ask "is it there?").
 */
export function storable<T>(value: T): T {
  if (Array.isArray(value)) return value.filter((one) => one !== null && one !== undefined).map(storable) as T;
  if (value === null || typeof value !== "object") return value;
  const kept: Record<string, unknown> = {};
  for (const [key, one] of Object.entries(value)) if (one !== null && one !== undefined) kept[key] = storable(one);
  return kept as T;
}

/** Before anything is saved: the app's name and the one thing to do (`hint`, in the phone's language). */
export function setupDoc(title: string, hint: string | null, home: string): IosWidgetDoc {
  return {
    v: DOC_VERSION,
    state: "setup",
    scheme: "system",
    title,
    hint,
    url: home,
    status: { text: "", problem: false },
    now: null,
    actions: [],
    needs: null,
    today: null,
    colors: DOC_COLORS,
  };
}

/** Android's model as the iPhone's document. */
export function iosWidgetDoc(model: WidgetModel, title: string, link: LinkOf): IosWidgetDoc {
  const line = (one: WidgetLine): DocLine => ({ label: one.label, detail: one.detail ?? null, a11y: one.a11y ?? null, url: link(one.open) });
  const needs = model.needs;
  const today = model.today;
  return {
    v: DOC_VERSION,
    state: "ready",
    scheme: model.theme === "light" || model.theme === "dark" ? model.theme : "system",
    title,
    hint: null,
    url: link({ kind: "route", route: { screen: "home" } }),
    status: model.status,
    now: model.now ? ("code" in model.now ? classOf(model.now, link) : { kind: "line", ...line(model.now) }) : null,
    actions: model.actions.map((one, index) => ({ ...line(one), primary: index === 0 && one.open.kind === "checkIn" })),
    needs: needs
      ? { heading: needs.heading, items: needs.items.map(line), empty: needs.empty ? line(needs.empty) : null, all: needs.all ? line(needs.all) : null }
      : null,
    today: today
      ? {
          heading: today.heading,
          classes: today.classes.map((one) => ({
            time: one.time,
            code: one.code,
            room: one.room,
            live: one.live,
            past: one.past,
            color: courseColor(one.tone),
            url: link(one.open),
          })),
          none: today.none ? line(today.none) : null,
          deadline: today.deadline ? line(today.deadline) : null,
        }
      : null,
    colors: DOC_COLORS,
  };
}

function classOf(one: WidgetClass, link: LinkOf): DocClass {
  return {
    kind: "class",
    heading: one.heading,
    live: one.live,
    code: one.code,
    name: one.name,
    time: one.time,
    // "08:00–10:00" → "08:00" (an en dash, or a hyphen in a time range written otherwise).
    start: one.time.split(/[–-]/)[0]?.trim() ?? one.time,
    where: one.where,
    color: courseColor(one.tone),
    url: link(one.open),
  };
}
