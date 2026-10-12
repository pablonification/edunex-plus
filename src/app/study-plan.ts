// The Student's record and study plan for Nilai and Rencana studi (#78,
// #79): SIX's transcript, graduation progress and curriculum with ITB's
// catalog, read into one record, and the plan kept on this computer
// ("local.plan"). Both screens project with the same functions, so they never
// disagree.
import { useMemo, useState } from "react";
import type { StudyPlan } from "../core/models";
import { defaultPlan, livePlan, type Projection, project, type StudentRecord, studentRecord } from "../core/planner";
import { useBridge, useDataset } from "./store";

/** The record, or undefined while SIX's transcript hasn't been read. */
export function useStudentRecord(): StudentRecord | undefined {
  const transcript = useDataset("six.transcript");
  const progress = useDataset("six.progress");
  const curriculum = useDataset("six.curriculum");
  const catalog = useDataset("itb.catalog");
  const krs = useDataset("six.krs");
  const student = useDataset("six.student");
  const courses = useDataset("six.courses");
  return useMemo(() => {
    if (!transcript) return undefined;
    const term = student?.term ?? krs?.term ?? null;
    const termCourses = courses ?? (krs && krs.term === term ? krs.courses : undefined);
    return studentRecord({ transcript, progress, curriculum, catalog, term, termCourses });
  }, [transcript, progress, curriculum, catalog, krs, student, courses]);
}

export interface PlanState {
  /** The saved plan, or a starting one until the Student changes something. */
  plan: StudyPlan;
  saved: boolean;
  projection: Projection;
  /** Saves a change on this computer. */
  update(edit: (plan: StudyPlan) => StudyPlan): void;
  reset(): void;
}

export function usePlan(record: StudentRecord | undefined): PlanState | undefined {
  const bridge = useBridge();
  const stored = useDataset("local.plan");
  const [draft, setDraft] = useState<StudyPlan | null>(null);
  const fallback = useMemo(() => (record ? defaultPlan(record) : null), [record]);
  const current = draft ?? stored ?? fallback;
  const plan = useMemo(() => (record && current ? livePlan(current, record) : null), [record, current]);
  const projection = useMemo(() => (record && plan ? project(record, plan) : null), [record, plan]);
  if (!record || !plan || !projection) return undefined;
  const save = (next: StudyPlan | null) => {
    setDraft(next);
    void bridge.invoke("local.set", { name: "local.plan", value: next ?? defaultPlan(record) }).catch(() => undefined);
  };
  return {
    plan,
    saved: Boolean(draft ?? stored),
    projection,
    update: (edit) => save(edit(plan)),
    reset: () => save(defaultPlan(record)),
  };
}
