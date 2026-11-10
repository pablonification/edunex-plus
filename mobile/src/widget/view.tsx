"use no memo";
import { DEMO } from "../host/version";
import { hrefOf } from "../nav";
import { THEMES, type Theme } from "../ui/theme";
// The home-screen widgets as Android draws them (react-native-android-widget turns this tree into a picture, so no
// React state, hooks or app parts here). The app's look (qa/superapp-decisions.md): a white surface (one dark surface
// in dark), and one course as one block in its colour, saturated, with a white button. What a widget says comes from
// ./model.ts; how much of it shows depends on the size the Student gave it, the most pressing first.
// Every line opens its own place in the app (the same paths as ../nav.ts), an official page in the browser, or SIX's
// check-in page. This file: the shared parts, "Sekarang" and "Hari ini". The other six: ./views.tsx.
import { FlexWidget, type HexColor, TextWidget } from "./kit";
import type { WidgetClass, WidgetLine, WidgetModel, WidgetTarget, WidgetTodayClass } from "./model";

/** The app's deep links (app.config.ts's scheme). */
const SCHEME = DEMO ? "edunexplusdemo" : "edunexplus";

/** Font sizes in sp, and the line each takes in dp at the phone's normal text size, for working out what fits. */
const FONT = { micro: 12, small: 14, body: 16, title: 18 } as const;
export const LINE = { micro: 16, small: 19, body: 21, title: 24 } as const;
export const PAD = 14;
/** The widget's own corners, and a block's inside it. */
export const RADIUS = 22;
const BUTTON = 36;

export interface WidgetSize {
  width: number;
  height: number;
  /** The phone's text size (1 is normal): bigger text, fewer lines fit. */
  fontScale: number;
}

type Pair = { light: React.JSX.Element; dark: React.JSX.Element };

function pair(setting: WidgetModel["theme"], draw: (theme: Theme) => React.JSX.Element): Pair {
  if (setting === "light" || setting === "dark") {
    const one = draw(THEMES[setting]);
    return { light: one, dark: one };
  }
  return { light: draw(THEMES.light), dark: draw(THEMES.dark) };
}

/** "Sekarang" in the phone's light and dark looks, or the one the Student chose in the app. */
export function widgetDrawing(model: WidgetModel, size: WidgetSize): Pair {
  return pair(model.theme, (theme) => <NowWidget model={model} size={size} theme={theme} />);
}

/** "Hari ini" in the phone's light and dark looks, or the one the Student chose in the app. */
export function todayDrawing(model: WidgetModel, size: WidgetSize): Pair {
  return pair(model.theme, (theme) => <TodayWidget model={model} size={size} theme={theme} />);
}

/** Before anything is saved: the app's name and the one thing to do, opening the app. */
export function emptyDrawing(hint: string): Pair {
  const draw = (theme: Theme) => (
    <Frame theme={theme}>
      <Text text="Edunex Plus" size="body" color={theme.v4.fg} bold />
      <Text text={hint} size="small" color={theme.v4.muted} lines={3} />
    </Frame>
  );
  return { light: draw(THEMES.light), dark: draw(THEMES.dark) };
}

// ---------------------------------------------------------------- colour

/** `a` with `b` mixed in (0 to 1): the library draws hex only, so "white at 80%" on a course's colour is worked out here. */
export function mix(a: string, b: string, amount: number): string {
  const part = (color: string, at: number) => Number.parseInt(color.slice(at, at + 2), 16);
  return `#${[1, 3, 5]
    .map((at) =>
      Math.round(part(a, at) + (part(b, at) - part(a, at)) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * A course's block: its colour, saturated, the same in light and dark (the tile's light ink, which white reads on at
 * 4.5:1 or more), with white on it, a softer white for what's secondary, and a faint one for a mark that's used up.
 */
export function courseBlock(tone: string | undefined): { bg: string; on: string; soft: string; faint: string } {
  const bg = THEMES.light.courseTile(tone).ink;
  return { bg, on: "#ffffff", soft: mix(bg, "#ffffff", 0.86), faint: mix(bg, "#ffffff", 0.36) };
}

/** A course's colour for a bar or a dot on the widget's own surface. */
export const courseInk = (theme: Theme, tone: string | undefined) => theme.courseTile(tone).ink;

// ---------------------------------------------------------------- Sekarang

function NowWidget({ model, size, theme }: { model: WidgetModel; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const cls = model.now && "code" in model.now ? model.now : null;
  const scale = Math.max(1, size.fontScale);
  if (!cls) {
    // No class to show: a calm line, what's open as buttons, then what needs the Student.
    const quiet = model.now && !("code" in model.now) ? model.now : null;
    let room = size.height - 2 * PAD - (LINE.micro + 6) * scale - (quiet ? (LINE.body + 6) * scale : 0);
    const actions = model.actions.filter(() => {
      const fits = room >= BUTTON * scale + 8;
      if (fits) room -= BUTTON * scale + 8;
      return fits;
    });
    const needs = fitNeeds(model, room, scale);
    const nothing = !quiet && !actions.length && !needs;
    return (
      <Frame theme={theme}>
        <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 8 }}>
          {nothing ? <Text text="Edunex Plus" size="micro" color={v.brandInk} bold /> : null}
          {nothing ? <Text text={model.status.text} size="body" color={v.fg} bold lines={3} /> : null}
          {quiet ? <Text text={quiet.label} size="body" color={v.fg} bold lines={2} open={quiet.open} /> : null}
          {actions.map((line) => (
            <Button
              key={`${line.label}${line.detail ?? ""}`}
              line={line}
              bg={v.brand}
              ink={v.onBrand}
              detailInk={v.onBrand}
              scale={scale}
              plain={size.width < 250}
            />
          ))}
          {needs ? <Needs needs={needs} theme={theme} /> : null}
        </FlexWidget>
        {nothing ? null : <Foot status={model.status} theme={theme} />}
      </Frame>
    );
  }

  const plan = fitNow(model, cls, size);
  const block = courseBlock(cls.tone);
  const name = plan.name;
  const label = [cls.heading, cls.time, cls.name ?? cls.code, cls.where].filter(Boolean).join(", ");
  const words = (
    <FlexWidget style={{ flexDirection: "column", ...(plan.row ? { flex: 1 } : { width: "match_parent" }) }}>
      {plan.head.map((line) => (
        <Text key={line} text={line} size="micro" color={block.soft} bold />
      ))}
      <Text text={name} size={plan.big ? "title" : "body"} color={block.on} weight="700" lines={plan.nameLines} />
      {plan.where && cls.where ? <Text text={cls.where} size="micro" color={block.soft} /> : null}
    </FlexWidget>
  );
  const buttons = plan.actions.map((line) => (
    <Button
      key={`${line.label}${line.detail ?? ""}`}
      line={line}
      bg={block.on}
      ink={block.bg}
      detailInk={THEMES.light.v4.fg}
      scale={scale}
      // The class is named right above: its code again on the button says nothing new.
      plain={line.detail === cls.code || (size.width < 250 && !plan.row)}
      stacked={plan.row}
    />
  ));
  const inside = (
    <FlexWidget
      {...tap(cls.open)}
      accessibilityLabel={label}
      style={{
        width: "match_parent",
        ...(plan.below ? {} : { height: "match_parent" }),
        flexDirection: plan.row ? "row" : "column",
        alignItems: plan.row ? "center" : "flex-start",
        justifyContent: "space-between",
        flexGap: plan.row ? 10 : 8,
        padding: 12,
        borderRadius: plan.below ? RADIUS - 6 : RADIUS,
        backgroundColor: hex(block.bg),
      }}
    >
      {words}
      {plan.row ? (
        buttons
      ) : buttons.length || plan.footInside ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 6 }}>
          {buttons}
          {plan.footInside ? (
            <Text text={model.status.text} size="micro" color={block.soft} bold={model.status.problem} lines={model.status.problem ? 2 : 1} />
          ) : null}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
  if (!plan.below) return inside;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        flexGap: 10,
        padding: 6,
        borderRadius: RADIUS,
        backgroundColor: hex(v.card),
      }}
    >
      {inside}
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", justifyContent: "space-between", paddingHorizontal: 8, paddingBottom: 6 }}>
        <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 10 }}>
          <Needs needs={plan.below} theme={theme} />
          {plan.later.length ? (
            <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 2 }}>
              {plan.later.map((one) => (
                <TodayRow
                  key={`${one.code}${one.time}`}
                  one={one}
                  theme={theme}
                  two={false}
                  wide
                  scale={scale}
                  flush
                  label={laterLabel(one, size.width - 28 - 42 * scale - 20, scale)}
                />
              ))}
            </FlexWidget>
          ) : null}
        </FlexWidget>
        <Foot status={model.status} theme={theme} />
      </FlexWidget>
    </FlexWidget>
  );
}

/** A later class under "Sekarang"'s needs: its name on one line with the room beside it, else whole over two. */
function laterLabel(one: WidgetTodayClass, width: number, scale: number): { text: string; lines: number } {
  const beside = courseLabel(one.name, one.code, FONT.small * scale, width - (one.room ? 96 : 0), 1);
  return beside.text === one.name ? beside : courseLabel(one.name, one.code, FONT.small * scale, width, 2);
}

interface FittedNeeds {
  items: WidgetLine[];
  more: WidgetLine | null;
  /** The height they take, in dp. */
  height: number;
}

interface FittedNow {
  /** The line or two above the name: "08:00–10:00 · R.9009" while it's on, the day and the time when it's later. */
  head: string[];
  big: boolean;
  /** The course's name where it fits whole, else its code. */
  name: string;
  nameLines: number;
  /** The room on its own line under the name (when the head doesn't carry it). */
  where: boolean;
  actions: WidgetLine[];
  /** One row high and wide: the button beside the class, not under it. */
  row: boolean;
  /** "Diperbarui pukul …" inside the block (no room under it). */
  footInside: boolean;
  /** What needs the Student, under the block on the widget's own surface; null when the block is the whole widget. */
  below: FittedNeeds | null;
  /** Today's classes still to come, under the needs, where a tall widget has the room: growing it shows more of the day. */
  later: WidgetTodayClass[];
}

/** The lines `text` takes at `width` dp and `fontSize`: an estimate on the safe side (Roboto's average letter is about 0.54 em, and a wrap wastes some). */
export const linesOf = (text: string, fontSize: number, width: number) => Math.max(1, Math.ceil((text.length * fontSize * 0.6) / Math.max(1, width)));

/**
 * What to call a course in the room there is: its name when it fits whole in `most` lines, else its code. A name is
 * wrapped before it's cut, and the code stands in before a name is cut mid-word.
 */
export function courseLabel(name: string | null, code: string, fontSize: number, width: number, most: number): { text: string; lines: number } {
  if (!name) return { text: code, lines: 1 };
  const lines = linesOf(name, fontSize, width);
  return lines <= most ? { text: name, lines } : { text: code, lines: 1 };
}

/**
 * What fits, most pressing first: the time and the name (always), the white button, the name's second line, the room,
 * then either what needs the Student under the block (3 rows and up) or the foot inside it.
 */
function fitNow(model: WidgetModel, cls: WidgetClass, size: WidgetSize): FittedNow {
  const scale = Math.max(1, size.fontScale);
  const L = (kind: keyof typeof LINE) => LINE[kind] * scale;
  const wide = size.width >= 250;
  const inner = size.width - 24;
  const row = size.height < 130 && wide && model.actions.length > 0;
  const big = wide && size.height >= 190;
  // On now: the time, and the room beside it where there's width. Later: the day first, as "08:00" alone would read as today.
  const head = cls.live
    ? [wide && cls.where ? `${cls.time} · ${cls.where}` : cls.time]
    : wide
      ? [`${cls.heading} · ${cls.time}`]
      : size.height >= 96 * scale
        ? [cls.heading, cls.time]
        : [`${cls.heading}`];
  const nameLine = L(big ? "title" : "body");
  let room = size.height - 24 - head.length * L("micro") - nameLine;
  if (model.status.problem) room -= L("micro") * (wide ? 1 : 2) + 6;
  const actions: WidgetLine[] = [];
  if (row) actions.push(model.actions[0]!);
  else
    for (const action of model.actions) {
      if (room < BUTTON * scale + 8) break;
      actions.push(action);
      room -= BUTTON * scale + 8;
    }
  const textWidth = row ? inner - 120 : inner;
  const fontSize = FONT[big ? "title" : "body"] * scale;
  const most = (space: number) => Math.min(3, 1 + Math.max(0, Math.floor(space / nameLine)));
  let label = courseLabel(cls.name, cls.code, fontSize, textWidth, most(room));
  // On now, in a small widget: the name whole before the time (the block and its button already say "now").
  const headless = courseLabel(cls.name, cls.code, fontSize, textWidth, most(room + head.length * L("micro")));
  if (cls.name && label.text !== cls.name && headless.text === cls.name && cls.live && !row) {
    room += head.length * L("micro");
    head.length = 0;
    label = headless;
  }
  room -= (label.lines - 1) * nameLine;
  const where = Boolean(cls.where) && !(cls.live && wide) && room >= L("micro");
  if (where) room -= L("micro");
  // Under the block: its frame (12) and the gap (10) come out of what's left.
  // (What's wrong already has its line kept above.)
  const under = room - 22 - (model.status.problem ? 0 : L("micro") + 6);
  const below = !row && model.needs ? fitNeedsList(model.needs, under, scale) : null;
  const rowHeight = (2 * LINE.small + 8) * scale + 2;
  const ahead = (model.today?.classes ?? []).filter((one) => !one.past && !one.live);
  const later = below ? ahead.slice(0, Math.max(0, Math.floor((under - below.height - 10) / rowHeight))) : [];
  return {
    later,
    head,
    big,
    name: label.text,
    nameLines: label.lines,
    where,
    actions,
    row,
    below,
    footInside: !below && (model.status.problem || room >= L("micro") + 6),
  };
}

function fitNeeds(model: WidgetModel, room: number, scale: number): FittedNeeds | null {
  return model.needs ? fitNeedsList(model.needs, room, scale) : null;
}

/** As many needs as fit `room`, with "Lihat semua 3 di Beranda" under them when some don't; null when not even one does. */
function fitNeedsList(needs: NonNullable<WidgetModel["needs"]>, room: number, scale: number): FittedNeeds | null {
  if (needs.empty) return room >= LINE.small * scale ? { items: [needs.empty], more: null, height: LINE.small * scale } : null;
  const items: WidgetLine[] = [];
  let left = room;
  const after = LINE.small * scale + 8;
  for (const item of needs.items) {
    const height = (LINE.small + (item.detail ? LINE.micro : 0)) * scale + 8;
    // Room for this one, and for "Lihat semua" under it when more are left out (the first is shown even without it).
    const last = items.length + 1 === needs.items.length;
    if (left < height + (last || !items.length ? 0 : after)) break;
    items.push(item);
    left -= height;
  }
  if (!items.length) return null;
  const more = items.length < needs.items.length && left >= after;
  return { items, more: more ? needs.all : null, height: room - left + (more ? after : 0) };
}

/** What needs the Student: each its own tap, the title first, its when under it. */
function Needs({ needs, theme }: { needs: FittedNeeds; theme: Theme }) {
  const v = theme.v4;
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 8 }}>
      {needs.items.map((line) => (
        <FlexWidget
          key={`${line.label}${line.detail ?? ""}`}
          style={{ width: "match_parent", flexDirection: "column" }}
          {...tap(line.open)}
          accessibilityLabel={[line.label, line.detail].filter(Boolean).join(", ")}
        >
          <Text text={line.label} size="small" color={v.fg} bold />
          {line.detail ? <Text text={line.detail} size="micro" color={v.muted} /> : null}
        </FlexWidget>
      ))}
      {needs.more ? <Text text={needs.more.label} size="small" color={v.brandInk} bold open={needs.more.open} /> : null}
    </FlexWidget>
  );
}

/**
 * A button that looks like one: a filled pill, its word in bold, the one time that matters at its end ("Tutup 09:30":
 * a time of day, as the widget doesn't tick). `stacked`: beside the class in a one-row widget, the time under the word.
 */
function Button({
  line,
  bg,
  ink,
  detailInk,
  scale,
  plain = false,
  stacked = false,
}: {
  line: WidgetLine;
  bg: string;
  ink: string;
  detailInk: string;
  scale: number;
  plain?: boolean;
  stacked?: boolean;
}) {
  const detail = plain ? null : line.detail;
  return (
    <FlexWidget
      {...tap(line.open)}
      accessibilityLabel={line.a11y ?? [line.label, line.detail].filter(Boolean).join(", ")}
      style={{
        ...(stacked ? {} : { width: "match_parent", height: BUTTON * scale }),
        flexDirection: stacked ? "column" : "row",
        alignItems: "center",
        justifyContent: detail && !stacked ? "space-between" : "center",
        flexGap: stacked ? 0 : 8,
        paddingHorizontal: 14,
        paddingVertical: stacked ? 8 : 0,
        borderRadius: stacked ? 14 : (BUTTON * scale) / 2,
        backgroundColor: hex(bg),
      }}
    >
      <Text text={line.short ?? line.label} size="small" color={ink} weight="700" />
      {detail ? <Text text={detail} size="micro" color={detailInk} bold /> : null}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Hari ini

/**
 * The day as a short list, the time first: each class its start, its course's colour bar and its name (the room under
 * it where rows have the height), the one on now as a block in its course's colour, the ones over quiet. Then the next
 * deadline, when every class still ahead fits above it. Classes already over drop first.
 */
function TodayWidget({ model, size, theme }: { model: WidgetModel; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const today = model.today;
  if (!today)
    return (
      <Frame theme={theme}>
        <Text text="Edunex Plus" size="body" color={v.fg} bold />
        <Text text={model.status.text} size="small" color={model.status.problem ? v.ambFg : v.muted} lines={3} />
      </Frame>
    );
  const scale = Math.max(1, size.fontScale);
  const narrow = size.width < 180;
  const nameWidth = size.width - 2 * PAD - 12 - 42 * scale - 20;
  const labelOf = (one: WidgetTodayClass) => courseLabel(one.name, one.code, FONT.small * scale, nameWidth, 2);
  const heightOf = (one: WidgetTodayClass, under: boolean) => (labelOf(one).lines * LINE.small + (under && one.room ? LINE.micro : 0)) * scale + 10;
  const total = (list: WidgetTodayClass[], under: boolean) => list.reduce((sum, one) => sum + heightOf(one, under), 0);
  const ahead = today.classes.filter((one) => !one.past);
  const over = today.classes.filter((one) => one.past).reverse();
  let room = size.height - 2 * PAD - (LINE.micro + 8) * scale - (model.status.problem ? (LINE.micro * (narrow ? 2 : 1) + 6) * scale : 0);
  // The day first: the deadline when every class still ahead fits above it, then the rooms under the names.
  const deadlineHeight = (LINE.micro * (narrow ? 2 : 1) + LINE.small) * scale + 10;
  const deadline = today.deadline && total(ahead, false) + deadlineHeight <= room ? today.deadline : null;
  if (deadline) room -= deadlineHeight;
  const two = ahead.length > 0 && total(ahead, true) <= room;
  const shown: WidgetTodayClass[] = [];
  for (const one of [...ahead, ...over]) {
    if (room < heightOf(one, two)) break;
    shown.push(one);
    room -= heightOf(one, two);
  }
  const lines = today.classes.filter((one) => shown.includes(one));
  const foot = model.status.problem || room >= (LINE.micro + 6) * scale;
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 2 }}>
        <FlexWidget style={{ width: "match_parent", paddingHorizontal: 6, paddingBottom: 4 }}>
          <Text text={today.heading} size="micro" color={v.brandInk} bold />
        </FlexWidget>
        {today.none ? (
          <FlexWidget style={{ width: "match_parent", paddingHorizontal: 6 }}>
            <Text text={today.none.label} size="body" color={v.fg} bold lines={2} open={today.none.open} />
          </FlexWidget>
        ) : null}
        {lines.map((one) => (
          <TodayRow key={`${one.code}${one.time}`} one={one} theme={theme} two={two} wide={size.width >= 250} scale={scale} label={labelOf(one)} />
        ))}
      </FlexWidget>
      {deadline ? (
        <FlexWidget
          style={{ width: "match_parent", flexDirection: "column", paddingHorizontal: 6 }}
          {...tap(deadline.open)}
          accessibilityLabel={[deadline.label, deadline.detail].filter(Boolean).join(", ")}
        >
          <Text text={deadline.label} size="micro" color={v.muted} bold lines={narrow ? 2 : 1} />
          <Text text={deadline.detail ?? ""} size="small" color={v.fg} />
        </FlexWidget>
      ) : null}
      {foot ? (
        <FlexWidget style={{ width: "match_parent", paddingHorizontal: 6 }}>
          <Foot status={model.status} theme={theme} />
        </FlexWidget>
      ) : null}
    </Frame>
  );
}

function TodayRow({
  one,
  theme,
  two,
  wide,
  scale,
  label,
  flush = false,
}: {
  /** The course's name where it fits whole, else its code, and the lines it takes. */
  label: { text: string; lines: number };
  one: WidgetTodayClass;
  theme: Theme;
  two: boolean;
  wide: boolean;
  scale: number;
  /** No inset of its own: under "Sekarang"'s needs, where the lines start at the same edge. */
  flush?: boolean;
}) {
  const v = theme.v4;
  const block = courseBlock(one.tone);
  const ink = one.live ? block.on : one.past ? v.muted : v.fg;
  const quiet = one.live ? block.soft : v.muted;
  return (
    <FlexWidget
      {...tap(one.open)}
      accessibilityLabel={[one.time, one.name ?? one.code, one.room].filter(Boolean).join(", ")}
      style={{
        width: "match_parent",
        flexDirection: "row",
        alignItems: "center",
        flexGap: 8,
        paddingHorizontal: flush && !one.live ? 0 : 6,
        paddingVertical: 4,
        borderRadius: 10,
        ...(one.live ? { backgroundColor: hex(block.bg) } : {}),
      }}
    >
      <FlexWidget style={{ width: 42 * scale }}>
        <Text text={one.start} size="small" color={ink} weight={one.past ? "400" : "700"} />
      </FlexWidget>
      {one.live ? null : (
        <FlexWidget
          style={{
            width: 4,
            height: (label.lines * LINE.small + (two && one.room ? LINE.micro : 0)) * scale - 2,
            borderRadius: 2,
            backgroundColor: hex(one.past ? v.line : courseInk(theme, one.tone)),
          }}
        />
      )}
      <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
        <Text text={label.text} size="small" color={ink} bold={!one.past} lines={label.lines} />
        {two && one.room ? <Text text={one.room} size="micro" color={quiet} /> : null}
      </FlexWidget>
      {!two && wide && one.room && label.lines === 1 ? <Text text={one.room} size="micro" color={quiet} /> : null}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- shared parts

/** The widget's own surface: white (one dark surface in dark), its corners, a tap anywhere else opens the app. */
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
        borderRadius: RADIUS,
        backgroundColor: hex(surface ?? theme.v4.card),
      }}
    >
      {children}
    </FlexWidget>
  );
}

/** "Diperbarui pukul 08:11", or what's wrong in amber. */
export function Foot({ status, theme }: { status: { text: string; problem: boolean }; theme: Theme }) {
  // What's wrong is said whole: over two lines in a narrow widget.
  return <Text text={status.text} size="micro" color={status.problem ? theme.v4.ambFg : theme.v4.muted} bold={status.problem} lines={status.problem ? 2 : 1} />;
}

export function Text({
  text,
  size,
  color,
  bold = false,
  weight,
  lines = 1,
  open,
}: {
  text: string;
  size: keyof typeof FONT;
  color: string;
  bold?: boolean;
  /** "700" for a name or a figure; `bold` alone is the medium weight. */
  weight?: "400" | "500" | "700";
  lines?: number;
  open?: WidgetTarget;
}) {
  return (
    <TextWidget
      text={text}
      maxLines={lines}
      truncate="END"
      {...(open ? tap(open) : {})}
      style={{ fontSize: FONT[size], color: hex(color), fontWeight: weight ?? (bold ? "500" : "400") }}
    />
  );
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
