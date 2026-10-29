"use no memo";
// The home-screen widget as Android draws it (react-native-android-widget turns this tree into
// the system's own views, so no React state, hooks or app parts here). The app's look: the
// desktop's colors light and dark (../ui/theme.ts) and its type a step smaller, as a widget sits
// among icons. What it says comes from ./model.ts; how much of it shows depends on the size the
// Student gave the widget: the class first, then "Tandai Hadir", then the needs that fit.
// Every line opens its screen in the app (the same paths as ../nav.ts), an official page in the
// browser, or SIX's check-in page.
import { FlexWidget, type HexColor, TextWidget } from "react-native-android-widget";
import { DEMO } from "../host/version";
import { hrefOf } from "../nav";
import { THEMES, type Theme } from "../ui/theme";
import type { WidgetClass, WidgetLine, WidgetModel, WidgetTarget } from "./model";

/** The widget's name in the app's config (app.config.ts) and to Android. */
export const WIDGET_NAME = "Now";

/** The app's deep links (app.config.ts's scheme). */
const SCHEME = DEMO ? "edunexplusdemo" : "edunexplus";

/** Line heights in dp at the phone's normal text size, for working out what fits. */
const LINE = { micro: 15, small: 18, body: 20 } as const;
const PAD = 14;
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
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: GAP }}>
        {nothing ? <Text text="Edunex Plus" size="body" color={c.fg} bold /> : null}
        {model.now ? "code" in model.now ? <ClassBlock line={model.now} theme={theme} /> : <Plain line={model.now} color={c.muted} /> : null}
        {plan.actions.map((line, index) => (
          <ActionPill key={`${line.label}${line.detail ?? ""}`} line={line} primary={index === 0 && line.open.kind === "checkIn"} theme={theme} />
        ))}
        {plan.needs ? <NeedsBlock needs={plan.needs} theme={theme} /> : null}
      </FlexWidget>
      <Text text={model.status.text} size="micro" color={model.status.problem ? c.warningFg : c.faint} />
    </Frame>
  );
}

/** The widget's card: the app's surface, its corners, a tap anywhere else opens the app. */
function Frame({ theme, children }: { theme: Theme; children: React.ReactNode }) {
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
        backgroundColor: hex(theme.color.surface),
      }}
    >
      {children}
    </FlexWidget>
  );
}

/** "Sedang berlangsung · 08:00–10:00 · 7602", then the course's dot, code and name. */
function ClassBlock({ line, theme }: { line: WidgetClass; theme: Theme }) {
  const c = theme.color;
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "column" }} {...tap(line.open)} accessibilityLabel={line.name ?? line.code}>
      <Text text={[line.heading, line.time, line.where].filter(Boolean).join(" · ")} size="micro" color={line.live ? c.successFg : c.muted} bold />
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 6 }}>
        <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hex(theme.course(line.tone)) }} />
        <Text text={line.name ? `${line.code} ${line.name}` : line.code} size="body" color={c.fg} bold />
      </FlexWidget>
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
      <Text text={[line.label, line.detail].filter(Boolean).join(" · ")} size="small" color={primary ? c.onAccent : c.fg} bold />
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

function Text({
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
  needs: { heading: string; items: WidgetLine[]; more: WidgetLine | null } | null;
}

/**
 * What fits the widget's height, most pressing first: the class (always), "Tandai Hadir" and the
 * Presence, then "Perlu perhatianmu" with as many items as fit, and "Lihat semua" when some don't.
 */
function fit(model: WidgetModel, size: WidgetSize): Fitted {
  const scale = Math.max(1, size.fontScale);
  const line = (kind: keyof typeof LINE) => LINE[kind] * scale;
  let room = size.height - 2 * PAD - line("micro") - GAP;
  if (model.now) room -= ("code" in model.now ? line("micro") + line("body") : line("small")) + GAP;
  const actions: WidgetLine[] = [];
  for (const action of model.actions) {
    const height = line("small") + 14 + GAP;
    if (room < height) break;
    actions.push(action);
    room -= height;
  }
  const needs = model.needs;
  if (!needs) return { actions, needs: null };
  const heading = line("micro") + 4;
  if (needs.empty) return { actions, needs: room >= heading + line("small") ? { heading: needs.heading, items: [needs.empty], more: null } : null };
  const items: WidgetLine[] = [];
  room -= heading;
  for (const item of needs.items) {
    const height = line("small") + (item.detail ? line("micro") : 0) + 4;
    // Room for this one, and for "Lihat semua" under it when more are left out.
    const after = items.length + 1 < needs.items.length ? line("small") + 4 : 0;
    if (room < height + after) break;
    items.push(item);
    room -= height;
  }
  if (!items.length) return { actions, needs: null };
  return { actions, needs: { heading: needs.heading, items, more: items.length < needs.items.length ? needs.all : null } };
}

// ---------------------------------------------------------------- taps

/** A line's tap: its screen in the app (a deep link to ../nav.ts's path), or the page in the browser. */
function tap(open: WidgetTarget): { clickAction: string; clickActionData?: Record<string, unknown> } {
  switch (open.kind) {
    case "app":
      return { clickAction: "OPEN_APP" };
    case "url":
      return { clickAction: "OPEN_URI", clickActionData: { uri: open.url } };
    case "route":
      return { clickAction: "OPEN_URI", clickActionData: { uri: `${SCHEME}://${hrefOf(open.route).replace(/^\//, "")}` } };
    case "checkIn":
      // The demo's SIX is pretend: Presensi instead, as its "Tandai Hadir" opens nothing.
      return {
        clickAction: "OPEN_URI",
        clickActionData: { uri: DEMO ? `${SCHEME}://presence` : `${SCHEME}://check-in/${encodeURIComponent(open.meetingId)}` },
      };
  }
}

/** The theme's colors are hex: the widget library types them so. */
const hex = (color: string) => color as HexColor;
