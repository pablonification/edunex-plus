// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": Beranda (Home).
// Not a dashboard of lists: the first thing is what EduNex and SIX need from
// the Student right now, worked out from both. Then today, then what changed.
import type { JSX } from "react";
import type { ClassSession, Course } from "./data";
import { Icons } from "./icons";
import {
  actions,
  attendanceHealth,
  changeFeed,
  clashes,
  lecturePeriod,
  offTimetable,
  scheduleChanges,
  taskSignals,
  type ChangeEvent,
} from "./variant-d-insights";
import type { VariantProps } from "./variant-props";
import {
  ActionRow,
  BUDGET_TONE,
  Bar,
  CourseCode,
  CourseDot,
  LiveDot,
  SectionTitle,
  SourceTag,
  StatusGlyph,
  budgetText,
  courseOf,
  currentSession,
  cx,
  nextSession,
  openTasks,
  sessionsOn,
  termText,
  ui,
  useDSettings,
} from "./variant-d-ui";

const WEEK = 7 * 86_400_000;

export function Home(p: VariantProps) {
  const { data, now, f, tr } = p;
  const { attendanceTarget } = useDSettings();
  const nowIso = now.toISOString();
  const list = actions(p, attendanceTarget);
  const period = lecturePeriod(data, now);
  const week = period ? Math.floor((now.getTime() - Date.parse(period.start)) / WEEK) + 1 : null;
  const weeks = period ? Math.ceil((Date.parse(period.end) - Date.parse(period.start)) / WEEK) : null;
  const uts = data.academicCalendar.find((e) => e.key === "uts" && new Date(e.end) >= now);

  return (
    <div className="mx-auto max-w-[1080px] px-10 pt-7 pb-20">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className={cx("text-[13px] font-medium", ui.muted)}>
            {f.dateLong(nowIso)} · {termText(tr, data.student.termLabel)}
            {week && weeks ? tr({ en: ` · Week ${week} of ${weeks}`, id: ` · Minggu ke-${week} dari ${weeks}` }) : ""}
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.02em]">
            {f.greeting()}, {data.student.firstName}
          </h1>
        </div>
        {uts && f.dayOffset(uts.start) > 0 && f.dayOffset(uts.start) <= 14 && (
          <p className={cx("flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-medium", ui.fill)}>
            <SourceTag source="ITB" />
            {tr({
              en: `Midterm week starts ${f.weekday(uts.start)}, ${f.dayMonth(uts.start)}`,
              id: `Masa UTS mulai ${f.weekday(uts.start)}, ${f.dayMonth(uts.start)}`,
            })}
          </p>
        )}
      </header>

      <section className="mt-6">
        <SectionTitle
          aside={
            <span className={cx("flex items-center gap-1.5 text-[12px]", ui.faint)}>
              {tr({ en: "Checked", id: "Diperiksa" })} {f.time(data.sources.edunex.updatedAt)}
              <SourceTag source="EduNex" />
              <SourceTag source="SIX" />
            </span>
          }
        >
          {tr({ en: "Needs you", id: "Perlu perhatianmu" })}
          <span className={cx("ml-2 text-[13px] font-medium", ui.faint)}>{list.length}</span>
        </SectionTitle>
        {list.length ? (
          <div className={cx("overflow-hidden", ui.card)}>
            {(
              [
                ["now", tr({ en: "Right now", id: "Sekarang" })],
                ["soon", tr({ en: "Soon", id: "Segera" })],
                ["later", tr({ en: "Coming up", id: "Akan datang" })],
              ] as const
            )
              .map(([key, label]) => ({ key, label, items: list.filter((a) => a.urgency === key) }))
              .filter((g) => g.items.length > 0)
              .map((g, gi) => (
                <div key={g.key} className={cx(gi > 0 && "border-t", ui.line)}>
                  <p className={cx("px-4 pt-3 text-[11px] font-semibold tracking-[0.05em] uppercase", ui.faint)}>{g.label}</p>
                  <ol>
                    {g.items.map((a, i) => (
                      <ActionRow key={a.id} action={a} first={i === 0} p={p} />
                    ))}
                  </ol>
                </div>
              ))}
          </div>
        ) : (
          <p className={cx("rounded-xl px-4 py-6 text-center text-[13px]", ui.fill, ui.muted)}>
            {tr({ en: "Nothing needs you right now.", id: "Tidak ada yang perlu kamu urus sekarang." })}
          </p>
        )}
      </section>

      <div className="mt-10 grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-9">
        <Today {...p} />
        <div className="space-y-9">
          <DueSoon {...p} />
          <Changed {...p} />
        </div>
      </div>

      <section className="mt-11">
        <SectionTitle aside={<span className={cx("text-[12px] font-medium", ui.faint)}>{data.courses.length}</span>}>
          {tr({ en: "Courses this semester", id: "Mata kuliah semester ini" })}
        </SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {data.courses.map((c) => (
            <CourseCard key={c.code} {...p} course={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- today (SIX timetable + EduNex)

function Today(p: VariantProps) {
  const { data, f, tr } = p;
  const today = sessionsOn(data, 0, f);
  const tomorrowExtra = offTimetable(data, f).filter((m) => f.dayOffset(m.start) === 1);
  const tomorrow = sessionsOn(data, 1, f);
  return (
    <section>
      <SectionTitle aside={<SourceTag source="SIX" />}>{tr({ en: "Today", id: "Hari ini" })}</SectionTitle>
      {today.length ? (
        <ol className={cx("overflow-hidden", ui.card)}>
          {today.map((s, i) => (
            <TodayRow key={s.id} session={s} first={i === 0} {...p} />
          ))}
        </ol>
      ) : (
        <p className={cx("text-[13px]", ui.muted)}>{tr({ en: "No classes today", id: "Tidak ada kuliah hari ini" })}</p>
      )}

      {(tomorrow.length > 0 || tomorrowExtra.length > 0) && (
        <div className="mt-6">
          <p className={cx("mb-2 text-[12.5px] font-semibold", ui.muted)}>{tr({ en: "Tomorrow", id: "Besok" })}</p>
          <ul className={cx("overflow-hidden", ui.card)}>
            {tomorrow.map((s, i) => (
              <li key={s.id} className={cx("flex items-center gap-3 px-4 py-2.5 text-[13px]", i > 0 && "border-t", ui.line)}>
                <span className="w-[92px] shrink-0 font-medium tabular-nums">{f.timeRange(s.start, s.end)}</span>
                <CourseCode course={courseOf(data, s.courseCode)} />
                <span className={cx("truncate", ui.muted)}>{s.room}</span>
              </li>
            ))}
            {tomorrowExtra.map((m, i) => (
              <li key={m.id} className={cx("flex items-center gap-3 px-4 py-2.5 text-[13px]", (tomorrow.length > 0 || i > 0) && "border-t", ui.line)}>
                <span className="w-[92px] shrink-0 font-medium tabular-nums">{f.timeRange(m.start, m.end)}</span>
                <CourseCode course={courseOf(data, m.courseCode)} />
                <span className={cx("min-w-0 flex-1 truncate", ui.muted)}>
                  {tr({ en: `Meeting ${m.number} · online`, id: `Pertemuan ${m.number} · daring` })}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#fff1d6] px-1.5 py-0.5 text-[11px] font-semibold text-[#8a5300] dark:bg-[#3a2c10] dark:text-[#f5c46a]">
                  {tr({ en: "Not in SIX", id: "Tidak ada di SIX" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className={cx("mt-3 text-[12px]", ui.faint)}>
        {tr({
          en: "Rooms and times from SIX. Where attendance counts is worked out from both systems.",
          id: "Ruang dan jam dari SIX. Tempat presensi dihitung dari kedua sistem.",
        })}
      </p>
    </section>
  );
}

function TodayRow({ session, first, ...p }: VariantProps & { session: ClassSession; first: boolean }) {
  const { data, now, f, t, tr, go } = p;
  const { attendanceTarget } = useDSettings();
  const course = courseOf(data, session.courseCode);
  const past = new Date(session.end) <= now;
  const live = new Date(session.start) <= now && !past;
  const health = attendanceHealth(data, session.courseCode, now, f, attendanceTarget);
  const change = scheduleChanges(data, f).find((c) => c.session.id === session.id);
  const clash = clashes(data, now, f).find((c) => c.codes.includes(session.courseCode) && c.next?.some((s) => s.id === session.id));
  const other = clash?.codes.find((c) => c !== session.courseCode);
  const exam = /UTS|UAS/i.test(session.activity);
  return (
    <li className={cx(!first && "border-t", ui.line)}>
      <button
        onClick={() => go("course", { course: session.courseCode })}
        className={cx("grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3 text-left", ui.hover, ui.focus)}
      >
        <span className={cx("pt-0.5 tabular-nums", past && "opacity-45")}>
          <span className="block text-[14px] font-semibold">{f.time(session.start)}</span>
          <span className={cx("block text-[12px]", change ? "font-semibold text-[#9a5b00] dark:text-[#f5c46a]" : ui.faint)}>{f.time(session.end)}</span>
        </span>
        <span className={cx("flex min-w-0 gap-3", past && "opacity-45")}>
          <span className="mt-0.5 h-10 w-[3px] shrink-0 rounded-full" style={{ background: course?.color }} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium">{session.courseName}</span>
            <span className={cx("mt-0.5 flex items-center gap-2 text-[12.5px]", ui.muted)}>
              <span className="font-semibold">{session.courseCode}</span>
              <span className="inline-flex items-center gap-1">
                <Icons.MapPin className="size-3" />
                {session.room}
              </span>
              {exam && <span className="font-semibold text-[#c4321f] dark:text-[#ff9c8f]">{session.activity}</span>}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
              <span className={cx("inline-flex items-center gap-1 font-medium", ui.muted)}>
                <Icons.Hand className="size-3" />
                {tr({ en: `Attendance in ${health.source}`, id: `Presensi di ${health.source}` })}
              </span>
              {health.state !== "unknown" && (
                <span className={cx("font-semibold", BUDGET_TONE[budgetText(tr, health, attendanceTarget).tone])}>
                  {budgetText(tr, health, attendanceTarget).label}
                </span>
              )}
              {change && (
                <span className="font-semibold text-[#9a5b00] dark:text-[#f5c46a]">
                  {tr({ en: `Changed · usually ${change.usual.start}–${change.usual.end}`, id: `Berubah · biasanya ${change.usual.start}–${change.usual.end}` })}
                </span>
              )}
              {clash && other && (
                <span className="inline-flex items-center gap-1 font-semibold text-[#c4321f] dark:text-[#ff9c8f]">
                  <Icons.Overlap className="size-3" />
                  {tr({ en: `Overlaps ${other} ${clash.from}–${clash.to}`, id: `Bentrok ${other} ${clash.from}–${clash.to}` })}
                </span>
              )}
            </span>
          </span>
        </span>
        <span className="pt-0.5 text-right text-[12px] font-medium whitespace-nowrap">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e3f5ea] px-2 py-0.5 text-[#178a4a] dark:bg-[#12301f] dark:text-[#6fdc9c]">
              <LiveDot className="scale-75" />
              {t("now")}
            </span>
          ) : past ? (
            <span className={ui.faint}>{tr({ en: "Done", id: "Selesai" })}</span>
          ) : (
            <span className={ui.muted}>{f.fromNow(session.start)}</span>
          )}
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- right column

function DueSoon(p: VariantProps) {
  const { data, now, f, tr, go } = p;
  const due = openTasks(data).slice(0, 4);
  return (
    <section>
      <SectionTitle
        aside={
          <button onClick={() => go("tasks")} className={cx("rounded text-[12.5px] font-medium", ui.accentText, ui.focus)}>
            {tr({ en: "Tasks & exams", id: "Tugas & ujian" })}
          </button>
        }
      >
        {tr({ en: "Due next", id: "Tenggat berikutnya" })}
      </SectionTitle>
      {due.length ? (
        <ul className="-mx-2">
          {due.map((task) => {
            const course = courseOf(data, task.courseCode);
            const sig = taskSignals(data, task, now);
            return (
              <li key={task.id}>
                <button
                  onClick={() => go("task", { task: task.id })}
                  className={cx("flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left", ui.hover, ui.focus)}
                >
                  <span className={cx("mt-0.5", ui.faint)}>
                    <StatusGlyph status={task.status} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium">{task.title}</span>
                    <span className={cx("mt-0.5 flex items-center gap-1.5 text-[12px]", ui.muted)}>
                      <CourseDot color={course?.color ?? "#999"} className="size-2" />
                      {task.courseCode}
                      {sig.attendanceWindow && (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#9a5b00] dark:text-[#f5c46a]">
                          · <Icons.Hand className="size-3" />
                          {tr({ en: "counts as attendance", id: "sekaligus presensi" })}
                        </span>
                      )}
                      {task.domain === "uts" && <span className="font-semibold text-[#c4321f] dark:text-[#ff9c8f]">· UTS</span>}
                    </span>
                  </span>
                  {task.dueAt && (
                    <span className="text-right text-[12px] whitespace-nowrap tabular-nums">
                      <span className="block font-medium">{f.dueLabel(task.dueAt)}</span>
                      <span className={cx("block", ui.faint)}>{f.fromNow(task.dueAt)}</span>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={cx("text-[13px]", ui.muted)}>{tr({ en: "Nothing due", id: "Tidak ada tenggat" })}</p>
      )}
    </section>
  );
}

const CHANGE_ICON: Record<ChangeEvent["kind"], (props: { className?: string }) => JSX.Element> = {
  schedule: Icons.CalendarClock,
  exam: Icons.GraduationCap,
  task_new: Icons.ListChecks,
  task_edited: Icons.PenLine,
  material_new: Icons.FileText,
  krs: Icons.ShieldCheck,
};

function Changed(p: VariantProps) {
  const { f, tr, go } = p;
  const events = changeFeed(p).slice(0, 5);
  if (!events.length) return null;
  return (
    <section>
      <SectionTitle aside={<span className={cx("text-[12px] font-medium", ui.faint)}>{tr({ en: "Both systems", id: "Kedua sistem" })}</span>}>
        {tr({ en: "New & changed", id: "Baru & berubah" })}
      </SectionTitle>
      <ul className="-mx-2">
        {events.map((e) => {
          const Icon = CHANGE_ICON[e.kind];
          return (
            <li key={e.id}>
              <button
                onClick={() => e.go && go(e.go.screen, { task: e.go.task, course: e.go.course })}
                className={cx("flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left", ui.hover, ui.focus)}
              >
                <span className={cx("mt-0.5", e.important ? "text-[#9a5b00] dark:text-[#f5c46a]" : ui.faint)}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{e.title}</span>
                  <span className={cx("mt-0.5 flex items-center gap-1.5 text-[12px]", ui.muted)}>
                    <SourceTag source={e.source} />
                    <span className="truncate">{e.detail}</span>
                  </span>
                </span>
                <span className={cx("text-[12px] whitespace-nowrap", ui.faint)}>{f.fromNow(e.at)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- course cards

function CourseCard({ course, ...p }: VariantProps & { course: Course }) {
  const { data, now, f, t, tr, go } = p;
  const { attendanceTarget } = useDSettings();
  const next = nextSession(data, now, course.code);
  const open = openTasks(data, course.code).length;
  const live = currentSession(data, now, course.code);
  const health = attendanceHealth(data, course.code, now, f, attendanceTarget);
  const budget = budgetText(tr, health, attendanceTarget);
  return (
    <button
      onClick={() => go("course", { course: course.code })}
      className={cx(
        "group flex flex-col rounded-xl border p-4 text-left motion-safe:transition motion-safe:duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_-8px_rgba(16,24,40,0.18)]",
        ui.line,
        "bg-white dark:bg-[#1c1c1f]",
        ui.focus,
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <CourseCode course={course} className="text-[12.5px]" />
        {live && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#178a4a] dark:text-[#6fdc9c]">
            <LiveDot className="scale-75" />
            {t("now")}
          </span>
        )}
      </span>
      <span className="mt-2 line-clamp-2 min-h-[40px] text-[14.5px] leading-5 font-semibold tracking-[-0.01em]">{course.name}</span>
      <span className={cx("mt-1 text-[12.5px]", ui.muted)}>
        {t("class_no")} {course.classNo} · {course.sks} SKS
      </span>
      <span className={cx("mt-3 border-t pt-3 text-[12.5px]", ui.line, ui.muted)}>
        {next ? (
          <span className="flex items-center gap-1.5 truncate">
            <Icons.Calendar className="size-3.5 shrink-0" />
            <span className="truncate">
              {f.relativeDay(next.start)}, {f.time(next.start)} · {next.room}
            </span>
          </span>
        ) : (
          <span>{tr({ en: "No upcoming meetings", id: "Belum ada pertemuan berikutnya" })}</span>
        )}
      </span>
      <span className="mt-2.5 flex items-center justify-between gap-3 text-[12px]">
        <span className={cx("font-medium", open ? "" : ui.faint)}>
          {open ? tr({ en: `${open} open task${open > 1 ? "s" : ""}`, id: `${open} tugas aktif` }) : tr({ en: "No open tasks", id: "Tidak ada tugas aktif" })}
        </span>
        {health.attended !== null && health.held !== null && (
          <span className="flex items-center gap-2">
            <Bar className="w-12" value={health.attended / Math.max(1, health.held)} color={course.color} />
            <span className={cx("tabular-nums", ui.muted)}>
              {health.attended}/{health.held}
            </span>
          </span>
        )}
      </span>
      <span className={cx("mt-1.5 text-right text-[11.5px] font-semibold", BUDGET_TONE[budget.tone])}>{budget.label}</span>
    </button>
  );
}
