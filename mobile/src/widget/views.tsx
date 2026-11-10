"use no memo";
import type { AttendanceState } from "../../../src/core/attendance";
import { absenceInk, absenceTone } from "../ui/absence";
import type { Theme } from "../ui/theme";
// The widgets beyond "Now" and "Hari ini" (qa/superapp-widgets.md), as Android draws them: react-native-android-widget
// turns this tree into a picture, so no state or hooks here. Each takes its model (./model.ts) and the size the Student
// gave it, and shows what fits, most important first. Every row opens its own place; the card around it opens the app.
import { FlexWidget, SvgWidget, TextWidget } from "./kit";
import type { AttendanceWidget, CourseWidget, DueWidget, ExamWidget, NextWidget, ServiceIcon, ServicesWidget, WidgetLine, WidgetStatus } from "./model";
import { Frame, hex, LINE, PAD, Text, tap, type WidgetSize } from "./view";

/** Room for rows: the widget's height less its padding, its heading and (when it says something wrong, or there's room) its foot. */
function rowsRoom(size: WidgetSize, status: WidgetStatus, heading = true): { room: number; foot: boolean; scale: number } {
  const scale = Math.max(1, size.fontScale);
  const foot = status.problem || size.height >= 170;
  const room = size.height - 2 * PAD - (heading ? (LINE.micro + 6) * scale : 0) - (foot ? (LINE.micro + 6) * scale : 0);
  return { room, foot, scale };
}

function Heading({ text, color, open }: { text: string; color: string; open?: WidgetLine["open"] }) {
  return <Text text={text} size="micro" color={color} bold {...(open ? { open } : {})} />;
}

function Foot({ status, theme }: { status: WidgetStatus; theme: Theme }) {
  return <Text text={status.text} size="micro" color={status.problem ? theme.v4.ambFg : theme.v4.muted} />;
}

/** As many rows as fit `room`, leaving `moreHeight` for "+3 lagi" when some are left out. */
function fitRows<T>(rows: readonly T[], room: number, rowHeight: number, moreHeight: number): T[] {
  if (rows.length * rowHeight <= room) return [...rows];
  return rows.slice(0, Math.max(1, Math.floor((room - moreHeight) / rowHeight)));
}

/** "+3 lagi" when rows are left out: it opens the whole list. */
function more(count: number, lang: "id" | "en"): string {
  return lang === "id" ? `+${count} lagi` : `+${count} more`;
}

// ---------------------------------------------------------------- Tenggat

export function DueView({ model, size, theme, lang }: { model: DueWidget; size: WidgetSize; theme: Theme; lang: "id" | "en" }) {
  const v = theme.v4;
  const { room, foot, scale } = rowsRoom(size, model.status);
  const rowHeight = (LINE.small + LINE.micro + 8) * scale;
  const rows = fitRows(model.rows, room, rowHeight, (LINE.micro + 8) * scale);
  const left = model.rows.length - rows.length;
  return (
    <Frame theme={theme} surface={v.card}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 8 }}>
        <Heading text={model.heading} color={v.brand} open={model.all} />
        {model.empty ? <Text text={model.empty.label} size="small" color={v.muted} lines={2} open={model.empty.open} /> : null}
        {rows.map((row) => (
          <FlexWidget
            key={`${row.code}${row.title}${row.when}`}
            {...tap(row.open)}
            accessibilityLabel={`${row.title}, ${row.code}, ${row.when}`}
            style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}
          >
            <FlexWidget
              style={{ width: 4, height: (LINE.small + LINE.micro) * scale, borderRadius: 2, backgroundColor: hex(theme.courseTile(row.tone).ink) }}
            />
            <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
              <Text text={row.title} size="small" color={v.fg} bold />
              <Text text={`${row.code} · ${row.when}`} size="micro" color={row.soon ? v.ambFg : v.muted} bold={row.soon} />
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

export function AttendanceView({ model, size, theme, lang }: { model: AttendanceWidget; size: WidgetSize; theme: Theme; lang: "id" | "en" }) {
  const v = theme.v4;
  const { room, foot, scale } = rowsRoom(size, model.status);
  const rowHeight = (LINE.small + 6) * scale;
  // Narrow (2 cells): the code over its absences, as both don't fit one line. Wide (5 cells): the course's name too.
  const narrow = size.width < 180;
  const wide = size.width >= 320;
  const rows = fitRows(model.rows, room, narrow ? (LINE.small + LINE.small + 6) * scale : rowHeight, (LINE.micro + 6) * scale);
  const left = model.rows.length - rows.length;
  return (
    <Frame theme={theme} surface={v.card}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 6 }}>
        <Heading text={model.heading} color={v.brand} open={model.all} />
        {model.empty ? <Text text={model.empty.label} size="small" color={v.muted} lines={2} open={model.empty.open} /> : null}
        {rows.map((row) => (
          <FlexWidget
            key={row.code}
            {...tap(row.open)}
            accessibilityLabel={`${row.name ?? row.code}, ${row.label}`}
            style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}
          >
            <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hex(theme.courseTile(row.tone).ink) }} />
            {narrow ? (
              <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
                <Text text={row.code} size="small" color={v.fg} bold />
                <Text text={row.short} size="small" color={absenceColor(theme, row.state)} bold />
              </FlexWidget>
            ) : (
              <FlexWidget style={{ flex: 1 }}>
                <Text text={wide && row.name ? `${row.code} ${row.name}` : row.code} size="small" color={v.fg} bold />
              </FlexWidget>
            )}
            {narrow ? null : <Text text={row.short} size="small" color={absenceColor(theme, row.state)} bold />}
          </FlexWidget>
        ))}
        {left > 0 ? <Text text={more(left, lang)} size="micro" color={v.brandInk} bold open={model.all} /> : null}
      </FlexWidget>
      {foot ? <Foot status={model.status} theme={theme} /> : null}
    </Frame>
  );
}

// ---------------------------------------------------------------- Ujian

export function ExamView({ model, size, theme }: { model: ExamWidget; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const next = model.next;
  if (!next)
    return (
      <Frame theme={theme} surface={v.card}>
        <Text text={model.empty?.label ?? ""} size="small" color={v.muted} lines={3} {...(model.empty ? { open: model.empty.open } : {})} />
        {model.status.problem ? <Foot status={model.status} theme={theme} /> : null}
      </Frame>
    );
  const ink = theme.courseTile(next.tone).ink;
  // One row high: the number beside the exam.
  const short = size.height < 130;
  const big = (
    <FlexWidget style={{ flexDirection: "row", alignItems: "flex-end", flexGap: 4 }}>
      <TextWidget
        text={next.big}
        maxLines={1}
        truncate="END"
        style={{ adjustsFontSizeToFit: true, fontSize: next.unit ? (short ? 28 : 40) : short ? 20 : 26, color: hex(ink), fontWeight: "700" }}
      />
      {next.unit ? <TextWidget text={next.unit} maxLines={1} style={{ fontSize: 12, color: hex(v.muted), fontWeight: "500" }} /> : null}
    </FlexWidget>
  );
  return (
    <FlexWidget
      clickAction={tap(next.open).clickAction}
      clickActionData={tap(next.open).clickActionData}
      accessibilityLabel={`${next.title}, ${next.big}${next.unit ? ` ${next.unit}` : ""}, ${next.when}`}
      style={{
        width: "match_parent",
        height: "match_parent",
        padding: PAD,
        borderRadius: 20,
        backgroundColor: hex(v.card),
        flexDirection: short ? "row" : "column",
        justifyContent: "space-between",
        alignItems: short ? "center" : "flex-start",
        flexGap: 10,
      }}
    >
      {short ? big : null}
      <FlexWidget style={{ flexDirection: "column", ...(short ? { flex: 1 } : { width: "match_parent" }) }}>
        <Text text={next.title} size="small" color={v.fg} bold />
        <Text text={next.when} size="micro" color={v.muted} lines={short ? 1 : 2} />
      </FlexWidget>
      {short ? null : big}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Kelas berikutnya (one cell)

export function NextView({ model, size, theme }: { model: NextWidget; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const next = model.next;
  const pad = size.width < 80 ? 7 : 12;
  if (!next)
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        style={{ width: "match_parent", height: "match_parent", padding: pad, borderRadius: 18, backgroundColor: hex(v.card), justifyContent: "center" }}
      >
        <Text text={model.empty?.label ?? ""} size="micro" color={v.muted} lines={3} {...(model.empty ? { open: model.empty.open } : {})} />
      </FlexWidget>
    );
  const live = next.checkIn;
  // Tandai Hadir open: SIX's green, white on it in light (6.9:1), its pale ink on the dark tint in dark. Else the course's tint.
  const tile = theme.courseTile(next.tone);
  const green = theme.scheme === "light" ? { bg: v.okFg, fg: v.onBrand } : { bg: v.okBg, fg: v.okFg };
  const ink = live ? green.fg : tile.ink;
  const fg = live ? green.fg : v.fg;
  const big = Math.min(26, Math.floor((size.width - 2 * pad) / 2.9));
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
        borderRadius: 18,
        backgroundColor: hex(live ? green.bg : tile.tint),
        flexDirection: "column",
        justifyContent: "center",
        flexGap: 2,
      }}
    >
      {next.day && !live ? <Text text={next.day} size="micro" color={v.muted} /> : null}
      <TextWidget
        text={next.big}
        maxLines={live ? 2 : 1}
        style={{ adjustsFontSizeToFit: true, fontSize: live ? Math.min(big, 16) : big, color: hex(fg), fontWeight: "700" }}
      />
      {live ? null : (
        <TextWidget
          text={next.code}
          maxLines={1}
          style={{ adjustsFontSizeToFit: true, fontSize: size.width < 80 ? 11 : 12, color: hex(ink), fontWeight: "500" }}
        />
      )}
      {next.room && size.height >= 90 && !live ? <Text text={next.room} size="micro" color={v.muted} /> : null}
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

/** Each service its own colour (ink on its tint), light and dark: no two the same. */
const SERVICE_TONE: Record<ServiceIcon, { light: [string, string]; dark: [string, string] }> = {
  calendar: { light: ["#1f63e0", "#dbe6ff"], dark: ["#a9c4ff", "#1c2c4d"] },
  tasks: { light: ["#b5530a", "#ffe8d4"], dark: ["#ffb27a", "#43301f"] },
  courses: { light: ["#11692f", "#dcf2e3"], dark: ["#7fd69c", "#1c3a27"] },
  grades: { light: ["#6c45f6", "#efebff"], dark: ["#9787ff", "#2d2b4d"] },
};

const svgOf = (icon: ServiceIcon, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${ICON_PATH[icon]}"/></svg>`;

export function ServicesView({ model, size, theme }: { model: ServicesWidget; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const each = Math.max(1, Math.min(model.items.length, Math.floor((size.width - 16) / 56)));
  const tile = size.height >= 80 ? 44 : 34;
  const labels = size.height >= 70;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        height: "match_parent",
        paddingHorizontal: 8,
        borderRadius: 20,
        backgroundColor: hex(v.card),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
      }}
    >
      {model.items.slice(0, each).map((item) => {
        const [ink, tint] = SERVICE_TONE[item.icon][theme.scheme];
        return (
          <FlexWidget
            key={item.icon}
            {...tap(item.open)}
            accessibilityLabel={item.label}
            style={{ flexDirection: "column", alignItems: "center", flexGap: 4, padding: 4 }}
          >
            <FlexWidget style={{ width: tile, height: tile, borderRadius: 14, backgroundColor: hex(tint), alignItems: "center", justifyContent: "center" }}>
              <SvgWidget svg={svgOf(item.icon, ink)} style={{ width: tile * 0.55, height: tile * 0.55 }} />
            </FlexWidget>
            {labels ? <Text text={item.label} size="micro" color={v.fg} bold /> : null}
          </FlexWidget>
        );
      })}
    </FlexWidget>
  );
}

// ---------------------------------------------------------------- Satu mata kuliah

export function CourseView({ model, size, theme }: { model: CourseWidget; size: WidgetSize; theme: Theme }) {
  const v = theme.v4;
  const course = model.course;
  if (!course)
    return (
      <Frame theme={theme} surface={v.card}>
        <Text text={model.empty?.label ?? ""} size="small" color={v.muted} lines={3} />
      </Frame>
    );
  const { room, scale } = rowsRoom(size, model.status, false);
  const tile = theme.courseTile(course.tone);
  let left = room - (LINE.body + 8) * scale;
  const take = (height: number) => {
    if (left < height * scale) return false;
    left -= height * scale;
    return true;
  };
  // Two cells wide: the code alone, the absences and the class in their short words, the Task over two lines.
  const narrow = size.width < 180;
  const showAbsences = model.absences ? take(LINE.small + 6) : false;
  const showNext = model.next ? take(LINE.small + 6) : false;
  const showTask = model.task ? take((narrow ? 2 : 1) * LINE.small + LINE.micro + 6) : false;
  return (
    <Frame theme={theme} surface={v.card}>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column", flexGap: 6 }}>
        <FlexWidget
          {...tap(course.open)}
          accessibilityLabel={course.name ?? course.code}
          style={{ width: "match_parent", flexDirection: "row", alignItems: "center", flexGap: 8 }}
        >
          <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hex(tile.ink) }} />
          <Text text={course.name && !narrow ? `${course.code} ${course.name}` : course.code} size="body" color={v.fg} bold />
        </FlexWidget>
        {showAbsences && model.absences ? (
          <Text text={narrow ? model.absences.short : model.absences.label} size="small" color={absenceColor(theme, model.absences.state)} bold />
        ) : null}
        {showNext && model.next ? <Text text={narrow ? model.next.short : model.next.label} size="small" color={v.fg} open={model.next.open} /> : null}
        {showTask && model.task ? (
          <FlexWidget {...tap(model.task.open)} style={{ width: "match_parent", flexDirection: "column" }}>
            <Text text={model.task.label} size="small" color={v.fg} bold lines={narrow ? 2 : 1} />
            <Text text={model.task.detail ?? ""} size="micro" color={v.muted} />
          </FlexWidget>
        ) : null}
      </FlexWidget>
      {model.status.problem ? <Foot status={model.status} theme={theme} /> : null}
    </Frame>
  );
}
