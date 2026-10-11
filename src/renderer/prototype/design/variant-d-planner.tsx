// PROTOTYPE (#83) — throwaway. Variant D "Kuliah": the study planner. Every
// course in ITB's public catalog (SIX /pub/kur2024), the program's rules
// (SIX curriculum + Peraturan Akademik ITB) and the transcript, so the Student
// can plan semester by semester to graduation, see every rule checked live,
// and see the grades a target IPK needs.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
// @ts-ignore: generated locally into .scratch/ and never committed.
import catalogRaw from "../../../../.scratch/prototype/catalog.json";
import type { DesignData } from "./data";
import { Icons } from "./icons";
import { HONORS, graduationPath } from "./variant-d-insights";
import type { VariantProps } from "./variant-props";
import { GRADES, GRADE_POINTS, SourceTag, cx, gradeForIp, ui } from "./variant-d-ui";

// ---------------------------------------------------------------- catalog (SIX public pages)

export interface CatalogCourse {
  code: string;
  name: string;
  sks: number;
  category: string;
  prodi: string | null;
  mkId: number | null;
}
interface Minor {
  program: string;
  name: string;
  sks: number;
  description: string;
  courses: string[];
}
interface Catalog {
  builtAt: string | null;
  programs: { code: string; faculty: string; name: string }[];
  courses: CatalogCourse[];
  required: Record<string, { semester: number; code: string; sks: number }[]>;
  specializations: Record<string, { name: string; sks: number; courses: string[] }[]>;
  minors: Minor[];
}
const catalog = catalogRaw as Catalog;
const catalogByCode = new Map(catalog.courses.map((c) => [c.code, c]));
const programName = new Map(catalog.programs.map((p) => [p.code, p.name]));
const minorKey = (m: Minor) => `${m.program} · ${m.name}`;

// ---------------------------------------------------------------- terms

type Kind = "Ganjil" | "Genap" | "Pendek";
interface Term {
  /** SIX's term code: academic-year start + 1 (odd), 2 (even), 3 (short). */
  key: string;
  year: number;
  kind: Kind;
  /** The Student's semester number (short semesters don't count). */
  semester: number | null;
}

const KIND_OF = { "1": "Ganjil", "2": "Genap", "3": "Pendek" } as const;

function termOf(key: string, semesterNow: number, currentKey: string): Term {
  const [y, k] = key.split("-");
  const kind = KIND_OF[k as "1" | "2" | "3"];
  const regularBetween = (from: string, to: string) => {
    // Count regular terms after `from` up to and including `to`.
    let n = 0;
    let cur = from;
    while (cur < to) {
      cur = nextKey(cur, false);
      n += 1;
    }
    return n;
  };
  return { key, year: Number(y), kind, semester: kind === "Pendek" ? null : semesterNow + regularBetween(currentKey, key) };
}

/** The term after `key`; with `short`, a short semester follows an even one. */
function nextKey(key: string, short: boolean): string {
  const [y, k] = key.split("-").map(Number);
  if (k === 1) return `${y}-2`;
  if (k === 2) return short ? `${y}-3` : `${y + 1}-1`;
  return `${y + 1}-1`;
}

// ---------------------------------------------------------------- plan state (local, prototype only)

interface PlannedItem {
  code: string;
  grade: string;
  /** Retaking a course already passed: only the newest grade counts (Pasal 43). */
  retake?: boolean;
}
interface PlanState {
  terms: string[];
  items: Record<string, PlannedItem[]>;
  /** Expected grades for this semester's courses. */
  current: Record<string, string>;
  target: number;
  minor: string | null;
}

const PLAN_KEY = "edunex-plus-prototype-plan-v1";
let planSnapshot: PlanState | null = null;
const planListeners = new Set<() => void>();

function defaultPlan(data: DesignData, currentKey: string): PlanState {
  const path = graduationPath(data);
  const next = nextKey(currentKey, false);
  return {
    terms: [next],
    items: { [next]: path.nextTerm.map((c) => ({ code: c.code, grade: "AB" })) },
    current: Object.fromEntries(data.krs.courses.map((c) => [c.code, "AB"])),
    target: 3.5,
    minor: null,
  };
}

function usePlan(data: DesignData, currentKey: string): [PlanState, (fn: (s: PlanState) => PlanState) => void, () => void] {
  if (!planSnapshot) {
    try {
      planSnapshot = JSON.parse(localStorage.getItem(PLAN_KEY) ?? "null") ?? defaultPlan(data, currentKey);
    } catch {
      planSnapshot = defaultPlan(data, currentKey);
    }
  }
  const state = useSyncExternalStore(
    (l) => {
      planListeners.add(l);
      return () => planListeners.delete(l);
    },
    () => planSnapshot!,
  );
  const update = (fn: (s: PlanState) => PlanState) => {
    planSnapshot = fn(planSnapshot!);
    localStorage.setItem(PLAN_KEY, JSON.stringify(planSnapshot));
    for (const l of planListeners) l();
  };
  const reset = () => update(() => defaultPlan(data, currentKey));
  return [state, update, reset];
}

// ---------------------------------------------------------------- the Student's record

interface Record_ {
  prodi: string;
  required: Map<string, { semester: number; sks: number; name: string }>;
  /** Required courses SIX's curriculum-position page marks "Belum diambil". */
  requiredLeft: Set<string>;
  passed: Map<string, { grade: string; sks: number; term: string }>;
  exempt: Set<string>;
  current: Map<string, { name: string; sks: number }>;
  specialization: { name: string; courses: string[] } | null;
  electivesNow: number;
}

function recordOf(data: DesignData): Record_ {
  const prodi = /^(\d{3})/.exec(data.student.program ?? "")?.[1] ?? "";
  const required = new Map(data.curriculum.required.map((r) => [r.code, { semester: r.semester, sks: r.sks, name: r.name }]));
  const positioned = data.curriculum.stages.flatMap((st) => st.semesters.flatMap((s) => s.courses));
  const passed = new Map<string, { grade: string; sks: number; term: string }>();
  for (const sem of data.transcript)
    for (const c of sem.courses) if (c.grade && c.grade in GRADE_POINTS) passed.set(c.code, { grade: c.grade, sks: c.sks, term: sem.label });
  const spec = data.student.specialization
    ? data.curriculum.specializations.find((s) => s.name === data.student.specialization?.name)
    : undefined;
  return {
    prodi,
    required,
    requiredLeft: new Set(positioned.filter((c) => c.grade === "Belum diambil").map((c) => c.code)),
    passed,
    exempt: new Set(positioned.filter((c) => c.grade === "Dibebaskan").map((c) => c.code)),
    current: new Map(data.krs.courses.map((c) => [c.code, { name: c.name, sks: c.sks }])),
    specialization: spec ? { name: spec.name, courses: spec.courses.map((c) => c.code) } : null,
    electivesNow: data.curriculum.categories.filter((c) => /Pilihan/.test(c.label)).reduce((s, c) => s + c.sks, 0),
  };
}

function courseInfo(data: DesignData, rec: Record_, code: string): { code: string; name: string; sks: number; prodi: string | null } {
  const c = catalogByCode.get(code);
  if (c) return { code, name: c.name, sks: c.sks, prodi: c.prodi };
  const r = rec.required.get(code);
  if (r) return { code, name: r.name, sks: r.sks, prodi: rec.prodi };
  const k = rec.current.get(code);
  if (k) return { code, name: k.name, sks: k.sks, prodi: null };
  for (const sem of data.transcript) {
    const t = sem.courses.find((x) => x.code === code);
    if (t) return { code, name: t.name, sks: t.sks, prodi: null };
  }
  return { code, name: code, sks: 0, prodi: null };
}

type Role = "required" | "specialization" | "minor" | "elective_in" | "elective_out";

function roleOf(rec: Record_, code: string, minor: Minor | null): Role {
  if (rec.required.has(code)) return "required";
  if (rec.specialization?.courses.includes(code)) return "specialization";
  if (minor?.courses.includes(code)) return "minor";
  return catalogByCode.get(code)?.prodi === rec.prodi ? "elective_in" : "elective_out";
}

const ROLE_TONE: Record<Role, string> = {
  required: "bg-[#e6eefe] text-[#2f5fc4] dark:bg-[#1b2742] dark:text-[#9ab8ff]",
  specialization: "bg-[#f3ecfd] text-[#6b3fc4] dark:bg-[#271d3a] dark:text-[#c4b0f5]",
  minor: "bg-[#fdf2d6] text-[#875800] dark:bg-[#382d10] dark:text-[#f2c862]",
  elective_in: "bg-[#e3f4f1] text-[#0f766e] dark:bg-[#11302c] dark:text-[#6fd6c6]",
  elective_out: "bg-[#f0f0f2] text-[#55555c] dark:bg-[#27272b] dark:text-[#b9b9c1]",
};

function roleLabel(tr: VariantProps["tr"], role: Role, rec: Record_, code: string): string {
  switch (role) {
    case "required":
      return tr({ en: `Required · sem ${rec.required.get(code)?.semester}`, id: `Wajib · smt ${rec.required.get(code)?.semester}` });
    case "specialization":
      return tr({ en: "Specialization", id: "Spesialisasi" });
    case "minor":
      return tr({ en: "Minor", id: "Minor" });
    case "elective_in":
      return tr({ en: "Elective, your program", id: "Pilihan dalam prodi" });
    default:
      return tr({ en: "Elective, other program", id: "Pilihan luar prodi" });
  }
}

// ---------------------------------------------------------------- GPA projection (shared with the Grades page)

export interface ProjectionStep {
  label: string;
  /** The term code the step belongs to; null for past semesters. */
  key: string | null;
  ip: number | null;
  ipk: number;
  sks: number;
  projected: boolean;
}

export interface Projection {
  steps: ProjectionStep[];
  finalIpk: number;
  /** Average grade points the remaining graded SKS need for the target; null when nothing is left. */
  needAvg: number | null;
  variableSks: number;
  honor: (typeof HONORS)[number] | undefined;
  curSks: number;
  target: number;
}

/** Exact transcript points, this semester's expected grades, then every planned course (retakes replace the old grade). */
export function projectPlan(p: VariantProps, plan: PlanState): Projection {
  const { data, tr } = p;
  const rec = recordOf(data);
  const path = graduationPath(data);
  const currentKey = currentTermKey(data);
  const steps: Projection["steps"] = [];
  let points = 0;
  let graded = 0;
  data.grades.semesters.forEach((s, i) => {
    if (s.ip === null || !s.sks) return;
    points += s.ip * s.sks;
    graded += s.sks;
    steps.push({ label: tr({ en: `Sem ${i + 1}`, id: `Smt ${i + 1}` }), key: null, ip: s.ip, ipk: points / graded, sks: s.sks, projected: false });
  });
  points = data.grades.points;
  graded = data.grades.gradedSks;
  const curPoints = data.krs.courses.reduce((s, c) => s + (GRADE_POINTS[plan.current[c.code] ?? "AB"] ?? 0) * c.sks, 0);
  const curSks = data.krs.courses.reduce((s, c) => s + c.sks, 0);
  points += curPoints;
  graded += curSks;
  steps.push({
    label: tr({ en: `Sem ${path.semesterNow}`, id: `Smt ${path.semesterNow}` }),
    key: currentKey,
    ip: curSks ? curPoints / curSks : null,
    ipk: points / graded,
    sks: curSks,
    projected: true,
  });
  let fixedPoints = data.grades.points;
  let variableSks = curSks;
  let retook = false;
  for (const key of plan.terms) {
    const t = termOf(key, path.semesterNow, currentKey);
    const items = (plan.items[key] ?? []).map((it) => ({ ...it, info: courseInfo(data, rec, it.code) }));
    if (!items.length) continue;
    let tPoints = 0;
    let tSks = 0;
    for (const it of items) {
      tPoints += (GRADE_POINTS[it.grade] ?? 0) * it.info.sks;
      tSks += it.info.sks;
      variableSks += it.info.sks;
      const old = it.retake ? rec.passed.get(it.code) : undefined;
      if (old) {
        retook = true;
        points -= (GRADE_POINTS[old.grade] ?? 0) * old.sks;
        graded -= old.sks;
        fixedPoints -= (GRADE_POINTS[old.grade] ?? 0) * old.sks;
      }
    }
    points += tPoints;
    graded += tSks;
    steps.push({
      label: t.kind === "Pendek" ? tr({ en: "Short", id: "Pendek" }) : tr({ en: `Sem ${t.semester}`, id: `Smt ${t.semester}` }),
      key,
      ip: tPoints / tSks,
      ipk: points / graded,
      sks: tSks,
      projected: true,
    });
  }
  const finalIpk = graded ? points / graded : 0;
  return {
    steps,
    finalIpk,
    needAvg: variableSks ? (plan.target * graded - fixedPoints) / variableSks : null,
    variableSks,
    honor: HONORS.find((h) => finalIpk >= h.min - 1e-9 && (h.key !== "summa" || !retook)),
    curSks,
    target: plan.target,
  };
}

/** The saved plan, for screens other than the planner. */
export function usePlanState(data: DesignData): PlanState {
  return usePlan(data, currentTermKey(data))[0];
}

// ---------------------------------------------------------------- the planner

/** SIX writes the current term as "1-2026/2027"; its term code is "2026-1". */
function currentTermKey(data: DesignData): string {
  const m = /^(\d)-(\d{4})/.exec(data.student.termLabel.trim());
  return m ? `${m[2]}-${m[1]}` : "2026-1";
}

export function Planner(p: VariantProps) {
  const { data, tr, lang } = p;
  const rec = useMemo(() => recordOf(data), [data]);
  const path = graduationPath(data);
  const currentKey = currentTermKey(data);
  const [plan, update, reset] = usePlan(data, currentKey);
  // Prototype convenience: ?add=2026-2 opens the course search for that term (for screenshots).
  const [adding, setAdding] = useState<string | null>(() => new URLSearchParams(window.location.search).get("add"));
  const minor = catalog.minors.find((m) => minorKey(m) === plan.minor) ?? null;
  const terms = plan.terms.map((k) => termOf(k, path.semesterNow, currentKey));
  const plannedCodes = new Map<string, string>();
  for (const t of plan.terms) for (const it of plan.items[t] ?? []) plannedCodes.set(it.code, t);
  const num = (n: number) => (lang === "id" ? n.toFixed(2).replace(".", ",") : n.toFixed(2));
  const termLabel = (t: Term) =>
    t.kind === "Pendek"
      ? tr({ en: `Short semester · ${t.year}/${t.year + 1}`, id: `Semester pendek · ${t.year}/${t.year + 1}` })
      : tr({ en: `Semester ${t.semester} · ${t.year}/${t.year + 1} ${t.kind === "Ganjil" ? "Odd" : "Even"}`, id: `Semester ${t.semester} · ${t.year}/${t.year + 1} ${t.kind}` });

  // ------------------------------------------------ numbers
  const planned = plan.terms.flatMap((k) => (plan.items[k] ?? []).map((it) => ({ ...it, term: k, info: courseInfo(data, rec, it.code) })));
  const newSks = planned.filter((x) => !x.retake).reduce((s, x) => s + x.info.sks, 0);
  const totalAfter = path.passed + path.inProgress + newSks;
  const electivesPlanned = planned.filter((x) => !x.retake && !rec.required.has(x.code)).reduce((s, x) => s + x.info.sks, 0);
  const electivesNeeded = data.program.graduationSks - data.curriculum.required.reduce((s, c) => s + c.sks, 0);
  const requiredUncovered = [...rec.requiredLeft].filter((c) => !plannedCodes.has(c));
  const lastTerm = [...terms].reverse().find((t) => t.kind !== "Pendek" && (plan.items[t.key] ?? []).length > 0) ?? terms[terms.length - 1];
  const finishSemester = lastTerm?.semester ?? path.semesterNow;

  const { steps, finalIpk, needAvg, variableSks, honor, curSks } = projectPlan(p, plan);
  const stepOf = new Map(steps.filter((x) => x.key).map((x) => [x.key, x]));
  /** Projected IP for the semester, and the IPK once it's done. */
  const gpaOf = (key: string) => {
    const x = stepOf.get(key);
    if (!x) return undefined;
    return (
      <span className="text-right leading-tight" title={tr({ en: "From the grades you picked", id: "Dari nilai yang kamu pilih" })}>
        <span className="block text-[12.5px] font-semibold tabular-nums">IP {x.ip !== null ? num(x.ip) : "—"}</span>
        <span className={cx("block text-[11px] tabular-nums", ui.faint)}>{tr({ en: `IPK after: ${num(x.ipk)}`, id: `IPK jadi ${num(x.ipk)}` })}</span>
      </span>
    );
  };

  // ------------------------------------------------ rules
  type Rule = { level: "ok" | "warn" | "error"; title: string; detail: string; source: "SIX" | "ITB" };
  const rules: Rule[] = [
    {
      level: totalAfter >= path.target ? "ok" : "error",
      title: tr({ en: `${totalAfter} of ${path.target} SKS`, id: `${totalAfter} dari ${path.target} SKS` }),
      detail:
        totalAfter >= path.target
          ? tr({ en: "Enough to graduate once everything planned passes.", id: "Cukup untuk lulus jika semua rencana lulus." })
          : tr({ en: `${path.target - totalAfter} SKS short. Add courses.`, id: `Kurang ${path.target - totalAfter} SKS. Tambah mata kuliah.` }),
      source: "SIX",
    },
    {
      level: requiredUncovered.length ? "error" : "ok",
      title: tr({ en: "Required courses", id: "Mata kuliah wajib" }),
      detail: requiredUncovered.length
        ? tr({
            en: `Not planned yet: ${requiredUncovered.map((c) => courseInfo(data, rec, c).name).join(", ")}.`,
            id: `Belum direncanakan: ${requiredUncovered.map((c) => courseInfo(data, rec, c).name).join(", ")}.`,
          })
        : tr({ en: `All ${rec.required.size} taken, in progress or planned.`, id: `Ke-${rec.required.size} sudah diambil, sedang, atau direncanakan.` }),
      source: "SIX",
    },
    {
      level: rec.electivesNow + electivesPlanned >= electivesNeeded ? "ok" : "error",
      title: tr({ en: "Electives", id: "Mata kuliah pilihan" }),
      detail: tr({
        en: `${rec.electivesNow + electivesPlanned} of ${electivesNeeded} SKS (${data.program.graduationSks} minus ${data.program.graduationSks - electivesNeeded} required).`,
        id: `${rec.electivesNow + electivesPlanned} dari ${electivesNeeded} SKS (${data.program.graduationSks} dikurangi ${data.program.graduationSks - electivesNeeded} wajib).`,
      }),
      source: "SIX",
    },
  ];
  for (const t of terms) {
    const sks = (plan.items[t.key] ?? []).reduce((s, it) => s + courseInfo(data, rec, it.code).sks, 0);
    const limit = t.kind === "Pendek" ? 9 : path.maxSks ?? 24;
    if (sks > limit)
      rules.push({
        level: "error",
        title: termLabel(t),
        detail: tr({ en: `${sks} SKS is over the ${limit}-SKS limit.`, id: `${sks} SKS melebihi batas ${limit} SKS.` }),
        source: "ITB",
      });
    else if (t.kind !== "Pendek" && sks > 20)
      rules.push({
        level: "warn",
        title: termLabel(t),
        detail: tr({ en: `${sks} SKS: above 20 needs your advisor's approval.`, id: `${sks} SKS: di atas 20 perlu persetujuan dosen wali.` }),
        source: "ITB",
      });
    for (const it of plan.items[t.key] ?? []) {
      const req = rec.required.get(it.code);
      if (!req || t.kind === "Pendek") continue;
      const odd = req.semester % 2 === 1;
      if (odd !== (t.kind === "Ganjil"))
        rules.push({
          level: "warn",
          title: courseInfo(data, rec, it.code).name,
          detail: tr({
            en: `The curriculum puts it in semester ${req.semester}, an ${odd ? "odd" : "even"} semester. Check it also runs in the ${t.kind === "Ganjil" ? "odd" : "even"} semester, or plan it for the short semester.`,
            id: `Kurikulum menaruhnya di semester ${req.semester} (${odd ? "ganjil" : "genap"}). Pastikan juga dibuka di semester ${t.kind === "Ganjil" ? "ganjil" : "genap"}, atau rencanakan di semester pendek.`,
          }),
          source: "SIX",
        });
    }
  }
  if (rec.specialization) {
    const missing = rec.specialization.courses.filter((c) => !rec.passed.has(c) && !rec.current.has(c) && !plannedCodes.has(c));
    rules.push({
      level: missing.length ? "warn" : "ok",
      title: rec.specialization.name,
      detail: missing.length
        ? tr({ en: `Stays incomplete: ${missing.join(", ")} not planned.`, id: `Belum tuntas: ${missing.join(", ")} belum direncanakan.` })
        : tr({ en: "All 4 courses covered.", id: "Keempat mata kuliah terpenuhi." }),
      source: "SIX",
    });
  }
  if (minor) {
    const have = minor.courses.filter((c) => rec.passed.has(c) || rec.current.has(c) || plannedCodes.has(c));
    const haveSks = have.reduce((s, c) => s + courseInfo(data, rec, c).sks, 0);
    rules.push({
      level: haveSks >= minor.sks ? "ok" : "warn",
      title: `Minor ${minor.name}`,
      detail: tr({ en: `${haveSks} of ${minor.sks} SKS from its list.`, id: `${haveSks} dari ${minor.sks} SKS dari daftarnya.` }),
      source: "SIX",
    });
  }
  rules.push({
    level: finishSemester <= 8 ? "ok" : "warn",
    title: tr({ en: `Finish in semester ${finishSemester}`, id: `Lulus di semester ${finishSemester}` }),
    detail:
      finishSemester <= 8
        ? tr({ en: "On time (8 semesters).", id: "Tepat waktu (8 semester)." })
        : finishSemester <= 9
          ? tr({ en: "One semester late; honors are still possible (up to 9).", id: "Terlambat satu semester; predikat pujian masih mungkin (maks. 9)." })
          : tr({ en: "Honors need graduating within 9 semesters.", id: "Predikat pujian mensyaratkan lulus dalam 9 semester." }),
    source: "ITB",
  });

  const errors = rules.filter((r) => r.level === "error").length;
  const warnings = rules.filter((r) => r.level === "warn").length;

  // ------------------------------------------------ actions
  const addCourse = (termKey: string, code: string, retake = false) =>
    update((s) => ({ ...s, items: { ...s.items, [termKey]: [...(s.items[termKey] ?? []).filter((x) => x.code !== code), { code, grade: "AB", retake }] } }));
  const removeCourse = (termKey: string, code: string) =>
    update((s) => ({ ...s, items: { ...s.items, [termKey]: (s.items[termKey] ?? []).filter((x) => x.code !== code) } }));
  const setGrade = (termKey: string, code: string, grade: string) =>
    update((s) => ({ ...s, items: { ...s.items, [termKey]: (s.items[termKey] ?? []).map((x) => (x.code === code ? { ...x, grade } : x)) } }));
  const addTerm = (short: boolean) =>
    update((s) => {
      const last = s.terms[s.terms.length - 1] ?? currentKey;
      const key = short && last.endsWith("-2") ? `${last.slice(0, 4)}-3` : nextKey(last, false);
      return s.terms.includes(key) ? s : { ...s, terms: [...s.terms, key].sort() };
    });
  const removeTerm = (key: string) => update((s) => ({ ...s, terms: s.terms.filter((k) => k !== key), items: { ...s.items, [key]: [] } }));
  const canAddShort = (() => {
    const last = plan.terms[plan.terms.length - 1] ?? currentKey;
    return last.endsWith("-2") && !plan.terms.includes(`${last.slice(0, 4)}-3`);
  })();

  return (
    <div className="space-y-6">
      {/* summary */}
      <section className={cx("px-6 py-5", ui.card)}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className={cx("text-[12.5px] font-medium", ui.muted)}>{data.program.name.replace(/^Kurikulum \d+ - /, "")}</p>
            <p className="mt-1 text-[28px] leading-9 font-semibold tracking-[-0.02em] tabular-nums">
              {totalAfter} <span className={cx("text-[18px] font-medium", ui.muted)}>/ {path.target} SKS</span>
            </p>
            <p className={cx("text-[13px]", ui.muted)}>
              {tr({
                en: `${path.passed} passed · ${path.inProgress} this semester · ${newSks} planned`,
                id: `${path.passed} lulus · ${path.inProgress} semester ini · ${newSks} direncanakan`,
              })}
            </p>
          </div>
          <div className="flex gap-8 text-right">
            <div>
              <p className={cx("text-[12px] font-medium", ui.muted)}>{tr({ en: "Graduate", id: "Lulus" })}</p>
              <p className="text-[16px] font-semibold">{tr({ en: `Semester ${finishSemester}`, id: `Semester ${finishSemester}` })}</p>
              <p className={cx("text-[12px] font-semibold", errors ? "text-[#c4321f] dark:text-[#ff9c8f]" : warnings ? "text-[#9a5b00] dark:text-[#f5c46a]" : "text-[#178a4a] dark:text-[#6fdc9c]")}>
                {errors
                  ? tr({ en: `${errors} rule${errors > 1 ? "s" : ""} not met`, id: `${errors} aturan belum terpenuhi` })
                  : warnings
                    ? tr({ en: `${warnings} thing${warnings > 1 ? "s" : ""} to check`, id: `${warnings} hal perlu dicek` })
                    : tr({ en: "All rules met", id: "Semua aturan terpenuhi" })}
              </p>
            </div>
            <div>
              <p className={cx("text-[12px] font-medium", ui.muted)}>{tr({ en: "IPK at graduation", id: "IPK saat lulus" })}</p>
              <p className="text-[16px] font-semibold tabular-nums">{num(finalIpk)}</p>
              <p className={cx("text-[12px]", honor ? "font-semibold text-[#178a4a] dark:text-[#6fdc9c]" : ui.faint)}>
                {honor ? tr(honor.label) : tr({ en: "No honors", id: "Tanpa predikat pujian" })}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <span className="h-full bg-[#22a35a]" style={{ width: `${(path.passed / path.target) * 100}%` }} />
          <span className="h-full bg-[#86d4a5] dark:bg-[#2b6b45]" style={{ width: `${(path.inProgress / path.target) * 100}%` }} />
          <span className="h-full bg-[#9db8f5] dark:bg-[#34508a]" style={{ width: `${(Math.min(newSks, Math.max(0, path.target - path.passed - path.inProgress)) / path.target) * 100}%` }} />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_340px] gap-6">
        {/* semesters */}
        <div className="space-y-3">
          <PastSummary {...p} steps={steps.filter((s) => !s.projected)} />
          <TermBlock
            title={tr({ en: `Semester ${path.semesterNow} · now`, id: `Semester ${path.semesterNow} · sekarang` })}
            subtitle={tr({ en: "In progress · pick the grades you expect", id: "Berlangsung · pilih nilai perkiraanmu" })}
            source="SIX"
            sks={curSks}
            limit={path.maxSks}
            gpa={gpaOf(currentKey)}
          >
            {data.krs.courses.map((c) => (
              <CourseLine
                key={c.code}
                p={p}
                code={c.code}
                name={c.name}
                sks={c.sks}
                tag={roleLabel(tr, roleOf(rec, c.code, minor), rec, c.code)}
                tone={ROLE_TONE[roleOf(rec, c.code, minor)]}
                grade={plan.current[c.code] ?? "AB"}
                onGrade={(g) => update((s) => ({ ...s, current: { ...s.current, [c.code]: g } }))}
              />
            ))}
          </TermBlock>
          {terms.map((t) => {
            const items = plan.items[t.key] ?? [];
            const sks = items.reduce((s, it) => s + courseInfo(data, rec, it.code).sks, 0);
            return (
              <TermBlock
                key={t.key}
                title={termLabel(t)}
                subtitle={tr({ en: "Planned · pick the grades you expect", id: "Rencana · pilih nilai perkiraanmu" })}
                sks={sks}
                limit={t.kind === "Pendek" ? 9 : path.maxSks}
                gpa={gpaOf(t.key)}
                onRemove={plan.terms.length > 1 ? () => removeTerm(t.key) : undefined}
                onAdd={() => setAdding(t.key)}
                addLabel={tr({ en: "Add course", id: "Tambah mata kuliah" })}
              >
                {items.map((it) => {
                  const info = courseInfo(data, rec, it.code);
                  const role = roleOf(rec, it.code, minor);
                  return (
                    <CourseLine
                      key={it.code}
                      p={p}
                      code={it.code}
                      name={info.name}
                      sks={info.sks}
                      tag={it.retake ? tr({ en: `Retake · was ${rec.passed.get(it.code)?.grade}`, id: `Ulang · dulu ${rec.passed.get(it.code)?.grade}` }) : roleLabel(tr, role, rec, it.code)}
                      tone={it.retake ? ROLE_TONE.minor : ROLE_TONE[role]}
                      grade={it.grade}
                      onGrade={(g) => setGrade(t.key, it.code, g)}
                      onRemove={() => removeCourse(t.key, it.code)}
                    />
                  );
                })}
                {items.length === 0 && (
                  <p className={cx("px-4 py-3 text-[12.5px]", ui.faint)}>{tr({ en: "Nothing planned yet.", id: "Belum ada rencana." })}</p>
                )}
              </TermBlock>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {canAddShort && (
              <button onClick={() => addTerm(true)} className={cx("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium", ui.secondary, ui.focus)}>
                <Icons.Calendar className="size-3.5" />
                {tr({ en: "Add short semester", id: "Tambah semester pendek" })}
              </button>
            )}
            <button onClick={() => addTerm(false)} className={cx("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium", ui.secondary, ui.focus)}>
              <Icons.Calendar className="size-3.5" />
              {tr({ en: "Add semester", id: "Tambah semester" })}
            </button>
            <button onClick={reset} className={cx("ml-auto rounded px-1 text-[12px] font-medium", ui.faint, "hover:text-current", ui.focus)}>
              {tr({ en: "Reset plan", id: "Atur ulang rencana" })}
            </button>
          </div>
          <p className={cx("text-[11.5px] leading-[1.55]", ui.faint)}>
            {tr({
              en: `Courses come from SIX's public catalog (${catalog.courses.length} courses, ${catalog.programs.length} programs). SIX doesn't publish prerequisites or which term an elective runs; class times arrive when programs open next semester's classes, and the plan is then checked for clashes. The app never sends your KRS.`,
              id: `Mata kuliah diambil dari katalog publik SIX (${catalog.courses.length} mata kuliah, ${catalog.programs.length} prodi). SIX tidak menerbitkan prasyarat atau semester buka mata kuliah pilihan; jadwal kelas tersedia saat prodi membuka kelas semester depan, lalu rencana diperiksa bentroknya. Aplikasi tidak pernah mengirim KRS-mu.`,
            })}
          </p>
        </div>

        {/* rules + projection */}
        <aside className="space-y-4">
          <section className={cx("overflow-hidden", ui.card)}>
            <p className="px-4 pt-3.5 text-[13px] font-semibold">{tr({ en: "Rules, checked live", id: "Aturan, dicek langsung" })}</p>
            <ul className="space-y-2.5 px-4 pt-3 pb-4">
              {rules.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className={cx(
                      "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full",
                      r.level === "ok"
                        ? "bg-[#dcf4e5] text-[#178a4a] dark:bg-[#12301f] dark:text-[#6fdc9c]"
                        : r.level === "warn"
                          ? "bg-[#fdf2d6] text-[#8a5300] dark:bg-[#382d10] dark:text-[#f2c862]"
                          : "bg-[#fde7e4] text-[#c4321f] dark:bg-[#3a1c19] dark:text-[#ff9c8f]",
                    )}
                  >
                    {r.level === "ok" ? <Icons.Check className="size-3" strokeWidth={3} /> : <span className="text-[11px] font-bold">!</span>}
                  </span>
                  <span className="min-w-0 flex-1 text-[12.5px] leading-[1.45]">
                    <span className="flex items-center justify-between gap-2 font-semibold">
                      <span className="min-w-0 truncate">{r.title}</span>
                      <SourceTag source={r.source} />
                    </span>
                    <span className={ui.muted}>{r.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={cx("overflow-hidden", ui.card)}>
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5">
              <p className="text-[13px] font-semibold">{tr({ en: "IPK target", id: "Target IPK" })}</p>
              <span className="flex items-center gap-1">
                {[3, 3.5, 3.75].map((v) => (
                  <button
                    key={v}
                    onClick={() => update((s) => ({ ...s, target: v }))}
                    className={cx(
                      "h-7 rounded-md px-2 text-[12px] font-semibold tabular-nums",
                      plan.target === v ? "bg-[#2f6feb] text-white dark:bg-[#3a77f0]" : cx(ui.fill, ui.muted),
                      ui.focus,
                    )}
                  >
                    {num(v)}
                  </button>
                ))}
              </span>
            </div>
            <p className={cx("px-4 pt-2 text-[12.5px] leading-[1.5]", ui.muted)}>
              {needAvg === null
                ? "—"
                : needAvg > 4
                  ? tr({
                      en: `Out of reach with the courses left, even with straight A's. Retaking a low grade can help: only the newest grade counts.`,
                      id: `Tidak tercapai dengan mata kuliah tersisa, walau semua A. Mengulang nilai rendah bisa membantu: hanya nilai terbaru yang dihitung.`,
                    })
                  : needAvg <= 0
                    ? tr({ en: "Already secured.", id: "Sudah pasti tercapai." })
                    : tr({
                        en: `Average ${num(needAvg)} (about ${gradeForIp(needAvg) ?? "A"}) over your last ${variableSks} SKS.`,
                        id: `Rata-rata ${num(needAvg)} (sekitar ${gradeForIp(needAvg) ?? "A"}) di ${variableSks} SKS terakhir.`,
                      })}
            </p>
            <IpkChart steps={steps} target={plan.target} num={num} />
            <ProjectedTable steps={steps} num={num} tr={tr} />
            <p className={cx("border-t px-4 py-2.5 text-[11.5px] leading-[1.5]", ui.line, ui.faint)}>
              {tr({
                en: "Pick an expected grade for each course. Cum laude ≥ 3.50, magna ≥ 3.75, summa ≥ 3.85 with no retakes, all within 9 semesters (Peraturan Akademik ITB, Pasal 49).",
                id: "Pilih perkiraan nilai tiap mata kuliah. Cum laude ≥ 3,50, magna ≥ 3,75, summa ≥ 3,85 tanpa mengulang, semuanya dalam 9 semester (Peraturan Akademik ITB, Pasal 49).",
              })}
            </p>
          </section>

          <MinorPicker p={p} rec={rec} plannedCodes={plannedCodes} value={plan.minor} onChange={(v) => update((s) => ({ ...s, minor: v }))} />
        </aside>
      </div>

      {adding && (
        <AddCourse
          p={p}
          rec={rec}
          minor={minor}
          termLabel={termLabel(termOf(adding, path.semesterNow, currentKey))}
          plannedCodes={plannedCodes}
          onAdd={(code, retake) => addCourse(adding, code, retake)}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function PastSummary({ steps, ...p }: VariantProps & { steps: { label: string; ip: number | null; ipk: number; sks: number }[] }) {
  const { data, tr } = p;
  const [open, setOpen] = useState(false);
  return (
    <section className={cx("overflow-hidden", ui.card)}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left", ui.hover, ui.focus)}>
        <Icons.ChevronRight className={cx("size-4 transition-transform", open && "rotate-90", ui.faint)} />
        <span className="flex-1 text-[13.5px] font-semibold">
          {tr({ en: `Semesters 1–${steps.length}`, id: `Semester 1–${steps.length}` })}
          <span className={cx("ml-2 font-medium", ui.muted)}>
            · {data.student.sksPassed} SKS · IPK {data.student.ipk?.toFixed(2)}
          </span>
        </span>
        <SourceTag source="SIX" />
      </button>
      {open && (
        <ul className={cx("grid grid-cols-3 gap-2 border-t px-4 py-3", ui.line)}>
          {steps.map((s) => (
            <li key={s.label} className={cx("rounded-lg px-3 py-2 text-[12.5px]", ui.fill)}>
              <span className="font-semibold">{s.label}</span>
              <span className={cx("block tabular-nums", ui.muted)}>
                IP {s.ip?.toFixed(2)} · {s.sks} SKS
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TermBlock({
  title,
  subtitle,
  source,
  sks,
  limit,
  onAdd,
  addLabel,
  onRemove,
  gpa,
  children,
}: {
  title: string;
  subtitle: string;
  source?: "SIX";
  sks: number;
  limit: number | null;
  onAdd?: () => void;
  addLabel?: string;
  onRemove?: () => void;
  gpa?: ReactNode;
  children: ReactNode;
}) {
  const over = limit !== null && sks > limit;
  return (
    <section className={cx("overflow-hidden", ui.card)}>
      <header className={cx("flex items-center gap-3 border-b px-4 py-2.5", ui.line)}>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold">{title}</span>
          <span className={cx("block text-[11.5px]", ui.faint)}>{subtitle}</span>
        </span>
        {source && <SourceTag source={source} />}
        <span className={cx("text-[12.5px] font-semibold tabular-nums", over ? "text-[#c4321f] dark:text-[#ff9c8f]" : ui.muted)}>
          {sks}
          {limit ? ` / ${limit}` : ""} SKS
        </span>
        {gpa && <span className={cx("border-l pl-3", ui.line)}>{gpa}</span>}
        {onRemove && (
          <button onClick={onRemove} aria-label="Remove semester" className={cx("rounded p-1", ui.faint, ui.hover, ui.focus)}>
            <Icons.X className="size-3.5" />
          </button>
        )}
      </header>
      <ul>{children}</ul>
      {onAdd && (
        <button
          onClick={onAdd}
          className={cx("flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-[12.5px] font-semibold", ui.line, ui.accentText, ui.hover, ui.focus)}
        >
          <Icons.Search className="size-3.5" />
          {addLabel}
        </button>
      )}
    </section>
  );
}

function CourseLine({
  p,
  code,
  name,
  sks,
  tag,
  tone,
  grade,
  onGrade,
  onRemove,
}: {
  p: VariantProps;
  code: string;
  name: string;
  sks: number;
  tag: string;
  tone: string;
  grade: string;
  onGrade: (g: string) => void;
  onRemove?: () => void;
}) {
  return (
    <li className={cx("grid grid-cols-[70px_minmax(0,1fr)_auto_44px_62px_24px] items-center gap-3 px-4 py-2 text-[13px]", "border-b last:border-b-0", ui.line)}>
      <span className="font-semibold tabular-nums">{code}</span>
      <span className="truncate">{name}</span>
      <span className={cx("rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", tone)}>{tag}</span>
      <span className={cx("text-right tabular-nums", p.dark ? "text-[#a1a1a9]" : "text-[#6e6e73]")}>{sks}</span>
      <select
        value={grade}
        onChange={(e) => onGrade(e.target.value)}
        aria-label={`${code} expected grade`}
        className={cx("h-7 rounded-md px-1.5 text-[12.5px] font-semibold", ui.secondary, ui.focus)}
      >
        {GRADES.map((g) => (
          <option key={g}>{g}</option>
        ))}
      </select>
      {onRemove ? (
        <button onClick={onRemove} aria-label={`Remove ${code}`} className={cx("grid size-6 place-items-center rounded", ui.faint, ui.hover, ui.focus)}>
          <Icons.X className="size-3.5" />
        </button>
      ) : (
        <span />
      )}
    </li>
  );
}

function IpkChart({ steps, target, num }: { steps: { label: string; ipk: number; projected: boolean }[]; target: number; num: (n: number) => string }) {
  const w = 300;
  const h = 120;
  const pad = { l: 8, r: 8, t: 14, b: 22 };
  const min = 2.5;
  const max = 4;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, steps.length - 1);
  const y = (v: number) => pad.t + ((max - Math.min(max, Math.max(min, v))) / (max - min)) * (h - pad.t - pad.b);
  const firstProjected = steps.findIndex((s) => s.projected);
  const line = (from: number, to: number) =>
    steps
      .slice(from, to + 1)
      .map((s, i) => `${i === 0 ? "M" : "L"}${x(from + i).toFixed(1)},${y(s.ipk).toFixed(1)}`)
      .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 w-full px-2" role="img" aria-label="IPK by semester">
      <line x1={pad.l} x2={w - pad.r} y1={y(target)} y2={y(target)} stroke="#d7a20f" strokeDasharray="4 3" strokeWidth={1} />
      <text x={pad.l} y={y(target) - 4} textAnchor="start" fontSize="9" fill="#b7880c" fontWeight={600}>
        {num(target)}
      </text>
      {firstProjected > 0 && <path d={line(0, firstProjected - 1)} fill="none" stroke="#2f6feb" strokeWidth={2} />}
      {firstProjected >= 0 && <path d={line(Math.max(0, firstProjected - 1), steps.length - 1)} fill="none" stroke="#2f6feb" strokeWidth={2} strokeDasharray="4 3" />}
      {steps.map((s, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(s.ipk)} r={2.6} fill={s.projected ? "#fff" : "#2f6feb"} stroke="#2f6feb" strokeWidth={1.5} />
          <text x={x(i)} y={h - 8} textAnchor="middle" fontSize="8.5" fill="#8b8b92">
            {s.label.replace(/^(Sem|Smt) /, "")}
          </text>
        </g>
      ))}
      <text x={x(steps.length - 1)} y={y(steps[steps.length - 1]?.ipk ?? 0) + 14} textAnchor="end" fontSize="9.5" fontWeight={700} fill="#2f6feb">
        {num(steps[steps.length - 1]?.ipk ?? 0)}
      </text>
    </svg>
  );
}

/** Each projected semester's IP and the IPK it leaves you with. */
export function ProjectedTable({ steps, num, tr }: { steps: ProjectionStep[]; num: (n: number) => string; tr: VariantProps["tr"] }) {
  const rows = steps.filter((x) => x.projected);
  if (!rows.length) return null;
  return (
    <table className="mx-4 mb-3 w-[calc(100%-2rem)] text-[12.5px]">
      <thead>
        <tr className={cx("text-left text-[11px]", ui.faint)}>
          <th className="py-1 font-medium">{tr({ en: "Projected", id: "Perkiraan" })}</th>
          <th className="py-1 text-right font-medium">SKS</th>
          <th className="py-1 text-right font-medium">IP</th>
          <th className="py-1 text-right font-medium">IPK</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((x) => (
          <tr key={x.label} className={cx("border-t", ui.line)}>
            <td className="py-1.5 font-medium">{x.label.replace(/^Sem /, "Semester ").replace(/^Smt /, "Semester ")}</td>
            <td className={cx("py-1.5 text-right tabular-nums", ui.muted)}>{x.sks}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{x.ip !== null ? num(x.ip) : "—"}</td>
            <td className="py-1.5 text-right font-semibold tabular-nums">{num(x.ipk)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MinorPicker({
  p,
  rec,
  plannedCodes,
  value,
  onChange,
}: {
  p: VariantProps;
  rec: Record_;
  plannedCodes: Map<string, string>;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { tr } = p;
  // Minors the Student is closest to, by SKS already earned or planned from the list.
  const own = programName.get(rec.prodi);
  const ranked = catalog.minors
    .filter((m) => m.program !== own)
    .map((m) => {
      const have = m.courses.filter((c) => rec.passed.has(c) || rec.current.has(c) || plannedCodes.has(c));
      return { m, have, sks: have.reduce((s, c) => s + (catalogByCode.get(c)?.sks ?? 0), 0) };
    })
    .filter((x) => x.sks > 0)
    .sort((a, b) => b.sks / b.m.sks - a.sks / a.m.sks)
    .slice(0, 4);
  return (
    <section className={cx("overflow-hidden", ui.card)}>
      <p className="px-4 pt-3.5 text-[13px] font-semibold">{tr({ en: "Minors you're closest to", id: "Minor yang paling dekat" })}</p>
      <ul className="px-2 pt-2 pb-2">
        {ranked.map(({ m, sks }) => {
          const key = minorKey(m);
          const on = value === key;
          return (
            <li key={key}>
              <button
                onClick={() => onChange(on ? null : key)}
                className={cx("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left", on ? "bg-[#eef2fd] dark:bg-[#1e2638]" : ui.hover, ui.focus)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">{m.name}</span>
                  <span className={cx("block truncate text-[11.5px]", ui.muted)}>{m.program}</span>
                </span>
                <span className="text-[12px] font-semibold tabular-nums">
                  {sks}/{m.sks}
                </span>
              </button>
            </li>
          );
        })}
        {ranked.length === 0 && <li className={cx("px-2 py-1 text-[12px]", ui.faint)}>—</li>}
      </ul>
      <p className={cx("border-t px-4 py-2.5 text-[11.5px] leading-[1.5]", ui.line, ui.faint)}>
        {tr({
          en: `${catalog.minors.length} minors from SIX. Pick one to track it; its courses show up first when you add courses.`,
          id: `${catalog.minors.length} minor dari SIX. Pilih satu untuk dipantau; mata kuliahnya muncul paling atas saat menambah.`,
        })}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- add course (search the catalog)

type Tab = "needed" | "program" | "minor" | "all";

function AddCourse({
  p,
  rec,
  minor,
  termLabel,
  plannedCodes,
  onAdd,
  onClose,
}: {
  p: VariantProps;
  rec: Record_;
  minor: Minor | null;
  termLabel: string;
  plannedCodes: Map<string, string>;
  onAdd: (code: string, retake: boolean) => void;
  onClose: () => void;
}) {
  const { data, tr } = p;
  const [tab, setTab] = useState<Tab>("needed");
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), [tab]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = (code: string) =>
    rec.passed.has(code)
      ? { kind: "passed" as const, label: tr({ en: `Passed · ${rec.passed.get(code)?.grade}`, id: `Lulus · ${rec.passed.get(code)?.grade}` }) }
      : rec.exempt.has(code)
        ? { kind: "done" as const, label: tr({ en: "Exempted", id: "Dibebaskan" }) }
        : rec.current.has(code)
          ? { kind: "done" as const, label: tr({ en: "This semester", id: "Semester ini" }) }
          : plannedCodes.has(code)
            ? { kind: "done" as const, label: tr({ en: "Planned", id: "Direncanakan" }) }
            : null;

  const needed = [
    ...[...rec.requiredLeft].map((c) => ({ code: c, why: tr({ en: "Required, not taken", id: "Wajib, belum diambil" }) })),
    ...(rec.specialization?.courses ?? [])
      .filter((c) => !rec.passed.has(c) && !rec.current.has(c))
      .map((c) => ({ code: c, why: tr({ en: `Completes ${rec.specialization?.name}`, id: `Menuntaskan ${rec.specialization?.name}` }) })),
    ...(minor?.courses ?? []).filter((c) => !rec.passed.has(c)).map((c) => ({ code: c, why: `Minor ${minor?.name}` })),
  ];
  const retakes = [...rec.passed.entries()]
    .filter(([, v]) => ["C", "D", "E", "BC"].includes(v.grade))
    .sort((a, b) => (GRADE_POINTS[a[1].grade] ?? 0) - (GRADE_POINTS[b[1].grade] ?? 0));
  const q = query.trim().toLowerCase();
  const matches = (c: { code: string; name: string }) => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
  const programCourses = catalog.courses.filter((c) => c.prodi === rec.prodi && !rec.required.has(c.code) && matches(c));
  const allCourses = q.length >= 2 ? catalog.courses.filter(matches).slice(0, 60) : [];

  const Row = ({ code, why, retake }: { code: string; why?: string; retake?: boolean }) => {
    const info = catalogByCode.get(code) ?? courseInfo(data, rec, code);
    const st = retake ? null : status(code);
    return (
      <li className={cx("flex items-center gap-3 px-4 py-2.5", "border-b last:border-b-0", ui.line)}>
        <span className="w-[64px] shrink-0 text-[12.5px] font-semibold tabular-nums">{code}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{info.name}</span>
          <span className={cx("block truncate text-[11.5px]", ui.muted)}>
            {[`${info.sks} SKS`, info.prodi ? programName.get(info.prodi) ?? info.prodi : null, why].filter(Boolean).join(" · ")}
          </span>
        </span>
        {st ? (
          <span className={cx("text-[11.5px] font-semibold whitespace-nowrap", ui.faint)}>{st.label}</span>
        ) : (
          <button
            onClick={() => {
              onAdd(code, Boolean(retake));
              onClose();
            }}
            className={cx("inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12px] font-semibold", ui.secondary, ui.focus)}
          >
            {retake ? tr({ en: "Retake", id: "Ulang" }) : tr({ en: "Add", id: "Tambah" })}
          </button>
        )}
      </li>
    );
  };

  const tabs: [Tab, string][] = [
    ["needed", tr({ en: "For your plan", id: "Untuk rencanamu" })],
    ["program", tr({ en: "Your program's electives", id: "Pilihan prodimu" })],
    ["minor", tr({ en: "Minors", id: "Minor" })],
    ["all", tr({ en: "All ITB courses", id: "Semua mata kuliah ITB" })],
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/30 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={cx("flex max-h-[80vh] w-[680px] flex-col overflow-hidden rounded-2xl", "bg-white dark:bg-[#1f1f23]", "shadow-[0_24px_80px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/10 dark:ring-white/10")}
      >
        <div className={cx("border-b px-4 pt-3.5", ui.line)}>
          <p className="flex items-center justify-between text-[14px] font-semibold">
            {tr({ en: `Add to ${termLabel}`, id: `Tambah ke ${termLabel}` })}
            <button onClick={onClose} aria-label="Close" className={cx("rounded-md p-1", ui.muted, ui.hover, ui.focus)}>
              <Icons.X className="size-4" />
            </button>
          </p>
          <div className={cx("mt-2.5 flex h-9 items-center gap-2 rounded-lg px-3", ui.fill)}>
            <Icons.Search className={cx("size-4", ui.faint)} />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (e.target.value.trim().length >= 2 && tab === "needed") setTab("all");
              }}
              placeholder={tr({ en: "Search by code or name, e.g. II4031 or kriptografi", id: "Cari kode atau nama, mis. II4031 atau kriptografi" })}
              className="h-full flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[#9a9aa1]"
            />
          </div>
          <nav className="mt-2 flex gap-5" role="tablist">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cx("-mb-px h-9 border-b-2 text-[12.5px] font-medium", tab === key ? "border-current" : cx("border-transparent", ui.muted), ui.focus)}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="min-h-[300px] overflow-y-auto">
          {tab === "needed" && (
            <>
              <ul>
                {needed.map((x) => (
                  <Row key={x.code} code={x.code} why={x.why} />
                ))}
              </ul>
              {retakes.length > 0 && (
                <>
                  <p className={cx("px-4 pt-4 pb-1 text-[11.5px] font-semibold tracking-[0.04em] uppercase", ui.faint)}>
                    {tr({ en: "Retake to raise your IPK", id: "Ulang untuk menaikkan IPK" })}
                  </p>
                  <ul>
                    {retakes.map(([code, v]) => (
                      <Row key={code} code={code} retake why={tr({ en: `Your grade: ${v.grade}`, id: `Nilaimu: ${v.grade}` })} />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          {tab === "program" && (
            <ul>
              {programCourses.map((c) => (
                <Row key={c.code} code={c.code} why={c.category !== "Kuliah" ? c.category : undefined} />
              ))}
            </ul>
          )}
          {tab === "minor" && (
            <ul>
              {catalog.minors
                .filter((m) => m.program !== programName.get(rec.prodi))
                .filter((m) => !q || m.name.toLowerCase().includes(q) || m.program.toLowerCase().includes(q))
                .slice(0, 40)
                .map((m) => (
                  <li key={minorKey(m)} className={cx("border-b px-4 py-2.5 last:border-b-0", ui.line)}>
                    <p className="flex items-center justify-between text-[13px] font-semibold">
                      {m.name}
                      <span className={cx("text-[11.5px] font-medium", ui.muted)}>
                        {m.program} · {m.sks} SKS
                      </span>
                    </p>
                    <p className={cx("mt-0.5 line-clamp-2 text-[11.5px]", ui.muted)}>{m.description}</p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.courses.map((c) => {
                        const st = status(c);
                        return (
                          <li key={c}>
                            <button
                              disabled={Boolean(st)}
                              onClick={() => {
                                onAdd(c, false);
                                onClose();
                              }}
                              className={cx(
                                "rounded-md px-2 py-1 text-[11.5px] font-semibold tabular-nums",
                                st ? "bg-[#dcf4e5] text-[#166240] dark:bg-[#12301f] dark:text-[#80e0a9]" : cx(ui.secondary),
                                ui.focus,
                              )}
                              title={catalogByCode.get(c)?.name}
                            >
                              {c}
                              {st ? " ✓" : " +"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
            </ul>
          )}
          {tab === "all" &&
            (q.length < 2 ? (
              <p className={cx("px-4 py-6 text-center text-[13px]", ui.muted)}>
                {tr({ en: `Type at least 2 letters to search ${catalog.courses.length} courses.`, id: `Ketik minimal 2 huruf untuk mencari ${catalog.courses.length} mata kuliah.` })}
              </p>
            ) : (
              <ul>
                {allCourses.map((c) => (
                  <Row key={c.code} code={c.code} />
                ))}
                {allCourses.length === 0 && <li className={cx("px-4 py-6 text-center text-[13px]", ui.muted)}>{tr({ en: "No match.", id: "Tidak ditemukan." })}</li>}
              </ul>
            ))}
        </div>
        <p className={cx("border-t px-4 py-2 text-[11.5px]", ui.line, ui.faint)}>
          {tr({ en: "From SIX's public catalog, Kurikulum 2024.", id: "Dari katalog publik SIX, Kurikulum 2024." })}
        </p>
      </div>
    </div>
  );
}
