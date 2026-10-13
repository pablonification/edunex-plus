// The Student's record and study plan for Nilai and Rencana studi (#78,
// #79): SIX's transcript, graduation progress and curriculum with ITB's
// catalog and the Student's corrections to it ("local.curriculum"), read into
// one record, and the plan kept on this computer ("local.plan") with this
// term's what-ifs. Both screens project with the same functions, so they
// never disagree; Nilai keeps to SIX's own record for this term.
import { useMemo, useState } from "react";
import type { CurriculumFix, StudyPlan } from "../core/models";
import {
  aheadPlan,
  defaultPlan,
  livePlan,
  type Projection,
  project,
  pruneWhatIfs,
  type StudentRecord,
  studentRecord,
  untried,
  withWhatIf,
} from "../core/planner";
import { useBridge, useDataset, useStore } from "./store";

/** The record, or undefined while SIX's transcript hasn't been read. */
export function useStudentRecord(): StudentRecord | undefined {
  const transcript = useDataset("six.transcript");
  const progress = useDataset("six.progress");
  const curriculum = useDataset("six.curriculum");
  const catalog = useDataset("itb.catalog");
  const krs = useDataset("six.krs");
  const student = useDataset("six.student");
  const courses = useDataset("six.courses");
  const fixes = useDataset("local.curriculum");
  return useMemo(() => {
    if (!transcript) return undefined;
    const term = student?.term ?? krs?.term ?? null;
    const termCourses = courses ?? (krs && krs.term === term ? krs.courses : undefined);
    return studentRecord({ transcript, progress, curriculum, catalog, term, termCourses, fixes: fixes?.slots });
  }, [transcript, progress, curriculum, catalog, krs, student, courses, fixes]);
}

/** Saves or removes the Student's correction to one curriculum course, on this computer; gives back the one it replaced, for an undo. */
export function useCurriculumFix(): (slot: string, fix: CurriculumFix | null) => CurriculumFix | null {
  const bridge = useBridge();
  const store = useStore();
  return (slot, fix) => {
    // Read at the moment of the change, so an undo from a toast never puts back an older set.
    const { [slot]: before, ...rest } = (store.dataset("local.curriculum")?.value as { slots: Record<string, CurriculumFix> } | undefined)?.slots ?? {};
    void bridge.invoke("local.set", { name: "local.curriculum", value: { slots: fix ? { ...rest, [slot]: fix } : rest } }).catch(() => undefined);
    return before ?? null;
  };
}

export interface PlanState {
  /** The plan every figure reads (see `livePlan`): the saved one, or a starting one until the Student changes something. */
  plan: StudyPlan;
  /** The plan as it's saved: what an undo puts back. */
  base: StudyPlan;
  /** The record with this term's what-ifs, or SIX's own when the screen asked for that. */
  record: StudentRecord;
  saved: boolean;
  projection: Projection;
  /** Saves a change on this computer. */
  update(edit: (plan: StudyPlan) => StudyPlan): void;
  reset(): void;
}

/**
 * The plan and its projection. Rencana and Kurikulum count this term's
 * what-ifs; Nilai passes `whatIfs: false` to keep to SIX's own record.
 */
export function usePlan(record: StudentRecord | undefined, whatIfs = true): PlanState | undefined {
  const bridge = useBridge();
  const stored = useDataset("local.plan");
  const [draft, setDraft] = useState<StudyPlan | null>(null);
  const fallback = useMemo(() => (record ? defaultPlan(record) : null), [record]);
  const current = draft ?? stored ?? fallback;
  const base = useMemo(() => (record && current ? pruneWhatIfs(aheadPlan(current, record), record) : null), [record, current]);
  const effective = useMemo(() => (record && base ? (whatIfs ? withWhatIf(record, base) : record) : undefined), [record, base, whatIfs]);
  // Without the what-ifs, a course tried this term counts where it was planned.
  const plan = useMemo(() => (effective && base ? livePlan(whatIfs ? base : untried(base), effective) : null), [effective, base, whatIfs]);
  const projection = useMemo(() => (effective && plan ? project(effective, plan) : null), [effective, plan]);
  if (!record || !effective || !base || !plan || !projection) return undefined;
  const save = (next: StudyPlan) => {
    setDraft(next);
    void bridge.invoke("local.set", { name: "local.plan", value: next }).catch(() => undefined);
  };
  return {
    plan,
    base,
    record: effective,
    saved: Boolean(draft ?? stored),
    projection,
    // Edits apply to the plan as saved, not the one the figures read: nothing a figure leaves out is lost.
    update: (edit) => save(edit(base)),
    reset: () => save(defaultPlan(record, base.hidden)),
  };
}
