"use no memo";
import { DEMO } from "../host/version";
import { hrefOf } from "../nav";
import { NOW } from "../ui/palette";
import { THEMES, type Theme } from "../ui/theme";
// The home-screen widget as Android draws it (react-native-android-widget turns this tree into
// the system's own views, so no React state, hooks or app parts here). The app's look: the
// desktop's colors light and dark (../ui/theme.ts) and its type a step smaller, as a widget sits
// among icons. What it says comes from ./model.ts; how much of it shows depends on the size the
// Student gave the widget: the class first, then "Tandai Hadir", then the needs that fit.
// Every line opens its screen in the app (the same paths as ../nav.ts), an official page in the
// browser, or SIX's check-in page.
import { FlexWidget, type HexColor, TextWidget } from "./kit";
import type { WidgetClass, WidgetLine, WidgetModel, WidgetTarget } from "./model";

/** The app's deep links (app.config.ts's scheme). */
const SCHEME = DEMO ? "edunexplusdemo" : "edunexplus";

/** Line heights in dp at the phone's normal text size, for working out what fits. */
export const LINE = { micro: 15, small: 18, body: 20 } as const;
export const PAD = 14;
const GAP = 8;

export interface WidgetSize {
  width: number;
  height: number;
  /** The phone's text size (1 is normal): bigger text, fewer lines fit. */
  fontScale: number;
}

/** The widget in the phone's light and dark looks, or the one the Student chose in the app. */
export function widgetDrawing(model: WidgetModel, size: WidgetSize): { light: React.JSX.Element; dark: React.JSX.Element } {
  if (model.theme === "light" || model.theme === "dark") {
    const one = <NowWidget model={model} size={size} theme={THEMES[model.theme]} />;
    return { light: one, dark: one };
  }
  return { light: <NowWidget model={model} size={size} theme={THEMES.light} />, dark: <NowWidget model={model} size={size} theme={THEMES.dark} /> };
}

/** The "Hari ini" widget in the phone's light and dark looks, or the one the Student chose in the app. */
export function todayDrawing(model: WidgetModel, size: WidgetSize): { light: React.JSX.Element; dark: React.JSX.Element } {
  if (model.theme === "light" || model.theme === "dark") {
    const one = <TodayWidget model={model} size={size} theme={THEMES[model.theme]} />;
    return { light: one, dark: one };
  }
  return { light: <TodayWidget model={model} size={size} theme={THEMES.light} />, dark: <TodayWidget model={model} size={size} theme={THEMES.dark} /> };
}

/**
 * "Hari ini · Kam 8 Okt", then today's classes one line each (the time, the code, the room; the one on now in the live
 * colour, the ones over quiet), each opening its sheet on Jadwal, then the next deadline. Without SIX, the class
 * widget's "now" says what to do. What doesn't fit the height is left out, the class on now and the next first.
 */
function TodayWidget({ model, size, theme }: { model: WidgetModel; size: WidgetSize; theme: Theme }) {
  // v4's look: the card surface, each course in its ink, today's blue on the heading, the class on now in the live green.
  const v = theme.v4;
  const todayInk = NOW[theme.scheme].now;
  const today = model.today;
  if (!today)
    return (
      <Frame theme={theme} surface={v.card}>
        <Text text="Edunex Plus" size="body" color={v.fg} bold />
        <Text text={model.status.text} size="micro" color={model.status.problem ? v.ambFg : v.muted} />
      </Frame>
    );
  const scale = Math.max(1, size.fontScale);
  let room = size.height - 2 * PAD - (LINE.micro + GAP) * scale - (today.deadline ? (LINE.small + LINE.micro + GAP) * scale : 0);
  // Classes over are dropped first, from the morning on: what's still ahead stays.
  const ahead = today.classes.filter((one) => !one.past);
  const over = today.classes.filter((one) => one.past);
  const shown: typeof today.classes = [];
  for (const one of [...ahead, ...over.reverse()]) {
    if (room < LINE.small * scale + 4) break;
    shown.push(one);
    room -= LINE.small * scale + 4;
  }
  const lines = today.classes.filter((one) => shown.includes(one));
  // Narrow: the start time alone (the range was cut), and below three cells the code alone.
  const narrow = size.width < 250;
  const tiny = size.width < 150;
  return (
    <Frame theme={theme} surface={v.card}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 4 }}>
        <Text text={today.heading} size="micro" color={todayInk} bold />
        {today.none ? <Plain line={today.none} color={v.muted} /> : null}
        {lines.map((one) => (
          <FlexWidget
            key={`${one.code}${one.time}`}
            {...tap(one.open)}
            accessibilityLabel={[one.time, one.code, one.room].filter(Boolean).join(", ")}
            style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 6 }}
          >
            <FlexWidget style={{ width: 4, height: 16, borderRadius: 2, backgroundColor: hex(theme.courseTile(one.tone).ink) }} />
            <Text text={narrow ? one.start : one.time} size="small" color={one.live ? v.okFg : one.past ? v.muted : v.fg} bold={one.live} />
            <FlexWidget style={{ flex: 1 }}>
              <Text text={tiny ? one.code : [one.code, one.room].filter(Boolean).join(" · ")} size="small" color={one.past ? v.muted : v.fg} bold={!one.past} />
            </FlexWidget>
          </FlexWidget>
        ))}
      </FlexWidget>
      {today.deadline ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }} {...tap(today.deadline.open)}>
          <Text text={today.deadline.label} size="micro" color={v.muted} bold />
          <Text text={today.deadline.detail ?? ""} size="small" color={v.fg} />
        </FlexWidget>
      ) : null}
    </Frame>
  );
}

/** Before anything is saved: the app's name and the one thing to do, opening the app. */
export function emptyDrawing(hint: string): { light: React.JSX.Element; dark: React.JSX.Element } {
  const draw = (theme: Theme) => (
    <Frame theme={theme}>
      <Text text="Edunex Plus" size="body" color={theme.color.fg} bold />
      <Text text={hint} size="small" color={theme.color.muted} lines={2} />
    </Frame>
  );
  return { light: draw(THEMES.light), dark: draw(THEMES.dark) };
}

function NowWidget({ model, size, theme }: { model: WidgetModel; size: WidgetSize; theme: Theme }) {
  const c = theme.color;
  const plan = fit(model, size);
  const nothing = !model.now && !plan.actions.length && !plan.needs;
  const narrow = size.width < 200;
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: GAP }}>
        {nothing ? <Text text="Edunex Plus" size="body" color={c.fg} bold /> : null}
        {model.now ? (
          "code" in model.now ? (
            <ClassBlock line={model.now} theme={theme} narrow={narrow} where={plan.where} />
          ) : (
            <Plain line={model.now} color={c.muted} />
          )
        ) : null}
        {plan.actions.map((line, index) => (
          <ActionPill key={`${line.label}${line.detail ?? ""}`} line={line} primary={index === 0 && line.open.kind === "checkIn"} theme={theme} />
        ))}
        {plan.needs ? <NeedsBlock needs={plan.needs} theme={theme} /> : null}
      </FlexWidget>
      {plan.status ? <Text text={model.status.text} size="micro" color={model.status.problem ? c.warningFg : c.faint} /> : null}
    </Frame>
  );
}

/** The widget's card: the app's surface, its corners, a tap anywhere else opens the app. */
/** `surface`: the widget's own background (the Hari ini widget's v4 card); the app's page colour by default. */
export function Frame({ theme, children, surface }: { theme: Theme; children: React.ReactNode; surface?: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: PAD,
        borderRadius: 20,
        backgroundColor: hex(surface ?? theme.color.surface),
      }}
    >
      {children}
    </FlexWidget>
  );
}

/**
 * "Sedang berlangsung · 08:00–10:00" (the time alone when narrow), then the course's dot, code and name, then the room
 * on its own line when there's room for it (it was cut off at the end of the first).
 */
function ClassBlock({ line, theme, narrow, where }: { line: WidgetClass; theme: Theme; narrow: boolean; where: boolean }) {
  const c = theme.color;
  return (
    <FlexWidget
      style={{ width: "match_parent", flexDirection: "column" }}
      {...tap(line.open)}
      accessibilityLabel={[line.heading, line.time, line.name ?? line.code, line.where].filter(Boolean).join(", ")}
    >
      <Text text={narrow ? line.time : `${line.heading} · ${line.time}`} size="micro" color={line.live ? c.successFg : c.muted} bold />
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 6 }}>
        <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hex(theme.course(line.tone)) }} />
        <Text text={line.name && !narrow ? `${line.code} ${line.name}` : line.code} size="body" color={c.fg} bold />
      </FlexWidget>
      {where && line.where ? <Text text={line.where} size="micro" color={c.muted} /> : null}
    </FlexWidget>
  );
}

/** "Tandai Hadir sudah dibuka di SIX · PL3002" as the app's main button; the Presence to fill in as a quiet one. */
function ActionPill({ line, primary, theme }: { line: WidgetLine; primary: boolean; theme: Theme }) {
  const c = theme.color;
  return (
    <FlexWidget
      {...tap(line.open)}
      accessibilityLabel={line.a11y ?? line.label}
      style={{
        width: "match_parent",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: hex(primary ? c.accent : c.fill),
      }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}>
        <FlexWidget style={{ flex: 1 }}>
          <Text text={line.short ?? line.label} size="small" color={primary ? c.onAccent : c.fg} bold />
        </FlexWidget>
        {line.detail ? <Text text={line.detail} size="micro" color={primary ? c.onAccent : c.fg} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function NeedsBlock({ needs, theme }: { needs: NonNullable<Fitted["needs"]>; theme: Theme }) {
  const c = theme.color;
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 4 }}>
      <Text text={needs.heading} size="micro" color={c.muted} bold />
      {needs.items.map((line) => (
        <FlexWidget key={`${line.label}${line.detail ?? ""}`} style={{ width: "match_parent", flexDirection: "column" }} {...tap(line.open)}>
          <Text text={line.label} size="small" color={c.fg} bold />
          {line.detail ? <Text text={line.detail} size="micro" color={c.muted} /> : null}
        </FlexWidget>
      ))}
      {needs.more ? <Plain line={needs.more} color={c.accentFg} /> : null}
    </FlexWidget>
  );
}

function Plain({ line, color }: { line: WidgetLine; color: string }) {
  return <Text text={line.label} size="small" color={color} open={line.open} />;
}

export function Text({
  text,
  size,
  color,
  bold = false,
  lines = 1,
  open,
}: {
  text: string;
  size: keyof typeof LINE;
  color: string;
  bold?: boolean;
  lines?: number;
  open?: WidgetTarget;
}) {
  const fontSize = size === "micro" ? 12 : size === "small" ? 14 : 16;
  return (
    <TextWidget
      text={text}
      maxLines={lines}
      truncate="END"
      {...(open ? tap(open) : {})}
      style={{ fontSize, color: hex(color), fontWeight: bold ? "500" : "400" }}
    />
  );
}

// ---------------------------------------------------------------- what fits

interface Fitted {
  actions: WidgetLine[];
  /** The room on its own line under the class. */
  where: boolean;
  /** "Diperbarui pukul …" at the foot. */
  status: boolean;
  needs: { heading: string; items: WidgetLine[]; more: WidgetLine | null } | null;
}

/**
 * What fits the widget's height, most pressing first: the class (always), "Tandai Hadir" and the
 * Presence, then "Perlu perhatianmu" with as many items as fit, and "Lihat semua" when some don't.
 */
function fit(model: WidgetModel, size: WidgetSize): Fitted {
  const scale = Math.max(1, size.fontScale);
  const line = (kind: keyof typeof LINE) => LINE[kind] * scale;
  // What's wrong is always said; "Diperbarui pukul …" only where there's room left for it.
  const problem = model.status.problem;
  let room = size.height - 2 * PAD - (problem ? line("micro") + GAP : 0);
  const cls = model.now && "code" in model.now ? model.now : null;
  if (model.now) room -= (cls ? line("micro") + line("body") : line("small")) + GAP;
  const actions: WidgetLine[] = [];
  for (const action of model.actions) {
    const height = line("small") + 14 + GAP;
    if (room < height) break;
    actions.push(action);
    room -= height;
  }
  const where = Boolean(cls?.where) && room >= line("micro");
  if (where) room -= line("micro");
  const done = (needs: Fitted["needs"]): Fitted => ({ actions, needs, where, status: problem || room >= line("micro") + GAP });
  const needs = model.needs;
  if (!needs) return done(null);
  const heading = line("micro") + 4;
  if (needs.empty) {
    if (room < heading + line("small") + GAP) return done(null);
    room -= heading + line("small") + GAP;
    return done({ heading: needs.heading, items: [needs.empty], more: null });
  }
  const items: WidgetLine[] = [];
  let left = room - heading - GAP;
  for (const item of needs.items) {
    const height = line("small") + (item.detail ? line("micro") : 0) + 4;
    // Room for this one, and for "Lihat semua" under it when more are left out.
    const after = items.length + 1 < needs.items.length ? line("small") + 4 : 0;
    if (left < height + after) break;
    items.push(item);
    left -= height;
  }
  if (!items.length) return done(null);
  const more = items.length < needs.items.length;
  room = left - (more ? line("small") + 4 : 0);
  return done({ heading: needs.heading, items, more: more ? needs.all : null });
}

// ---------------------------------------------------------------- taps

/** A line's tap: its screen in the app (a deep link to ../nav.ts's path), or the page in the browser. */
export function tap(open: WidgetTarget): { clickAction: string; clickActionData?: Record<string, unknown> } {
  switch (open.kind) {
    case "app":
      return { clickAction: "OPEN_APP" };
    case "url":
      return { clickAction: "OPEN_URI", clickActionData: { uri: open.url } };
    case "route":
      return { clickAction: "OPEN_URI", clickActionData: { uri: `${SCHEME}://${hrefOf(open.route).replace(/^\//, "")}` } };
    case "class":
      // Jadwal on the class's day, its sheet open (schedule-screen.tsx reads ?class=).
      return { clickAction: "OPEN_URI", clickActionData: { uri: `${SCHEME}://schedule?class=${encodeURIComponent(open.sessionId)}` } };
    case "checkIn":
      // The demo's SIX is pretend: Presensi instead, as its "Tandai Hadir" opens nothing.
      return {
        clickAction: "OPEN_URI",
        clickActionData: { uri: DEMO ? `${SCHEME}://presence` : `${SCHEME}://check-in/${encodeURIComponent(open.meetingId)}` },
      };
  }
}

/** The theme's colors are hex: the widget library types them so. */
export const hex = (color: string) => color as HexColor;
