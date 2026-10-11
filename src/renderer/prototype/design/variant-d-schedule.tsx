// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": Jadwal (the SIX week,
// laid out like SIX's own weekly grid) and the first-run sign-in.
import { useState } from "react";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import { clashes, isExamActivity, offTimetable, scheduleChanges } from "./variant-d-insights";
import { CourseCode, LiveDot, SourceTag, courseOf, cx, openTasks, sessionsOn, tint, ui } from "./variant-d-ui";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" });
const DAY_MS = 86_400_000;

export function SchedulePage(p: VariantProps) {
  const { data, now, f, t, tr, go } = p;
  const [week, setWeek] = useState(0);
  const mondayOffset = -["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(WEEKDAY.format(now));
  const days = [0, 1, 2, 3, 4].map((d) => mondayOffset + d + week * 7);
  const isoFor = (offset: number) => new Date(now.getTime() + offset * DAY_MS).toISOString();
  const changes = scheduleChanges(data, f);
  const allClashes = clashes(data, now, f);
  const extra = offTimetable(data, f);
  const weekStart = f.dayKey(isoFor(days[0]));
  const weekEnd = f.dayKey(isoFor(days[4]));
  const events = data.academicCalendar.filter(
    (e) => !e.key.startsWith("lectures") && f.dayKey(e.start) <= weekEnd && f.dayKey(e.end) >= weekStart,
  );

  return (
    <div className="px-10 pt-7 pb-20">
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{t("schedule")}</h1>
          <p className={cx("mt-1 text-[13px]", ui.muted)}>
            {f.dayMonth(isoFor(days[0]))} – {f.dayMonth(isoFor(days[4]))} · SIX
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWeek((w) => w - 1)}
            aria-label={tr({ en: "Previous week", id: "Minggu sebelumnya" })}
            className={cx("grid size-8 place-items-center rounded-lg", ui.secondary, ui.focus)}
          >
            <Icons.ChevronLeft className="size-4" />
          </button>
          <button onClick={() => setWeek(0)} className={cx("h-8 rounded-lg px-3 text-[13px] font-medium", ui.secondary, ui.focus)}>
            {t("this_week")}
          </button>
          <button
            onClick={() => setWeek((w) => w + 1)}
            aria-label={tr({ en: "Next week", id: "Minggu berikutnya" })}
            className={cx("grid size-8 place-items-center rounded-lg", ui.secondary, ui.focus)}
          >
            <Icons.ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      {events.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {events.map((e) => (
            <span key={e.key} className={cx("inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-medium", ui.fill)}>
              <SourceTag source="ITB" />
              {tr({ en: e.en, id: e.id })} · {f.dayMonth(e.start)}
              {f.dayKey(e.start) !== f.dayKey(e.end) ? `–${f.dayMonth(e.end)}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid grid-cols-5 gap-3">
        {days.map((offset) => {
          const sessions = sessionsOn(data, offset, f);
          const isToday = offset === 0;
          return (
            <section key={offset} className="min-w-0">
              <h2 className={cx("mb-2 flex items-baseline gap-1.5 px-1 text-[13px]", isToday ? "font-semibold" : ui.muted)}>
                <span className={cx(isToday && "rounded-md bg-[#2f6feb] px-1.5 py-0.5 text-white dark:bg-[#3a77f0]")}>
                  {f.weekdayShort(isoFor(offset))} {f.dayMonth(isoFor(offset))}
                </span>
              </h2>
              <div
                className={cx(
                  "min-h-[420px] space-y-2 rounded-xl p-2",
                  isToday ? "bg-[#f1f5fe] dark:bg-[#1a2133]" : "bg-[#f7f7f8] dark:bg-[#1b1b1e]",
                )}
              >
                {sessions.map((s) => {
                  const course = courseOf(data, s.courseCode);
                  const color = course?.color ?? "#2f6feb";
                  const live = new Date(s.start) <= now && now < new Date(s.end);
                  const past = new Date(s.end) <= now;
                  const change = changes.find((c) => c.session.id === s.id);
                  const clash = allClashes.find((c) => c.codes.includes(s.courseCode) && sessions.some((o) => o.id !== s.id && c.codes.includes(o.courseCode)));
                  const other = clash?.codes.find((c) => c !== s.courseCode);
                  const exam = isExamActivity(s.activity);
                  return (
                    <button
                      key={s.id}
                      onClick={() => go("course", { course: s.courseCode })}
                      className={cx(
                        "block w-full rounded-lg border-l-[3px] px-3 py-2.5 text-left motion-safe:transition hover:brightness-[0.98]",
                        past && "opacity-55",
                        ui.focus,
                      )}
                      style={{ borderColor: color, background: tint(color, p.dark ? 0.16 : 0.1) }}
                    >
                      <span className="flex items-center justify-between text-[12px] font-semibold tabular-nums">
                        {f.timeRange(s.start, s.end)}
                        {live && <LiveDot className="scale-75" />}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[13px] leading-snug font-medium">{s.courseName}</span>
                      <span className={cx("mt-1.5 flex items-center justify-between gap-2 text-[11.5px]", ui.muted)}>
                        <CourseCode course={course} />
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                          <Icons.MapPin className="size-3 shrink-0" />
                          <span className="truncate">{s.room || "—"}</span>
                        </span>
                      </span>
                      {(exam || change || other) && (
                        <span className="mt-1.5 block space-y-0.5 text-[11px] leading-snug font-semibold">
                          {exam && <span className="block text-[#c4321f] dark:text-[#ff9c8f]">{s.activity}</span>}
                          {change && (
                            <span className="block text-[#9a5b00] dark:text-[#f5c46a]">
                              {tr({ en: `Changed · usually ${change.usual.start}–${change.usual.end}`, id: `Berubah · biasanya ${change.usual.start}–${change.usual.end}` })}
                            </span>
                          )}
                          {other && clash && (
                            <span className="block text-[#c4321f] dark:text-[#ff9c8f]">
                              {tr({ en: `Overlaps ${other} ${clash.from}–${clash.to}`, id: `Bentrok ${other} ${clash.from}–${clash.to}` })}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
                {extra
                  .filter((m) => f.dayOffset(m.start) === offset)
                  .map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-dashed px-3 py-2.5 text-left"
                      style={{ borderColor: courseOf(data, m.courseCode)?.color }}
                    >
                      <span className="block text-[12px] font-semibold tabular-nums">{f.timeRange(m.start, m.end)}</span>
                      <span className="mt-1 block text-[13px] leading-snug font-medium">
                        {tr({ en: `Meeting ${m.number}${m.online ? " · online" : ""}`, id: `Pertemuan ${m.number}${m.online ? " · daring" : ""}` })}
                      </span>
                      <span className={cx("mt-1.5 flex items-center justify-between gap-2 text-[11.5px]", ui.muted)}>
                        <CourseCode course={courseOf(data, m.courseCode)} />
                        <SourceTag source="EduNex" />
                      </span>
                      <span className="mt-1 block text-[11px] font-semibold text-[#9a5b00] dark:text-[#f5c46a]">
                        {tr({ en: "Not in SIX's timetable", id: "Tidak ada di jadwal SIX" })}
                      </span>
                    </div>
                  ))}
                {openTasks(data)
                  .filter((t) => t.dueAt && f.dayOffset(t.dueAt) === offset)
                  .map((t) => (
                    <button
                      key={t.id}
                      onClick={() => go("task", { task: t.id })}
                      className={cx("flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11.5px]", ui.hover, ui.focus)}
                    >
                      <Icons.Clock className={cx("size-3 shrink-0", ui.faint)} />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold">{f.time(t.dueAt!)}</span> {t.title}
                      </span>
                    </button>
                  ))}
                {sessions.length === 0 && !extra.some((m) => f.dayOffset(m.start) === offset) && (
                  <p className={cx("px-1 pt-2 text-[12px]", ui.faint)}>{tr({ en: "No classes", id: "Tidak ada kuliah" })}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
