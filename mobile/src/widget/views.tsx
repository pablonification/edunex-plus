"use no memo";
import type { AttendanceState } from "../../../src/core/attendance";
import { absenceInk, absenceTone } from "../ui/absence";
import { THEMES, type Theme } from "../ui/theme";
// The widgets beyond "Sekarang" and "Hari ini" (qa/superapp-widgets.md), as Android draws them: react-native-android-widget
// turns this tree into a picture, so no state or hooks here. Each is built around one shape that answers its question at
// a glance: one course is one block in its colour (Ujian's figure of days, Kelas berikutnya's time, Satu mata kuliah),
// many are a short list on the widget's white surface with a colour bar per course (Tenggat, Kehadiran's marks), and
// Pintasan is the app's solid service tiles. Each takes its model (./model.ts) and the size the Student gave it, and
// shows what fits, most important first. Every row opens its own place; the surface around it opens the app.
import { FlexWidget, SvgWidget, TextWidget } from "./kit";
import type {
  AttendanceRow,
  AttendanceWidget,
  CourseWidget,
  DueRow,
  DueWidget,
  ExamWidget,
  NextWidget,
  ServiceIcon,
  ServicesWidget,
  WidgetStatus,
} from "./model";
import { courseBlock, courseInk, courseLabel, Foot, Frame, hex, LINE, linesOf, mix, PAD, RADIUS, rowLabel, Text, tap, type WidgetSize } from "./view";

/** Room for rows: the widget's height less its padding, its heading and (when it says something wrong, or there's room) its foot. */
function rowsRoom(size: WidgetSize, status: WidgetStatus, heading = true): { room: number; foot: boolean; scale: number } {
  const scale = Math.max(1, size.fontScale);
  const foot = status.problem || size.height >= 170;
  // What's wrong takes two lines in a narrow widget.
  const footLines = status.problem && size.width < 250 ? 2 : 1;
  const room = size.height - 2 * PAD - (heading ? (LINE.micro + 8) * scale : 0) - (foot ? (footLines * LINE.micro + 6) * scale : 0);
  return { room, foot, scale };
}

/** "+3 lagi" when rows are left out: it opens the whole list. */
function more(count: number, lang: "id" | "en"): string {
  return lang === "id" ? `+${count} lagi` : `+${count} more`;
}

/** A widget with nothing of its own to show: the one line that says why, opening where to fix it, and the foot when something's wrong. */
function Quiet({
  label,
  open,
  status,
  theme,
  small,
}: {
  label: string;
  open?: Parameters<typeof tap>[0];
  status: WidgetStatus;
  theme: Theme;
  small?: boolean;
}) {
  return (
    <Frame theme={theme}>
      <Text text="Edunex Plus" size="micro" color={theme.v4.brandInk} bold />
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 4 }}>
        <Text text={label} size={small ? "small" : "body"} color={theme.v4.fg} bold lines={3} {...(open ? { open } : {})} />
        {status.problem && status.text !== label ? <Foot status={status} theme={theme} /> : null}
      </FlexWidget>
    </Frame>
  );
}

// ---------------------------------------------------------------- Tenggat

/** What's due, soonest first: the time first (amber within a day), the Task under it, its course's colour as the bar. */
export function DueView({ model, size, theme, lang }: { model: DueWidget; size: WidgetSize; theme: Theme; lang: "id" | "en" }) {
  const v = theme.v4;
  const { room, foot, scale } = rowsRoom(size, model.status);
  // A Task's title over two lines (three in a tall widget) where it needs them and the list still fits: each row takes only the lines it uses.
  const titleWidth = size.width - 2 * PAD - 12;
  const linesFor = (row: DueRow, most: number) => Math.min(most, linesOf(row.title, 14 * scale, titleWidth));
  const heightOf = (row: DueRow, most: number) => (LINE.micro + linesFor(row, most) * LINE.small) * scale + 10;
  const fits = (lines: number) => model.rows.reduce((sum, row) => sum + heightOf(row, lines), 0) <= room;
  const most = fits(3) ? 3 : fits(2) ? 2 : 1;
  const moreHeight = (LINE.micro + 10) * scale;
  const rows: DueRow[] = [];
  let space = room;
  for (const row of model.rows) {
    const last = rows.length + 1 === model.rows.length;
    if (space < heightOf(row, most) + (last ? 0 : moreHeight) && rows.length) break;
    rows.push(row);
    space -= heightOf(row, most);
  }
  const left = model.rows.length - rows.length;
  const wide = size.width >= 180;
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 10 }}>
        <Text text={model.heading} size="micro" color={v.brandInk} bold open={model.all} />
        {model.empty ? <Text text={model.empty.label} size="body" color={v.fg} bold lines={3} open={model.empty.open} /> : null}
        {rows.map((row) => (
          <FlexWidget
            key={`${row.code}${row.title}${row.when}`}
            {...tap(row.open)}
            accessibilityLabel={`${row.title}, ${row.code}, ${row.when}`}
            style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}
          >
            <FlexWidget style={{ width: 4, height: heightOf(row, most) - 10, borderRadius: 2, backgroundColor: hex(courseInk(theme, row.tone)) }} />
            <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
              <Text text={wide ? `${row.when} · ${row.code}` : row.when} size="micro" color={row.soon ? v.ambFg : v.muted} bold />
              <Text text={row.title} size="small" color={v.fg} bold lines={linesFor(row, most)} />
            </FlexWidget>
          </FlexWidget>
        ))}
        {left > 0 ? <Text text={more(left, lang)} size="micro" color={v.brandInk} bold open={model.all} /> : null}
      </FlexWidget>
      {foot ? <Foot status={model.status} theme={theme} /> : null}
    </Frame>
  );
}

// ---------------------------------------------------------------- Kehadiran

function absenceColor(theme: Theme, state: AttendanceState): string {
  const tone = absenceTone(state);
  return tone ? absenceInk(theme.v4, tone).fg : theme.v4.muted;
}

/** More absences than this and the marks stop reading as a count: the word alone says it. */
const MOST_MARKS = 6;

/**
 * A course's absences as marks: one per absence the term allows, full while it's still left and pale once used, so
 * "two left" is two full marks. Past the limit, a red mark for each one over. No marks without SIX's count.
 */
function Marks({
  row,
  theme,
  full,
  pale,
  size = 9,
}: {
  row: Pick<AttendanceRow, "allowed" | "used" | "over">;
  theme: Theme;
  full: string;
  pale: string;
  size?: number;
}) {
  if (row.allowed === null || row.used === null || row.allowed + row.over > MOST_MARKS || row.allowed + row.over === 0) return null;
  const marks = [
    ...Array.from({ length: row.allowed - row.used }, () => full),
    ...Array.from({ length: row.used }, () => pale),
    ...Array.from({ length: row.over }, () => theme.v4.redFg),
  ];
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 3 }}>
      {marks.map((color, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the marks are alike and never reorder.
        <FlexWidget key={index} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: hex(color) }} />
      ))}
    </FlexWidget>
  );
}

export function AttendanceView({ model, size, theme, lang }: { model: AttendanceWidget; size: WidgetSize; theme: Theme; lang: "id" | "en" }) {
  const v = theme.v4;
  const { room, foot, scale } = rowsRoom(size, model.status);
  // Narrow (2 cells): the name over its marks. From 3 cells: the name, the marks, and the word at the end from 4.
  const narrow = size.width < 180;
  const words = size.width >= 250;
  const counted = (row: AttendanceRow) => row.allowed !== null && row.allowed + row.over <= MOST_MARKS && row.allowed + row.over > 0;
  // The marks in one column, as wide as the longest row of them, so they read down the list like a chart.
  const marksWidth = Math.max(0, ...model.rows.filter(counted).map((row) => ((row.allowed ?? 0) + row.over) * 12 - 3));
  const wordWidth = 58 * scale;
  const nameWidth = narrow ? size.width - 2 * PAD : size.width - 2 * PAD - marksWidth - 8 - (words ? wordWidth + 8 : 0);
  // One size down the list: a step smaller for every row when one name needs it.
  const smaller = model.rows.some((row) => rowLabel(row.name, row.code, nameWidth, scale).size === "micro");
  const labelOf = (row: AttendanceRow) => rowLabel(row.name, row.code, nameWidth, scale, smaller);
  const heightOf = (row: AttendanceRow) => labelOf(row).lines * LINE[labelOf(row).size] * scale + (narrow ? 12 * scale + 3 : 0) + 8;
  const moreHeight = (LINE.micro + 8) * scale;
  const rows: AttendanceRow[] = [];
  let space = room;
  for (const row of model.rows) {
    const last = rows.length + 1 === model.rows.length;
    if (space < heightOf(row) + (last ? 0 : moreHeight) && rows.length) break;
    rows.push(row);
    space -= heightOf(row);
  }
  const left = model.rows.length - rows.length;
  const pale = mix(v.card, v.muted, 0.32);
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 8 }}>
        <Text text={model.heading} size="micro" color={v.brandInk} bold open={model.all} />
        {model.empty ? <Text text={model.empty.label} size="body" color={v.fg} bold lines={3} open={model.empty.open} /> : null}
        {rows.map((row) => {
          const ink = absenceColor(theme, row.state);
          const marks = <Marks row={row} theme={theme} full={courseInk(theme, row.tone)} pale={pale} />;
          const label = labelOf(row);
          // The word where there's width for it; narrow, when it's the danger or there are no marks to read.
          const word = words || !counted(row) || (narrow && (row.state === "none" || row.state === "out"));
          return (
            <FlexWidget
              key={row.code}
              {...tap(row.open)}
              accessibilityLabel={`${row.name ?? row.code}, ${row.label}`}
              style={{ width: "match_parent", flexDirection: narrow ? "column" : "row", alignItems: narrow ? "flex-start" : "center", flexGap: narrow ? 3 : 8 }}
            >
              <FlexWidget style={narrow ? { width: "match_parent" } : { flex: 1 }}>
                <Text text={label.text} size={label.size} color={v.fg} bold lines={label.lines} />
              </FlexWidget>
              {narrow ? (
                <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}>
                  {marks}
                  {word ? <Text text={row.short} size="micro" color={ink} bold /> : null}
                </FlexWidget>
              ) : (
                <FlexWidget style={{ width: marksWidth, flexDirection: "row" }}>{marks}</FlexWidget>
              )}
              {!narrow && words ? (
                <FlexWidget style={{ width: wordWidth, flexDirection: "row", justifyContent: "flex-end" }}>
                  <Text text={row.short} size="micro" color={ink} bold />
                </FlexWidget>
              ) : !narrow && word ? (
                <Text text={row.short} size="micro" color={ink} bold />
              ) : null}
            </FlexWidget>
          );
        })}
        {left > 0 ? <Text text={more(left, lang)} size="micro" color={v.brandInk} bold open={model.all} /> : null}
      </FlexWidget>
      {foot ? <Foot status={model.status} theme={theme} /> : null}
    </Frame>
  );
}

// ---------------------------------------------------------------- Ujian

/**
 * The days to the next exam as one big figure, on its course's colour: "7" with "hari lagi", or "Besok" / "Hari ini"
 * alone. Then the exam by its course's name ("UTS Desain Komunikasi Visual"), and its sitting. One row high, the
 * figure sits beside them; four cells wide, it stands at the left with the words at its right.
 */
export function ExamView({ model, size, theme }: { model: ExamWidget; size: WidgetSize; theme: Theme }) {
  const next = model.next;
  if (!next)
    return (
      <Quiet
        label={model.empty?.label ?? ""}
        {...(model.empty ? { open: model.empty.open } : {})}
        status={model.status}
        theme={theme}
        small={size.width < 180}
      />
    );
  const block = courseBlock(next.tone);
  const scale = Math.max(1, size.fontScale);
  const short = size.height < 130;
  const wide = size.width >= 250;
  // One row high: the figure beside the words. Taller: the figure on top, the exam under it.
  const side = short;
  const narrow = size.width < 180;
  const pad = short && narrow ? 10 : PAD;
  const figureSize = next.unit ? (short ? 34 : wide ? 72 : 52) : short ? 18 : wide ? 34 : 26;
  const figure = (
    <FlexWidget style={{ flexDirection: side ? "column" : "row", alignItems: side ? "center" : "flex-end", flexGap: side ? 0 : 8 }}>
      <TextWidget text={next.big} maxLines={1} style={{ adjustsFontSizeToFit: true, fontSize: figureSize, color: hex(block.on), fontWeight: "700" }} />
      {next.unit ? <Text text={next.unit} size="micro" color={block.soft} bold /> : null}
    </FlexWidget>
  );
  // The exam by its course's name where it fits whole; the code is the short form.
  const whole = next.name ? `${next.kind} ${next.name}` : next.title;
  const titleLines = short ? (narrow ? 1 : size.height >= 96 * scale ? 2 : 1) : 2;
  const roomForWhole = (side ? size.width - 2 * PAD - (next.unit ? 76 : 96) : size.width - 2 * PAD) * titleLines >= whole.length * 14 * scale * 0.56;
  const used = (short ? 0 : figureSize * 1.25 + 8) + titleLines * LINE.small * scale + LINE.micro * scale;
  const foot = (model.status.problem && !(short && narrow)) || (!short && size.height - 2 * PAD - used - LINE.micro * scale >= LINE.micro * scale + 6);
  const words = (
    <FlexWidget style={{ flexDirection: "column", flexGap: 2, ...(side ? { flex: 1 } : { width: "match_parent" }) }}>
      <Text text={roomForWhole ? whole : next.title} size={wide && !short ? "body" : "small"} color={block.on} weight="700" lines={titleLines} />
      <Text text={next.when} size="micro" color={block.soft} lines={short && !narrow ? 1 : 2} />
      {foot ? <Text text={model.status.text} size="micro" color={block.soft} bold={model.status.problem} lines={model.status.problem ? 2 : 1} /> : null}
    </FlexWidget>
  );
  const action = tap(next.open);
  return (
    <FlexWidget
      clickAction={action.clickAction}
      clickActionData={action.clickActionData}
      accessibilityLabel={`${whole}, ${next.big}${next.unit ? ` ${next.unit}` : ""}, ${next.when}`}
      style={{
        width: "match_parent",
        height: "match_parent",
        padding: pad,
        borderRadius: RADIUS,
        backgroundColor: hex(block.bg),
        flexDirection: side ? "row" : "column",
        justifyContent: side ? "flex-start" : "space-between",
        alignItems: side ? "center" : "flex-start",
        flexGap: side ? (narrow ? 8 : 14) : 6,
      }}
    >
      {figure}
      {words}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Kelas berikutnya (one cell)

/**
 * One cell: a time and a colour. The next class's start, big and white on its course's colour, its code under it, its
 * day above when it isn't today. Two cells: the course's name whole and its room. While SIX shows Tandai Hadir for the
 * class on now, the cell is SIX's green and says so.
 */
export function NextView({ model, size, theme }: { model: NextWidget; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const next = model.next;
  // One cell: 57 dp on Android's own launcher, about 81 on this phone's.
  const tiny = size.width < 100;
  const pad = size.width < 80 ? 7 : 12;
  const radius = tiny ? 18 : RADIUS;
  if (!next) {
    const line = model.empty;
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ width: "match_parent", height: "match_parent", padding: pad, borderRadius: radius, backgroundColor: hex(v.card), justifyContent: "center" }}
      >
        <Text text={(tiny ? line?.short : null) ?? line?.label ?? ""} size="micro" color={v.fg} bold lines={3} {...(line ? { open: line.open } : {})} />
      </FlexWidget>
    );
  }
  const live = next.checkIn;
  // Tandai Hadir open: SIX's green (the light theme's, white on it at 6.9:1), the same in dark. Else the course's block.
  const block = live ? { ...courseBlock(next.tone), bg: THEMES.light.v4.okFg, soft: "#dff3e6" } : courseBlock(next.tone);
  const big = Math.min(size.width >= 120 ? 34 : 26, Math.floor((size.width - 2 * pad) / 2.9));
  const roomy = size.width >= 120;
  const tall = size.height >= 130;
  const action = tap(next.open);
  return (
    <FlexWidget
      clickAction={action.clickAction}
      clickActionData={action.clickActionData}
      accessibilityLabel={next.a11y}
      style={{
        width: "match_parent",
        height: "match_parent",
        padding: pad,
        borderRadius: radius,
        backgroundColor: hex(block.bg),
        flexDirection: "column",
        justifyContent: tall && roomy ? "space-between" : "center",
        flexGap: 1,
      }}
    >
      <FlexWidget style={{ flexDirection: "column" }}>
        {next.day && !live ? <Text text={next.day} size="micro" color={block.soft} bold /> : null}
        <TextWidget
          text={next.big}
          maxLines={live ? 2 : 1}
          style={{ adjustsFontSizeToFit: true, fontSize: live ? Math.min(big, 16) : big, color: hex(block.on), fontWeight: "700" }}
        />
        {live || (roomy && tall && next.name) ? null : (
          <TextWidget
            text={next.code}
            maxLines={1}
            style={{ adjustsFontSizeToFit: true, fontSize: tiny ? 11 : 12, color: hex(block.soft), fontWeight: "500" }}
          />
        )}
      </FlexWidget>
      {roomy && tall ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          <Text
            text={courseLabel(next.name, next.code, 14 * Math.max(1, size.fontScale), size.width - 2 * pad, 3).text}
            size="small"
            color={block.on}
            weight="700"
            lines={3}
          />
          {next.room ? <Text text={next.room} size="micro" color={block.soft} /> : null}
        </FlexWidget>
      ) : next.room && !live && (roomy || size.height >= 90) ? (
        <Text text={next.room} size="micro" color={block.soft} />
      ) : null}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Pintasan

/** Fluent's filled icons at 24 (MIT, @fluentui/react-icons' headless SVG), as Beranda's service tiles use them. */
const ICON_PATH: Record<ServiceIcon, string> = {
  calendar:
    "M21 8.5v9.25c0 1.8-1.46 3.25-3.25 3.25H6.25A3.25 3.25 0 0 1 3 17.75V8.5zM7.25 15a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5M12 15a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m-4.75-4.5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.75 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m4.75 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5m1-7.5C19.55 3 21 4.46 21 6.25V7H3v-.75C3 4.45 4.46 3 6.25 3z",
  tasks:
    "M13.75 2h-3.5c-1.16 0-2.11.87-2.24 2H6.25C5.01 4 4 5 4 6.25v13.5C4 20.99 5 22 6.25 22h11.5c1.24 0 2.25-1 2.25-2.25V6.25C20 5.01 19 4 17.75 4h-1.76a2.25 2.25 0 0 0-2.24-2m-3.5 1.5h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1 0-1.5m6.78 7.53-5.5 5.5c-.3.3-.77.3-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06L11 14.94l4.97-4.97a.75.75 0 1 1 1.06 1.06",
  courses:
    "M4 4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h6c.77 0 1.47-.29 2-.76.53.47 1.23.76 2 .76h6a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-6c-.77 0-1.47.29-2 .76A3 3 0 0 0 10 4zm7 3v10a1 1 0 0 1-1 1H4V6h6a1 1 0 0 1 1 1m2 10V7a1 1 0 0 1 1-1h6v12h-6a1 1 0 0 1-1-1",
  grades:
    "M5 17.75v-3.77l4.06 2.66a5.4 5.4 0 0 0 5.88 0L19 13.98v3.77q0 .25-.15.45l-.01.02-.02.01v.02a3 3 0 0 1-.41.43q-.42.42-1.25.96A9.7 9.7 0 0 1 12 21a9.7 9.7 0 0 1-5.16-1.36 7 7 0 0 1-1.68-1.42v-.01a1 1 0 0 1-.16-.46m17.16-7.62-8.04 5.25a3.9 3.9 0 0 1-4.24 0L3 10.88v5.37a.75.75 0 0 1-1.5 0V10q0-.13.04-.25a.75.75 0 0 1 .3-.88L9.92 3.7a3.9 3.9 0 0 1 4.18 0l8.06 5.17a.75.75 0 0 1 .01 1.26",
};

/** Each service its own solid colour, the same in light and dark, a white glyph on it (3:1 or more): no two the same. */
const SERVICE_COLOR: Record<ServiceIcon, string> = {
  calendar: "#1f63e0",
  tasks: "#d2540b",
  courses: "#7a3ee6",
  grades: "#178a4a",
};

const svgOf = (icon: ServiceIcon, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${ICON_PATH[icon]}"/></svg>`;

/** The app's service tiles: a solid colour square, a white filled glyph, one word under it where there's height. */
export function ServicesView({ model, size, theme }: { model: ServicesWidget; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const scale = Math.max(1, size.fontScale);
  const each = Math.max(1, Math.min(model.items.length, Math.floor((size.width - 16) / 56)));
  const labels = size.height >= 84 * scale;
  // The tile grows with the widget, up to Beranda's own (56), and never past what its column or the height leaves.
  const tile = Math.round(Math.max(36, Math.min(56, (size.width - 16) / each - 12, size.height - 16 - (labels ? LINE.micro * scale + 6 : 0))));
  // Two rows high: all four as blocks that fill the widget, two by two, the word inside each.
  if (size.height >= 190 && model.items.length >= 4) {
    const glyph = size.width >= 250 ? 30 : 26;
    const pairs = [model.items.slice(0, 2), model.items.slice(2, 4)];
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{
          width: "match_parent",
          height: "match_parent",
          padding: 8,
          flexGap: 8,
          borderRadius: RADIUS,
          backgroundColor: hex(v.card),
          flexDirection: "column",
        }}
      >
        {pairs.map((two) => (
          <FlexWidget key={two[0]!.icon} style={{ width: "match_parent", flex: 1, flexDirection: "row", flexGap: 8 }}>
            {two.map((item) => (
              <FlexWidget
                key={item.icon}
                {...tap(item.open)}
                accessibilityLabel={item.label}
                style={{
                  flex: 1,
                  height: "match_parent",
                  padding: 12,
                  borderRadius: RADIUS - 8,
                  backgroundColor: hex(SERVICE_COLOR[item.icon]),
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <SvgWidget svg={svgOf(item.icon, "#ffffff")} style={{ width: glyph, height: glyph }} />
                <Text text={item.label} size="small" color="#ffffff" weight="700" />
              </FlexWidget>
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    );
  }
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        paddingHorizontal: 8,
        borderRadius: RADIUS,
        backgroundColor: hex(v.card),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
      }}
    >
      {model.items.slice(0, each).map((item) => (
        <FlexWidget key={item.icon} {...tap(item.open)} accessibilityLabel={item.label} style={{ flexDirection: "column", alignItems: "center", flexGap: 6 }}>
          <FlexWidget
            style={{
              width: tile,
              height: tile,
              borderRadius: Math.round(tile * 0.3),
              backgroundColor: hex(SERVICE_COLOR[item.icon]),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SvgWidget svg={svgOf(item.icon, "#ffffff")} style={{ width: Math.round(tile * 0.5), height: Math.round(tile * 0.5) }} />
          </FlexWidget>
          {labels ? <Text text={item.label} size="micro" color={v.fg} bold /> : null}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Satu mata kuliah

/**
 * One course, in its colour: its name whole (two lines), then, as the size allows, its next class (the time first),
 * its absences as marks, and its next Task. A danger (no absences left, or past the limit) is said in a white pill in
 * the state's colour, as red or amber wouldn't read on the course's own.
 */
export function CourseView({ model, size, theme }: { model: CourseWidget; size: WidgetSize; theme: Theme }) {
  const course = model.course;
  if (!course) return <Quiet label={model.empty?.label ?? ""} status={model.status} theme={theme} small={size.width < 180} />;
  const block = courseBlock(course.tone);
  const scale = Math.max(1, size.fontScale);
  const narrow = size.width < 180;
  const big = size.width >= 250 && size.height >= 190;
  const inner = size.width - 2 * PAD;
  const label = courseLabel(course.name, course.code, (big ? 18 : 16) * scale, inner, narrow ? 3 : 2);
  const name = label.text;
  const nameLine = (big ? LINE.title : LINE.body) * scale;
  let left = size.height - 2 * PAD - nameLine * label.lines - (model.status.problem ? LINE.micro * (narrow ? 2 : 1) * scale + 6 : 0);
  const take = (height: number) => {
    if (left < height) return false;
    left -= height;
    return true;
  };
  // The class's day, time and room, over two lines where one doesn't hold them; two cells wide, its day and start.
  const nextText = model.next ? (narrow ? model.next.short : model.next.label) : "";
  const nextLines = Math.min(2, linesOf(nextText, 14 * scale, inner));
  const showNext = model.next ? take(nextLines * LINE.small * scale + 6) : false;
  const showAbsences = model.absences ? take(LINE.small * scale + 6) : false;
  const detailLines = model.task?.detail ? Math.min(2, linesOf(model.task.detail, 12 * scale, inner)) : 1;
  const showTask = model.task ? take((LINE.small + detailLines * LINE.micro) * scale + 8) : false;
  const showCode = name !== course.code ? take(LINE.micro * scale) : false;
  const foot = model.status.problem || take(LINE.micro * scale + 8);
  // Then the Task's title whole, a line at a time, where there's still height for it.
  const taskNeeds = model.task ? Math.min(3, linesOf(model.task.label, 14 * scale, inner)) : 1;
  let taskLines = 1;
  while (showTask && taskLines < taskNeeds && take(LINE.small * scale)) taskLines += 1;
  const danger = model.absences && (model.absences.state === "none" || model.absences.state === "out") ? model.absences : null;
  const light = THEMES.light.v4;
  return (
    <FlexWidget
      {...tap(course.open)}
      accessibilityLabel={course.name ?? course.code}
      style={{
        width: "match_parent",
        height: "match_parent",
        padding: PAD,
        borderRadius: RADIUS,
        backgroundColor: hex(block.bg),
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 6 }}>
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          <Text text={name} size={big ? "title" : "body"} color={block.on} weight="700" lines={label.lines} />
          {showCode ? <Text text={course.code} size="micro" color={block.soft} /> : null}
        </FlexWidget>
        {showNext && model.next ? <Text text={nextText} size="small" color={block.on} bold lines={nextLines} open={model.next.open} /> : null}
        {showAbsences && model.absences ? (
          <FlexWidget accessibilityLabel={model.absences.label} style={{ flexDirection: "row", alignItems: "center", flexGap: 8 }}>
            {model.marks ? <Marks row={model.marks} theme={theme} full={block.on} pale={block.faint} /> : null}
            {danger ? (
              <FlexWidget style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: hex(block.on) }}>
                <Text text={danger.short} size="micro" color={danger.state === "out" ? light.redFg : light.ambFg} weight="700" />
              </FlexWidget>
            ) : (
              <Text text={narrow ? model.absences.short : model.absences.label} size="small" color={block.soft} />
            )}
          </FlexWidget>
        ) : null}
        {showTask && model.task ? (
          <FlexWidget
            {...tap(model.task.open)}
            accessibilityLabel={[model.task.label, model.task.detail].filter(Boolean).join(", ")}
            style={{ width: "match_parent", flexDirection: "column" }}
          >
            <Text text={model.task.detail ?? ""} size="micro" color={block.soft} bold lines={detailLines} />
            <Text text={model.task.label} size="small" color={block.on} bold lines={taskLines} />
          </FlexWidget>
        ) : null}
      </FlexWidget>
      {foot ? <Text text={model.status.text} size="micro" color={block.soft} bold={model.status.problem} lines={model.status.problem ? 2 : 1} /> : null}
    </FlexWidget>
  );
}
