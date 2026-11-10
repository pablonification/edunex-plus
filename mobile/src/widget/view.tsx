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
import type { WidgetClass, WidgetLine, WidgetModel, WidgetQuiet, WidgetTarget, WidgetTodayClass } from "./model";

/** The app's deep links (app.config.ts's scheme). */
const SCHEME = DEMO ? "edunexplusdemo" : "edunexplus";

/** Font sizes in sp, and the line each takes in dp at the phone's normal text size, for working out what fits. */
// `foot`: when the data was last read, the quietest line on any widget, never bigger than its least important fact.
const FONT = { foot: 11, micro: 12, small: 14, body: 16, title: 18 } as const;
export const LINE = { foot: 15, micro: 16, small: 19, body: 21, title: 24 } as const;
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
export function courseBlock(tone: string | undefined): { bg: string; on: string; soft: string; faint: string; edge: string } {
  const bg = THEMES.light.courseTile(tone).ink;
  // `edge`: a hairline a shade lighter, so the block keeps its outline on a wallpaper of its own colour.
  return { bg, on: "#ffffff", soft: mix(bg, "#ffffff", 0.92), faint: mix(bg, "#ffffff", 0.36), edge: mix(bg, "#ffffff", 0.34) };
}

/** A course's colour for a bar or a dot on the widget's own surface. */
export const courseInk = (theme: Theme, tone: string | undefined) => theme.courseTile(tone).ink;

/**
 * A course in a list's row: its name whole at the row's size, else whole a step smaller, else its code. So a list at
 * its first size says names, not a mix of names and codes.
 */
export function rowLabel(
  name: string | null,
  code: string,
  width: number,
  scale: number,
  /** Every row of the list a step smaller, as one of them needs it: a list reads in one size. */
  smaller = false,
): { text: string; lines: number; size: "small" | "micro" } {
  const normal = courseLabel(name, code, FONT.small * scale, width, 2);
  if (!smaller && (!name || normal.text === name)) return { text: normal.text, lines: normal.lines, size: "small" };
  const small = courseLabel(name, code, FONT.micro * scale, width, 2);
  if (smaller || small.text === name) return { text: small.text, lines: small.lines, size: "micro" };
  return { text: normal.text, lines: normal.lines, size: "small" };
}

// ---------------------------------------------------------------- Sekarang

function NowWidget({ model: given, size, theme }: { model: WidgetModel; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  if (given.quiet?.now) return <StateCard quiet={given.quiet.now} status={given.status} size={size} theme={theme} />;
  // Not reached at the last read: no button for a page that may not open, or a window that may have closed since.
  const model = given.status.offline ? { ...given, actions: [] } : given;
  const cls = model.now && "code" in model.now ? model.now : null;
  const scale = Math.max(1, size.fontScale);
  if (!cls) {
    // No class to show: a calm line, what's open as buttons, then what needs the Student.
    const quiet = model.now && !("code" in model.now) ? model.now : null;
    let room =
      size.height -
      2 * PAD -
      (LINE.foot + 6) * scale -
      (quiet ? (LINE.body * linesOf(quiet.label, FONT.body * scale, size.width - 2 * PAD) + 8) * scale : 0) -
      (model.needs?.items.length ? (LINE.micro + 8) * scale : 0);
    const actions = model.actions.filter(() => {
      const fits = room >= BUTTON * scale + 8;
      if (fits) room -= BUTTON * scale + 8;
      return fits;
    });
    const needs = fitNeeds(model, room, scale, size.width - 2 * PAD);
    const nothing = !quiet && !actions.length && !needs;
    return (
      <Frame theme={theme}>
        <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 8 }}>
          {nothing ? <Text text={model.status.text} size="body" color={v.fg} bold lines={3} /> : null}
          {quiet ? (
            <Text
              text={quiet.label}
              size={size.width < 250 ? "small" : "body"}
              color={v.fg}
              bold
              lines={Math.min(4, linesOf(quiet.label, (size.width < 250 ? FONT.small : FONT.body) * scale, size.width - 2 * PAD))}
              open={quiet.open}
            />
          ) : null}
          {actions.map((line) => (
            <Button
              key={`${line.label}${line.detail ?? ""}`}
              line={line}
              bg={v.brand}
              ink={v.onBrand}
              detailInk={v.onBrand}
              scale={scale}
              plain={size.width < 250}
              // No class above it to say whose: the button names its course.
              full
            />
          ))}
          {needs ? (
            <Needs needs={needs} theme={theme} heading={model.needs?.items.length ? model.needs.heading : null} width={size.width - 2 * PAD} scale={scale} />
          ) : null}
        </FlexWidget>
        {nothing ? null : <Foot status={model.status} theme={theme} width={size.width - 2 * PAD} scale={scale} />}
      </Frame>
    );
  }

  const plan = fitNow(model, cls, size);
  // The classes under the block: names down the whole list, the rooms at the rows' ends only where every name still fits.
  const laterWidth = size.width - 24 - 42 * scale - 20;
  const laterRooms = plan.later.every((one) => laterLabel(one, laterWidth, scale).text === (one.name ?? one.code));
  // One size down the list: a step smaller for every row when one name needs it.
  const laterSmall = plan.later.some((one) => laterLabel(one, laterWidth, scale, laterRooms).size === "micro");
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
  const buttons = plan.actions.map((line) => {
    // The class is named right above: its code again by the button says nothing new.
    const detail = line.detail && line.detail !== cls.code ? line.detail : null;
    if (plan.row)
      return (
        <Button
          key={`${line.label}${line.detail ?? ""}`}
          line={line}
          bg={block.on}
          ink={block.bg}
          detailInk={THEMES.light.v4.fg}
          scale={scale}
          plain={!detail}
          stacked
        />
      );
    const beside = size.width >= 250;
    // The pill runs the widget's width, under either thumb: the time it closes at its end, or under it in a narrow widget.
    return (
      <FlexWidget key={`${line.label}${line.detail ?? ""}`} style={{ width: "match_parent", flexDirection: "column", alignItems: "flex-start", flexGap: 4 }}>
        <Button line={detail ? line : { ...line, detail: undefined }} bg={block.on} ink={block.bg} detailInk={block.bg} scale={scale} plain={!beside} />
        {detail && !beside && plan.detailUnder ? <Text text={detail} size="micro" color={block.on} bold /> : null}
      </FlexWidget>
    );
  });
  const inside = (
    <FlexWidget
      {...tap(cls.open)}
      accessibilityLabel={label}
      style={{
        width: "match_parent",
        ...(plan.split ? {} : { height: "match_parent" }),
        flexDirection: plan.row ? "row" : "column",
        alignItems: plan.row ? "center" : "flex-start",
        justifyContent: "space-between",
        flexGap: plan.row ? 10 : 8,
        padding: 12,
        // With the list under it, the block is the widget's own top, edge to edge: never a card inside a card.
        ...(plan.split
          ? { borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS }
          : { borderRadius: RADIUS, borderWidth: 1, borderColor: hex(block.edge) }),
        backgroundColor: hex(block.bg),
      }}
    >
      {words}
      {plan.row ? (
        buttons
      ) : buttons.length || plan.footInside ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 6 }}>
          {buttons}
          {plan.footInside ? <Foot status={model.status} theme={theme} width={size.width - 24} scale={scale} on={block.on} /> : null}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
  if (!plan.split) return inside;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        flexDirection: "column",
        flexGap: 10,
        borderRadius: RADIUS,
        backgroundColor: hex(v.card),
      }}
    >
      {inside}
      <FlexWidget
        style={{ width: "match_parent", flex: 1, flexDirection: "column", justifyContent: "space-between", paddingHorizontal: 12, paddingBottom: 12 }}
      >
        <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 10 }}>
          {/* The next class right under the one on now, then what needs the Student under its own heading. */}
          {plan.later.length ? (
            <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 2 }}>
              {plan.later.map((one) => (
                <TodayRow
                  key={`${one.code}${one.time}`}
                  one={one}
                  theme={theme}
                  two={false}
                  beside={laterRooms}
                  scale={scale}
                  flush
                  label={laterLabel(one, laterWidth, scale, laterRooms, laterSmall)}
                />
              ))}
            </FlexWidget>
          ) : null}
          {plan.below ? (
            <Needs
              needs={plan.below}
              theme={theme}
              heading={model.needs?.items.length ? model.needs.heading : null}
              width={size.width - 24}
              scale={scale}
              link={false}
            />
          ) : null}
        </FlexWidget>
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexGap: 8 }}>
          {plan.below?.more ? <Text text={plan.below.more.label} size="small" color={v.brandInk} bold open={plan.below.more.open} /> : null}
          {plan.footInside ? null : (
            <Foot
              status={model.status}
              theme={theme}
              width={size.width - 24 - (plan.below?.more ? plan.below.more.label.length * FONT.small * scale * 0.62 + 8 : 0)}
              scale={scale}
            />
          )}
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/** A later class under "Sekarang"'s needs: its name on one line with the room beside it, else whole over two. */
function laterLabel(
  one: WidgetTodayClass,
  width: number,
  scale: number,
  rooms = true,
  smaller = false,
): { text: string; lines: number; size: "small" | "micro" } {
  // One line, the room at its end: the name at the row's size, else a step smaller, else its code.
  const left = width - (rooms && one.room ? one.room.length * FONT.micro * scale * 0.56 + 8 : 0);
  const small = courseLabel(one.name, one.code, FONT.small * scale, left, 1);
  if (!smaller && (!one.name || small.text === one.name)) return { ...small, size: "small" };
  return { ...courseLabel(one.name, one.code, FONT.micro * scale, left, 1), size: "micro" };
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
  /** A narrow widget: "Tutup 09:30" on its own line under the button. */
  detailUnder: boolean;
  /** What needs the Student, under the block on the widget's own surface; null when none fits. */
  below: FittedNeeds | null;
  /** The block is the widget's top with a list under it (classes, needs, the foot); else the block is the whole widget. */
  split: boolean;
  /** Today's classes still to come, under the needs, where a tall widget has the room: growing it shows more of the day. */
  later: WidgetTodayClass[];
}

/** The lines `text` takes at `width` dp and `fontSize`: an estimate on the safe side (Roboto's average letter is about 0.54 em, and a wrap wastes some). */
export const linesOf = (text: string, fontSize: number, width: number) =>
  // One line when it clearly fits (0.56 em a letter, a margin over Roboto's 0.54); wrapped, a line wastes its end (0.6).
  text.length * fontSize * 0.56 <= width ? 1 : Math.max(2, Math.ceil((text.length * fontSize * 0.6) / Math.max(1, width)));

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
  // One row high and wide: the button at the right, beside the class (a cell's row is up to about 135 dp).
  const row = size.height < 150 && wide && model.actions.length > 0;
  // The bigger name only where it stays on one line: a second line of it would take the place of the next class under the block.
  const big = wide && size.height >= 190 && (!cls.name || linesOf(cls.name, FONT.title * scale, inner) === 1);
  // What stays true until the widget is drawn again: "Sedang berlangsung" with when it ends, "Mulai 11:00", "Besok 08:00".
  const lead = cls.lead ?? cls.heading;
  // On now, a narrow widget leads with the class's hours: "Sedang berlangsung" alone is false the minute it ends.
  const head = !cls.live || !cls.ends ? [lead] : wide ? [`${lead} · ${cls.ends}`] : [cls.time];
  const nameLine = L(big ? "title" : "body");
  let room = size.height - 24 - head.length * L("micro") - nameLine;
  if (model.status.problem) room -= L("foot") + 6;
  // Not live: the class's own hours and room under its name come before a second line of the name.
  const first = model.actions[0];
  const detailUnder = !wide && !row && Boolean(first?.detail) && first?.detail !== cls.code && room >= BUTTON * scale + 8 + L("micro") + 4;
  if (detailUnder) room -= L("micro") + 4;
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
  const label = courseLabel(cls.name, cls.code, fontSize, textWidth, most(room));
  room -= (label.lines - 1) * nameLine;
  const where = Boolean(cls.where) && room >= L("micro");
  if (where) room -= L("micro");
  // Under the block: its frame (12) and the gap (10) come out of what's left.
  // (What's wrong already has its line kept above.)
  // The last line under the block is one row: the link to the rest at its left, when the data was read at its right.
  // (Offline, the line stays on the block, where the button was: the reason there's none is said in its place.)
  const offline = Boolean(model.status.offline);
  const under = room - 22 - (L("small") + 6) + (model.status.problem && !offline ? L("foot") + 6 : 0);
  const rowHeight = (LINE.small + 10) * scale;
  const ahead = (model.today?.classes ?? []).filter((one) => !one.past && !one.live);
  // The next class right under the block, then what needs the Student under its heading, then the rest of the day.
  const nextUp = !row && ahead.length && under >= rowHeight + 10 ? 1 : 0;
  const headHeight = model.needs?.items.length ? (LINE.micro + 8) * scale : 0;
  // (The last need has no gap under it: 8 back.)
  const below = !row && model.needs ? fitNeedsList(model.needs, under - nextUp * (rowHeight + 10) - headHeight + 8, scale, inner, true) : null;
  const used = nextUp * (rowHeight + 10) + (below ? below.height + headHeight : 0);
  // The lines above are counted on the safe side, so a row that's 8 dp short by the count still has its place.
  // Between two designed heights (a launcher's rows differ: 260 dp for two on a Samsung, 268 on a Pixel) no need may
  // fit yet: the day's next classes take the room instead, as many as fit, never the block stretched over a hole.
  const later = row
    ? []
    : below
      ? ahead.slice(0, nextUp + Math.max(0, Math.floor((under - used + 8) / rowHeight)))
      : ahead.slice(0, Math.max(0, Math.floor((under + 2) / (rowHeight + 2))));
  return {
    later,
    split: Boolean(below) || later.length > 0,
    head,
    big,
    name: label.text,
    nameLines: label.lines,
    where,
    actions,
    row,
    below,
    detailUnder,
    // On the block, only what's wrong: when all is well the class is the whole widget.
    footInside: ((!below && !later.length) || offline) && Boolean(model.status.text) && model.status.problem,
  };
}

function fitNeeds(model: WidgetModel, room: number, scale: number, width: number): FittedNeeds | null {
  return model.needs ? fitNeedsList(model.needs, room, scale, width) : null;
}

/** A need's title with its course by name, and the lines it takes (two at most). */
const needTitle = (line: WidgetLine, width: number, scale: number) => {
  const named = line.named ?? line.label;
  const lines = linesOf(named, FONT.small * scale, width);
  return lines <= 2 ? { text: named, lines } : { text: line.label, lines: 1 };
};

/** As many needs as fit `room`, with "Lihat semua 3 di Beranda" under them when some don't; null when not even one does. */
function fitNeedsList(
  needs: NonNullable<WidgetModel["needs"]>,
  room: number,
  scale: number,
  width: number,
  /** The link has its own line kept elsewhere (beside the foot): it takes no room here. */
  linkKept = false,
): FittedNeeds | null {
  if (needs.empty) return room >= LINE.small * scale ? { items: [needs.empty], more: null, height: LINE.small * scale } : null;
  const items: WidgetLine[] = [];
  let left = room;
  const after = linkKept ? 0 : LINE.small * scale + 8;
  for (const item of needs.items) {
    const height = (LINE.small * needTitle(item, width, scale).lines + (item.detail ? LINE.micro : 0)) * scale + 8;
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
function Needs({
  needs,
  theme,
  heading,
  width,
  scale,
  link = true,
}: {
  needs: FittedNeeds;
  theme: Theme;
  heading: string | null;
  width: number;
  scale: number;
  /** False where the link is drawn elsewhere (beside the foot). */
  link?: boolean;
}) {
  const v = theme.v4;
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 8 }}>
      {heading ? <Text text={heading} size="micro" color={v.muted} bold /> : null}
      {needs.items.map((line) => (
        <FlexWidget
          key={`${line.label}${line.detail ?? ""}`}
          style={{ width: "match_parent", flexDirection: "column" }}
          {...tap(line.open)}
          accessibilityLabel={[line.label, line.detail].filter(Boolean).join(", ")}
        >
          <Text text={needTitle(line, width, scale).text} size="small" color={v.fg} bold lines={needTitle(line, width, scale).lines} />
          {line.detail ? <Text text={line.detail} size="micro" color={v.muted} /> : null}
        </FlexWidget>
      ))}
      {link && needs.more ? <Text text={needs.more.label} size="small" color={v.brandInk} bold open={needs.more.open} /> : null}
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
  full = false,
  hug = false,
}: {
  line: WidgetLine;
  bg: string;
  ink: string;
  detailInk: string;
  scale: number;
  plain?: boolean;
  stacked?: boolean;
  /** The line's whole label ("Isi Presensi KU5014"), where nothing above names the course. */
  full?: boolean;
  /** As wide as its word, not the widget. */
  hug?: boolean;
}) {
  const detail = plain ? null : line.detail;
  return (
    <FlexWidget
      {...tap(line.open)}
      accessibilityLabel={line.a11y ?? [line.label, line.detail].filter(Boolean).join(", ")}
      style={{
        ...(stacked ? {} : hug ? { height: BUTTON * scale } : { width: "match_parent", height: BUTTON * scale }),
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
      <Text text={full ? line.label : (line.short ?? line.label)} size="small" color={ink} weight="700" />
      {detail ? <Text text={detail} size="micro" color={detailInk} bold /> : null}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Hari ini

/**
 * The day as a short list, the time first: each class its start, its course's colour bar and its name (the room under
 * it on every row, or on none), the one on now as a block in its course's colour that says when it ends, the ones over
 * quiet. Where there's still height, the next day's classes under their own heading. Deadlines are Tenggat's.
 */
function TodayWidget({ model, size, theme }: { model: WidgetModel; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const today = model.today;
  const quiet = model.quiet?.today ?? null;
  if (quiet) return <StateCard quiet={quiet} status={model.status} size={size} theme={theme} />;
  if (!today)
    return (
      <Frame theme={theme}>
        <Foot status={model.status} theme={theme} />
      </Frame>
    );
  const scale = Math.max(1, size.fontScale);
  // Today only: another day's classes under "Hari ini" would read as today's.
  const every = today.classes;
  // A wide widget says each room at its row's end, where the right third would be empty.
  const roomWidth = Math.max(0, ...every.map((one) => (one.room ? one.room.length * FONT.micro * scale * 0.62 : 0)));
  const besideRooms = size.width >= 340 && roomWidth > 0;
  const nameWidth = size.width - 2 * PAD - 12 - 42 * scale - 20 - (besideRooms ? roomWidth + 8 : 0);
  // One size down the list: a step smaller for every row when one name needs it.
  const smaller = every.some((one) => rowLabel(one.name, one.code, nameWidth, scale).size === "micro");
  // Names down the whole list, or codes down the whole list: never a mix.
  const codes = every.some((one) => rowLabel(one.name, one.code, nameWidth, scale, smaller).text !== (one.name ?? one.code));
  const labelOf = (one: WidgetTodayClass) =>
    codes ? { text: one.code, lines: 1, size: "small" as const } : rowLabel(one.name, one.code, nameWidth, scale, smaller);
  // The row on now says when it ends ("selesai 10:00"): the block alone could be the course's colour.
  const until = model.now && "code" in model.now && model.now.live ? (model.now.ends ?? null) : null;
  const onNow = today.classes.find((one) => one.live);
  // "selesai 10:00", or "–10:00" where the row is too narrow for the word.
  const ends = until && onNow ? (until.length * FONT.micro * scale * 0.56 <= nameWidth ? until : `–${onNow.end}`) : null;
  const heightOf = (one: WidgetTodayClass, under: boolean) =>
    (labelOf(one).lines * LINE[labelOf(one).size] + ((under && one.room) || (one.live && ends) ? LINE.micro : 0)) * scale + 10;
  const total = (list: WidgetTodayClass[], under: boolean) => list.reduce((sum, one) => sum + heightOf(one, under), 0);
  const ahead = today.classes.filter((one) => !one.past);
  const over = today.classes.filter((one) => one.past).reverse();
  const headHeight = (LINE.micro + 8) * scale;
  const foot = Boolean(model.status.text);
  // (A row's height counts the 2 dp gap under it, and the last row has none: 2 back. At 260 dp, a Samsung's two rows,
  // that is the fourth class of the day.)
  let room = size.height - 2 * PAD - headHeight - (foot ? (LINE.foot + 6) * scale : 0) + 2;
  // "Tidak ada kuliah hari ini.", or once the last one is over, "Kelas hari ini sudah selesai".
  const said = today.none?.label ?? today.done ?? null;
  const saidLines = said ? linesOf(said, FONT.body * scale, size.width - 2 * PAD - 12) : 0;
  if (said) room -= LINE.body * saidLines * scale + 6;
  // The rooms under the names only where every row's line fits its width (the row on now carries "selesai 10:00" too).
  const underFits = (one: WidgetTodayClass): boolean => (one.room ?? "").length * FONT.micro * scale * 0.62 <= nameWidth;
  // The row on now says when it ends first: its room beside that only where the line holds both.
  const liveRoom = onNow ? [ends, onNow.room].filter(Boolean).join(" · ").length * FONT.micro * scale * 0.62 <= nameWidth : true;
  const two = !besideRooms && every.every(underFits) && total(every, true) <= room;
  const shown: WidgetTodayClass[] = [];
  // A two-cell-wide widget holds four rows at most: more is a wall of text in a small tile.
  const most = size.width < 250 ? 4 : 99;
  const fill = (list: WidgetTodayClass[]) => {
    for (const one of list) {
      if (room < heightOf(one, two) || shown.length >= most) break;
      shown.push(one);
      room -= heightOf(one, two);
    }
  };
  fill(ahead);
  // Every class still ahead is in: then the ones already over, quiet.
  fill(over);
  const row = (one: WidgetTodayClass) => (
    <TodayRow
      key={`${one.code}${one.time}${one.open.kind === "class" ? one.open.sessionId : ""}`}
      one={one}
      theme={theme}
      two={two && (!one.live || liveRoom)}
      beside={besideRooms}
      scale={scale}
      label={labelOf(one)}
      ends={ends}
    />
  );
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 2 }}>
        <FlexWidget style={{ width: "match_parent", paddingHorizontal: 6, paddingBottom: 4 }}>
          <Text text={today.heading} size="micro" color={v.muted} bold />
        </FlexWidget>
        {said ? (
          <FlexWidget style={{ width: "match_parent", paddingHorizontal: 6, paddingBottom: 6 }}>
            <Text text={said} size="body" color={v.fg} bold lines={saidLines} open={today.none?.open ?? { kind: "route", route: { screen: "schedule" } }} />
          </FlexWidget>
        ) : null}
        {today.classes.filter((one) => shown.includes(one)).map(row)}
      </FlexWidget>
      {foot ? (
        <FlexWidget style={{ width: "match_parent", paddingHorizontal: 6 }}>
          <Foot status={model.status} theme={theme} width={size.width - 2 * PAD - 12} scale={scale} />
        </FlexWidget>
      ) : null}
    </Frame>
  );
}

function TodayRow({
  one,
  theme,
  two,
  scale,
  label,
  flush = false,
  ends = null,
  beside = false,
}: {
  /** The course's name where it fits whole, else its code, and the lines it takes. */
  label: { text: string; lines: number; size?: "small" | "micro" };
  one: WidgetTodayClass;
  theme: Theme;
  /** The room under the name: on every row that has one, or on none. */
  two: boolean;
  scale: number;
  /** No inset of its own: under "Sekarang"'s needs, where the lines start at the same edge. */
  flush?: boolean;
  /** "selesai 10:00", on the row that's on now. */
  ends?: string | null;
  /** The room at the row's end, on one line (the label was fitted to leave it room). */
  beside?: boolean;
}) {
  const v = theme.v4;
  const block = courseBlock(one.tone);
  const ink = one.live ? block.on : one.past ? v.muted : v.fg;
  const quiet = one.live ? block.soft : v.muted;
  const under = [one.live ? ends : null, two ? one.room : null].filter(Boolean).join(" · ");
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
      {/* The bar on every row, white on the one that's on now, so every name starts at the same edge. */}
      <FlexWidget
        style={{
          width: 4,
          height: (label.lines * LINE[label.size ?? "small"] + (under ? LINE.micro : 0)) * scale - 2,
          borderRadius: 2,
          backgroundColor: hex(one.live ? block.on : one.past ? v.line : courseInk(theme, one.tone)),
        }}
      />
      <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
        <Text text={label.text} size={label.size ?? "small"} color={ink} bold={!one.past} lines={label.lines} />
        {under ? <Text text={under} size="micro" color={quiet} /> : null}
      </FlexWidget>
      {beside && one.room ? <Text text={one.room} size="micro" color={quiet} /> : null}
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

/**
 * The foot, one small line on every widget: "Diperbarui 08:11", quieter than anything above it, or what's wrong in
 * amber ("Tidak terhubung · data 08:12"; "Data 08:12" where the line doesn't hold that). `on`: the ink on a course's block.
 */
export function Foot({
  status,
  theme,
  width,
  scale = 1,
  on,
}: {
  status: { text: string; problem: boolean; short?: string; mid?: string };
  theme: Theme;
  /** The line's width in dp: what's wrong is said in its short form before it's cut. */
  width?: number;
  scale?: number;
  on?: string;
}) {
  if (!status.text) return null;
  // A tenth of slack: the phone's font runs wider than the estimate.
  const held = (text: string) => width === undefined || text.length * FONT.foot * scale * 0.62 <= width;
  // Offline is said in words at every size ("Tidak terhubung · data 08:12", then "Tidak terhubung · 08:12"); the bare
  // "Data 08:12" only in one cell, which holds no more.
  const text = held(status.text) ? status.text : status.mid && (held(status.mid) || (width ?? 0) >= 110) ? status.mid : (status.short ?? status.text);
  return <Text text={text} size="foot" color={on ?? (status.problem ? theme.v4.ambFg : theme.v4.muted)} bold={status.problem} lines={1} />;
}

/**
 * A widget with nothing of its own to show, the same on all seven: its own name, one sentence that's true, and one
 * thing to tap, in the only blue on it. The whole widget is that tap. One cell: the sentence's two words alone.
 */
export function StateCard({
  quiet,
  status,
  size,
  theme,
}: {
  quiet: WidgetQuiet;
  status: { text: string; problem: boolean; short?: string; mid?: string };
  size: WidgetSize;
  theme: Theme;
}) {
  const v = theme.v4;
  const scale = Math.max(1, size.fontScale);
  const tiny = size.width < 120;
  const short = size.height < 100 * scale;
  const action = tap(quiet.open);
  const frame = {
    width: "match_parent",
    height: "match_parent",
    padding: tiny ? 8 : PAD,
    borderRadius: tiny ? 18 : RADIUS,
    backgroundColor: hex(v.card),
    flexDirection: "column",
  } as const;
  const label = `${quiet.name}. ${quiet.label} ${quiet.action}`;
  if (tiny || size.height < 72 * scale)
    return (
      <FlexWidget
        clickAction={action.clickAction}
        clickActionData={action.clickActionData}
        accessibilityLabel={label}
        style={{ ...frame, justifyContent: "center" }}
      >
        <Text text={quiet.short} size={tiny ? "micro" : "small"} color={v.fg} bold lines={3} />
      </FlexWidget>
    );
  // What's wrong (offline, a sign-in that ended), when the card isn't already about signing in.
  const foot = status.problem && quiet.state !== "signedOut" && size.height >= 130 * scale;
  return (
    <FlexWidget
      clickAction={action.clickAction}
      clickActionData={action.clickActionData}
      accessibilityLabel={label}
      style={{ ...frame, justifyContent: "space-between" }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 2 }}>
        <Text text={quiet.name} size="micro" color={v.muted} bold />
        <Text text={short ? quiet.short : quiet.label} size={size.width >= 250 ? "body" : "small"} color={v.fg} bold lines={short ? 1 : 3} />
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 2 }}>
        {quiet.state === "signedOut" && size.height >= 110 * scale ? (
          // Signing in is the one thing to do here: a real button, as "Isi Presensi" is, sized for a thumb.
          <FlexWidget style={{ flexDirection: "row" }}>
            <FlexWidget
              style={{
                height: BUTTON * scale,
                paddingHorizontal: 18,
                borderRadius: (BUTTON * scale) / 2,
                backgroundColor: hex(v.brandInk),
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text text={quiet.action} size="small" color={v.card} weight="700" />
            </FlexWidget>
          </FlexWidget>
        ) : (
          <Text text={quiet.action} size="small" color={v.brandInk} weight="700" />
        )}
        {foot ? <Foot status={status} theme={theme} width={size.width - 2 * PAD} scale={scale} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
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
