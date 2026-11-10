"use no memo";
import type { AttendanceState } from "../../../src/core/attendance";
import { absenceInk, absenceTone } from "../ui/absence";
import { THEMES, type Theme } from "../ui/theme";
// The widgets beyond "Sekarang" and "Hari ini" (qa/superapp-widgets.md), as Android draws them: react-native-android-widget
// turns this tree into a picture, so no state or hooks here. Each is built around one shape that answers its question at
// a glance: one course is one block in its colour (Ujian's figure of days, Kelas berikutnya's time, Satu mata kuliah),
// many are a short list on the widget's white surface with a colour bar per course (Tenggat, Kehadiran's marks). Each takes its model (./model.ts) and the size the Student gave it, and
// shows what fits, most important first. Every row opens its own place; the surface around it opens the app.
import { FlexWidget, TextWidget } from "./kit";
import type { AttendanceRow, AttendanceWidget, CourseWidget, DueRow, DueWidget, ExamWidget, NextWidget, WidgetStatus } from "./model";
import { courseBlock, courseInk, courseLabel, Foot, Frame, hex, LINE, linesOf, PAD, RADIUS, StateCard, Text, tap, type WidgetSize } from "./view";

/** Room for rows: the widget's height less its padding, its heading and its foot (said wherever there's something to say). */
function rowsRoom(size: WidgetSize, status: WidgetStatus, heading = true): { room: number; foot: boolean; scale: number } {
  const scale = Math.max(1, size.fontScale);
  const foot = Boolean(status.text) && (status.problem || size.height >= 150);
  const room = size.height - 2 * PAD - (heading ? (LINE.micro + 8) * scale : 0) - (foot ? (LINE.foot + 6) * scale : 0);
  return { room, foot, scale };
}

/** "+3 lagi" when rows are left out: it opens the whole list. */
function more(count: number, lang: "id" | "en"): string {
  return lang === "id" ? `+${count} lagi` : `+${count} more`;
}

/** The width `text` takes on one line, on the safe side (as ./view's linesOf). */
const widthOf = (text: string, fontSize: number) => text.length * fontSize * 0.56;
/** The same with a tenth of slack, for a line that must not be cut: the phone's font runs wider than the estimate. */
const safeWidth = (text: string, fontSize: number) => widthOf(text, fontSize) * 1.1;

// ---------------------------------------------------------------- Tenggat

/**
 * What's due, soonest first, and the Task leads: its title in bold, its course under it; at the row's end how close it
 * is ("Hari ini" in amber, "Besok", "8 hari"), with the date under that, or the date alone from two weeks out, quieter.
 * A narrow widget says the same on one line under the title.
 */
export function DueView({ model, size, theme, lang }: { model: DueWidget; size: WidgetSize; theme: Theme; lang: "id" | "en" }) {
  const v = theme.v4;
  if (model.quiet) return <StateCard quiet={model.quiet} status={model.status} size={size} theme={theme} />;
  const { room: counted, foot, scale } = rowsRoom(size, model.status);
  // (The last line has no gap under it: 8 back.)
  const room = counted + 8;
  // The phone's text made big: the narrow layout before a title is cut.
  const wide = size.width >= 250 * scale;
  const inner = size.width - 2 * PAD - 12;
  // The row's end: how close, over the date (the time when it's today or tomorrow).
  const topOf = (row: DueRow) => row.near ?? row.day.replace(", ", " ");
  // One pattern down the list: the count in bold ("Hari ini", "8 hari"; from two weeks out, the date) over the hour,
  // with the date before it where the count stands in for it ("Jum 16 Okt, 23:59"). Every row says its hour.
  const bottomOf = (row: DueRow) => (row.mark || !row.near ? row.time : `${row.day.replace(", ", " ")}, ${row.time}`);
  const rightWidth = wide ? Math.max(0, ...model.rows.flatMap((row) => [safeWidth(topOf(row), 14 * scale), safeWidth(bottomOf(row), 12 * scale)])) : 0;
  const titleWidth = inner - (wide ? rightWidth + 8 : 0);
  // The course by its name where the line holds it whole, else its code.
  const courseOf = (row: DueRow) => (row.name && safeWidth(row.name, 12 * scale) <= titleWidth ? row.name : row.code);
  // Narrow: the same two facts on one line under the title, and the course's code after them where it's held whole.
  const underOf = (row: DueRow) => {
    const said = `${topOf(row)} · ${row.time}`;
    return safeWidth(`${said} · ${row.code}`, 12 * scale) <= titleWidth ? `${said} · ${row.code}` : said;
  };
  // A title that's a line and a bit by the (safe) estimate sits on one; a long one keeps two before it's cut.
  const linesFor = (row: DueRow, most: number) => {
    const need = linesOf(row.title, 14 * scale, titleWidth);
    return most === 1 ? (need >= 3 ? 2 : 1) : Math.min(most, need);
  };
  const heightOf = (row: DueRow, most: number) => (linesFor(row, most) * LINE.small + LINE.micro) * scale + 8;
  const fits = (lines: number) => model.rows.reduce((sum, row) => sum + heightOf(row, lines), 0) <= room;
  const most = fits(3) ? 3 : fits(2) ? 2 : 1;
  const moreHeight = (LINE.micro + 8) * scale;
  const rows: DueRow[] = [];
  let space = room;
  for (const row of model.rows) {
    const last = rows.length + 1 === model.rows.length;
    if (space < heightOf(row, most) + (last ? 0 : moreHeight) && rows.length) break;
    rows.push(row);
    space -= heightOf(row, most);
  }
  const left = model.rows.length - rows.length;
  // Height left over goes to a title that would be cut: its second line.
  const extra = new Set<DueRow>();
  let spare = space - (left > 0 ? moreHeight : 0);
  for (const row of rows) {
    if (linesOf(row.title, 14 * scale, titleWidth) > linesFor(row, most) && spare >= LINE.small * scale) {
      extra.add(row);
      spare -= LINE.small * scale;
    }
  }
  const shownLines = (row: DueRow) => linesFor(row, most) + (extra.has(row) ? 1 : 0);
  // Close is loud, far is quiet: amber within a day, the ink while it's a count of days, grey once it's only a date.
  const inkOf = (row: DueRow) => (row.soon || row.mark === "today" ? v.ambFg : v.fg);
  return (
    <Frame theme={theme}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 8 }}>
        <Text text={model.heading} size="micro" color={v.muted} bold open={model.all} />
        {rows.map((row) => (
          <FlexWidget
            key={`${row.code}${row.title}${row.when}`}
            {...tap(row.open)}
            accessibilityLabel={`${row.title}, ${row.name ?? row.code}, ${row.when}`}
            style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}
          >
            <FlexWidget
              style={{
                width: 4,
                height: heightOf(row, most) - 8 + (extra.has(row) ? LINE.small * scale : 0),
                borderRadius: 2,
                backgroundColor: hex(courseInk(theme, row.tone)),
              }}
            />
            <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
              <Text text={row.title} size="small" color={v.fg} weight="700" lines={shownLines(row)} />
              {wide ? <Text text={courseOf(row)} size="micro" color={v.muted} /> : <Text text={underOf(row)} size="micro" color={inkOf(row)} bold />}
            </FlexWidget>
            {wide ? (
              <FlexWidget style={{ width: rightWidth, flexDirection: "column", alignItems: "flex-end" }}>
                <Text text={topOf(row)} size="small" color={inkOf(row)} weight="700" />
                <Text text={bottomOf(row)} size="micro" color={v.muted} />
              </FlexWidget>
            ) : null}
          </FlexWidget>
        ))}
        {left > 0 ? <Text text={more(left, lang)} size="micro" color={v.brandInk} bold open={model.all} /> : null}
      </FlexWidget>
      {foot ? <Foot status={model.status} theme={theme} width={size.width - 2 * PAD} scale={scale} /> : null}
    </Frame>
  );
}

// ---------------------------------------------------------------- Kehadiran

/** The state's colour, the same on every screen (absenceTone): red past the limit, amber at it; `rest` while it's fine. */
function absenceColor(theme: Theme, state: AttendanceState, rest: string): string {
  const tone = absenceTone(state);
  return tone ? absenceInk(theme.v4, tone).fg : rest;
}

/** More absences than this and the dots stop reading as a count: the word alone says it. */
const MOST_DOTS = 8;

/**
 * A course's absences, the phone's one way (screens/presence/absence-dots.tsx): a dot per absence the term allows, full
 * (`ink`, the ink of the surface it sits on) while it's still left and a ring once it's used, then one more dot, set a
 * little apart, for each absence over the limit (`overInk`: red). "sisa 2 absen" is two full dots, "absen habis" all
 * rings, "lewat 1 absen" all rings and one red. Never green or amber: colour on a dot means over.
 */
function Dots({
  row,
  ink,
  ring,
  overInk,
  overEdge,
  size = 10,
}: {
  row: { allowed: number | null; used: number | null; over: number };
  ink: string;
  ring: string;
  overInk: string;
  /** On a colour block: the red dot's own edge, so it's seen on any course's colour. */
  overEdge?: string;
  size?: number;
}) {
  if (row.allowed === null || row.used === null) return null;
  const allowed = Math.max(0, row.allowed);
  if (allowed + row.over > MOST_DOTS || allowed + row.over === 0) return null;
  const dot = (index: number) => {
    const past = index >= allowed;
    const used = past || index < (row.used ?? 0);
    return (
      <FlexWidget
        key={index}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          ...(past
            ? { backgroundColor: hex(overInk), ...(overEdge ? { borderWidth: 1.5, borderColor: hex(overEdge) } : {}) }
            : used
              ? { borderWidth: 1.5, borderColor: hex(ring) }
              : { backgroundColor: hex(ink) }),
        }}
      />
    );
  };
  return (
    <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: OVER_GAP }}>
      {allowed > 0 ? (
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 4 }}>{Array.from({ length: allowed }, (_, index) => dot(index))}</FlexWidget>
      ) : null}
      {row.over > 0 ? (
        <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 4 }}>
          {Array.from({ length: row.over }, (_, index) => dot(allowed + index))}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

/** The gap before the dots over the limit: two dots' gaps, so "these, and one more" reads at a glance. */
const OVER_GAP = 8;

/** A red that stays red on a dark card and on a course's colour (the theme's dark red ink reads as salmon at a dot's size). */
const OVER_RED = "#e5484d";

/** Every course's absences, the worst first: its name, its dots, then "sisa 1", "habis" or "lewat 1" in the state's colour. One size at every width: fewer rows and "+2 lagi", never smaller type. */
export function AttendanceView({ model, size, theme, lang }: { model: AttendanceWidget; size: WidgetSize; theme: Theme; lang: "id" | "en" }) {
  const v = theme.v4;
  if (model.quiet) return <StateCard quiet={model.quiet} status={model.status} size={size} theme={theme} />;
  const { room: counted, foot, scale } = rowsRoom(size, model.status);
  // (The last line has no gap under it: 8 back.)
  const room = counted + 8;
  // Narrow (2 cells): the name over its dots and its word. Wider: the name, the dots in one column, the word at the end.
  const thin = size.width < 220;
  const drawn = (row: AttendanceRow) => row.allowed !== null && row.allowed + row.over <= MOST_DOTS && row.allowed + row.over > 0;
  const dotsWidth = Math.max(
    0,
    ...model.rows.filter(drawn).map((row) => ((row.allowed ?? 0) + row.over) * 14 - 4 + (row.over > 0 && (row.allowed ?? 0) > 0 ? OVER_GAP - 4 : 0)),
  );
  const wordWidth = Math.max(0, ...model.rows.map((row) => safeWidth(row.short, 12 * scale)));
  const beside = size.width - 2 * PAD - dotsWidth - 10 - wordWidth - 10;
  // (Big text: the name's column would hold four letters, so the name goes over its dots as in two cells.)
  const narrow = thin || beside < 96 * scale;
  const nameWidth = narrow ? size.width - 2 * PAD : beside;
  // Names down the whole list (wrapped where one line doesn't hold it), or codes down the whole list: never a mix.
  // (The phone's text made big: two lines at most, where the estimate of a third is least sure.)
  const most = scale > 1 ? 2 : 3;
  const codes = model.rows.some((row) => courseLabel(row.name, row.code, 14 * scale, nameWidth, most).text !== (row.name ?? row.code));
  // Beside the dots, a name that doesn't fit whole keeps one line and ends on "…": every course still gets its row.
  const labelOf = (row: AttendanceRow) =>
    codes ? { text: narrow ? row.code : (row.name ?? row.code), lines: 1 } : courseLabel(row.name, row.code, 14 * scale, nameWidth, most);
  const heightOf = (row: AttendanceRow) => labelOf(row).lines * LINE.small * scale + (narrow ? LINE.micro * scale + 3 : 0) + 8;
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
          const danger = row.state === "out" || row.state === "missed";
          const dots = <Dots row={row} ink={v.fg} ring={v.muted} overInk={theme === THEMES.light ? v.redFg : OVER_RED} />;
          const label = labelOf(row);
          const word = <Text text={row.short} size="micro" color={absenceColor(theme, row.state, v.fg)} weight={danger ? "700" : "500"} />;
          return (
            <FlexWidget
              key={row.code}
              {...tap(row.open)}
              accessibilityLabel={`${row.name ?? row.code}, ${row.label}`}
              style={{
                width: "match_parent",
                flexDirection: narrow ? "column" : "row",
                alignItems: narrow ? "flex-start" : "center",
                flexGap: narrow ? 3 : 10,
              }}
            >
              <FlexWidget style={narrow ? { width: "match_parent" } : { flex: 1 }}>
                <Text text={label.text} size="small" color={v.fg} bold lines={label.lines} />
              </FlexWidget>
              {narrow ? (
                <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}>
                  {dots}
                  {word}
                </FlexWidget>
              ) : (
                <FlexWidget style={{ width: dotsWidth, flexDirection: "row" }}>{dots}</FlexWidget>
              )}
              {narrow ? null : <FlexWidget style={{ width: wordWidth, flexDirection: "row", justifyContent: "flex-end" }}>{word}</FlexWidget>}
            </FlexWidget>
          );
        })}
        {left > 0 ? <Text text={more(left, lang)} size="micro" color={v.brandInk} bold open={model.all} /> : null}
      </FlexWidget>
      {foot ? <Foot status={model.status} theme={theme} width={size.width - 2 * PAD} scale={scale} /> : null}
    </Frame>
  );
}

// ---------------------------------------------------------------- Ujian

/**
 * The next exam, on its course's colour, and the count leads: "7 hari lagi" ("Besok", "Hari ini"), then its day and
 * time, the exam by its course's name, the room last. Never more than four lines in one row of cells: what's wrong
 * takes the room's line, it doesn't add one. A taller widget goes on to the exams after it.
 */
export function ExamView({ model, size, theme }: { model: ExamWidget; size: WidgetSize; theme: Theme }) {
  const next = model.next;
  if (!next) return model.quiet ? <StateCard quiet={model.quiet} status={model.status} size={size} theme={theme} /> : <Frame theme={theme}>{null}</Frame>;
  const block = courseBlock(next.tone);
  const scale = Math.max(1, size.fontScale);
  const inner = size.width - 2 * PAD;
  const headline = next.unit ? `${next.big} ${next.unit}` : next.big;
  const headSize = Math.max(18, Math.min(size.width >= 250 ? 26 : 22, Math.floor(inner / (headline.length * 0.62 * scale))));
  const headLine = Math.round(headSize * 1.3) * scale;
  // Today and tomorrow the headline is the day: the time alone under it.
  const date = next.days <= 1 ? next.time : `${next.day}, ${next.time}`;
  // Four cells wide: the count and the exam at the left, its day, time and room at the right, so neither half is empty.
  const split = size.width >= 340 && size.height < 190;
  const dated = !split && next.room && safeWidth(`${date} · ${next.room}`, 14 * scale) <= inner ? `${date} · ${next.room}` : date;
  let room = size.height - 2 * PAD - headLine - (LINE.small + 2) * scale - LINE.small * scale - 4;
  const take = (height: number) => {
    if (room < height) return false;
    room -= height;
    return true;
  };
  const problem = model.status.problem && Boolean(model.status.text);
  // What's wrong comes before the name's second line and the room.
  if (problem) room -= (LINE.foot + 4) * scale;
  const name = next.name ? `${next.kind} ${next.name}` : next.title;
  const nameLines = linesOf(name, 14 * scale, inner);
  const title = nameLines === 1 || (nameLines === 2 && take(LINE.small * scale)) ? { text: name, lines: nameLines } : { text: next.title, lines: 1 };
  const roomLine = !split && dated === date && Boolean(next.room) && take(LINE.micro * scale + 2);
  const rowHeight = (LINE.micro + LINE.small) * scale + 8;
  const rows = model.more.slice(0, Math.max(0, Math.floor((room - 10) / rowHeight)));
  const action = tap(next.open);
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
        borderWidth: 1,
        borderColor: hex(block.edge),
        backgroundColor: hex(block.bg),
        flexDirection: "column",
        // Alone on the block, the lockup sits in its middle: no gap gathers under it.
        justifyContent: rows.length || problem ? "space-between" : "center",
      }}
    >
      {split ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexGap: 12 }}>
          <FlexWidget style={{ flex: 1, flexDirection: "column", flexGap: 2 }}>
            <TextWidget text={headline} maxLines={1} style={{ fontSize: headSize + 4, color: hex(block.on), fontWeight: "700" }} />
            <Text text={title.text} size="small" color={block.soft} lines={1} />
          </FlexWidget>
          <FlexWidget style={{ flexDirection: "column", alignItems: "flex-end" }}>
            {next.days <= 1 ? null : <Text text={next.day} size="small" color={block.on} bold />}
            <TextWidget text={next.time} maxLines={1} style={{ fontSize: 22, color: hex(block.on), fontWeight: "700" }} />
            {next.room ? <Text text={next.room} size="micro" color={block.soft} /> : null}
          </FlexWidget>
        </FlexWidget>
      ) : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 2 }}>
          <TextWidget text={headline} maxLines={1} style={{ fontSize: headSize, color: hex(block.on), fontWeight: "700" }} />
          <Text text={dated} size="small" color={block.on} bold />
          <FlexWidget style={{ width: "match_parent", paddingTop: 2 }}>
            <Text text={title.text} size="small" color={block.soft} lines={title.lines} />
          </FlexWidget>
          {roomLine && next.room ? <Text text={next.room} size="micro" color={block.soft} /> : null}
        </FlexWidget>
      )}
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
      {problem ? <Foot status={model.status} theme={theme} width={inner} scale={scale} on={block.on} /> : null}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Kelas berikutnya (one cell)

/**
 * One cell: a day, a time and a colour. The next class's start, big and white on its course's colour, its day above it
 * ("Hari ini", "Besok", "Kam"), its code under it. From two cells: the course's name instead of the code, and its
 * room. While SIX shows Tandai Hadir for the class on now, the cell is SIX's green and says so. What's wrong is one
 * small line ("Data 08:12" in one cell) in the room's place.
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
  const block = live ? { ...courseBlock(next.tone), bg: THEMES.light.v4.okFg, soft: "#dff3e6", edge: "#4c9a66" } : courseBlock(next.tone);
  const big = Math.min(tiny ? 26 : 34, Math.floor((size.width - 2 * pad) / (2.9 * scale)));
  const inner = size.width - 2 * pad;
  const day = !live && safeWidth(next.dayShort, 12 * scale) <= inner;
  let room = size.height - 2 * pad - (day ? LINE.micro * scale : 0) - big * 1.3 * scale;
  const take = (height: number) => {
    if (room < height) return false;
    room -= height;
    return true;
  };
  // What's wrong is always said, in one small line.
  const problem = model.status.problem && Boolean(model.status.text) && take(LINE.foot * scale + 3);
  const named = !tiny && !live && take(LINE.small * scale);
  const label = named
    ? courseLabel(next.name, next.code, 14 * scale, inner, 1 + Math.min(1, Math.floor(room / (LINE.small * scale))))
    : { text: next.code, lines: 1 };
  if (named) room -= (label.lines - 1) * LINE.small * scale;
  const coded = !named && !live && take(LINE.micro * scale);
  const where = Boolean(next.room) && !live && safeWidth(next.room ?? "", 12 * scale) <= inner && take(LINE.micro * scale);
  const action = tap(next.open);
  const foot = problem ? <Foot status={model.status} theme={theme} width={inner} scale={scale} on={block.on} /> : null;
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
        borderWidth: 1,
        borderColor: hex(block.edge),
        backgroundColor: hex(block.bg),
        flexDirection: "column",
        justifyContent: tiny ? "center" : "space-between",
        flexGap: 1,
      }}
    >
      <FlexWidget style={{ flexDirection: "column" }}>
        {day ? <Text text={next.dayShort} size="micro" color={block.soft} bold /> : null}
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
        {tiny ? foot : null}
      </FlexWidget>
      {tiny ? null : (
        <FlexWidget style={{ width: "match_parent", flexDirection: "column" }}>
          {named ? <Text text={label.text} size="small" color={block.on} weight="700" lines={label.lines} /> : null}
          {where && next.room ? <Text text={next.room} size="micro" color={block.soft} /> : null}
          {foot}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Satu mata kuliah

/**
 * One course, in its colour, and the three things a student asks of it: its code with its absences as dots at the top
 * ("sisa 1"), its name whole, its next class (the time, then the room on its own line where one doesn't hold both),
 * and its next deadline where there's height. Never a line that ends on "·".
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
  const problem = model.status.problem && Boolean(model.status.text);
  // The code's row is kept only with the name under it (a widget that falls back to the code says it once).
  const coded = label.text !== course.code;
  const top = coded || model.absences ? LINE.micro * scale + 6 : 0;
  let left = size.height - 2 * PAD - top - nameLine * label.lines - (problem ? (LINE.foot + 6) * scale : 0);
  const take = (height: number) => {
    if (left < height) return false;
    left -= height;
    return true;
  };
  // The class's day and time on one line with its room, else each on its own line: a line never ends on "·".
  const next = model.next;
  const whole = next ? (narrow ? next.short : next.label) : "";
  const when = next ? (narrow ? next.short : next.when) : "";
  const oneLine = next ? safeWidth(whole, 14 * scale) <= inner : false;
  const whenSize = oneLine || safeWidth(when, 14 * scale) <= inner ? "small" : "micro";
  const showNext = next ? take(LINE[whenSize] * scale + 6) : false;
  const showRoom = showNext && !oneLine && !narrow && Boolean(next?.room) && take(LINE.micro * scale);
  const detailLines = model.task?.detail ? Math.min(2, linesOf(model.task.detail, 12 * scale, inner)) : 1;
  const taskLines = model.task ? linesOf(model.task.label, 14 * scale, inner) : 1;
  // Its next deadline: the date always where there's a line for it, the title only where it fits whole.
  const showDue = model.task ? take(detailLines * LINE.micro * scale + 8) : false;
  const showTask = showDue && taskLines <= 3 ? take(taskLines * LINE.small * scale) : false;
  const foot = problem || (Boolean(model.status.text) && take(LINE.foot * scale + 8));
  const danger = model.absences && (model.absences.state === "out" || model.absences.state === "missed");
  return (
    <FlexWidget
      {...tap(course.open)}
      accessibilityLabel={course.name ?? course.code}
      style={{
        width: "match_parent",
        height: "match_parent",
        padding: PAD,
        borderRadius: RADIUS,
        borderWidth: 1,
        borderColor: hex(block.edge),
        backgroundColor: hex(block.bg),
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <FlexWidget style={{ width: "match_parent", flexDirection: "column", flexGap: 6 }}>
        {top ? (
          <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text text={coded ? course.code : ""} size="micro" color={block.soft} bold />
            {model.absences ? (
              <FlexWidget accessibilityLabel={model.absences.label} style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}>
                {model.marks ? <Dots row={model.marks} ink={block.on} ring={block.on} overInk={OVER_RED} overEdge={block.on} size={9} /> : null}
                <Text text={model.absences.short} size="micro" color={block.on} weight={danger ? "700" : "500"} />
              </FlexWidget>
            ) : null}
          </FlexWidget>
        ) : null}
        <Text text={label.text} size={big ? "title" : "body"} color={block.on} weight="700" lines={label.lines} />
        {showNext && next ? (
          <FlexWidget {...tap(next.open)} accessibilityLabel={next.label} style={{ width: "match_parent", flexDirection: "column" }}>
            <Text text={oneLine ? whole : when} size={whenSize} color={block.on} bold />
            {showRoom && next.room ? <Text text={next.room} size="micro" color={block.soft} /> : null}
          </FlexWidget>
        ) : null}
        {showDue && model.task ? (
          <FlexWidget
            {...tap(model.task.open)}
            accessibilityLabel={[model.task.label, model.task.detail].filter(Boolean).join(", ")}
            style={{ width: "match_parent", flexDirection: "column", paddingTop: 2 }}
          >
            <Text text={model.task.detail ?? ""} size="micro" color={block.soft} bold lines={detailLines} />
            {showTask ? <Text text={model.task.label} size="small" color={block.on} lines={taskLines} /> : null}
          </FlexWidget>
        ) : null}
      </FlexWidget>
      {foot ? <Foot status={model.status} theme={theme} width={inner} scale={scale} on={problem ? block.on : block.soft} /> : null}
    </FlexWidget>
  );
}
