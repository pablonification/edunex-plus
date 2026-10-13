// The course page (#74): one course, its parent and child Edunex classes
// merged. The header says what it is and where attendance stands; under it
// what is happening now or next (and, for a course at risk, what that means
// today); then tabs: Modul (Edunex's table of contents with each module's
// Tasks and materials), Pertemuan, Tugas & Ujian, Nilai and Pengumuman.
import * as Tabs from "@radix-ui/react-tabs";
import { useMemo, useState } from "react";
import { type AttendanceHealth, percent } from "../../core/attendance";
import { planOfflineFiles } from "../../core/course-materials";
import { clashes, openPresence, pinnedMeeting } from "../../core/course-meetings";
import { edunexCourseUrl } from "../../core/links";
import { sixTimetableUrl } from "../../core/schedule";
import { attendanceKey, attendanceSnoozable } from "../../core/snooze";
import { useAttendance } from "../attendance";
import { verdictLabel } from "../attendance-labels";
import { AttendanceSummary, CourseTarget } from "../attendance-parts";
import { useOpenExternal } from "../hooks";
import { type StringKey, useFormat, useLang, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useRefresh } from "../shell/source-status";
import { SnoozeMenu } from "../snooze-menu";
import { useSnoozes } from "../snoozes";
import { useBridge, useDataset, useStatus } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { CourseDot, EmptyState, LiveDot, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { Meta, Notice, Page, PageHeader } from "../ui/layout";
import { Menu } from "../ui/menu";
import { CountdownBar } from "../ui/meter";
import { toast } from "../ui/overlays";
import { type CoursePage, useCoursePage } from "./course/data";
import { GradesTab } from "./course/grades";
import { AnnouncementsTab, TasksTab } from "./course/lists";
import { MeetingsTab, meetingModuleTitle, pageModules } from "./course/meetings";
import { ModulesTab } from "./course/modules";

export const ready = true;

const TABS = ["modules", "meetings", "tasks", "grades", "announcements"] as const;
type Tab = (typeof TABS)[number];

/** `module`: open the Modul tab on this Edunex module (search and alerts name one). */
export function CourseScreen({ code, tab, module }: { code: string; tab?: string; module?: number }) {
  const t = useT();
  const page = useCoursePage(code);
  const [current, setCurrent] = useState<Tab>(module === undefined && (TABS as readonly string[]).includes(tab ?? "") ? (tab as Tab) : "modules");

  if (page === undefined) return <Loading />;
  if (page === null)
    return (
      <Page>
        <EmptyState icon={<Icons.BookOpen className="size-5" />} title={t("course.notFound")} />
      </Page>
    );

  const counts: Partial<Record<Tab, number>> = {
    modules: page.outline?.modules.length,
    meetings: page.meetings.length,
    tasks: page.tasks.length + page.exams.length,
    announcements: page.announcements?.length || undefined,
  };

  return (
    <Page width="wide">
      <Header page={page} />
      <RiskStrip page={page} />
      <NowStrip page={page} />
      <Tabs.Root value={current} onValueChange={(value) => setCurrent(value as Tab)}>
        <Tabs.List aria-label={page.course.code} className="mt-8 flex gap-6 border-b border-line">
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
              {counts[key] !== undefined && <span className="text-small font-medium text-faint tabular-nums">{counts[key]}</span>}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="pt-6">
          {page.materials === undefined && current !== "grades" ? (
            <NotLoaded />
          ) : (
            <>
              <Tabs.Content value="modules" className="focus-ring rounded-sm">
                <ModulesTab page={page} module={module} />
              </Tabs.Content>
              <Tabs.Content value="meetings" className="focus-ring rounded-sm">
                <MeetingsTab page={page} />
              </Tabs.Content>
              <Tabs.Content value="tasks" className="focus-ring rounded-sm">
                <TasksTab tasks={page.tasks} exams={page.exams} />
              </Tabs.Content>
              <Tabs.Content value="announcements" className="focus-ring rounded-sm">
                <AnnouncementsTab announcements={page.announcements} mainCourseId={page.course.edunex?.courseId ?? null} code={page.course.code} />
              </Tabs.Content>
            </>
          )}
          <Tabs.Content value="grades" className="focus-ring rounded-sm">
            <GradesTab page={page} onOpenModules={() => setCurrent("modules")} />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </Page>
  );
}

function Header({ page }: { page: CoursePage }) {
  const t = useT();
  const { course, outline } = page;
  const sks = course.sks ?? outline?.credits ?? null;
  return (
    <PageHeader
      className="mb-6 items-start"
      eyebrow={
        <span className="flex items-center gap-1.5">
          <CourseDot color={course.color} className="size-2" />
          <span className="font-semibold text-fg/80">{course.code}</span>
        </span>
      }
      title={course.name}
      description={
        <Meta className="text-body">
          {course.classNo ? t("course.class", { no: course.classNo }) : ""}
          {sks !== null ? t("course.sks", { count: sks }) : ""}
          {outline?.lecturer ? (
            <span className="inline-flex items-center gap-1.5">
              <Icons.User className="size-3.5" aria-label={t("course.lecturer")} />
              {outline.lecturer}
            </span>
          ) : (
            ""
          )}
        </Meta>
      }
      actions={
        <div className="flex items-start gap-4">
          <AttendanceMeter page={page} />
          <MoreMenu page={page} />
        </div>
      }
    />
  );
}

/** SIX's count against the course's target, what's left before it in words, and the target, a click from changing it (#85). */
function AttendanceMeter({ page }: { page: CoursePage }) {
  const t = useT();
  const attendance = useAttendance();
  const health = attendance?.courses.find((c) => c.course.code === page.course.code)?.health;
  const banner = useBannerShows(page.course.code, health);
  if (!health?.held) return null;
  return (
    <AttendanceSummary
      className="w-[260px] pt-0.5"
      health={health}
      // With no room left the banner below says it, as its title; put off with "Ingatkan nanti", the words are back here.
      words={banner ? null : verdictLabel(t, health)}
      aside={<CourseTarget code={page.course.code} className="shrink-0" />}
    />
  );
}

/**
 * The attendance banner shows with no room left or the target out of reach,
 * unless it's put off with "Ingatkan nanti" (here or on Beranda: they share
 * it) until its time or a new count; the header meter says it meanwhile.
 */
function useBannerShows(code: string, health: AttendanceHealth | undefined): boolean {
  const { snoozed } = useSnoozes();
  if (!health || (health.state !== "out" && health.state !== "none")) return false;
  return !snoozed(attendanceKey(code, health));
}

/** The rare actions: save the files for offline, open the official pages. */
function MoreMenu({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const bridge = useBridge();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const { course } = page;
  const [busy, setBusy] = useState(false);
  const plan = useMemo(
    () =>
      course.edunex
        ? planOfflineFiles({ code: course.code, name: course.name, mainCourseId: course.edunex.courseId }, page.outline, page.materials ?? [], lang)
        : null,
    [course, page.outline, page.materials, lang],
  );
  const save = async (pick: boolean) => {
    setBusy(true);
    try {
      const result = await bridge.invoke("course.saveOffline", { code: course.code, pick });
      if (result.folder === null) return;
      if (result.saved + result.kept + result.failed === 0) toast(t("offline.nothing"));
      else if (result.failed > 0) toast(t("offline.failed", { count: result.failed }), "danger");
      else toast(t("offline.done", { count: result.saved, saved: result.saved, kept: result.kept }), "success");
    } catch (error) {
      toast(t("error.action", { message: error instanceof Error ? error.message : String(error) }), "danger");
    } finally {
      setBusy(false);
    }
  };
  const files = plan?.files ?? [];
  const size = files.reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0);
  const items = [];
  if (plan) {
    const hint =
      files.length === 0
        ? t("offline.noneYet")
        : size > 0
          ? t("offline.files", { count: files.length, size: f.fileSize(size) })
          : t("offline.filesNoSize", { count: files.length });
    items.push(
      {
        label: t("offline.save"),
        hint,
        icon: busy ? <Icons.Loader className="size-4 animate-spin" /> : <Icons.FolderDown className="size-4" />,
        disabled: busy || files.length === 0,
        onSelect: () => void save(false),
      },
      { label: t("offline.pick"), icon: <Icons.FolderDown className="size-4" />, disabled: busy || files.length === 0, onSelect: () => void save(true) },
    );
  }
  if (course.edunex)
    items.push({
      label: t("course.openEdunex"),
      icon: <Icons.ArrowUpRight className="size-4" />,
      onSelect: () => open(edunexCourseUrl(course.edunex!.courseId)),
    });
  if (page.inSix && student)
    items.push({ label: t("course.openSix"), icon: <Icons.ArrowUpRight className="size-4" />, onSelect: () => open(sixTimetableUrl(student)) });
  if (!items.length) return null;
  return <Menu label={t("course.more")} items={items} />;
}

/**
 * For a course in trouble (no absences left, or the target out of reach):
 * what that means now, in one place. The next meeting, and a clash with
 * another class that day. One absence left is said by the header's meter,
 * not by a banner.
 */
function RiskStrip({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const attendance = useAttendance();
  const schedule = useDataset("six.schedule");
  const health = attendance?.courses.find((c) => c.course.code === page.course.code)?.health;
  const shows = useBannerShows(page.course.code, health);
  if (!health || !attendance || !shows) return null;
  const later = attendanceSnoozable(page.course.code, health);
  const next = page.meetings.find((m) => m.end > now && !m.notInSix);
  const clash = next ? clashes(next, page.course.code, schedule ?? [])[0] : undefined;
  // The strip right below already shows the next meeting; say it here only when it doesn't.
  const nextShownBelow = next !== undefined && pinnedMeeting(page.meetings, now)?.meeting.key === next.key;
  const out = health.state === "out";
  const title = verdictLabel(t, health);
  return (
    <Notice
      tone={out ? "danger" : "warning"}
      className="mb-4"
      title={title}
      action={
        <Button size="sm" onClick={() => go({ screen: "presence" })}>
          {t("course.risk.seePresence")}
        </Button>
      }
      snooze={<SnoozeMenu item={later} name={`${page.course.code}: ${title}`} words onTone />}
    >
      {[
        out ? t("course.risk.best", { best: percent(health.best ?? 0) }) : noneLeft(t, f, health, attendance.lastDay),
        next && !nextShownBelow
          ? t("course.risk.next", {
              when: `${f.relativeDay(next.start)}, ${f.timeRange(next.start, next.end)}`,
              room: next.six?.room ? t("course.risk.room", { room: next.six.room }) : "",
            })
          : "",
        // The minutes the two classes share, as Beranda and Jadwal say it.
        next && clash
          ? t("course.risk.clash", { code: clash.courseCode, time: f.timeRange(Math.max(next.start, clash.start), Math.min(next.end, clash.end)) })
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    </Notice>
  );
}

/** "7 pertemuan lagi sampai 4 Des: hadiri semuanya agar tetap 80%." ("Sekitar" when part of it is the weekly slot carried on.) */
function noneLeft(t: ReturnType<typeof useT>, f: ReturnType<typeof useFormat>, health: AttendanceHealth, lastDay: string | null): string {
  const { count, estimated } = health.left;
  // The sure meetings alone fall short: one that may not run has to.
  if (health.needsUncertain) return t("course.risk.noneIfRuns", { target: health.target });
  if (count === 0) return "";
  if (!lastDay) return t("course.risk.noneNoDate", { target: health.target });
  const date = f.dayMonth(Date.parse(`${lastDay}T12:00:00+07:00`));
  return t(estimated ? "course.risk.noneAbout" : "course.risk.none", { count, date, target: health.target });
}

/**
 * What's happening now, or next, in two fixed lines: the class and its room;
 * then the one thing to do (record attendance while Presence is open, join an
 * online meeting).
 */
function NowStrip({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const attendance = useAttendance();
  const live = useStatus("edunex").state === "live";
  const pinned = pinnedMeeting(page.meetings, now);
  const presence = openPresence(page.presence ?? [], now);
  if (!pinned && !presence) return null;
  const meeting = pinned?.meeting;
  const countedIn = attendance?.courses.find((c) => c.course.code === page.course.code)?.health.countedIn;
  const url = presence?.url ?? (page.course.edunex ? edunexCourseUrl(page.course.edunex.courseId) : null);
  const link = meeting?.announced?.link ?? null;
  const online = meeting?.announced?.online ?? false;
  // Edunex's window is the thing to do only where it may be what counts: not where SIX counts, and
  // not loudly without SIX (nobody can say; it's worth doing just in case).
  const presenceCounts = countedIn !== "six" && countedIn !== "noSix";
  const what = meeting ? (meetingModuleTitle(t, pageModules(page), meeting) ?? meeting.presence?.topic ?? meeting.six?.activity ?? null) : null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-edge bg-raised px-5 py-3.5 shadow-card"
      style={{ boxShadow: `inset 3px 0 0 ${page.course.color}` }}
    >
      <div className="min-w-0 flex-1">
        {meeting && (
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-body">
            {pinned.current ? (
              <span className="inline-flex items-center gap-2 font-semibold text-success-fg">
                {live && <LiveDot />}
                {t("course.now")}
              </span>
            ) : (
              <span className="font-semibold text-muted">{t("course.next")}</span>
            )}
            <Meta className="font-medium">
              <span className="tabular-nums">
                {f.relativeDay(meeting.start)}, {f.timeRange(meeting.start, meeting.end)}
              </span>
              {meeting.six?.room ? (
                <span className="inline-flex items-center gap-1">
                  <Icons.MapPin className="size-3.5 text-muted" />
                  {meeting.six.room}
                </span>
              ) : (
                ""
              )}
              {online ? (
                <span className="inline-flex items-center gap-1 text-muted">
                  <Icons.Video className="size-3.5" />
                  {t("course.online")}
                </span>
              ) : (
                ""
              )}
              {what ? <span className="font-normal text-muted">{what}</span> : ""}
              {meeting.notInSix ? <span className="text-small text-warning-fg">{t("meeting.notInSix")}</span> : ""}
            </Meta>
          </p>
        )}
        {presence ? (
          <div className="mt-1.5 flex max-w-[520px] items-center gap-3 text-small">
            <span className="shrink-0 font-semibold">{t("course.presenceOpen")}</span>
            {/* The same shrinking countdown as on Presensi and Beranda. */}
            <CountdownBar
              className="min-w-16 flex-1"
              opensAt={presence.opensAt}
              closesAt={presence.closesAt}
              now={now}
              label={t("course.closesAt", { time: f.time(presence.closesAt), left: f.countdown(presence.closesAt) })}
            />
          </div>
        ) : (
          meeting?.presence?.note && <p className="mt-1 truncate text-small text-muted">{meeting.presence.note}</p>
        )}
        {presence && !presenceCounts && (
          <p className="mt-1 text-small text-muted">{t(countedIn === "noSix" ? "course.presenceNoSix" : "course.presenceCountsSix")}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {link && meeting && meeting.end > now && (
          <Button variant={presence ? "secondary" : "primary"} icon={<Icons.Video className="size-3.5" />} onClick={() => open(link)}>
            {t("course.join")}
          </Button>
        )}
        {presence && url && (
          <Button variant={presenceCounts ? "primary" : "secondary"} icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(url)}>
            {t("course.recordInEdunex")}
          </Button>
        )}
      </div>
    </div>
  );
}

function NotLoaded() {
  const t = useT();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  if (status.state === "connecting" || status.state === "live")
    return (
      <div className="grid grid-cols-[248px_minmax(0,1fr)] gap-8" aria-busy="true">
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/2" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
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
    <Page width="wide">
      <div aria-busy="true">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <Skeleton className="mt-3 h-3 w-1/3" />
        <Skeleton className="mt-8 h-16 w-full" />
        <Skeleton className="mt-8 h-10 w-full" />
      </div>
    </Page>
  );
}
