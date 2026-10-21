// The course page (#74): one course, its parent and child Edunex classes
// merged. The header says what it is and where attendance stands; under it
// what is happening now or next (and, for a course at risk, what that means
// today); then tabs: Modul (Edunex's table of contents with each module's
// Tasks and materials), Pertemuan, Tugas & Ujian, Nilai and Pengumuman.
import * as Tabs from "@radix-ui/react-tabs";
import { type ReactNode, useMemo, useState } from "react";
import { type AttendanceHealth, percent } from "../../core/attendance";
import { planOfflineFiles } from "../../core/course-materials";
import { clashes, type Meeting, openPresences, pinnedMeeting } from "../../core/course-meetings";
import { edunexCourseUrl, sixTimetableUrl } from "../../core/links";
import type { PresenceSession } from "../../core/models";
import { attendanceKey, attendanceSnoozable } from "../../core/snooze";
import { useAttendance } from "../attendance";
import { verdictLabel } from "../attendance-labels";
import { AttendanceSummary, CourseTarget } from "../attendance-parts";
import { useOpenExternal } from "../hooks";
import { type Format, type StringKey, type Translate, useFormat, useLang, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useRefresh } from "../shell/source-status";
import { SnoozeMenu } from "../snooze-menu";
import { useSnoozes } from "../snoozes";
import { useBridge, useDataset, useStatus } from "../store";
import { Button } from "../ui/controls";
import { CourseDot, EmptyState, LiveDot, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { Meta, Notice, Page, PageHeader } from "../ui/layout";
import { Menu } from "../ui/menu";
import { CountdownBar } from "../ui/meter";
import { NowCard, NowLine, NowZone } from "../ui/now-card";
import { toast } from "../ui/overlays";
import { TabBar } from "../ui/tabs";
import { type CoursePage, useCoursePage } from "./course/data";
import { GradesTab } from "./course/grades";
import { AnnouncementsTab, TasksTab } from "./course/lists";
import { MeetingsTab, meetingModuleTitle, meetingTitle, pageModules } from "./course/meetings";
import { ModulesTab } from "./course/modules";

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

  const loaded = page.materials !== undefined;
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
      <MeetingNow page={page} />
      <Tabs.Root value={current} onValueChange={(value) => setCurrent(value as Tab)}>
        <TabBar
          value={current}
          label={page.course.code}
          tabs={TABS.map((key) => ({ value: key, label: t(`course.tab.${key}` as StringKey), count: counts[key] }))}
          className="mt-8 border-b border-line"
        />
        <div className="pt-6">
          {/* Every tab keeps its panel while Edunex's part isn't here yet, so each tab still names the panel it controls. */}
          <Tabs.Content value="modules" className="focus-ring rounded-sm">
            {loaded ? <ModulesTab page={page} module={module} /> : <NotLoaded />}
          </Tabs.Content>
          <Tabs.Content value="meetings" className="focus-ring rounded-sm">
            {loaded ? <MeetingsTab page={page} /> : <NotLoaded />}
          </Tabs.Content>
          <Tabs.Content value="tasks" className="focus-ring rounded-sm">
            {loaded ? <TasksTab tasks={page.tasks} exams={page.exams} /> : <NotLoaded />}
          </Tabs.Content>
          <Tabs.Content value="announcements" className="focus-ring rounded-sm">
            {loaded ? (
              <AnnouncementsTab announcements={page.announcements} mainCourseId={page.course.edunex?.courseId ?? null} code={page.course.code} />
            ) : (
              <NotLoaded />
            )}
          </Tabs.Content>
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
    // The "⋯" stays at the top right at every width; only the meter wraps under the class line when the window is narrow.
    <div className="mb-6 flex items-start gap-4">
      <PageHeader
        className="mb-0 min-w-0 flex-1 items-start"
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
        actions={<AttendanceMeter page={page} />}
      />
      <MoreMenu page={page} />
    </div>
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
  // The meeting right below already shows the next one; say it here only when it doesn't.
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

const DAY = 86_400_000;

/**
 * When a Presence window closes, as the Student reads it: "tutup 23:00 (1 jam
 * 5 mnt lagi)" today; a window can stay open for days, so with its day when
 * it isn't today ("tutup besok, 23:00", "tutup Sen, 12 Okt, 23:00"), and how
 * long is left only while that's under a day.
 */
function closesLabel(t: Translate, f: Format, closesAt: number, now: number): string {
  const time = f.dayTime(closesAt);
  return closesAt - now < DAY ? t("course.closesAt", { time, left: f.countdown(closesAt) }) : t("course.closesOn", { time });
}

/**
 * What's on now or next. While a class is on or a Presence window is open, a
 * raised card: its time, what it is, where, and the one thing to do (record
 * attendance, join online), with the window's countdown under it. A window can
 * stay open long after its class, for days: with no class on, the card is then
 * about that class, and the next one keeps its quiet line under it. The class
 * going on shows only its own window; one still open from an earlier class is
 * a quiet line of its own under the card. Otherwise, the next meeting in one
 * quiet line under the header.
 */
function MeetingNow({ page }: { page: CoursePage }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const open = useOpenExternal();
  const attendance = useAttendance();
  const live = useStatus("edunex").state === "live";
  const modules = pageModules(page);
  const pinned = pinnedMeeting(page.meetings, now);
  const windows = openPresences(page.presence ?? [], now);
  const current = pinned?.current ? pinned.meeting : null;
  // The card's window: the class going on has only its own, never an earlier class's still open; with no class on, the one closing first.
  const presence = current ? (windows.find((p) => p.id === current.presence?.id) ?? null) : (windows[0] ?? null);
  const meetingOf = (p: PresenceSession) => page.meetings.find((m) => m.presence?.id === p.id) ?? null;
  // The card's class: the one going on, else the one the open window is for (not next week's, under its window).
  const meeting = current ?? (presence ? meetingOf(presence) : null);
  const next = pinned && !pinned.current && pinned.meeting !== meeting ? pinned.meeting : null;
  const countedIn = attendance?.courses.find((c) => c.course.code === page.course.code)?.health.countedIn;
  const courseUrl = page.course.edunex ? edunexCourseUrl(page.course.edunex.courseId) : null;
  const url = presence?.url ?? courseUrl;
  // Edunex's window is the thing to do only where it may be what counts: not where SIX counts, and
  // not loudly without SIX (nobody can say; it's worth doing just in case).
  const presenceCounts = countedIn !== "six" && countedIn !== "noSix";

  const linkOf = (m: Meeting) => (m.end > now ? (m.announced?.link ?? null) : null);
  const placeOf = (m: Meeting) => [
    m.six?.room ? (
      <span key="room" className="inline-flex items-center gap-1">
        <Icons.MapPin className="size-3.5" />
        {m.six.room}
      </span>
    ) : (
      ""
    ),
    m.announced?.online ? (
      <span key="online" className="inline-flex items-center gap-1">
        <Icons.Video className="size-3.5" />
        {t("course.online")}
      </span>
    ) : (
      ""
    ),
  ];
  const notInSixOf = (m: Meeting) => (m.notInSix ? <span className="text-warning-fg">{t("meeting.notInSix")}</span> : "");

  // Windows still open from earlier classes, each with its own class and close, under the card.
  const lines: ReactNode[] = windows
    .filter((p) => p !== presence)
    .map((p) => {
      const of = meetingOf(p);
      const href = p.url ?? courseUrl;
      return (
        <NowLine
          key={`p${p.id}`}
          icon={<Icons.Hand className="size-4" />}
          action={
            href ? (
              <Button size="sm" variant="ghost" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(href)}>
                {t("course.recordInEdunex")}
              </Button>
            ) : undefined
          }
        >
          <Meta>
            <span className="font-medium text-fg">{t("course.presenceStillOpen")}</span>
            <span className="tabular-nums">
              {f.relativeDay(of?.start ?? p.start)}, {f.timeRange(of?.start ?? p.start, of?.end ?? p.end)}
            </span>
            <span className="tabular-nums">{closesLabel(t, f, p.closesAt, now)}</span>
          </Meta>
        </NowLine>
      );
    });
  if (next) {
    const link = linkOf(next);
    const what = meetingModuleTitle(t, modules, next) ?? next.presence?.topic ?? next.six?.activity ?? null;
    lines.push(
      <NowLine
        key="next"
        icon={<Icons.CalendarClock className="size-4" />}
        action={
          link && f.dayOffset(next.start) === 0 ? (
            <Button size="sm" variant="ghost" icon={<Icons.Video className="size-3.5" />} onClick={() => open(link)}>
              {t("course.join")}
            </Button>
          ) : undefined
        }
      >
        <Meta>
          <span className="font-medium text-fg">{t("course.next")}</span>
          <span className="tabular-nums">
            {f.relativeDay(next.start)}, {f.timeRange(next.start, next.end)}
          </span>
          {placeOf(next)}
          {/* "Kuliah" is every class: only a topic says something. */}
          {what && !/^kuliah$/i.test(what) ? what : ""}
          {notInSixOf(next)}
        </Meta>
      </NowLine>,
    );
  }
  // Nothing on and no window open: at most the next meeting's line.
  if (!current && !presence) return lines[0] ?? null;

  const start = meeting?.start ?? presence!.start;
  const end = meeting?.end ?? presence!.end;
  const link = meeting ? linkOf(meeting) : null;
  const upcoming = meeting !== null && meeting.start > now;
  // A class that's over, on an earlier day: its day, so the time beside it isn't read as today's.
  const day = meeting && !current && !upcoming && f.dayOffset(meeting.start) !== 0 ? <span className="tabular-nums">{f.relativeDay(meeting.start)}</span> : "";
  const facts = meeting ? [day, ...placeOf(meeting), notInSixOf(meeting)] : [];
  const card = (
    <NowCard
      raised
      time={{ start: f.time(start), end: f.time(end) }}
      eyebrow={
        current ? (
          <span className="inline-flex items-center gap-2 text-success-fg">
            {live && <LiveDot />}
            <Meta>{t("course.nowUntil", { time: f.time(end) })}</Meta>
          </span>
        ) : upcoming ? (
          <Meta className="text-muted">
            {t("course.next")}
            {f.relativeDay(meeting.start)}
          </Meta>
        ) : (
          <span className="text-muted">{t("course.presenceOpen")}</span>
        )
      }
      // Named as its row on the Pertemuan tab names it ("Pertemuan 3"), never just "Kuliah" when there's more to say.
      title={
        <p className="text-title font-semibold">
          {meeting ? meetingTitle(t, meeting, meetingModuleTitle(t, modules, meeting)) : (presence?.topic ?? t("meeting.untitled"))}
        </p>
      }
      meta={facts.some(Boolean) ? <Meta>{facts}</Meta> : undefined}
      note={!presence && meeting?.presence?.note ? <p className="mt-1 truncate text-small text-muted">{meeting.presence.note}</p> : undefined}
      action={
        link || (presence && url) ? (
          <>
            {link && (
              <Button variant={presence ? "secondary" : "primary"} icon={<Icons.Video className="size-3.5" />} onClick={() => open(link)}>
                {t("course.join")}
              </Button>
            )}
            {presence && url && (
              <Button variant={presenceCounts ? "primary" : "secondary"} icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => open(url)}>
                {t("course.recordInEdunex")}
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {presence && (
        <NowZone>
          <div className="flex max-w-[560px] items-center gap-3 text-small">
            {/* Said here unless the line above already says it. */}
            {(current || upcoming) && <span className="shrink-0 font-semibold">{t("course.presenceOpen")}</span>}
            {/* The same shrinking countdown as on Presensi and Beranda. */}
            <CountdownBar
              className="min-w-16 flex-1"
              opensAt={presence.opensAt}
              closesAt={presence.closesAt}
              now={now}
              label={closesLabel(t, f, presence.closesAt, now)}
            />
          </div>
          {!presenceCounts && <p className="mt-1.5 text-small text-muted">{t(countedIn === "noSix" ? "course.presenceNoSix" : "course.presenceCountsSix")}</p>}
        </NowZone>
      )}
    </NowCard>
  );
  return lines.length ? (
    <>
      {card}
      <div className="mt-3">{lines}</div>
    </>
  ) : (
    card
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
