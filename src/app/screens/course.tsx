// The course page (#74): one course, its parent and child EduNex classes
// merged. The header (code, class, SKS, lecturer, attendance) and the meeting
// going on now or next, then tabs: Modul (EduNex's table of contents with
// each module's Tasks and materials), Pertemuan, Tugas & Ujian, Nilai and
// Pengumuman.
import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { openPresence, pinnedMeeting } from "../../core/course-meetings";
import { edunexCourseUrl } from "../../core/links";
import { useAttendance } from "../attendance";
import { useOpenExternal } from "../hooks";
import { useFormat, useNow, useT, type StringKey } from "../i18n";
import { SourceNotice, useRefresh } from "../shell/source-status";
import { useBridge, useStatus } from "../store";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { Bar, CourseCode, EmptyState, LiveDot, Skeleton, SourceTag } from "../ui/display";
import { Icons } from "../ui/icons";
import { toast, Tooltip } from "../ui/overlays";
import { type CoursePage, useCoursePage } from "./course/data";
import { GradesTab } from "./course/grades";
import { AnnouncementsTab, TasksTab } from "./course/lists";
import { MeetingsTab } from "./course/meetings";
import { ModulesTab } from "./course/modules";
import { budgetLabel, STATE_TONE } from "./presence";

export const ready = true;

const TABS = ["modules", "meetings", "tasks", "grades", "announcements"] as const;
type Tab = (typeof TABS)[number];

export function CourseScreen({ code, tab }: { code: string; tab?: string }) {
  const t = useT();
  const page = useCoursePage(code);
  const [current, setCurrent] = useState<Tab>((TABS as readonly string[]).includes(tab ?? "") ? (tab as Tab) : "modules");

  if (page === undefined) return <Loading />;
  if (page === null)
    return (
      <div className="mx-auto max-w-[1080px] px-10 pt-7">
        <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("course.notFound")} />
      </div>
    );

  const counts: Partial<Record<Tab, number>> = {
    modules: page.outline?.modules.length,
    meetings: page.meetings.length,
    tasks: page.tasks.length + (page.exams?.length ?? 0),
    announcements: page.announcements?.length,
  };

  return (
    <div className="mx-auto max-w-[1180px] px-10 pt-7 pb-20">
      <Header page={page} />
      <SourceNotice source="edunex" hasData={page.materials !== undefined} />
      <PinnedMeeting page={page} />
      <Tabs.Root value={current} onValueChange={(value) => setCurrent(value as Tab)}>
        <Tabs.List aria-label={page.course.code} className="mt-6 flex gap-6 border-b border-line">
          {TABS.map((key) => (
            <Tabs.Trigger
              key={key}
              value={key}
              className={cx(
                "focus-ring relative -mb-px flex h-10 items-center gap-1.5 rounded-t-sm border-b-2 text-body font-medium transition-colors duration-150",
                "border-transparent text-muted hover:text-fg data-[state=active]:border-fg data-[state=active]:text-fg",
              )}
            >
              {t(`course.tab.${key}` as StringKey)}
              {counts[key] !== undefined && <span className="rounded-full bg-fill px-1.5 text-micro font-semibold text-muted tabular-nums">{counts[key]}</span>}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="pt-6">
          {page.materials === undefined && current !== "grades" ? (
            <NotLoaded />
          ) : (
            <>
              <Tabs.Content value="modules" className="focus-ring rounded-sm">
                <ModulesTab page={page} />
              </Tabs.Content>
              <Tabs.Content value="meetings" className="focus-ring rounded-sm">
                <MeetingsTab page={page} />
              </Tabs.Content>
              <Tabs.Content value="tasks" className="focus-ring rounded-sm">
                <TasksTab tasks={page.tasks} exams={page.exams} />
              </Tabs.Content>
              <Tabs.Content value="announcements" className="focus-ring rounded-sm">
                <AnnouncementsTab announcements={page.announcements} mainCourseId={page.course.edunex?.courseId ?? null} />
              </Tabs.Content>
            </>
          )}
          <Tabs.Content value="grades" className="focus-ring rounded-sm">
            <GradesTab page={page} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </div>
  );
}

function Header({ page }: { page: CoursePage }) {
  const t = useT();
  const open = useOpenExternal();
  const { course, outline } = page;
  const sks = course.sks ?? outline?.credits ?? null;
  const attendance = course.attendance;
  return (
    <header className="flex items-start justify-between gap-8">
      <div className="min-w-0">
        <CourseCode code={course.code} color={course.color} className="text-small" />
        <h1 className="mt-2 text-display leading-[1.15] font-semibold tracking-[-0.02em]">{course.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted">
          {course.classNo && <span>{t("course.class", { no: course.classNo })}</span>}
          {sks !== null && (
            <>
              <span className="text-faint">·</span>
              <span>{t("course.sks", { count: sks })}</span>
            </>
          )}
          {outline?.lecturer && (
            <>
              <span className="text-faint">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Icons.User className="size-3.5" aria-label={t("course.lecturer")} />
                {outline.lecturer}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-start gap-5">
        {attendance && attendance.held > 0 && (
          <div className="w-[180px]">
            <p className="flex items-baseline justify-between text-small font-medium text-muted">
              <span className="inline-flex items-center gap-1.5">
                {t("course.attendance")} <SourceTag source="six" />
              </span>
              <span className="text-lead font-semibold text-fg tabular-nums">
                {attendance.attended}/{attendance.held}
              </span>
            </p>
            <Bar className="mt-1.5" value={attendance.attended / attendance.held} color={course.color} label={t("course.attended", attendance)} />
            <AbsencesLeft code={course.code} />
          </div>
        )}
        {course.edunex && <SaveOffline code={course.code} />}
        {course.edunex && (
          <Button icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(edunexCourseUrl(course.edunex!.courseId))}>
            {t("source.edunex")}
          </Button>
        )}
      </div>
    </header>
  );
}

/** What SIX's count leaves before the Student's attendance target (#85). */
function AbsencesLeft({ code }: { code: string }) {
  const t = useT();
  const attendance = useAttendance();
  const health = attendance?.courses.find((c) => c.course.code === code)?.health;
  if (!health || health.state === "unknown") return null;
  return <p className={cx("mt-1 text-caption font-semibold", STATE_TONE[health.state])}>{budgetLabel(t, health, attendance.target)}</p>;
}

/** Saves the course's files by module, to Documents/Edunex Plus or a folder the Student picks. */
function SaveOffline({ code }: { code: string }) {
  const t = useT();
  const bridge = useBridge();
  const [busy, setBusy] = useState(false);
  const save = async (pick: boolean) => {
    setBusy(true);
    try {
      const result = await bridge.invoke("course.saveOffline", { code, pick });
      if (result.folder === null) return;
      if (result.saved + result.kept + result.failed === 0) toast(t("offline.nothing"));
      else if (result.failed > 0) toast(t("offline.failed", { count: result.failed }), "danger");
      else toast(t("offline.done", { count: result.saved, saved: result.saved, kept: result.kept }));
    } catch (error) {
      toast(t("error.action", { message: error instanceof Error ? error.message : String(error) }), "danger");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center">
      <Button busy={busy} icon={<Icons.FolderDown className="size-3.5" />} onClick={() => void save(false)} className="rounded-r-none">
        {t("offline.save")}
      </Button>
      <Tooltip content={t("offline.pick")}>
        <IconButton label={t("offline.pick")} disabled={busy} onClick={() => void save(true)} className="rounded-l-none border border-l-0 border-edge bg-surface">
          <Icons.ChevronDown className="size-3.5" />
        </IconButton>
      </Tooltip>
    </div>
  );
}

function PinnedMeeting({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const pinned = pinnedMeeting(page.meetings, now);
  const presence = openPresence(page.presence ?? [], now);
  if (!pinned && !presence) return null;
  const meeting = pinned?.meeting;
  const url = presence?.url ?? (page.course.edunex ? edunexCourseUrl(page.course.edunex.courseId) : null);
  return (
    <div className="mt-5 flex items-center gap-6 rounded-xl border border-line bg-fill/60 px-5 py-3.5" style={{ borderLeft: `3px solid ${page.course.color}` }}>
      {meeting && (
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-small font-semibold">
            {pinned.current ? (
              <>
                <LiveDot />
                <span className="text-success-fg">{t("course.now")}</span>
              </>
            ) : (
              <span className="text-muted">{t("course.next")}</span>
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-body font-medium">
            <span>
              {f.relativeDay(meeting.start)}, {f.timeRange(meeting.start, meeting.end)}
            </span>
            {meeting.six?.room && (
              <span className="inline-flex items-center gap-1.5">
                <Icons.MapPin className="size-3.5" />
                {meeting.six.room}
              </span>
            )}
            {(meeting.presence?.topic ?? meeting.six?.activity) && <span className="text-muted">{meeting.presence?.topic ?? meeting.six?.activity}</span>}
            {meeting.notInSix && <span className="text-small text-warning-fg">{t("meeting.notInSix")}</span>}
          </p>
        </div>
      )}
      {presence && (
        <div className={cx("flex shrink-0 items-center gap-4", !meeting && "flex-1 justify-between")}>
          <div className="w-[200px]">
            <p className="flex items-baseline justify-between gap-2 text-small">
              <span className="font-semibold">{t("course.presenceOpen")}</span>
              <span className="text-muted tabular-nums">{t("course.closesIn", { time: f.countdown(presence.closesAt) })}</span>
            </p>
            <Bar
              className="mt-1.5"
              value={(now - presence.opensAt) / Math.max(1, presence.closesAt - presence.opensAt)}
              color={page.course.color}
              label={t("course.presenceOpen")}
            />
            {presence.note && <p className="mt-1 truncate text-caption text-muted">{presence.note}</p>}
          </div>
          {url && (
            <Button variant="primary" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(url)}>
              {t("course.recordInEdunex")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function NotLoaded() {
  const t = useT();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  if (status.state === "connecting" || status.state === "live")
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  return (
    <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("course.unavailable")}>
      {status.state !== "expired" && status.state !== "signed-out" && (
        <Button size="sm" busy={busy} onClick={() => void refresh("edunex")}>
          {t("action.tryAgain")}
        </Button>
      )}
    </EmptyState>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-[1080px] px-10 pt-7" aria-busy="true">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-7 w-2/3" />
      <Skeleton className="mt-3 h-3 w-1/3" />
      <Skeleton className="mt-8 h-10 w-full" />
    </div>
  );
}
