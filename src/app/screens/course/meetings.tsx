// The Pertemuan tab: SIX's timetable (official time and room) merged with
// EduNex Presence (the window and what EduNex recorded) and meetings
// announced only in EduNex text. The attendance story is told honestly: SIX's
// count is the official one and comes first; EduNex's record per meeting is a
// quiet second line, and a meeting EduNex didn't record never reads as an
// absence where SIX is (or, signed out of SIX, may be) the one that counts.
// A meeting carries one number only: the name EduNex or SIX gives it.
import type { ReactNode } from "react";
import { meetingState, nextMeetingIndex, type Meeting, wibDay } from "../../../core/course-meetings";
import { edunexCourseUrl } from "../../../core/links";
import type { CalendarEvent } from "../../../core/models";
import { dayStart } from "../../../core/schedule";
import type { CountedIn } from "../../../core/attendance";
import { useAttendance } from "../../attendance";
import { useOpenExternal } from "../../hooks";
import { useFormat, useNow, useT } from "../../i18n";
import { SixEmptyState, useSignIn } from "../../shell/source-status";
import { useDataset, useStatus } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { EmptyState, LiveDot } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { budgetLabel, STATE_TONE } from "../presence";
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
  const periods = (calendar?.events ?? []).filter((e) => e.kind === "uts" || e.kind === "uas");
  // The exam period a meeting falls in, said once, before its first meeting.
  const periodOf = (meeting: Meeting) => periods.find((p) => wibDay(meeting.start) >= p.firstDay && wibDay(meeting.start) <= p.lastDay);

  return (
    <div className="max-w-[960px]">
      <div className="mb-5">
        {course.attendance && course.attendance.held > 0 ? (
          <p className="text-lead">
            <span className="font-semibold">{t("meeting.official", course.attendance)}</span>
            {health && attendance && health.state !== "unknown" && <span className={cx("font-semibold", STATE_TONE[health.state])}> · {budgetLabel(t, health, attendance.target)}</span>}
          </p>
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

/** Signed out of SIX: EduNex's own tally as a fact, and why it may not be the count that matters. */
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
  divider,
  fallbackUrl,
}: {
  meeting: Meeting;
  index: number;
  next: boolean;
  countedIn: CountedIn;
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
  // Unnamed, or only numbered ("Pertemuan 3"): said in a quieter color.
  const placeholder = !named || /^(pertemuan|meeting)\s*\d+$/i.test(named.trim());
  const title = named ?? (announced ? t("meeting.number", { no: announced.number }) : six?.activity || t("meeting.untitled"));
  // EduNex's Presence window, when it isn't simply the meeting's time.
  const window = presence && (presence.opensAt !== meeting.start || presence.closesAt !== meeting.end) ? f.timeRange(presence.opensAt, presence.closesAt) : null;
  const presenceUrl = presence?.url ?? fallbackUrl;
  const future = meeting.start > now;

  let status: ReactNode = null;
  if (state === "present")
    status = (
      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-success-bg px-2 text-caption font-semibold text-success-fg">
        <Icons.CheckCircle className="size-3" strokeWidth={2} />
        {t("meeting.state.present")}
      </span>
    );
  else if (state === "open")
    status = (
      <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-warning-bg px-2 text-caption font-semibold whitespace-nowrap text-warning-fg">
        <LiveDot className="scale-75" />
        {t("meeting.state.open")}
        {presence && <span className="font-medium opacity-80">· {f.countdown(presence.closesAt)}</span>}
      </span>
    );
  // Not recorded in EduNex: a warning only where EduNex is what counts; where SIX
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
    status = <span className="inline-flex h-[22px] items-center rounded-full bg-info-bg px-2 text-caption font-semibold text-info-fg">{t("meeting.next")}</span>;

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
          <span className={cx("block truncate", placeholder ? "text-muted" : "font-medium", future && !next && !placeholder && "text-fg/80")}>{title}</span>
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
            <Button variant="primary" size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(presenceUrl)}>
              {t("course.recordInEdunex")}
            </Button>
          )}
          {status}
        </span>
      </div>
    </li>
  );
}
