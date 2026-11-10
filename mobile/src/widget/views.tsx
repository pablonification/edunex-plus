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
import { courseBlock, courseInk, courseLabel, Foot, Frame, hex, LINE, linesOf, PAD, RADIUS, rowLabel, StateCard, Text, tap, type WidgetSize } from "./view";

/** Room for rows: the widget's height less its padding, its heading and its foot (said wherever there's something to say). */
function rowsRoom(size: WidgetSize, status: WidgetStatus, heading = true): { room: number; foot: boolean; scale: number } {
  const scale = Math.max(1, size.fontScale);
  const foot = Boolean(status.text) && (status.problem || size.height >= 150);
  // What's wrong takes two lines in a narrow widget.
  const footLines = status.problem && size.width < 250 ? 2 : 1;
  const room = size.height - 2 * PAD - (heading ? (LINE.micro + 8) * scale : 0) - (foot ? (footLines * LINE.micro + 6) * scale : 0);
  return { room, foot, scale };
}

/** "+3 lagi" when rows are left out: it opens the whole list. */
function more(count: number, lang: "id" | "en"): string {
  return lang === "id" ? `+${count} lagi` : `+${count} more`;
}

/** The width `text` takes on one line, on the safe side (as ./view's linesOf). */
const widthOf = (text: string, fontSize: number) => text.length * fontSize * 0.56;

// ---------------------------------------------------------------- Tenggat

/**
 * What's due, soonest first, and the day leads: "Hari ini, 23:59" (amber), "Besok, 23:59" (bold), "Jum, 16 Okt, 23:59"
 * (quiet), then the Task, its course's colour as the bar and its course beside the day (names down the whole list, or
 * codes down the whole list; under the Task in a narrow widget).
 */
export function DueView({ model, size, theme, lang }: { model: DueWidget; size: WidgetSize; theme: Theme; lang: "id" | "en" }) {
  const v = theme.v4;
  if (model.quiet) return <StateCard quiet={model.quiet} status={model.status} size={size} theme={theme} />;
  const { room, foot, scale } = rowsRoom(size, model.status);
  const titleWidth = size.width - 2 * PAD - 12;
  const headOf = (row: DueRow) => `${row.day}, ${row.time}`;
  const beside = (row: DueRow) => titleWidth - widthOf(headOf(row), 14 * scale) - 14;
  const names = model.rows.every((row) => row.name && widthOf(row.name, 12 * scale) <= beside(row));
  const codes = model.rows.every((row) => widthOf(row.code, 12 * scale) <= beside(row));
  const courseOf = (row: DueRow) => (names ? row.name! : row.code);
  const under = !names && !codes;
  // A narrow widget, or the phone's text made big: the day a step smaller before it's cut.
  const headSize = model.rows.some((row) => widthOf(headOf(row), 14 * scale) > titleWidth) ? "micro" : "small";
  const linesFor = (row: DueRow, most: number) => Math.min(most, linesOf(row.title, 14 * scale, titleWidth));
  const heightOf = (row: DueRow, most: number) => (LINE[headSize] + linesFor(row, most) * LINE.small + (under ? LINE.micro : 0)) * scale + 10;
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
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 10 }}>
        <Text text={model.heading} size="micro" color={v.muted} bold open={model.all} />
        {rows.map((row) => (
          <FlexWidget
            key={`${row.code}${row.title}${row.when}`}
            {...tap(row.open)}
            accessibilityLabel={`${row.when}, ${row.title}, ${row.name ?? row.code}`}
            style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}
          >
            <FlexWidget style={{ width: 4, height: heightOf(row, most) - 10, borderRadius: 2, backgroundColor: hex(courseInk(theme, row.tone)) }} />
            <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
              <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 6 }}>
                <Text text={headOf(row)} size={headSize} color={row.soon || row.mark === "today" ? v.ambFg : v.fg} weight="700" />
                {under ? null : <Text text={courseOf(row)} size="micro" color={v.muted} />}
              </FlexWidget>
              <Text text={row.title} size="small" color={v.fg} lines={linesFor(row, most)} />
              {under ? <Text text={row.code} size="micro" color={v.muted} /> : null}
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

/** The state's colour, the same on every screen (absenceTone): red past the limit, amber at it; `rest` while it's fine. */
function absenceColor(theme: Theme, state: AttendanceState, rest: string): string {
  const tone = absenceTone(state);
  return tone ? absenceInk(theme.v4, tone).fg : rest;
}

/** More absences than this and the marks stop reading as a count: the word alone says it. */
const MOST_MARKS = 6;

/**
 * A course's absences as marks: one per absence the term allows, filled while it's still left and an outline once
 * used, so "two left" is two filled marks; past the limit, a filled one for each over. One colour, the state's.
 */
function Marks({ row, ink, size = 9 }: { row: Pick<AttendanceRow, "allowed" | "used" | "over">; ink: string; size?: number }) {
  if (row.allowed === null || row.used === null || row.allowed + row.over > MOST_MARKS || row.allowed + row.over === 0) return null;
  const marks = [
    ...Array.from({ length: row.allowed - row.used }, () => true),
    ...Array.from({ length: row.used }, () => false),
    ...Array.from({ length: row.over }, () => true),
  ];
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 3 }}>
      {marks.map((full, index) => (
        <FlexWidget
          // biome-ignore lint/suspicious/noArrayIndexKey: the marks are alike and never reorder.
          key={index}
          style={{ width: size, height: size, borderRadius: size / 2, ...(full ? { backgroundColor: hex(ink) } : { borderWidth: 1.5, borderColor: hex(ink) }) }}
        />
      ))}
    </FlexWidget>
  );
}

/** Every course's absences, the worst first: its name, its marks, and always the count in words, in the state's colour. */
export function AttendanceView({ model, size, theme, lang }: { model: AttendanceWidget; size: WidgetSize; theme: Theme; lang: "id" | "en" }) {
  const v = theme.v4;
  if (model.quiet) return <StateCard quiet={model.quiet} status={model.status} size={size} theme={theme} />;
  const { room, foot, scale } = rowsRoom(size, model.status);
  // Narrow (2 cells): the name over its marks and its word. Wider: the name, the marks in one column, the word at the end.
  const narrow = size.width < 220;
  const counted = (row: AttendanceRow) => row.allowed !== null && row.allowed + row.over <= MOST_MARKS && row.allowed + row.over > 0;
  const marksWidth = Math.max(0, ...model.rows.filter(counted).map((row) => ((row.allowed ?? 0) + row.over) * 12 - 3));
  const wordWidth = 56 * scale;
  const nameWidth = narrow ? size.width - 2 * PAD : size.width - 2 * PAD - marksWidth - 8 - wordWidth - 8;
  // One size down the list, and names or codes down the whole list, never a mix.
  const smaller = model.rows.some((row) => rowLabel(row.name, row.code, nameWidth, scale).size === "micro");
  const codes = model.rows.some((row) => rowLabel(row.name, row.code, nameWidth, scale, smaller).text !== (row.name ?? row.code));
  const labelOf = (row: AttendanceRow) =>
    codes ? { text: row.code, lines: 1, size: "small" as const } : rowLabel(row.name, row.code, nameWidth, scale, smaller);
  const heightOf = (row: AttendanceRow) => labelOf(row).lines * LINE[labelOf(row).size] * scale + (narrow ? LINE.micro * scale + 3 : 0) + 8;
  const moreHeight = (LINE.micro + 8) * scale;
  const rows: AttendanceRow[] = [];
  let space = room;
  for (const row of model.rows) {
    const last = rows.length + 1 === model.rows.length;
    // The last row has no gap under it.
    if (space < heightOf(row) + (last ? -8 : moreHeight) && rows.length) break;
    rows.push(row);
    space -= heightOf(row);
  }
  const left = model.rows.length - rows.length;
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 8 }}>
        <Text text={model.heading} size="micro" color={v.muted} bold open={model.all} />
        {rows.map((row) => {
          const danger = row.state === "none" || row.state === "out";
          const ink = absenceColor(theme, row.state, v.fg);
          const marks = <Marks row={row} ink={absenceColor(theme, row.state, v.muted)} />;
          const label = labelOf(row);
          const word = <Text text={row.short} size="micro" color={ink} weight={danger ? "700" : "500"} />;
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
                  {word}
                </FlexWidget>
              ) : (
                <FlexWidget style={{ width: marksWidth, flexDirection: "row" }}>{marks}</FlexWidget>
              )}
              {narrow ? null : <FlexWidget style={{ width: wordWidth, flexDirection: "row", justifyContent: "flex-end" }}>{word}</FlexWidget>}
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
 * The next exam, on its course's colour, one lockup at every size: its day and time lead ("Kam, 15 Okt, 11:00": true
 * all day, where a count of days is wrong after midnight), the days to go and the room quiet under them, then the exam
 * by its course's name. A taller widget goes on to the exams after it.
 */
export function ExamView({ model, size, theme }: { model: ExamWidget; size: WidgetSize; theme: Theme }) {
  const next = model.next;
  if (!next) return model.quiet ? <StateCard quiet={model.quiet} status={model.status} size={size} theme={theme} /> : <Frame theme={theme}>{null}</Frame>;
  const block = courseBlock(next.tone);
  const scale = Math.max(1, size.fontScale);
  const inner = size.width - 2 * PAD;
  // Two rows high, the day and time grow to the widget's width: the tall size is the lockup bigger, not the small one with a hole.
  const widest = Math.max(next.day.length, next.time.length);
  const leadSize =
    size.height >= 190 && size.width < 250 ? Math.max(18, Math.min(30, Math.floor(inner / (widest * 0.58 * scale)))) : size.width >= 250 ? 22 : 18;
  const leadLine = Math.round(leadSize * 1.3) * scale;
  const whole = `${next.day}, ${next.time}`;
  // The day and the time on one line, else each on its own: never a line broken mid-date.
  const lead = widthOf(whole, leadSize * scale) <= inner ? [whole] : [next.day, next.time];
  let room = size.height - 2 * PAD - lead.length * leadLine - LINE.small * scale - 6;
  const take = (height: number) => {
    if (room < height) return false;
    room -= height;
    return true;
  };
  const sub = [next.left, next.room].filter(Boolean).join(" · ");
  const showSub = Boolean(sub) && take(LINE.micro * scale);
  const name = next.name ? `${next.kind} ${next.name}` : next.title;
  const nameLines = linesOf(name, 14 * scale, inner);
  const title = nameLines === 1 || (nameLines === 2 && take(LINE.small * scale)) ? { text: name, lines: nameLines } : { text: next.title, lines: 1 };
  const foot =
    Boolean(model.status.text) && (model.status.problem || room >= (LINE.micro + 6) * scale + (model.more.length ? (LINE.micro + LINE.small) * scale + 8 : 0));
  if (foot) room -= (LINE.micro * (model.status.problem && size.width < 250 ? 2 : 1) + 6) * scale;
  const rowHeight = (LINE.micro + LINE.small) * scale + 8;
  const rows = model.more.slice(0, Math.max(0, Math.floor((room - 8) / rowHeight)));
  const action = tap(next.open);
  const exam = <Text text={title.text} size="small" color={block.on} weight="700" lines={title.lines} />;
  return (
    <FlexWidget
      clickAction={action.clickAction}
      clickActionData={action.clickActionData}
      accessibilityLabel={`${name}, ${next.when}${next.left ? `, ${next.left}` : ""}`}
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
      <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
        {lead.map((line) => (
          <TextWidget key={line} text={line} maxLines={1} style={{ fontSize: leadSize, color: hex(block.on), fontWeight: "700" }} />
        ))}
        {showSub ? <Text text={sub} size="micro" color={block.soft} bold /> : null}
        {rows.length ? <FlexWidget style={{ width: "match_parent", paddingTop: 6 }}>{exam}</FlexWidget> : null}
      </FlexWidget>
      {rows.length ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 8 }}>
          {rows.map((one) => (
            <FlexWidget
              key={`${one.code}${one.kind}${one.day}`}
              {...tap(one.open)}
              accessibilityLabel={`${one.kind} ${one.name ?? one.code}, ${one.day}, ${one.time}`}
              style={{ width: "match_parent", flexDirection: "column" }}
            >
              <Text text={`${one.day}, ${one.time}`} size="micro" color={block.soft} bold />
              <Text text={courseLabel(one.name ? `${one.kind} ${one.name}` : null, one.title, 14 * scale, inner, 1).text} size="small" color={block.on} bold />
            </FlexWidget>
          ))}
        </FlexWidget>
      ) : null}
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 2 }}>
        {rows.length ? null : exam}
        {foot ? <Text text={model.status.text} size="micro" color={block.soft} bold={model.status.problem} lines={model.status.problem ? 2 : 1} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Kelas berikutnya (one cell)

/**
 * One cell: a time and a colour. The next class's start, big and white on its course's colour, its day above when it
 * isn't today, its code under it. From two cells: the course's name instead of the code, and its room. While SIX
 * shows Tandai Hadir for the class on now, the cell is SIX's green and says so.
 */
export function NextView({ model, size, theme }: { model: NextWidget; size: WidgetSize; theme: Theme }) {
  const next = model.next;
  if (!next) return model.quiet ? <StateCard quiet={model.quiet} status={model.status} size={size} theme={theme} /> : <Frame theme={theme}>{null}</Frame>;
  const scale = Math.max(1, size.fontScale);
  // One cell: 57 dp on Android's own launcher, about 97 on this phone's.
  const tiny = size.width < 120;
  const pad = size.width < 80 ? 7 : 12;
  const radius = tiny ? 18 : RADIUS;
  const live = next.checkIn;
  // Tandai Hadir open: SIX's green (the light theme's, white on it at 6.9:1), the same in dark. Else the course's block.
  const block = live ? { ...courseBlock(next.tone), bg: THEMES.light.v4.okFg, soft: "#dff3e6" } : courseBlock(next.tone);
  const big = Math.min(tiny ? 26 : 34, Math.floor((size.width - 2 * pad) / (2.9 * scale)));
  const inner = size.width - 2 * pad;
  let room = size.height - 2 * pad - (next.day && !live ? LINE.micro * scale : 0) - big * 1.3 * scale;
  const take = (height: number) => {
    if (room < height) return false;
    room -= height;
    return true;
  };
  // What's wrong is always said (two lines in one cell); when it was last right, where there's room after the class.
  const problemLines = Math.min(3, linesOf(model.status.text, 12 * scale, inner));
  const problem = model.status.problem && take(LINE.micro * problemLines * scale + 2);
  const named = !tiny && !live && take(LINE.small * scale);
  const label = named
    ? courseLabel(next.name, next.code, 14 * scale, inner, 1 + Math.min(2, Math.floor(room / (LINE.small * scale))))
    : { text: next.code, lines: 1 };
  if (named) room -= (label.lines - 1) * LINE.small * scale;
  const coded = !named && !live && take(LINE.micro * scale);
  const where = Boolean(next.room) && !live && widthOf(next.room ?? "", 12 * scale) <= inner && take(LINE.micro * scale);
  const foot = problem || (!tiny && Boolean(model.status.text) && take(LINE.micro * scale + 6));
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
        justifyContent: tiny ? "center" : "space-between",
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
        {coded ? (
          <TextWidget
            text={next.code}
            maxLines={1}
            style={{ adjustsFontSizeToFit: true, fontSize: tiny ? 11 : 12, color: hex(block.soft), fontWeight: "500" }}
          />
        ) : null}
        {tiny && where && next.room ? <Text text={next.room} size="micro" color={block.soft} /> : null}
        {tiny && foot ? <Text text={model.status.text} size="micro" color={block.on} bold lines={problemLines} /> : null}
      </FlexWidget>
      {tiny ? null : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          {named ? <Text text={label.text} size="small" color={block.on} weight="700" lines={label.lines} /> : null}
          {where && next.room ? <Text text={next.room} size="micro" color={block.soft} /> : null}
          {foot ? <Text text={model.status.text} size="micro" color={block.soft} bold={model.status.problem} lines={problem ? problemLines : 1} /> : null}
        </FlexWidget>
      )}
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

/**
 * Each service its own solid colour, the same in light and dark, white on it (4.5:1 or more): no two the same, and no
 * red or amber, which the app keeps for states.
 */
const SERVICE_COLOR: Record<ServiceIcon, string> = {
  calendar: "#1f63e0",
  tasks: "#0f7a86",
  courses: "#7a3ee6",
  grades: "#178a4a",
};

const svgOf = (icon: ServiceIcon, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${ICON_PATH[icon]}"/></svg>`;

/** Fluent's Checkmark at 24 (filled): "nothing left", said as a mark, never a "0". */
const CHECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ffffff" d="M4.53 12.97a.75.75 0 0 0-1.06 1.06l4.5 4.5c.3.3.77.3 1.06 0l11-11a.75.75 0 0 0-1.06-1.06L8.5 16.94z"/></svg>`;

/**
 * Tiles that answer: each service a solid tile that fills its share of the widget, its glyph, its one live figure
 * (classes left today, Tasks due within a week, courses at their absence limit, the IPK) and its word. A figure that
 * isn't known leaves the glyph and the word; none left is a check mark. No tray behind them: the tiles are the widget.
 */
export function ServicesView({ model, size }: { model: ServicesWidget; size: WidgetSize; theme: Theme }) {
  const scale = Math.max(1, size.fontScale);
  const each = Math.max(1, Math.min(model.items.length, Math.floor((size.width + 6) / 62)));
  const tile = (size.width - (each - 1) * 6) / each;
  const words = size.height >= 76 * scale;
  const pad = tile >= 80 ? 10 : 7;
  const glyph = tile >= 80 ? 22 : 18;
  return (
    <FlexWidget clickAction="OPEN_APP" style={{ width: "match_parent", height: "match_parent", flexDirection: "row", flexGap: 6 }}>
      {model.items.slice(0, each).map((item) => (
        <FlexWidget
          key={item.icon}
          {...tap(item.open)}
          accessibilityLabel={item.a11y}
          style={{
            flex: 1,
            height: "match_parent",
            padding: pad,
            borderRadius: 18,
            backgroundColor: hex(SERVICE_COLOR[item.icon]),
            flexDirection: "column",
            justifyContent: words ? "space-between" : "center",
          }}
        >
          <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <SvgWidget svg={svgOf(item.icon, "#ffffff")} style={{ width: glyph, height: glyph }} />
            {item.figure ? (
              <TextWidget
                text={item.figure}
                maxLines={1}
                style={{ adjustsFontSizeToFit: true, fontSize: tile >= 80 ? 20 : 16, color: hex("#ffffff"), fontWeight: "700" }}
              />
            ) : item.good ? (
              <SvgWidget svg={CHECK} style={{ width: glyph, height: glyph }} />
            ) : null}
          </FlexWidget>
          {words ? <Text text={item.label} size="micro" color="#ffffff" weight="700" /> : null}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Satu mata kuliah

/**
 * One course, in its colour, with one focus: its name whole, then its next class ("Mulai 11:00", "Besok 08:00 · R.9009").
 * Its absences in words where there's height, and its next Task only in the biggest size.
 */
export function CourseView({ model, size, theme }: { model: CourseWidget; size: WidgetSize; theme: Theme }) {
  const course = model.course;
  if (!course) return model.quiet ? <StateCard quiet={model.quiet} status={model.status} size={size} theme={theme} /> : <Frame theme={theme}>{null}</Frame>;
  const block = courseBlock(course.tone);
  const scale = Math.max(1, size.fontScale);
  const narrow = size.width < 220;
  const big = size.width >= 250 && size.height >= 190;
  const inner = size.width - 2 * PAD;
  const label = courseLabel(course.name, course.code, (big ? 18 : 16) * scale, inner, narrow ? 3 : 2);
  const nameLine = (big ? LINE.title : LINE.body) * scale;
  let left = size.height - 2 * PAD - nameLine * label.lines - (model.status.problem ? LINE.micro * (narrow ? 2 : 1) * scale + 6 : 0);
  const take = (height: number) => {
    if (left < height) return false;
    left -= height;
    return true;
  };
  // The class's day, time and room, over two lines where one doesn't hold them; narrow, its day and start.
  const nextText = model.next ? (narrow ? model.next.short : model.next.label) : "";
  const nextLines = Math.min(2, linesOf(nextText, 14 * scale, inner));
  const showNext = model.next ? take(nextLines * LINE.small * scale + 6) : false;
  const showAbsences = model.absences ? take(LINE.small * scale + 6) : false;
  const foot = Boolean(model.status.text) && (model.status.problem || take(LINE.micro * scale + 8));
  const detailLines = model.task?.detail ? Math.min(2, linesOf(model.task.detail, 12 * scale, inner)) : 1;
  const taskLines = model.task ? linesOf(model.task.label, 14 * scale, inner) : 1;
  // Its next Task only where the title fits whole: a cut title says less than none.
  const showTask = big && model.task && taskLines <= 2 ? take((taskLines * LINE.small + detailLines * LINE.micro) * scale + 8) : false;
  const danger = model.absences && (model.absences.state === "none" || model.absences.state === "out");
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
        <Text text={label.text} size={big ? "title" : "body"} color={block.on} weight="700" lines={label.lines} />
        {showNext && model.next ? <Text text={nextText} size="small" color={block.on} bold lines={nextLines} open={model.next.open} /> : null}
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
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 4 }}>
        {showAbsences && model.absences ? (
          <FlexWidget accessibilityLabel={model.absences.label} style={{ flexDirection: "row", alignItems: "center", flexGap: 8 }}>
            {model.marks ? <Marks row={model.marks} ink={block.on} /> : null}
            <Text
              text={narrow ? model.absences.short : model.absences.label}
              size="small"
              color={danger ? block.on : block.soft}
              weight={danger ? "700" : "400"}
            />
          </FlexWidget>
        ) : null}
        {foot ? <Text text={model.status.text} size="micro" color={block.soft} bold={model.status.problem} lines={model.status.problem ? 2 : 1} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}
