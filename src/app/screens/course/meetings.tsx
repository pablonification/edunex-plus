// The Pertemuan tab: SIX's timetable (official time and room) merged with
// Edunex Presence (the window and what Edunex recorded) and meetings
// announced only in Edunex text. The attendance story is told honestly: SIX's
// count is the official one and comes first; Edunex's record per meeting is a
// quiet second line, and a meeting Edunex didn't record never reads as an
// absence where SIX is (or, signed out of SIX, may be) the one that counts.
// A meeting carries one number only: the name Edunex or SIX gives it.
import type { ReactNode } from "react";
import type { CountedIn } from "../../../core/attendance";
import { type OutlineEntry, outlineEntries } from "../../../core/course-materials";
import { type Meeting, meetingModules, meetingState, nextMeetingIndex, wibDay } from "../../../core/course-meetings";
import { edunexCourseUrl } from "../../../core/links";
import type { CalendarEvent } from "../../../core/models";
import { dayStart } from "../../../core/schedule";
import { useAttendance } from "../../attendance";
import { budgetLabel, STATE_TONE } from "../../attendance-labels";
import { useOpenExternal } from "../../hooks";
import { useFormat, useNow, useT } from "../../i18n";
import { SixEmptyState, useSignIn } from "../../shell/source-status";
import { useDataset, useStatus } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { EmptyState, LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import type { CoursePage } from "./data";

export function MeetingsTab({ page }: { page: CoursePage }) {
  const t = useT();
  const now = useNow();
  const attendance = useAttendance();
  const calendar = useDataset("itb.calendar");
  const { meetings, course, presence } = page;
  const health = attendance?.courses.find((c) => c.course.code === course.code)?.health;
  const countedIn = health?.countedIn ?? "unknown";
  const noEdunexPresence = presence !== undefined && presence.length === 0;
  const sixSignedOut = useStatus("six").state === "signed-out";
  const next = nextMeetingIndex(meetings, now);
  // A meeting nothing names takes the one module the lecturer posted the week before it, when there is one.
  const modules = pageModules(page);
  const periods = (calendar?.events ?? []).filter((e) => e.kind === "uts" || e.kind === "uas");
  // The exam period a meeting falls in, said once, before its first meeting.
  const periodOf = (meeting: Meeting) => periods.find((p) => wibDay(meeting.start) >= p.firstDay && wibDay(meeting.start) <= p.lastDay);

  return (
    <div className="max-w-[960px]">
      <div className="mb-5">
        {course.attendance && course.attendance.held > 0 ? (
          <Meta className="text-lead">
            <span className="font-semibold">{t("meeting.official", course.attendance)}</span>
            {health && health.state !== "unknown" ? <span className={cx("font-semibold", STATE_TONE[health.state])}>{budgetLabel(t, health)}</span> : null}
          </Meta>
        ) : null}
        {countedIn === "noSix" && !noEdunexPresence && health ? (
          <NoSixIntro recorded={health.edunexRecorded} closed={health.edunexClosed} />
        ) : (
          <p className="mt-1 max-w-[70ch] text-small text-muted">
            {noEdunexPresence
              ? t("meeting.noEdunexPresence")
              : countedIn === "edunex"
                ? t("meeting.edunexCounts")
                : course.attendance && presence?.length
                  ? t("meeting.sixTotalsOnly")
                  : ""}
          </p>
        )}
      </div>
      {meetings.length === 0 ? (
        sixSignedOut ? (
          <SixEmptyState icon={<Icons.Calendar className="size-5" />} title={t("meeting.noSix")} />
        ) : (
          <EmptyState icon={<Icons.Calendar className="size-5" />} title={t("meeting.none")} />
        )
      ) : (
        <ol className="overflow-hidden rounded-xl border border-edge bg-surface shadow-card">
          {meetings.map((meeting, index) => {
            const period = periodOf(meeting);
            const firstInPeriod = period && (index === 0 || periodOf(meetings[index - 1]) !== period);
            return (
              <MeetingRow
                key={meeting.key}
                meeting={meeting}
                index={index}
                next={index === next}
                countedIn={countedIn}
                moduleTitle={meetingModuleTitle(t, modules, meeting)}
                divider={firstInPeriod ? period : undefined}
                fallbackUrl={course.edunex ? edunexCourseUrl(course.edunex.courseId) : null}
              />
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** Each meeting's Edunex module, where one goes with it (see meetingModules). */
export const pageModules = (page: CoursePage) =>
  meetingModules(page.meetings, page.outline && page.course.edunex ? outlineEntries(page.outline, page.course.edunex.courseId) : []);

/** "Modul 7 · Inovasi Pelayanan Publik" for a meeting known only as a class, as its row on the Pertemuan tab says it. */
export function meetingModuleTitle(t: ReturnType<typeof useT>, modules: ReadonlyMap<string, OutlineEntry>, meeting: Meeting): string | null {
  const named = meeting.presence?.topic ?? meeting.six?.activity ?? null;
  // A meeting Edunex or SIX names or numbers keeps that: one number per meeting.
  if (meeting.announced || (named && !/^kuliah$/i.test(named.trim()))) return null;
  const entry = modules.get(meeting.key);
  return entry ? t("meeting.module", { no: entry.number, title: entry.module.title.trim() }) : null;
}

/** What a meeting is called, the same on its row and on the card above the tabs: its module, its name, "Pertemuan 3", or "Kuliah". */
export function meetingTitle(t: ReturnType<typeof useT>, meeting: Meeting, moduleTitle: string | null): string {
  const named = meeting.presence?.topic?.trim() || meeting.six?.activity?.trim() || null;
  // SIX calls nearly every class "Kuliah": Edunex's number for it says more.
  const telling = named && !/^kuliah$/i.test(named) ? named : null;
  return moduleTitle ?? telling ?? (meeting.announced ? t("meeting.number", { no: meeting.announced.number }) : (named ?? t("meeting.untitled")));
}

/** Signed out of SIX: Edunex's own tally as a fact, and why it may not be the count that matters. */
function NoSixIntro({ recorded, closed }: { recorded: number; closed: number }) {
  const t = useT();
  const { signIn, busy } = useSignIn();
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="min-w-0 flex-1">
        {closed > 0 && <p className="text-lead font-semibold">{t("presence.edunexTally", { recorded, closed })}</p>}
        <p className="mt-1 max-w-[70ch] text-small text-muted">{t("meeting.noSixCount")}</p>
      </div>
      <Button size="sm" busy={busy} onClick={() => void signIn("six")}>
        {t("presence.signInSix")}
      </Button>
    </div>
  );
}

function PeriodDivider({ period }: { period: CalendarEvent }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="flex items-center gap-2 border-b border-line bg-warning-bg/50 px-4 py-1.5 text-small font-semibold text-warning-fg">
      <Icons.GraduationCap className="size-3.5" />
      {t("meeting.examPeriod", {
        period: t(period.kind === "uts" ? "calendar.kind.uts" : "calendar.kind.uas"),
        from: f.dayMonth(dayStart(period.firstDay)),
        to: f.dayMonth(dayStart(period.lastDay)),
      })}
    </div>
  );
}

function MeetingRow({
  meeting,
  index,
  next,
  countedIn,
  moduleTitle,
  divider,
  fallbackUrl,
}: {
  meeting: Meeting;
  index: number;
  next: boolean;
  countedIn: CountedIn;
  moduleTitle: string | null;
  divider: CalendarEvent | undefined;
  fallbackUrl: string | null;
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const state = meetingState(meeting, now);
  const { six, presence, announced } = meeting;
  const named = presence?.topic ?? six?.activity ?? null;
  // Unnamed, only numbered ("Pertemuan 3") or just "Kuliah", with no module to name it: said in a quieter color.
  const placeholder = !moduleTitle && (!named || /^((pertemuan|meeting)\s*\d+|kuliah)$/i.test(named.trim()));
  const title = meetingTitle(t, meeting, moduleTitle);
  // Edunex's Presence window, when it isn't simply the meeting's time.
  const window =
    presence && (presence.opensAt !== meeting.start || presence.closesAt !== meeting.end) ? f.timeRange(presence.opensAt, presence.closesAt) : null;
  const presenceUrl = presence?.url ?? fallbackUrl;
  const future = meeting.start > now;
  // An open window asks for you (amber, primary) only where Edunex may be what counts; where SIX counts, or
  // without SIX (nobody can say), the strip above says it once and the row stays calm.
  const quiet = countedIn === "six" || countedIn === "noSix";

  let status: ReactNode = null;
  if (state === "present")
    status = (
      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-success-bg px-2 text-caption font-semibold text-success-fg">
        <Icons.CheckCircle className="size-3" weight="bold" />
        {t("meeting.state.present")}
      </span>
    );
  else if (state === "open")
    status = (
      <span
        className={cx(
          "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-caption font-semibold whitespace-nowrap",
          quiet ? "bg-fill text-muted" : "bg-warning-bg text-warning-fg",
        )}
      >
        <LiveDot className="scale-75" />
        <Meta truncate>
          {t("meeting.state.open")}
          {presence ? <span className="font-medium opacity-80">{f.countdown(presence.closesAt)}</span> : null}
        </Meta>
      </span>
    );
  // Not recorded in Edunex: a warning only where Edunex is what counts; where SIX
  // counts the intro says it once and the row stays quiet; without SIX, a plain fact.
  else if (state === "unmarked")
    status =
      countedIn === "six" ? (
        <span className="text-small text-faint">{t("meeting.done")}</span>
      ) : (
        <span className={cx("text-small", countedIn === "edunex" ? "font-medium text-warning-fg" : "text-faint")}>{t("meeting.edunexNotRecordedCounts")}</span>
      );
  else if (state === "recorded") status = <span className="text-small text-faint">{t("meeting.state.recorded")}</span>;
  else if (state === "held") status = <span className="text-small text-faint">{t("meeting.done")}</span>;
  else if (next)
    status = (
      <span className="inline-flex h-[22px] items-center rounded-full bg-info-bg px-2 text-caption font-semibold text-info-fg">{t("meeting.next")}</span>
    );

  return (
    <li className={cx(index > 0 && "border-t border-line")}>
      {divider && <PeriodDivider period={divider} />}
      <div className={cx("grid grid-cols-[132px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3", next && "bg-info-bg/30")}>
        <span className={cx("text-body tabular-nums", future && !next && "text-muted")}>
          <span className="block font-medium">
            {f.weekdayShort(meeting.start)}, {f.dayMonth(meeting.start)}
          </span>
          <span className="block text-small text-muted">{f.timeRange(meeting.start, meeting.end)}</span>
        </span>
        <span className="min-w-0 text-body">
          <span title={title} className={cx("line-clamp-2", placeholder ? "text-muted" : "font-medium", future && !next && !placeholder && "text-fg/80")}>
            {title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-small text-muted">
            {six?.room && (
              <span className="inline-flex items-center gap-1">
                <Icons.MapPin className="size-3" />
                {six.room}
              </span>
            )}
            {announced?.online && (
              <span className="inline-flex items-center gap-1">
                <Icons.Video className="size-3" />
                {announced.note ?? t("course.online")}
              </span>
            )}
            {window && <span>{t("meeting.window", { range: window })}</span>}
            {presence?.note && <span className="truncate">{presence.note}</span>}
            {announced && !presence && announced.note && !announced.online && <span>{announced.note}</span>}
            {meeting.notInSix && <span className="font-medium text-warning-fg">{t("meeting.notInSix")}</span>}
          </span>
        </span>
        <span className="flex items-center justify-end gap-2">
          {announced?.link && meeting.end > now && (
            <Button size="sm" icon={<Icons.Video className="size-3.5" />} onClick={() => open(announced.link!)}>
              {t("material.join")}
            </Button>
          )}
          {state === "open" && presenceUrl && (
            <Button variant={quiet ? "secondary" : "primary"} size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(presenceUrl)}>
              {t("course.recordInEdunex")}
            </Button>
          )}
          {status}
        </span>
      </div>
    </li>
  );
}
