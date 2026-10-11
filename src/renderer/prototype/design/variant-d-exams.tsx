// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": exams. SIX's calendar has
// in-class exams with rooms, EduNex has take-home exams and the course
// outline, ITB's calendar has the exam weeks. None of them shows the others.
import { Icons } from "./icons";
import { attendanceHealth, examsOf, taskSignals, type Exam } from "./variant-d-insights";
import type { VariantProps } from "./variant-props";
import {
  BUDGET_TONE,
  CourseCode,
  EmptyState,
  MaterialIcon,
  SourceTag,
  StatusChip,
  budgetText,
  courseOf,
  cx,
  modulesOf,
  tint,
  ui,
  useDSettings,
} from "./variant-d-ui";

interface ExamGroup {
  courseCode: string;
  kind: string;
  items: Exam[];
  /** Earliest known date, for sorting. */
  at: string | null;
}

const KIND_ORDER: Record<string, number> = { KUIS: 0, QUIZ: 0, UTS: 1, UJIAN: 2, UAS: 3 };

function groupExams(exams: Exam[]): ExamGroup[] {
  const groups = new Map<string, ExamGroup>();
  for (const e of exams) {
    const key = `${e.courseCode}|${e.kind}`;
    const g = groups.get(key) ?? { courseCode: e.courseCode, kind: e.kind, items: [], at: null };
    g.items.push(e);
    if (e.start && (!g.at || e.start < g.at)) g.at = e.start;
    groups.set(key, g);
  }
  // Dated exams first; undated ones in exam order (UTS before UAS).
  return [...groups.values()].sort(
    (a, b) => (a.at ?? "9").localeCompare(b.at ?? "9") || (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9),
  );
}

function examWeek(p: VariantProps, kind: string) {
  return p.data.academicCalendar.find((e) => e.key === kind.toLowerCase() && new Date(e.end) >= p.now);
}

// ---------------------------------------------------------------- list (Tugas & Ujian)

export function ExamList(p: VariantProps) {
  const { data, f, tr, go } = p;
  const groups = groupExams(examsOf(data));
  const uts = examWeek(p, "UTS");
  const uas = examWeek(p, "UAS");
  return (
    <div>
      {groups.length ? (
        <ul className={cx("overflow-hidden", ui.card)}>
          {groups.map((g, i) => {
            const course = courseOf(data, g.courseCode);
            const inClass = g.items.find((e) => e.source === "SIX");
            const takeHome = g.items.find((e) => e.taskId);
            const outlineOnly = g.items.every((e) => e.dateUnknown);
            return (
              <li key={`${g.courseCode}-${g.kind}`} className={cx(i > 0 && "border-t", ui.line)}>
                <button
                  onClick={() => go("exam", { course: g.courseCode })}
                  className={cx("grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3.5 text-left", ui.hover, ui.focus)}
                >
                  <span className="grid h-7 place-items-center rounded-md bg-[#fde7e4] text-[11.5px] font-bold text-[#c4321f] dark:bg-[#3a1c19] dark:text-[#ff9c8f]">
                    {g.kind}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[14px] font-medium">
                      <CourseCode course={course} />
                      <span className="truncate">{course?.name}</span>
                    </span>
                    <span className={cx("mt-1 block space-y-0.5 text-[12.5px]", ui.muted)}>
                      {inClass?.start && (
                        <span className="flex items-center gap-1.5">
                          <SourceTag source="SIX" />
                          {tr({ en: "In class", id: "Di kelas" })} · {f.weekdayShort(inClass.start)} {f.dayMonth(inClass.start)}, {f.timeRange(inClass.start, inClass.end!)}
                          {inClass.room ? ` · ${inClass.room}` : ""}
                        </span>
                      )}
                      {takeHome?.end && (
                        <span className="flex items-center gap-1.5">
                          <SourceTag source="EduNex" />
                          {tr({ en: "Take-home, due", id: "Take-home, tenggat" })} {f.dueLabel(takeHome.end)}
                        </span>
                      )}
                      {outlineOnly && (
                        <span className="flex items-center gap-1.5">
                          <SourceTag source="EduNex" />
                          {tr({ en: "In the course outline, no date in SIX yet", id: "Ada di daftar isi, belum ada tanggal di SIX" })}
                          {examWeek(p, g.kind) && (
                            <span className={ui.faint}>
                              {" "}
                              · {tr({ en: `${g.kind} period`, id: `Masa ${g.kind}` })} {f.dayMonth(examWeek(p, g.kind)!.start)}–{f.dayMonth(examWeek(p, g.kind)!.end)}
                            </span>
                          )}
                        </span>
                      )}
                      {inClass && takeHome && (
                        <span className="block font-semibold text-[#9a5b00] dark:text-[#f5c46a]">
                          {tr({ en: "Two different dates. Confirm with your lecturer.", id: "Dua tanggal berbeda. Pastikan ke dosen." })}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="pt-0.5 text-right text-[12px] whitespace-nowrap">
                    {g.at ? <span className="font-medium">{f.fromNow(g.at)}</span> : <span className={ui.faint}>{tr({ en: "No date", id: "Belum ada tanggal" })}</span>}
                    <span className={cx("mt-1 flex items-center justify-end gap-1 font-medium", ui.accentText)}>
                      {tr({ en: "Prepare", id: "Persiapan" })}
                      <Icons.ChevronRight className="size-3.5" />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<Icons.Calendar className="size-6" />} title={tr({ en: "No exams found yet", id: "Belum ada ujian" })} />
      )}
      <p className={cx("mt-2.5 text-[12px]", ui.faint)}>
        {uts && tr({ en: `UTS week ${f.dayMonth(uts.start)}–${f.dayMonth(uts.end)}`, id: `Masa UTS ${f.dayMonth(uts.start)}–${f.dayMonth(uts.end)}` })}
        {uts && uas && " · "}
        {uas && tr({ en: `UAS ${f.dayMonth(uas.start)}–${f.dayMonth(uas.end)}`, id: `UAS ${f.dayMonth(uas.start)}–${f.dayMonth(uas.end)}` })}
        {tr({
          en: " (ITB calendar). Each course sets its own date; it shows up here the moment SIX or EduNex lists it.",
          id: " (kalender ITB). Tiap mata kuliah menentukan tanggalnya; muncul di sini begitu SIX atau EduNex mencantumkannya.",
        })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- exam page

export function ExamPage(p: VariantProps) {
  const { data, now, f, tr, go } = p;
  const { attendanceTarget } = useDSettings();
  const all = groupExams(examsOf(data));
  // Opened without a course: show the next exam.
  const explicit = new URLSearchParams(window.location.search).get("course");
  const group =
    all.find((g) => g.courseCode === (explicit ?? p.course.code)) ??
    all.find((g) => g.at && new Date(g.at) > now) ??
    all[0];
  if (!group) {
    return (
      <div className="mx-auto max-w-[900px] px-10 pt-7">
        <EmptyState icon={<Icons.GraduationCap className="size-6" />} title={tr({ en: "No exams found yet", id: "Belum ada ujian" })} />
      </div>
    );
  }
  const course = courseOf(data, group.courseCode)!;
  const inClass = group.items.find((e) => e.source === "SIX");
  const takeHome = group.items.find((e) => e.taskId);
  const task = takeHome ? data.tasks.find((t) => t.id === takeHome.taskId) : undefined;
  const week = examWeek(p, group.kind);
  const health = attendanceHealth(data, course.code, now, f, attendanceTarget);
  const budget = budgetText(tr, health, attendanceTarget);
  const examDay = inClass?.start ?? takeHome?.end ?? week?.start ?? null;
  const modules = modulesOf(data, course.code).filter((m) => m.active && !/UTS|UAS|Midex|Finex/i.test(m.title));
  const studyModules = modules.filter((m) => !examDay || !m.opensAt || m.opensAt < examDay);
  const files = data.materials.filter((m) => m.courseCode === course.code && m.kind === "pdf");
  const openTasks = data.tasks.filter((t) => t.courseCode === course.code && (t.status === "not_started" || t.status === "draft") && t.id !== task?.id);
  const others = all.filter((g) => g !== group);

  return (
    <div className="mx-auto grid max-w-[1080px] grid-cols-[minmax(0,1fr)_300px] gap-10 px-10 pt-7 pb-20">
      <article className="min-w-0">
        <button
          onClick={() => go("tasks")}
          className={cx("flex items-center gap-1.5 rounded text-[12.5px] font-medium", ui.muted, "hover:text-current", ui.focus)}
        >
          <Icons.ChevronLeft className="size-3.5" />
          {tr({ en: "Tasks & Exams", id: "Tugas & Ujian" })}
        </button>
        <p className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold">
          <span className="rounded-md bg-[#fde7e4] px-1.5 py-0.5 text-[11.5px] font-bold text-[#c4321f] dark:bg-[#3a1c19] dark:text-[#ff9c8f]">{group.kind}</span>
          <CourseCode course={course} />
        </p>
        <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.02em]">{course.name}</h1>
        {examDay && (
          <p className={cx("mt-1.5 text-[13.5px]", ui.muted)}>
            {f.dateLong(examDay)} · {f.fromNow(examDay)}
          </p>
        )}

        <section className="mt-7">
          <h2 className={cx("mb-2.5 text-[12.5px] font-semibold", ui.muted)}>{tr({ en: "When and where", id: "Kapan dan di mana" })}</h2>
          <div className="grid grid-cols-2 gap-3">
            {inClass?.start && (
              <div className={cx("px-4 py-3.5", ui.card)}>
                <p className="flex items-center justify-between text-[12px] font-semibold">
                  {tr({ en: "In class", id: "Di kelas" })}
                  <SourceTag source="SIX" />
                </p>
                <p className="mt-1.5 text-[16px] font-semibold">
                  {f.weekdayShort(inClass.start)} {f.dayMonth(inClass.start)}, {f.timeRange(inClass.start, inClass.end!)}
                </p>
                <p className={cx("mt-0.5 flex items-center gap-1.5 text-[13px]", ui.muted)}>
                  <Icons.MapPin className="size-3.5" />
                  {inClass.room ?? "—"}
                </p>
              </div>
            )}
            {task?.dueAt && (
              <button onClick={() => go("task", { task: task.id })} className={cx("px-4 py-3.5 text-left", ui.card, ui.hover, ui.focus)}>
                <p className="flex items-center justify-between text-[12px] font-semibold">
                  {tr({ en: "Take-home", id: "Take-home" })}
                  <SourceTag source="EduNex" />
                </p>
                <p className="mt-1.5 text-[16px] font-semibold">
                  {tr({ en: "Due", id: "Tenggat" })} {f.dueLabel(task.dueAt)}
                </p>
                <p className={cx("mt-1 flex flex-wrap items-center gap-2 text-[12.5px]", ui.muted)}>
                  <StatusChip status={task.status} t={p.t} />
                  {task.files.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Icons.FileText className="size-3.5" />
                      {task.files[0].name}
                    </span>
                  )}
                </p>
              </button>
            )}
            {!inClass && !task && week && (
              <div className={cx("px-4 py-3.5", ui.card)}>
                <p className="flex items-center justify-between text-[12px] font-semibold">
                  {tr({ en: "Not scheduled yet", id: "Belum dijadwalkan" })}
                  <SourceTag source="ITB" />
                </p>
                <p className="mt-1.5 text-[16px] font-semibold">
                  {tr({ en: `${group.kind} period`, id: `Masa ${group.kind}` })} {f.dayMonth(week.start)}–{f.dayMonth(week.end)}
                </p>
                <p className={cx("mt-0.5 text-[12.5px]", ui.muted)}>
                  {tr({
                    en: "Your course outline in EduNex has this exam, but SIX hasn't listed a date. You'll be told when it does.",
                    id: "Daftar isi mata kuliah di EduNex mencantumkan ujian ini, tapi SIX belum menjadwalkannya. Kamu akan diberi tahu.",
                  })}
                </p>
              </div>
            )}
          </div>
          {inClass && task && (
            <p className="mt-3 flex items-start gap-2.5 rounded-lg bg-[#fdf6e3] px-3.5 py-2.5 text-[13px] leading-[1.5] text-[#5c3d00] dark:bg-[#2e2510] dark:text-[#f2d79a]">
              <Icons.AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {tr({
                en: "SIX and EduNex give two different dates for this exam. It may be one exam in two parts, or one of them is out of date. Ask your lecturer; until then, you get reminders for both.",
                id: "SIX dan EduNex memberi dua tanggal berbeda untuk ujian ini. Bisa jadi satu ujian dua bagian, atau salah satunya belum diperbarui. Tanyakan ke dosen; sampai itu, kamu diingatkan untuk keduanya.",
              })}
            </p>
          )}
        </section>

        <section className="mt-8">
          <h2 className={cx("mb-2.5 flex items-center justify-between text-[12.5px] font-semibold", ui.muted)}>
            {tr({ en: "What to study", id: "Bahan belajar" })}
            <SourceTag source="EduNex" />
          </h2>
          {studyModules.length || files.length ? (
            <div className={cx("overflow-hidden", ui.card)}>
              <ul>
                {studyModules.map((m, i) => (
                  <li key={m.id} className={cx("flex items-center gap-3 px-4 py-2.5 text-[13px]", i > 0 && "border-t", ui.line)}>
                    <span className={cx("grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold tabular-nums", ui.fill, ui.muted)}>{m.index}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                  </li>
                ))}
                {files.map((m) => (
                  <li key={m.id} className={cx("flex items-center gap-3 border-t px-4 py-2.5 text-[13px]", ui.line)}>
                    <MaterialIcon kind={m.kind} />
                    <span className="min-w-0 flex-1 truncate font-medium">{m.title}</span>
                    {m.sizeBytes && <span className={cx("text-[12px]", ui.faint)}>{f.fileSize(m.sizeBytes)}</span>}
                  </li>
                ))}
              </ul>
              <div className={cx("flex items-center justify-between gap-3 border-t px-4 py-3", ui.line, ui.fill)}>
                <p className={cx("text-[12.5px]", ui.muted)}>
                  {tr({ en: "Everything is saved on this laptop, so it opens without campus Wi-Fi.", id: "Semua tersimpan di laptop ini, jadi bisa dibuka tanpa Wi-Fi kampus." })}
                </p>
                <button className={cx("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold", ui.secondary, ui.focus)}>
                  <Icons.FolderDown className="size-3.5" />
                  {tr({ en: "Open folder", id: "Buka folder" })}
                </button>
              </div>
            </div>
          ) : (
            <p className={cx("rounded-xl px-4 py-4 text-[13px] leading-[1.5]", ui.fill, ui.muted)}>
              {tr({
                en: `${course.code} has no lecture material on EduNex yet${task ? `; only the ${group.kind} itself is posted there` : ""}. If your lecturer shares slides elsewhere, they won't appear here.`,
                id: `${course.code} belum punya materi kuliah di EduNex${task ? `; yang ada hanya ${group.kind}-nya` : ""}. Kalau dosen membagikan slide di tempat lain, tidak akan muncul di sini.`,
              })}
            </p>
          )}
        </section>

        {others.length > 0 && (
          <section className="mt-8">
            <h2 className={cx("mb-2.5 text-[12.5px] font-semibold", ui.muted)}>{tr({ en: "Other exams", id: "Ujian lain" })}</h2>
            <ul className="flex flex-wrap gap-2">
              {others.map((g) => (
                <li key={`${g.courseCode}-${g.kind}`}>
                  <button
                    onClick={() => go("exam", { course: g.courseCode })}
                    className={cx("inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[12.5px] font-medium", ui.secondary, ui.focus)}
                  >
                    <span className="font-bold text-[#c4321f] dark:text-[#ff9c8f]">{g.kind}</span>
                    {g.courseCode}
                    <span className={ui.faint}>{g.at ? f.dayMonth(g.at) : tr({ en: "no date", id: "belum ada" })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>

      <aside className="space-y-4 self-start lg:sticky lg:top-6">
        <div className={cx("overflow-hidden", ui.card)}>
          <p className="px-4 pt-3.5 text-[12px] font-semibold">{tr({ en: "Before the exam", id: "Sebelum ujian" })}</p>
          <ul className="space-y-3 px-4 pt-3 pb-4 text-[12.5px] leading-[1.45]">
            <li className="flex items-start gap-2.5">
              <Icons.Hand className={cx("mt-0.5 size-4 shrink-0", ui.muted)} />
              <span>
                <span className="block font-medium">
                  {tr({ en: "Attendance", id: "Kehadiran" })} {health.attended}/{health.held}
                </span>
                <span className={cx("block font-semibold", BUDGET_TONE[budget.tone])}>{budget.label}</span>
                <span className={cx("block", ui.faint)}>
                  {tr({ en: `Some contracts bar the exam below ${attendanceTarget}%.`, id: `Sebagian kontrak melarang ujian di bawah ${attendanceTarget}%.` })}
                </span>
              </span>
            </li>
            {task && (
              <li className="flex items-start gap-2.5">
                <Icons.FileText className={cx("mt-0.5 size-4 shrink-0", ui.muted)} />
                <span>
                  <span className="block font-medium">{task.title}</span>
                  <span className={ui.muted}>
                    {task.fileRequired ? tr({ en: "File required · ", id: "Wajib unggah berkas · " }) : ""}
                    {task.lateAllowed ? tr({ en: "late allowed", id: "boleh terlambat" }) : tr({ en: "no late submission", id: "tidak bisa terlambat" })}
                  </span>
                  {taskSignals(data, task, now).editedAt && (
                    <span className="block font-semibold text-[#9a5b00] dark:text-[#f5c46a]">
                      {tr({ en: `Edited by lecturer ${f.dayMonth(taskSignals(data, task, now).editedAt!)}`, id: `Diubah dosen ${f.dayMonth(taskSignals(data, task, now).editedAt!)}` })}
                    </span>
                  )}
                </span>
              </li>
            )}
            {openTasks.length > 0 && (
              <li className="flex items-start gap-2.5">
                <Icons.ListChecks className={cx("mt-0.5 size-4 shrink-0", ui.muted)} />
                <span>
                  <span className="block font-medium">
                    {tr({ en: `${openTasks.length} other open task${openTasks.length > 1 ? "s" : ""}`, id: `${openTasks.length} tugas lain belum selesai` })}
                  </span>
                  <span className={ui.muted}>{openTasks.map((t) => t.title).join(", ")}</span>
                </span>
              </li>
            )}
            <li className="flex items-start gap-2.5">
              <Icons.EyeOff className={cx("mt-0.5 size-4 shrink-0", ui.muted)} />
              <span>
                <span className="block font-medium">{tr({ en: "No grades published yet", id: "Belum ada nilai" })}</span>
                <span className={ui.muted}>
                  {tr({ en: 'EduNex\'s "0.00 · E" is a placeholder, not your grade.', id: 'Angka "0.00 · E" di EduNex hanya pengisi, bukan nilaimu.' })}
                </span>
              </span>
            </li>
          </ul>
        </div>
        <button
          className={cx("flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-semibold", ui.secondary, ui.focus)}
          style={{ boxShadow: `inset 3px 0 0 ${tint(course.color, 0.9)}` }}
        >
          <Icons.Smartphone className="size-4" />
          {tr({ en: "Add to phone calendar", id: "Tambahkan ke kalender HP" })}
        </button>
      </aside>
    </div>
  );
}
