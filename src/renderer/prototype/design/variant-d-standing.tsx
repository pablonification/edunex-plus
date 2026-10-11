// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": where a course grade
// stands. EduNex's gradebook shows "0.00 · E" until it's published, task
// scores are hidden, and SIX only shows the final letter after the semester.
// The weights live in each course contract (ITB rules require lecturers to
// share them at the start), so the Student enters them once.
import { useState } from "react";
import type { Course } from "./data";
import { Icons } from "./icons";
import { attendanceHealth } from "./variant-d-insights";
import type { VariantProps } from "./variant-props";
import { SourceTag, cx, ui, useDSettings } from "./variant-d-ui";

interface Component {
  key: string;
  label: { en: string; id: string };
  weight: number;
  /** Known or expected score out of 100; null while unknown. */
  score: number | null;
  /** Filled by the app, not typed. */
  auto?: "attendance";
}

/** A real ITB course contract's scheme (Fisika Dasar 2022/23), offered as a starting point only. */
const TEMPLATE: Component[] = [
  { key: "uts", label: { en: "Midterm (UTS)", id: "UTS" }, weight: 30, score: null },
  { key: "uas", label: { en: "Final (UAS)", id: "UAS" }, weight: 30, score: null },
  { key: "tugas", label: { en: "Assignments", id: "Tugas" }, weight: 20, score: null },
  { key: "kuis", label: { en: "Quizzes", id: "Kuis" }, weight: 10, score: null },
  { key: "hadir", label: { en: "Attendance", id: "Kehadiran" }, weight: 10, score: null, auto: "attendance" },
];
const CUTOFFS: [string, number][] = [
  ["A", 75],
  ["AB", 68],
  ["B", 60],
  ["BC", 55],
  ["C", 50],
  ["D", 45],
];

const letterFor = (score: number) => CUTOFFS.find(([, min]) => score >= min - 1e-9)?.[0] ?? "E";

export function StandingCard({ course, compact, ...p }: VariantProps & { course: Course; compact?: boolean }) {
  const { data, now, f, tr } = p;
  const { attendanceTarget } = useDSettings();
  const health = attendanceHealth(data, course.code, now, f, attendanceTarget);
  const attendanceScore = health.attended !== null && health.held ? Math.round((health.attended / health.held) * 100) : null;
  const [parts, setParts] = useState<Component[]>(() =>
    TEMPLATE.map((c) => (c.auto === "attendance" ? { ...c, score: attendanceScore } : { ...c })),
  );
  const [fromContract, setFromContract] = useState(false);
  const tasks = data.tasks.filter((t) => t.courseCode === course.code);
  const scored = tasks.filter((t) => t.score !== null);
  const totalWeight = parts.reduce((s, c) => s + c.weight, 0);
  const known = parts.filter((c) => c.score !== null);
  const knownPoints = known.reduce((s, c) => s + (c.weight * (c.score ?? 0)) / 100, 0);
  const missing = parts.filter((c) => c.score === null);
  const missingWeight = missing.reduce((s, c) => s + c.weight, 0);
  const projected = missing.length === 0 ? knownPoints : null;
  // What the open components must average for each letter.
  const needs = CUTOFFS.slice(0, 3).map(([letter, min]) => {
    const need = missingWeight > 0 ? ((min - knownPoints) / missingWeight) * 100 : null;
    return { letter, need };
  });
  const set = (key: string, patch: Partial<Component>) => setParts((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  return (
    <div className={cx("overflow-hidden", ui.card)}>
      <div className={cx("flex items-start justify-between gap-4 border-b px-4 py-3.5", ui.line)}>
        <div>
          <p className="text-[14px] font-semibold">{tr({ en: "Where your grade stands", id: "Posisi nilaimu" })}</p>
          <p className={cx("mt-0.5 text-[12.5px]", ui.muted)}>
            {course.gradebookPublished
              ? tr({ en: "From EduNex's gradebook.", id: "Dari buku nilai EduNex." })
              : tr({
                  en: 'EduNex\'s gradebook isn\'t published, so it shows "0.00 · E". That\'s a placeholder, not your grade.',
                  id: 'Buku nilai EduNex belum dirilis, jadi tampil "0.00 · E". Itu hanya pengisi, bukan nilaimu.',
                })}
          </p>
        </div>
        <SourceTag source="EduNex" />
      </div>

      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className={cx("text-[12px] font-semibold", ui.muted)}>
            {fromContract
              ? tr({ en: "Weights from your course contract", id: "Bobot dari kontrak kuliahmu" })
              : tr({ en: "Example weights (an ITB course contract)", id: "Contoh bobot (kontrak kuliah ITB)" })}
          </p>
          {!fromContract && (
            <button onClick={() => setFromContract(true)} className={cx("rounded text-[12px] font-medium", ui.accentText, ui.focus)}>
              {tr({ en: "Use my contract's weights", id: "Pakai bobot kontrakku" })}
            </button>
          )}
        </div>
        <table className="mt-2 w-full text-[13px]">
          <thead>
            <tr className={cx("text-left text-[11.5px]", ui.faint)}>
              <th className="py-1 font-medium">{tr({ en: "Part", id: "Komponen" })}</th>
              <th className="w-[70px] py-1 text-right font-medium">{tr({ en: "Weight", id: "Bobot" })}</th>
              <th className="w-[96px] py-1 text-right font-medium">{tr({ en: "Score", id: "Nilai" })}</th>
            </tr>
          </thead>
          <tbody>
            {parts.map((c) => (
              <tr key={c.key} className={cx("border-t", ui.line)}>
                <td className="py-1.5">
                  <span className="font-medium">{tr(c.label)}</span>
                  {c.key === "tugas" && tasks.length > 0 && (
                    <span className={cx("ml-1.5 text-[11.5px]", ui.faint)}>
                      {scored.length
                        ? tr({ en: `${scored.length} of ${tasks.length} scored`, id: `${scored.length} dari ${tasks.length} dinilai` })
                        : tr({ en: `${tasks.length} tasks, scores hidden`, id: `${tasks.length} tugas, nilai disembunyikan` })}
                    </span>
                  )}
                  {c.auto === "attendance" && <span className={cx("ml-1.5 text-[11.5px]", ui.faint)}>{tr({ en: "from SIX", id: "dari SIX" })}</span>}
                </td>
                <td className="py-1.5 text-right">
                  <input
                    aria-label={tr({ en: "Weight", id: "Bobot" })}
                    value={c.weight}
                    onChange={(e) => set(c.key, { weight: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                    className={cx("h-7 w-12 rounded-md px-1.5 text-right tabular-nums", ui.fill, ui.focus)}
                  />
                  <span className={cx("ml-0.5", ui.faint)}>%</span>
                </td>
                <td className="py-1.5 text-right">
                  {c.auto ? (
                    <span className="font-semibold tabular-nums">{c.score ?? "—"}</span>
                  ) : (
                    <input
                      aria-label={tr({ en: "Expected score", id: "Perkiraan nilai" })}
                      placeholder="—"
                      value={c.score ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d]/g, "");
                        set(c.key, { score: v === "" ? null : Math.min(100, Number(v)) });
                      }}
                      className={cx("h-7 w-16 rounded-md px-1.5 text-right tabular-nums", ui.fill, ui.focus)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalWeight !== 100 && (
          <p className="mt-2 text-[12px] font-medium text-[#b42318] dark:text-[#ff9c94]">
            {tr({ en: `Weights add up to ${totalWeight}%, not 100%.`, id: `Total bobot ${totalWeight}%, bukan 100%.` })}
          </p>
        )}
      </div>

      <div className={cx("border-t px-4 py-3.5", ui.line, ui.fill)}>
        {projected !== null ? (
          <p className="text-[13.5px]">
            {tr({ en: "You'd finish at", id: "Nilai akhirmu sekitar" })}{" "}
            <span className="font-semibold tabular-nums">{projected.toFixed(1)}</span> ·{" "}
            <span className="text-[16px] font-semibold">{letterFor(projected)}</span>
          </p>
        ) : (
          <div className="space-y-1">
            <p className={cx("text-[12.5px]", ui.muted)}>
              {tr({
                en: `To reach each grade, the parts still open (${missing.map((c) => tr(c.label)).join(", ")}) need to average:`,
                id: `Agar mencapai tiap nilai, komponen yang belum ada (${missing.map((c) => tr(c.label)).join(", ")}) rata-rata harus:`,
              })}
            </p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
              {needs.map(({ letter, need }) => (
                <span key={letter}>
                  <span className="font-semibold">{letter}</span>{" "}
                  <span className="tabular-nums">
                    {need === null ? "—" : need > 100 ? tr({ en: "out of reach", id: "tak tercapai" }) : `≥ ${Math.max(0, Math.ceil(need))}`}
                  </span>
                </span>
              ))}
            </p>
          </div>
        )}
        {!compact && (
          <p className={cx("mt-2 text-[11.5px] leading-[1.5]", ui.faint)}>
            {tr({
              en: `Letter cut-offs follow the same contract (A ≥ 75, AB ≥ 68, B ≥ 60…); yours may differ. The real grade appears in SIX after UAS, once you've filled the course questionnaire.`,
              id: `Batas huruf mengikuti kontrak yang sama (A ≥ 75, AB ≥ 68, B ≥ 60…); milikmu bisa berbeda. Nilai resmi muncul di SIX setelah UAS, setelah kamu mengisi kuesioner.`,
            })}
          </p>
        )}
      </div>
    </div>
  );
}

/** A one-line reminder of why the official screens can't answer "how am I doing?". */
export function GradeVisibility(p: VariantProps) {
  const { data, now, f, tr } = p;
  const survey = data.academicCalendar.find((e) => e.key === "survey" && new Date(e.end) >= now);
  const due = data.academicCalendar.find((e) => e.key === "grades" && new Date(e.end) >= now);
  return (
    <ul className={cx("space-y-1.5 text-[12.5px] leading-[1.5]", ui.muted)}>
      <li className="flex items-start gap-2">
        <Icons.EyeOff className="mt-0.5 size-3.5 shrink-0" />
        {tr({
          en: `EduNex shows "0.00 · E" for every course until the lecturer publishes, and keeps task scores hidden.`,
          id: `EduNex menampilkan "0.00 · E" untuk semua mata kuliah sampai dosen merilis, dan menyembunyikan nilai tugas.`,
        })}
      </li>
      {survey && (
        <li className="flex items-start gap-2">
          <Icons.ClipboardCheck className="mt-0.5 size-3.5 shrink-0" />
          {tr({
            en: `SIX keeps a course's grade hidden until you fill its questionnaire (${f.dayMonth(survey.start)}–${f.dayMonth(survey.end)}). You'll get a reminder.`,
            id: `SIX menyembunyikan nilai sampai kamu mengisi kuesioner mata kuliah itu (${f.dayMonth(survey.start)}–${f.dayMonth(survey.end)}). Kamu akan diingatkan.`,
          })}
        </li>
      )}
      {due && (
        <li className="flex items-start gap-2">
          <Icons.Calendar className="mt-0.5 size-3.5 shrink-0" />
          {tr({
            en: `Lecturers have until ${f.dayMonth(due.start)} to enter final grades. You're notified the moment one appears.`,
            id: `Dosen punya waktu sampai ${f.dayMonth(due.start)} untuk memasukkan nilai akhir. Kamu diberi tahu begitu nilai muncul.`,
          })}
        </li>
      )}
    </ul>
  );
}
