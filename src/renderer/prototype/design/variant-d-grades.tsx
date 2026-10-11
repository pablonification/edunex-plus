// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": Nilai — the SIX
// transcript made readable, plus an IPK target calculator for this term.
import { useState } from "react";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import { HONORS } from "./variant-d-insights";
import { ProjectedTable, projectPlan, usePlanState } from "./variant-d-planner";
import { GradeVisibility } from "./variant-d-standing";
import { SourceTag, cx, gradeForIp, termText, ui } from "./variant-d-ui";

export function GradesPage(p: VariantProps) {
  const { data, tr } = p;
  const { grades, student } = data;
  const ipk = student.ipk ?? grades.ipk ?? 0;
  const lastIp = [...grades.semesters].reverse().find((s) => s.ip !== null)?.ip ?? null;
  const stage = data.curriculum.stages[data.curriculum.stages.length - 1];

  return (
    <div className="mx-auto max-w-[1000px] px-10 pt-7 pb-20">
      <header>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{p.t("grades")}</h1>
        <p className={cx("mt-1 flex items-center gap-1.5 text-[13px]", ui.muted)}>
          {tr({ en: "Transcript from", id: "Transkrip dari" })} <SourceTag source="SIX" />
          {tr({ en: "· this semester's standing from", id: "· posisi semester ini dari" })} <SourceTag source="EduNex" />
        </p>
      </header>

      <div className="mt-6 grid grid-cols-4 gap-3">
        <Stat label="IPK" value={ipk.toFixed(2)} big />
        <Stat label={tr({ en: "SKS passed", id: "SKS lulus" })} value={String(student.sksPassed || grades.sksPassed)} />
        <Stat label={tr({ en: "Last semester IP", id: "IP semester lalu" })} value={lastIp !== null ? lastIp.toFixed(2) : "—"} />
        {stage && <Stat label={`${tr({ en: "Stage", id: "Tahap" })} ${stage.name}`} value={`IP ${stage.ip.toFixed(2)}`} />}
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_380px] gap-8">
        <IpChart {...p} />
        <HonorsPlanner {...p} />
      </div>

      <ThisSemester {...p} />

      <Transcript {...p} />
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className={cx("px-4 py-3.5", ui.card)}>
      <p className={cx("text-[12px] font-medium", ui.muted)}>{label}</p>
      <p className={cx("mt-1 font-semibold tracking-[-0.02em] tabular-nums", big ? "text-[30px] leading-9" : "text-[22px] leading-9")}>{value}</p>
    </div>
  );
}

function IpChart(p: VariantProps) {
  const { data, tr } = p;
  const semesters = data.grades.semesters.filter((s) => s.ip !== null);
  // This semester and the planned ones, estimated from the grades picked in the planner.
  const projected = projectPlan(p, usePlanState(data)).steps.filter((x) => x.projected && x.ip !== null);
  const bar = (value: number) => ({ height: `${Math.max(8, ((value - 2) / 2) * 110)}px` });
  return (
    <section className={cx("p-5", ui.card)}>
      <h2 className="flex items-baseline justify-between text-[14px] font-semibold">
        {tr({ en: "IP per semester", id: "IP per semester" })}
        <span className={cx("inline-flex items-center gap-3 text-[11.5px] font-medium", ui.faint)}>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-[#c9d8fb] dark:bg-[#2a3b61]" />
            {tr({ en: "Final", id: "Final" })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-dashed border-[#2f6feb]" />
            {tr({ en: "Estimate", id: "Perkiraan" })}
          </span>
        </span>
      </h2>
      <div className="mt-5 flex h-[150px] items-end gap-3">
        {semesters.map((s) => {
          const m = /Semester (\d) Tahun (\d{4})\/(\d{4})/.exec(s.label);
          const label = m ? `${m[2].slice(2)}/${m[3].slice(2)}·${m[1]}` : s.label;
          const value = s.ip ?? 0;
          return (
            <div key={s.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[12px] font-semibold tabular-nums">{value.toFixed(2)}</span>
              <span className="w-full max-w-[44px] rounded-md bg-[#c9d8fb] dark:bg-[#2a3b61]" style={bar(value)} />
              <span className={cx("text-[11px] tabular-nums", ui.faint)}>{label}</span>
            </div>
          );
        })}
        {projected.map((x) => (
          <div key={x.label} className="flex flex-1 flex-col items-center gap-2">
            <span className="text-[12px] font-semibold text-[#2f6feb] tabular-nums dark:text-[#7aa2ff]">{(x.ip ?? 0).toFixed(2)}</span>
            <span
              className="w-full max-w-[44px] rounded-md border-2 border-dashed border-[#2f6feb] bg-[#2f6feb]/10 dark:border-[#7aa2ff] dark:bg-[#7aa2ff]/10"
              style={bar(x.ip ?? 0)}
            />
            <span className="text-[11px] font-semibold text-[#2f6feb] dark:text-[#7aa2ff]">{x.label}</span>
          </div>
        ))}
      </div>
      <p className={cx("mt-4 text-[12px]", ui.faint)}>
        {tr({
          en: "Estimates use the grades you picked in the study planner.",
          id: "Perkiraan memakai nilai yang kamu pilih di perencana studi.",
        })}
      </p>
    </section>
  );
}

function HonorsPlanner(p: VariantProps) {
  const { data, tr, lang, go } = p;
  const plan = usePlanState(data);
  const proj = projectPlan(p, plan);
  const num = (n: number) => (lang === "id" ? n.toFixed(2).replace(".", ",") : n.toFixed(2));
  const plannedSks = proj.variableSks - proj.curSks;
  return (
    <section className={cx("flex flex-col p-5", ui.card)}>
      <h2 className="flex items-center gap-2 text-[14px] font-semibold">
        <Icons.Flag className="size-4 text-[#d7a20f]" />
        {tr({ en: "IPK at graduation", id: "IPK saat lulus" })}
      </h2>
      <p className={cx("mt-1 text-[12px]", ui.muted)}>
        {tr({
          en: `From your study plan: this semester's ${proj.curSks} SKS and ${plannedSks} SKS planned, at the grades you expect.`,
          id: `Dari rencana studimu: ${proj.curSks} SKS semester ini dan ${plannedSks} SKS rencana, dengan nilai perkiraanmu.`,
        })}
      </p>
      <p className="mt-4 text-[34px] leading-10 font-semibold tracking-[-0.02em] tabular-nums">{num(proj.finalIpk)}</p>
      <p className={cx("text-[12.5px] font-semibold", proj.honor ? "text-[#178a4a] dark:text-[#6fdc9c]" : ui.muted)}>
        {proj.honor ? tr(proj.honor.label) : proj.finalIpk >= 2.75 ? tr({ en: "Very satisfactory", id: "Sangat memuaskan" }) : tr({ en: "Satisfactory", id: "Memuaskan" })}
      </p>
      <div className="-mx-4 mt-3">
        <ProjectedTable steps={proj.steps} num={num} tr={tr} />
      </div>
      <ul className={cx("mt-1 space-y-1.5 rounded-lg px-3 py-3 text-[12.5px] leading-snug", ui.fill)}>
        {[...HONORS].reverse().map((h) => {
          const need = projectPlan(p, { ...plan, target: h.min }).needAvg;
          return (
            <li key={h.key} className="flex items-baseline justify-between gap-3">
              <span className="font-medium">
                {tr(h.label)} <span className={ui.faint}>≥ {num(h.min)}</span>
              </span>
              <span className={cx("text-right tabular-nums", need === null || need > 4 ? ui.faint : "font-semibold")}>
                {need === null || need > 4
                  ? tr({ en: "out of reach", id: "tak tercapai" })
                  : tr({ en: `needs ${num(need)} avg (${gradeForIp(need) ?? "A"})`, id: `butuh rata-rata ${num(need)} (${gradeForIp(need) ?? "A"})` })}
              </span>
            </li>
          );
        })}
      </ul>
      <button
        onClick={() => go("academic")}
        className={cx("mt-4 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold", ui.secondary, ui.focus)}
      >
        {tr({ en: "Change grades or courses in the planner", id: "Ubah nilai atau mata kuliah di perencana" })}
        <Icons.ChevronRight className="size-4" />
      </button>
    </section>
  );
}

function Transcript({ data, tr }: VariantProps) {
  const [open, setOpen] = useState<string | null>(data.transcript[data.transcript.length - 2]?.label ?? null);
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-[15px] font-semibold">{tr({ en: "Transcript", id: "Transkrip" })}</h2>
      <ul className={cx("overflow-hidden", ui.card)}>
        {[...data.transcript].reverse().map((sem, i) => {
          const ip = data.grades.semesters.find((s) => s.label === sem.label)?.ip ?? null;
          const isOpen = open === sem.label;
          const m = /Semester (\d) Tahun (\d{4}\/\d{4})/.exec(sem.label);
          return (
            <li key={sem.label} className={cx(i > 0 && "border-t", ui.line)}>
              <button
                onClick={() => setOpen(isOpen ? null : sem.label)}
                aria-expanded={isOpen}
                className={cx("flex w-full items-center gap-3 px-4 py-3 text-left", ui.hover, ui.focus)}
              >
                <Icons.ChevronRight className={cx("size-4 transition-transform", isOpen && "rotate-90", ui.faint)} />
                <span className="flex-1 text-[13.5px] font-medium">{m ? termText(tr, `${m[1]}-${m[2]}`) : sem.label}</span>
                <span className={cx("text-[12.5px]", ui.muted)}>{sem.courses.length} {tr({ en: "courses", id: "mata kuliah" })}</span>
                <span className="w-[64px] text-right text-[13px] font-semibold tabular-nums">{ip !== null ? `IP ${ip.toFixed(2)}` : "—"}</span>
              </button>
              {isOpen && (
                <ul className={cx("border-t px-4 py-2", ui.line, "bg-[#fafafb] dark:bg-[#19191c]")}>
                  {sem.courses.map((c) => (
                    <li key={c.code} className="grid grid-cols-[84px_minmax(0,1fr)_56px_48px] items-center gap-3 py-1.5 text-[13px]">
                      <span className="font-semibold tabular-nums">{c.code}</span>
                      <span className="truncate">{c.name}</span>
                      <span className={cx("text-right tabular-nums", ui.muted)}>{c.sks} SKS</span>
                      <span className="text-right">
                        {c.grade ? (
                          <span className={cx("inline-grid min-w-8 place-items-center rounded-md px-1.5 py-0.5 text-[12px] font-bold", gradeTone(c.grade))}>{c.grade}</span>
                        ) : (
                          <span className={ui.faint}>—</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function gradeTone(grade: string): string {
  if (grade === "A" || grade === "AB") return "bg-[#dcf4e5] text-[#166240] dark:bg-[#12301f] dark:text-[#80e0a9]";
  if (grade === "B" || grade === "BC") return "bg-[#e6eefe] text-[#2f5fc4] dark:bg-[#1b2742] dark:text-[#9ab8ff]";
  if (grade === "C") return "bg-[#fdf2d6] text-[#875800] dark:bg-[#382d10] dark:text-[#f2c862]";
  return "bg-[#fde4e2] text-[#b42318] dark:bg-[#3a1817] dark:text-[#ff9c94]";
}

function ThisSemester(p: VariantProps) {
  const { data, tr, go } = p;
  return (
    <section className="mt-9">
      <h2 className="mb-3 text-[15px] font-semibold">{tr({ en: "This semester", id: "Semester ini" })}</h2>
      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-8">
        <ul className={cx("overflow-hidden", ui.card)}>
          {data.courses.map((c, i) => {
            const tasks = data.tasks.filter((t) => t.courseCode === c.code);
            const scored = tasks.filter((t) => t.score !== null).length;
            return (
              <li key={c.code} className={cx(i > 0 && "border-t", ui.line)}>
                <button
                  onClick={() => go("course", { course: c.code, tab: "grades" })}
                  className={cx("grid w-full grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left text-[13px]", ui.hover, ui.focus)}
                >
                  <span className="font-semibold tabular-nums">{c.code}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className={cx("block text-[12px]", ui.muted)}>
                      {c.gradebookPublished
                        ? tr({ en: "Gradebook published", id: "Buku nilai dirilis" })
                        : tr({ en: 'EduNex gradebook not published ("0.00 · E")', id: 'Buku nilai EduNex belum dirilis ("0.00 · E")' })}
                      {tasks.length > 0 &&
                        ` · ${scored ? tr({ en: `${scored}/${tasks.length} tasks scored`, id: `${scored}/${tasks.length} tugas dinilai` }) : tr({ en: `${tasks.length} task scores hidden`, id: `${tasks.length} nilai tugas disembunyikan` })}`}
                    </span>
                  </span>
                  <span className={cx("inline-flex items-center gap-1 text-[12.5px] font-medium", ui.accentText)}>
                    {tr({ en: "What do I need?", id: "Butuh berapa?" })}
                    <Icons.ChevronRight className="size-3.5" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <GradeVisibility {...p} />
      </div>
    </section>
  );
}
