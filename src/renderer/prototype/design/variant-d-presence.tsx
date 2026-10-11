// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": Presensi. Attendance is
// split: some lecturers count it in SIX, some in EduNex, one by handing in
// Tasks. This page says where each course counts, how many absences are left
// before the target, and what the official pages get wrong.
import { Icons } from "./icons";
import { attendanceHealth, clashes, lecturePeriod, presenceAction, type AttendanceHealth } from "./variant-d-insights";
import type { VariantProps } from "./variant-props";
import type { Course } from "./data";
import {
  BUDGET_TONE,
  Bar,
  CourseCode,
  LiveDot,
  SourceTag,
  budgetText,
  courseOf,
  currentSession,
  cx,
  elapsed,
  nextSession,
  openPresence,
  tint,
  ui,
  useDSettings,
} from "./variant-d-ui";

export function PresencePage(p: VariantProps & { openSettings: () => void }) {
  const { data, now, f, t, tr, openSettings } = p;
  const { attendanceTarget } = useDSettings();
  const all = data.courses.map((c) => ({ course: c, h: attendanceHealth(data, c.code, now, f, attendanceTarget) }));
  const count = (state: AttendanceHealth["state"]) => all.filter((x) => x.h.state === state).length;
  const period = lecturePeriod(data, now);
  // Worst first: out of reach, then no absences left, then the rest.
  const order: Record<AttendanceHealth["state"], number> = { out: 0, last: 1, safe: 2, unknown: 3 };
  const sorted = [...all].sort((a, b) => order[a.h.state] - order[b.h.state]);

  return (
    <div className="mx-auto max-w-[1000px] px-10 pt-7 pb-20">
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{t("presence")}</h1>
          <p className={cx("mt-1 text-[13px]", ui.muted)}>
            {tr({
              en: "Where each course counts your attendance, and how many absences you have left.",
              id: "Di mana tiap mata kuliah menghitung kehadiranmu, dan sisa jatah absenmu.",
            })}
          </p>
        </div>
        <button onClick={openSettings} className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium", ui.secondary, ui.focus)}>
          <Icons.Target className="size-3.5" />
          {tr({ en: `Target ${attendanceTarget}%`, id: `Target ${attendanceTarget}%` })}
        </button>
      </header>

      <LiveCard {...p} />

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Summary tone="bad" value={count("out")} label={tr({ en: `Can't reach ${attendanceTarget}% anymore`, id: `Tak bisa lagi capai ${attendanceTarget}%` })} />
        <Summary tone="warn" value={count("last")} label={tr({ en: "No absences left", id: "Tidak boleh absen lagi" })} />
        <Summary tone="ok" value={count("safe")} label={tr({ en: "Room to spare", id: "Masih aman" })} />
      </div>

      <ul className="mt-6 space-y-3">
        {sorted.map(({ course, h }) => (
          <CourseRow key={course.code} {...p} course={course} h={h} />
        ))}
      </ul>

      <section className={cx("mt-8 rounded-xl px-5 py-4 text-[12.5px] leading-[1.6]", ui.fill, ui.muted)}>
        <p className="font-semibold text-current">{tr({ en: "How this is counted", id: "Cara menghitungnya" })}</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>
            {tr({
              en: "Attended and held meetings come from SIX's own count (“Hadir 4 dari 6 pertemuan”), the official record.",
              id: "Jumlah hadir dan pertemuan diambil dari hitungan SIX sendiri (“Hadir 4 dari 6 pertemuan”), catatan resmi.",
            })}
          </li>
          <li>
            {tr({
              en: `Meetings left follow SIX's timetable up to the last lecture day${period ? ` (${f.dayMonth(period.end)}, ITB academic calendar)` : ""}, skipping weeks where SIX puts an exam.`,
              id: `Sisa pertemuan mengikuti jadwal SIX sampai hari kuliah terakhir${period ? ` (${f.dayMonth(period.end)}, kalender akademik ITB)` : ""}, tanpa minggu yang diisi ujian.`,
            })}
          </li>
          <li>
            {tr({
              en: `There's no ITB-wide minimum: each course contract sets its own. SIX marks courses red below about 80%. Set your target per course if your contract differs.`,
              id: `Tidak ada batas minimal untuk seluruh ITB: kontrak tiap mata kuliah yang menentukan. SIX menandai merah di bawah sekitar 80%. Ubah targetmu jika kontrakmu berbeda.`,
            })}
          </li>
          <li>
            {tr({
              en: "After each class, the app checks that SIX's count went up. If it didn't, you hear about it the same day, while your lecturer still remembers you were there.",
              id: "Setelah tiap kuliah, aplikasi memeriksa hitungan SIX bertambah. Kalau tidak, kamu diberi tahu hari itu juga, selagi dosen masih ingat kamu hadir.",
            })}
          </li>
        </ul>
      </section>
    </div>
  );
}

function Summary({ value, label, tone }: { value: number; label: string; tone: "ok" | "warn" | "bad" }) {
  return (
    <div className={cx("px-4 py-3.5", ui.card)}>
      <p className={cx("text-[24px] leading-8 font-semibold tabular-nums", value > 0 ? BUDGET_TONE[tone] : ui.faint)}>{value}</p>
      <p className={cx("text-[12.5px] font-medium", ui.muted)}>{label}</p>
    </div>
  );
}

/** The class in progress, with the system that actually counts — not just the one that happens to be open. */
function LiveCard(p: VariantProps) {
  const { data, now, f, t, tr } = p;
  const { attendanceTarget } = useDSettings();
  const session = currentSession(data, now);
  if (!session) return null;
  const course = courseOf(data, session.courseCode);
  if (!course) return null;
  const h = attendanceHealth(data, course.code, now, f, attendanceTarget);
  const window = openPresence(data, now, course.code);
  return (
    <div className={cx("mt-6 rounded-2xl border px-5 py-4", ui.line)} style={{ background: tint(course.color, p.dark ? 0.16 : 0.07) }}>
      <div className="flex items-center gap-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#b45309] shadow-sm dark:bg-[#2a2418] dark:text-[#f5c46a]">
          <Icons.Hand className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[12px] font-semibold">
            <LiveDot />
            {t("in_progress")} · <CourseCode course={course} /> · {f.timeRange(session.start, session.end)} · {session.room}
          </p>
          <p className="mt-1 text-[16px] font-semibold">
            {tr({ en: `Record your attendance in ${h.source}`, id: `Catat kehadiranmu di ${h.source}` })}
          </p>
          <p className={cx("mt-0.5 text-[12.5px]", ui.muted)}>
            {h.source === "SIX"
              ? tr({
                  en: `SIX has counted you ${h.attended} of ${h.held} times in this course, so that's where your lecturer records it.`,
                  id: `SIX sudah menghitungmu ${h.attended} dari ${h.held} kali di mata kuliah ini, jadi di situlah dosen mencatatnya.`,
                })
              : tr({ en: "Your lecturer records attendance in EduNex.", id: "Dosen mencatat kehadiran di EduNex." })}
            {window &&
              h.source === "SIX" &&
              ` ${tr({ en: `EduNex Presence is open too, until ${f.time(window.closesAt)}.`, id: `Presensi EduNex juga dibuka sampai ${f.time(window.closesAt)}.` })} ${presenceAction(data, window, tr).long}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className={cx("inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold", ui.primary, ui.focus)}
          >
            {tr({ en: `Open in ${h.source}`, id: `Buka di ${h.source}` })}
            <Icons.ArrowUpRight className="size-3.5" strokeWidth={2.25} />
          </a>
          {window && h.source === "SIX" && (
            <a href="#" onClick={(e) => e.preventDefault()} className={cx("inline-flex items-center gap-1 rounded px-1 text-[12px] font-medium", ui.muted, ui.focus)}>
              {presenceAction(data, window, tr).short} · {f.countdown(window.closesAt)}
              <Icons.ArrowUpRight className="size-3" />
            </a>
          )}
        </div>
      </div>
      {window && <Bar className="mt-3" value={elapsed(window.opensAt, window.closesAt, now)} color={course.color} />}
    </div>
  );
}

function CourseRow({ course, h, ...p }: VariantProps & { course: Course; h: AttendanceHealth }) {
  const { data, now, f, tr, go } = p;
  const { attendanceTarget } = useDSettings();
  const budget = budgetText(tr, h, attendanceTarget);
  const next = nextSession(data, now, course.code);
  const clash = clashes(data, now, f).find((c) => c.codes.includes(course.code));
  const other = clash?.codes.find((c) => c !== course.code);
  const viaTasks = data.presence.some((x) => x.courseCode === course.code && x.taskId);
  const examReplaced = data.sessions.filter((s) => s.courseCode === course.code && /UTS|UAS/i.test(s.activity) && new Date(s.start) > now);
  const missed = h.attended !== null && h.held !== null ? h.held - h.attended : 0;

  const notes: { tone: "info" | "warn" | "bad"; text: string }[] = [];
  if (h.edunexMisleading)
    notes.push({
      tone: "info",
      text: tr({
        en: `EduNex has you at ${h.edunexMarked} of ${h.edunexPast} and labels the rest "Absent": its Presence only counts when you open this course's material in EduNex during class. SIX, where your lecturer counts you, has ${h.attended} of ${h.held}. You'll get a nudge to open the material during each window, so both match.`,
        id: `EduNex mencatat ${h.edunexMarked} dari ${h.edunexPast} dan sisanya "Absent": Presensinya hanya terhitung saat kamu membuka materi mata kuliah ini di EduNex selama kuliah. SIX, tempat dosen menghitungmu, mencatat ${h.attended} dari ${h.held}. Kamu akan diingatkan membuka materi di tiap jendela, agar keduanya cocok.`,
      }),
    });
  if (viaTasks)
    notes.push({
      tone: "info",
      text: tr({
        en: 'Your lecturer set some EduNex Presence sessions to "Answer Assignment": they count only if you hand in that task inside its window (Fridays, 15:00–23:59).',
        id: 'Dosen mengatur sebagian Presensi EduNex ke "Answer Assignment": hanya terhitung jika tugasnya dikumpulkan di dalam jendelanya (Jumat, 15:00–23:59).',
      }),
    });
  if (clash && other)
    notes.push({
      tone: "bad",
      text: tr({
        en: `Overlaps ${other} every ${clash.weekday}, ${clash.from}–${clash.to}. SIX accepted both in your KRS without a warning.`,
        id: `Bentrok dengan ${other} setiap ${clash.weekday}, ${clash.from}–${clash.to}. SIX menerima keduanya di KRS-mu tanpa peringatan.`,
      }),
    });
  for (const e of examReplaced)
    notes.push({
      tone: "info",
      text: tr({
        en: `${e.activity} on ${f.weekdayShort(e.start)} ${f.dayMonth(e.start)} takes one lecture slot, so it isn't counted as a meeting.`,
        id: `${e.activity} pada ${f.weekdayShort(e.start)} ${f.dayMonth(e.start)} memakai satu slot kuliah, jadi tidak dihitung sebagai pertemuan.`,
      }),
    });
  if (h.state === "out")
    notes.push({
      tone: "bad",
      text: tr({
        en: `If SIX missed a meeting you attended, ask your lecturer to correct it now. Otherwise, check your course contract for what happens below ${attendanceTarget}%.`,
        id: `Kalau SIX melewatkan pertemuan yang kamu hadiri, minta dosen mengoreksinya sekarang. Kalau tidak, cek kontrak kuliah soal akibatnya di bawah ${attendanceTarget}%.`,
      }),
    });

  return (
    <li className={cx("overflow-hidden", ui.card)}>
      <button
        onClick={() => go("course", { course: course.code })}
        className={cx("grid w-full grid-cols-[minmax(0,1fr)_250px_190px] items-center gap-6 px-5 py-4 text-left", ui.hover, ui.focus)}
      >
        <span className="min-w-0">
          <CourseCode course={course} className="text-[12.5px]" />
          <span className="mt-1 block truncate text-[14.5px] font-semibold">{course.name}</span>
          <span className={cx("mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]", ui.muted)}>
            <span className="inline-flex items-center gap-1">
              {tr({ en: "Counted in", id: "Dihitung di" })} <SourceTag source={h.source} />
            </span>
            {next && (
              <span className="truncate">
                · {tr({ en: "Next", id: "Berikutnya" })}: {f.relativeDay(next.start)}, {f.time(next.start)}
                {next.room ? ` · ${next.room}` : ""}
              </span>
            )}
          </span>
        </span>

        <span aria-label={tr({ en: "Meetings this semester", id: "Pertemuan semester ini" })}>
          <span className="flex flex-wrap gap-[3px]">
            {Array.from({ length: h.attended ?? 0 }, (_, i) => (
              <span key={`a${i}`} className="h-3 w-2.5 rounded-[3px] bg-[#22a35a]" />
            ))}
            {Array.from({ length: missed }, (_, i) => (
              <span key={`m${i}`} className="h-3 w-2.5 rounded-[3px] bg-[#e5484d]" />
            ))}
            {Array.from({ length: h.remaining }, (_, i) => (
              <span key={`r${i}`} className="h-3 w-2.5 rounded-[3px] border border-[#cfcfd6] dark:border-[#4a4a52]" />
            ))}
          </span>
          <span className={cx("mt-1.5 block text-[11.5px] tabular-nums", ui.muted)}>
            {h.attended !== null
              ? tr({
                  en: `${h.attended} attended · ${missed} missed · ${h.remaining} to go`,
                  id: `${h.attended} hadir · ${missed} absen · ${h.remaining} lagi`,
                })
              : "—"}
          </span>
        </span>

        <span className="text-right">
          <span className="block text-[20px] leading-7 font-semibold tabular-nums">
            {h.attended !== null && h.held ? `${Math.round((h.attended / h.held) * 100)}%` : "—"}
          </span>
          <span className={cx("block text-[12px] font-semibold", BUDGET_TONE[budget.tone])}>{budget.label}</span>
          {h.state !== "out" && h.best !== null && (
            <span className={cx("block text-[11.5px]", ui.faint)}>
              {tr({ en: `Best case ${Math.round(h.best * 100)}%`, id: `Paling tinggi ${Math.round(h.best * 100)}%` })}
            </span>
          )}
          {h.toRecover !== null && h.toRecover > 0 && h.state !== "out" && (
            <span className={cx("block text-[11.5px]", ui.faint)}>
              {tr({ en: `Back above ${attendanceTarget}% after ${h.toRecover} in a row`, id: `Kembali di atas ${attendanceTarget}% setelah ${h.toRecover}x hadir berturut-turut` })}
            </span>
          )}
        </span>
      </button>
      {notes.length > 0 && (
        <ul className={cx("space-y-1.5 border-t px-5 py-3 text-[12.5px] leading-[1.5]", ui.line)}>
          {notes.map((n, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={cx(
                  "mt-[7px] size-1.5 shrink-0 rounded-full",
                  n.tone === "bad" ? "bg-[#e5484d]" : n.tone === "warn" ? "bg-[#f59e0b]" : "bg-[#9a9aa1]",
                )}
              />
              <span className={ui.muted}>{n.text}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
