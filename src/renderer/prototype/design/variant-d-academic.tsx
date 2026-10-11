// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": Akademik — KRS status,
// UKT bills and the graduation map, all from SIX, in plain words.
import { useState } from "react";
import type { CurriculumCourse } from "./data";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import { clashes } from "./variant-d-insights";
import { Planner } from "./variant-d-planner";
import { SourceTag, courseOf, cx, rupiah, termText, ui } from "./variant-d-ui";

type Tab = "plan" | "calendar" | "krs" | "ukt" | "curriculum";

export function AcademicPage(p: VariantProps) {
  const { data, tr } = p;
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(window.location.search).get("tab") as Tab | null) ?? "plan");
  const s = data.student;
  const tabs: { key: Tab; label: string }[] = [
    { key: "plan", label: tr({ en: "Planner", id: "Perencana" }) },
    { key: "calendar", label: tr({ en: "Deadlines", id: "Tenggat akademik" }) },
    { key: "krs", label: "KRS" },
    { key: "ukt", label: "UKT" },
    { key: "curriculum", label: tr({ en: "Curriculum map", id: "Peta kurikulum" }) },
  ];
  return (
    <div className="mx-auto max-w-[1000px] px-10 pt-7 pb-20">
      <header>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">{tr({ en: "Study plan", id: "Rencana studi" })}</h1>
        <p className={cx("mt-1 flex flex-wrap gap-x-3 text-[13px]", ui.muted)}>
          <span>{s.program?.replace(/^\d+ \/ /, "")}</span>
          {s.advisor && (
            <>
              <span className={ui.faint}>·</span>
              <span>
                {tr({ en: "Academic advisor", id: "Dosen wali" })}: {s.advisor}
              </span>
            </>
          )}
        </p>
      </header>
      <nav className={cx("mt-5 flex gap-6 border-b", ui.line)} role="tablist">
        {tabs.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={cx(
              "-mb-px h-10 border-b-2 text-[13.5px] font-medium transition-colors",
              tab === x.key ? "border-current" : cx("border-transparent hover:text-current", ui.muted),
              ui.focus,
            )}
          >
            {x.label}
          </button>
        ))}
      </nav>
      <div className="pt-6">
        {tab === "plan" && <Planner {...p} />}
        {tab === "calendar" && <Deadlines {...p} />}
        {tab === "krs" && <Krs {...p} />}
        {tab === "ukt" && <Ukt {...p} />}
        {tab === "curriculum" && <GraduationMap {...p} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- KRS

const STEP_LABELS: Record<string, { en: string; id: string }> = {
  "Pengiriman Rencana Studi": { en: "Plan sent", id: "Rencana studi dikirim" },
  "Persetujuan Dosen Wali": { en: "Approved by advisor", id: "Disetujui dosen wali" },
  "Pembayaran UKT": { en: "UKT paid", id: "UKT dibayar" },
  "Pengesahan KSM": { en: "KSM legalized", id: "KSM disahkan" },
  "Pengesahan KSM Pengganti": { en: "Revised KSM legalized", id: "KSM pengganti disahkan" },
};

function Krs(p: VariantProps) {
  const { data, f, tr, lang, go } = p;
  const plan = data.krs.steps.filter((x) => x.phase === "plan");
  const change = data.krs.steps.filter((x) => x.phase === "change");
  const total = data.krs.courses.reduce((sum, c) => sum + c.sks, 0);
  const done = data.krs.steps.every((x) => x.at || x.amount);
  return (
    <div className="grid grid-cols-[340px_minmax(0,1fr)] gap-8">
      <section>
        <div className={cx("flex items-center gap-3 rounded-xl px-4 py-3.5", done ? "bg-[#e3f5ea] dark:bg-[#12301f]" : "bg-[#fff1d6] dark:bg-[#3a2c10]")}>
          <Icons.ShieldCheck className={cx("size-5", done ? "text-[#178a4a] dark:text-[#6fdc9c]" : "text-[#8a5300] dark:text-[#f5c46a]")} />
          <div>
            <p className="text-[14px] font-semibold">
              {done ? tr({ en: "KRS complete", id: "KRS selesai" }) : tr({ en: "KRS in progress", id: "KRS dalam proses" })}
            </p>
            <p className={cx("text-[12px]", ui.muted)}>{termText(tr, data.krs.heading.replace(/^Semester /, "").replace(/ \((Ganjil|Genap)\) - /, "-"))}</p>
          </div>
        </div>
        <Timeline title={tr({ en: "Study plan", id: "Rencana studi" })} steps={plan} f={f} tr={tr} lang={lang} />
        {change.length > 0 && <Timeline title={tr({ en: "Plan change (URS)", id: "Penggantian rencana studi (URS)" })} steps={change} f={f} tr={tr} lang={lang} />}
      </section>
      <section>
        {clashes(data, p.now, f).map((c) => (
          <p key={c.codes.join()} className="mb-4 flex items-start gap-2.5 rounded-lg bg-[#fdeceb] px-3.5 py-2.5 text-[13px] leading-[1.5] text-[#7a1f14] dark:bg-[#3a1c19] dark:text-[#ffb4aa]">
            <Icons.Overlap className="mt-0.5 size-4 shrink-0" />
            {tr({
              en: `This plan has a clash SIX didn't flag: ${c.codes[0]} and ${c.codes[1]} overlap every ${c.weekday}, ${c.from}–${c.to}. Next time, the planner checks class times before you send your KRS.`,
              id: `Rencana ini bentrok tanpa peringatan SIX: ${c.codes[0]} dan ${c.codes[1]} tumpang tindih setiap ${c.weekday}, ${c.from}–${c.to}. Berikutnya, perencana memeriksa jam kelas sebelum KRS dikirim.`,
            })}
          </p>
        ))}
        <h2 className="mb-3 flex items-baseline justify-between text-[15px] font-semibold">
          {tr({ en: "Courses taken", id: "Mata kuliah diambil" })}
          <span className={cx("text-[12.5px] font-medium", ui.muted)}>{total} SKS</span>
        </h2>
        <ul className={cx("overflow-hidden", ui.card)}>
          {data.krs.courses.map((c, i) => {
            const course = courseOf(data, c.code);
            return (
              <li key={c.code} className={cx(i > 0 && "border-t", ui.line)}>
                <button
                  onClick={() => go("course", { course: c.code })}
                  className={cx("grid w-full grid-cols-[18px_76px_minmax(0,1fr)_60px_56px] items-center gap-3 px-4 py-3 text-left text-[13px]", ui.hover, ui.focus)}
                >
                  <span className="size-2.5 rounded-[3px]" style={{ background: course?.color ?? "#999" }} />
                  <span className="font-semibold tabular-nums">{c.code}</span>
                  <span className="truncate">{c.name}</span>
                  <span className={cx("tabular-nums", ui.muted)}>
                    {tr({ en: "Class", id: "Kelas" })} {c.classNo}
                  </span>
                  <span className="text-right font-medium tabular-nums">{c.sks} SKS</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Timeline({
  title,
  steps,
  f,
  tr,
  lang,
}: {
  title: string;
  steps: VariantProps["data"]["krs"]["steps"];
  f: VariantProps["f"];
  tr: VariantProps["tr"];
  lang: VariantProps["lang"];
}) {
  return (
    <div className="mt-6">
      <p className={cx("mb-3 text-[12px] font-semibold", ui.muted)}>{title}</p>
      <ol className="relative ml-2 space-y-4 border-l border-[#dcdce1] pl-5 dark:border-[#34343a]">
        {steps.map((s, i) => {
          const ok = Boolean(s.at || s.amount);
          return (
            <li key={i} className="relative">
              <span
                className={cx(
                  "absolute top-0.5 -left-[27px] grid size-[13px] place-items-center rounded-full ring-4 ring-white dark:ring-[#161618]",
                  ok ? "bg-[#22a35a]" : "bg-[#d4d4da] dark:bg-[#4a4a52]",
                )}
              >
                {ok && <Icons.Check className="size-2.5 text-white" strokeWidth={3.5} />}
              </span>
              <p className="text-[13.5px] font-medium">{STEP_LABELS[s.label] ? tr(STEP_LABELS[s.label]) : s.label}</p>
              <p className={cx("text-[12px]", ui.muted)}>
                {s.amount !== null ? rupiah(s.amount, lang) : s.at ? `${f.weekdayShort(s.at)}, ${f.dayMonth(s.at)} · ${f.time(s.at)}` : "—"}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------- UKT

function Ukt({ data, f, tr, lang }: VariantProps) {
  const billed = data.bills.filter((b) => b.billed !== null);
  const current = billed[billed.length - 1];
  const upcoming = data.bills.slice(data.bills.indexOf(current) + 1).find((b) => b.kind !== "Pendek");
  const years = [...new Set(data.bills.map((b) => b.year))].reverse();
  const kindLabel = (kind: string) =>
    kind === "Ganjil" ? tr({ en: "Odd", id: "Ganjil" }) : kind === "Genap" ? tr({ en: "Even", id: "Genap" }) : tr({ en: "Short", id: "Pendek" });
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3">
        {current && (
          <div className={cx("px-5 py-4", ui.card)}>
            <p className={cx("text-[12px] font-medium", ui.muted)}>
              {tr({ en: "This semester", id: "Semester ini" })} · {current.year} {kindLabel(current.kind)}
            </p>
            <p className="mt-1 text-[24px] font-semibold tabular-nums">{rupiah(current.billed ?? 0, lang)}</p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#dcf4e5] px-2 py-0.5 text-[12px] font-semibold text-[#166240] dark:bg-[#12301f] dark:text-[#80e0a9]">
              <Icons.CheckCircle className="size-3.5" />
              {(current.paid ?? 0) >= (current.billed ?? 0) ? tr({ en: "Paid", id: "Lunas" }) : tr({ en: "Not paid yet", id: "Belum dibayar" })}
              {current.deadline && <span className="font-medium opacity-80">· {tr({ en: "due", id: "batas" })} {f.dayMonth(current.deadline)}</span>}
            </p>
          </div>
        )}
        {upcoming && (
          <div className={cx("px-5 py-4", ui.card)}>
            <p className={cx("text-[12px] font-medium", ui.muted)}>
              {tr({ en: "Next semester", id: "Semester depan" })} · {upcoming.year} {kindLabel(upcoming.kind)}
            </p>
            <p className="mt-1 text-[24px] font-semibold">{tr({ en: "Not billed yet", id: "Belum ditagih" })}</p>
            <p className={cx("mt-1.5 flex items-center gap-1.5 text-[12.5px]", ui.muted)}>
              <Icons.Bell className="size-3.5" />
              {tr({ en: "You'll get a reminder when the bill appears", id: "Kamu akan diingatkan saat tagihan muncul" })}
            </p>
          </div>
        )}
      </div>
      <section>
        <h2 className="mb-3 text-[15px] font-semibold">{tr({ en: "History", id: "Riwayat" })}</h2>
        <ul className={cx("overflow-hidden", ui.card)}>
          {years.map((year, yi) =>
            data.bills
              .filter((b) => b.year === year && b.billed !== null)
              .map((b, i) => (
                <li
                  key={`${year}-${b.semester}`}
                  className={cx("grid grid-cols-[130px_100px_minmax(0,1fr)_150px] items-center gap-3 px-4 py-3 text-[13px]", (yi > 0 || i > 0) && "border-t", ui.line)}
                >
                  <span className="font-medium tabular-nums">{year}</span>
                  <span className={ui.muted}>{kindLabel(b.kind)}</span>
                  <span className="tabular-nums">
                    {rupiah(b.billed ?? 0, lang)}
                    {b.installments && <span className={cx("ml-2 text-[11.5px]", ui.faint)}>{tr({ en: "in installments", id: "dicicil" })}</span>}
                  </span>
                  <span className="text-right">
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#178a4a] dark:text-[#6fdc9c]">
                      <Icons.Check className="size-3.5" strokeWidth={2.5} />
                      {(b.paid ?? 0) >= (b.billed ?? 0) ? tr({ en: "Paid", id: "Lunas" }) : tr({ en: "Partial", id: "Sebagian" })}
                    </span>
                  </span>
                </li>
              )),
          )}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- graduation map

function GraduationMap({ data, tr }: VariantProps) {
  const current = new Set(data.krs.courses.map((c) => c.code));
  const status = (c: CurriculumCourse) =>
    c.grade && c.grade !== "Dibebaskan" ? "passed" : c.grade === "Dibebaskan" ? "exempt" : current.has(c.code) ? "current" : "todo";
  // SIX's curriculum-position page places the courses you have taken or are
  // taking into curriculum semesters; it does not list ones not reached yet.
  const termSks = data.krs.courses.reduce((sum, c) => sum + c.sks, 0);
  const tone: Record<string, string> = {
    passed: "border-transparent bg-[#f3f8f5] dark:bg-[#14241b]",
    exempt: cx("border-transparent", ui.fill),
    current: "border-[#2f6feb]/40 bg-[#eef3fe] dark:border-[#3a77f0]/40 dark:bg-[#18223a]",
    todo: "border-dashed border-[#d6d6dc] bg-transparent dark:border-[#3a3a40]",
  };
  return (
    <div>
      <div className="grid grid-cols-4 gap-3">
        <div className={cx("px-4 py-3.5", ui.card)}>
          <p className={cx("text-[12px] font-medium", ui.muted)}>{tr({ en: "SKS passed", id: "SKS lulus" })}</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums">{data.student.sksPassed}</p>
        </div>
        <div className={cx("px-4 py-3.5", ui.card)}>
          <p className={cx("text-[12px] font-medium", ui.muted)}>{tr({ en: "This semester", id: "Semester ini" })}</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums">
            {data.krs.courses.length}
            <span className={cx("ml-1.5 text-[13px] font-medium", ui.muted)}>· {termSks} SKS</span>
          </p>
        </div>
        {data.curriculum.stages.map((st) => (
          <div key={st.name} className={cx("px-4 py-3.5", ui.card)}>
            <p className={cx("text-[12px] font-medium", ui.muted)}>
              {tr({ en: "Stage", id: "Tahap" })} {st.name}
            </p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums">
              IP {st.ip.toFixed(2)}
              <span className={cx("ml-1.5 text-[13px] font-medium", ui.muted)}>· {st.sksPassed} SKS</span>
            </p>
          </div>
        ))}
      </div>

      <p className={cx("mt-7 mb-3 text-[13px]", ui.muted)}>
        {tr({ en: "Your courses, placed by curriculum semester (SIX)", id: "Mata kuliahmu, menurut semester kurikulum (SIX)" })}
      </p>
      <div className="grid grid-cols-4 gap-x-4 gap-y-6">
        {data.curriculum.stages.flatMap((st) =>
          st.semesters.map((sem) => (
            <section key={`${st.name}-${sem.number}`} className="min-w-0">
              <h3 className="mb-2 flex items-baseline justify-between text-[12.5px] font-semibold">
                {tr({ en: "Semester", id: "Semester" })} {sem.number}
                <span className={cx("font-medium", ui.faint)}>{sem.courses.reduce((s, c) => s + c.sks, 0)} SKS</span>
              </h3>
              <ul className="space-y-1.5">
                {sem.courses.map((c) => {
                  const st2 = status(c);
                  return (
                    <li key={c.code} className={cx("rounded-lg border px-2.5 py-2", tone[st2])}>
                      <p className="flex items-center justify-between gap-2 text-[11.5px] font-semibold tabular-nums">
                        <span className={st2 === "todo" ? ui.muted : ""}>{c.code}</span>
                        {st2 === "passed" && <span className="text-[#178a4a] dark:text-[#6fdc9c]">{c.grade}</span>}
                        {st2 === "current" && <span className="text-[#2f6feb] dark:text-[#7aa2ff]">{tr({ en: "Now", id: "Kini" })}</span>}
                        {st2 === "exempt" && <span className={ui.faint}>{tr({ en: "Exempt", id: "Bebas" })}</span>}
                        {st2 === "todo" && c.kind === "elective" && <span className={ui.faint}>{tr({ en: "Elective", id: "Pilihan" })}</span>}
                      </p>
                      <p className={cx("mt-0.5 line-clamp-2 text-[12px] leading-snug", st2 === "todo" && ui.muted)}>{c.name}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )),
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- deadlines (ITB calendar + SIX + EduNex)

const WHAT_TO_DO: Record<string, { en: string; id: string }> = {
  uts: { en: "Exam dates per course are on the Tasks & Exams page.", id: "Tanggal ujian per mata kuliah ada di halaman Tugas & Ujian." },
  classes_next: { en: "Next semester's class times appear; your plan is checked for clashes.", id: "Jadwal kelas semester depan terbit; rencanamu diperiksa bentrok." },
  survey: { en: "Fill the questionnaire for every course, or SIX keeps that grade hidden.", id: "Isi kuesioner tiap mata kuliah, atau SIX menyembunyikan nilainya." },
  uas: { en: "Final exams. Check attendance first: some contracts bar the exam below the minimum.", id: "Ujian akhir. Cek kehadiran dulu: sebagian kontrak melarang ujian di bawah batas." },
  grades: { en: "Last day for lecturers to enter grades. You're notified as each one lands.", id: "Batas dosen memasukkan nilai. Kamu diberi tahu tiap nilai masuk." },
  monev: { en: "ITB checks every student's progress (SKS and IPK).", id: "ITB memeriksa kemajuan studi (SKS dan IPK) tiap mahasiswa." },
  drs2: { en: "Send your study plan in SIX, then get your advisor's approval.", id: "Kirim rencana studi di SIX, lalu minta persetujuan dosen wali." },
  ukt2: { en: "Pay UKT, or the KRS can't be legalized.", id: "Bayar UKT, atau KRS tidak bisa disahkan." },
  lectures2: { en: "Semester II starts.", id: "Semester II dimulai." },
  urs2: { en: "Last chance to change your study plan.", id: "Kesempatan terakhir mengubah rencana studi." },
  uas2: { en: "Final exams for Semester II.", id: "Ujian akhir Semester II." },
};

function Deadlines(p: VariantProps) {
  const { data, now, f, tr } = p;
  const upcoming = data.academicCalendar.filter((e) => new Date(e.end) >= now && e.key !== "lectures").slice(0, 10);
  return (
    <div>
      <p className={cx("mb-4 flex items-center gap-1.5 text-[13px]", ui.muted)}>
        {tr({ en: "From the official", id: "Dari" })} <SourceTag source="ITB" />
        {tr({
          en: "academic calendar, with what each date means for you. SIX and EduNex don't show these.",
          id: "resmi, beserta artinya untukmu. SIX dan EduNex tidak menampilkannya.",
        })}
      </p>
      <ol className={cx("overflow-hidden", ui.card)}>
        {upcoming.map((e, i) => {
          const live = new Date(e.start) <= now;
          return (
            <li key={e.key} className={cx("grid grid-cols-[150px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3.5", i > 0 && "border-t", ui.line)}>
              <span className="text-[13px] font-semibold tabular-nums">
                {f.dayKey(e.start) === f.dayKey(e.end) ? f.dayMonth(e.start) : `${f.dayMonth(e.start)} – ${f.dayMonth(e.end)}`}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium">{tr({ en: e.en, id: e.id })}</span>
                {WHAT_TO_DO[e.key] && <span className={cx("mt-0.5 block text-[12.5px]", ui.muted)}>{tr(WHAT_TO_DO[e.key])}</span>}
              </span>
              <span className={cx("text-right text-[12px] whitespace-nowrap", live ? "font-semibold text-[#178a4a] dark:text-[#6fdc9c]" : ui.faint)}>
                {live ? tr({ en: "Now", id: "Berlangsung" }) : f.fromNow(e.start)}
              </span>
            </li>
          );
        })}
      </ol>
      {data.survey && (
        <p className={cx("mt-3 text-[12px]", ui.faint)}>
          {tr({
            en: `Last questionnaire (${data.survey.term}): ${data.survey.filled} of ${data.survey.total} filled.`,
            id: `Kuesioner terakhir (${data.survey.term}): ${data.survey.filled} dari ${data.survey.total} terisi.`,
          })}
        </p>
      )}
    </div>
  );
}
