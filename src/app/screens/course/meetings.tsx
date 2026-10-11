// The Pertemuan tab: SIX's timetable (official time and room) merged with
// EduNex Presence (the window and what EduNex recorded) and meetings
// announced only in EduNex text. Nothing here says "absent": SIX may count a
// meeting EduNex didn't record, and a meeting still to come isn't missed.
import { meetingState, type Meeting, type MeetingState } from "../../../core/course-meetings";
import { edunexCourseUrl } from "../../../core/links";
import { useOpenExternal } from "../../hooks";
import { useFormat, useNow, useT } from "../../i18n";
import { SixEmptyState } from "../../shell/source-status";
import { useStatus } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Card, EmptyState, LiveDot, SourceTag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import type { CoursePage } from "./data";

const STATE_TONE: Record<MeetingState, string> = {
  present: "bg-success-bg text-success-fg",
  recorded: "bg-neutral-bg text-neutral-fg",
  open: "bg-warning-bg text-warning-fg",
  upcoming: "bg-neutral-bg text-neutral-fg",
  unmarked: "bg-neutral-bg text-neutral-fg",
  held: "bg-neutral-bg text-neutral-fg",
};

export function MeetingsTab({ page }: { page: CoursePage }) {
  const t = useT();
  const { meetings, course, presence } = page;
  const noEdunexPresence = presence !== undefined && presence.length === 0;
  const sixSignedOut = useStatus("six").state === "signed-out";
  return (
    <div>
      {(course.attendance || noEdunexPresence) && (
        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-body text-muted">
          {course.attendance && (
            <span className="inline-flex items-center gap-1.5">
              <SourceTag source="six" />
              {t("course.attended", course.attendance)}
            </span>
          )}
          {noEdunexPresence && (
            <span className="inline-flex items-center gap-1.5">
              <SourceTag source="edunex" />
              {t("meeting.noEdunexPresence")}
            </span>
          )}
        </div>
      )}
      {meetings.length === 0 ? (
        sixSignedOut ? (
          <SixEmptyState icon={<Icons.Calendar className="size-5" />} title={t("meeting.noSix")} />
        ) : (
          <EmptyState icon={<Icons.Calendar className="size-5" />} title={t("meeting.none")} />
        )
      ) : (
        <Card className="overflow-hidden">
          <ol>
            {meetings.map((meeting, index) => (
              <MeetingRow key={meeting.key} meeting={meeting} index={index} fallbackUrl={course.edunex ? edunexCourseUrl(course.edunex.courseId) : null} />
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function MeetingRow({ meeting, index, fallbackUrl }: { meeting: Meeting; index: number; fallbackUrl: string | null }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const state = meetingState(meeting, now);
  const { six, presence, announced } = meeting;
  const title = presence?.topic ?? (announced ? t("meeting.number", { no: announced.number }) : null) ?? six?.activity ?? t("meeting.number", { no: index + 1 });
  // EduNex's Presence window, when it isn't simply the meeting's time.
  const window = presence && (presence.opensAt !== meeting.start || presence.closesAt !== meeting.end) ? f.timeRange(presence.opensAt, presence.closesAt) : null;
  const presenceUrl = presence?.url ?? fallbackUrl;
  return (
    <li className={cx("grid grid-cols-[36px_150px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3", index > 0 && "border-t border-line")}>
      <span className="text-small font-semibold text-faint tabular-nums">{String(index + 1).padStart(2, "0")}</span>
      <span className="text-body tabular-nums">
        <span className="block font-medium">
          {f.weekdayShort(meeting.start)}, {f.dayMonth(meeting.start)}
        </span>
        <span className="block text-small text-muted">{f.timeRange(meeting.start, meeting.end)}</span>
      </span>
      <span className="min-w-0 text-body">
        <span className="block truncate font-medium">{title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-small text-muted">
          {six?.room && (
            <span className="inline-flex items-center gap-1">
              <Icons.MapPin className="size-3" />
              {six.room}
            </span>
          )}
          {window && <span>{t("meeting.window", { range: window })}</span>}
          {presence?.note && <span className="truncate">{presence.note}</span>}
          {announced && !presence && <span>{announced.note ?? t("meeting.announced")}</span>}
          {meeting.notInSix && (
            <span className="inline-flex h-[18px] items-center rounded bg-warning-bg px-1.5 text-micro font-semibold text-warning-fg">{t("meeting.notInSix")}</span>
          )}
          {six && <SourceTag source="six" />}
          {(presence || announced) && <SourceTag source="edunex" />}
        </span>
      </span>
      <span className="flex items-center gap-2">
        {announced?.link && meeting.end > now && (
          <Button size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(announced.link!)}>
            {t("material.join")}
          </Button>
        )}
        {state === "open" && presenceUrl && (
          <Button variant="primary" size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(presenceUrl)}>
            {t("course.recordInEdunex")}
          </Button>
        )}
        <span className={cx("inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-caption font-semibold whitespace-nowrap", STATE_TONE[state])}>
          {state === "open" && <LiveDot className="scale-75" />}
          {state === "present" && <Icons.CheckCircle className="size-3" strokeWidth={2} />}
          {t(`meeting.state.${state}`)}
          {state === "open" && presence && <span className="font-medium opacity-80">· {f.countdown(presence.closesAt)}</span>}
        </span>
      </span>
    </li>
  );
}
