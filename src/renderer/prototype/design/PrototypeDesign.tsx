// PROTOTYPE (#83) — throwaway.
// Three structurally different designs of the whole v2 app (Sign-in, Today,
// Tasks, Task page, Course page) on one page, switchable via ?variant=A|B|C,
// with ?screen=, ?theme=, ?lang= and a ?status= preview for the Task page.
// Real data comes from build-local-data.mjs (local, git-ignored).
import { useLayoutEffect, useMemo } from "react";
import { data, withStatus } from "./data";
import { makeFormat, pick, translate } from "./i18n";
import { setParams, useParams } from "./params";
import { PrototypeSwitcher } from "./PrototypeSwitcher";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";
import { VariantD } from "./VariantD";
import type { VariantModule, VariantProps } from "./variant-props";

// D is the decided LMS-native direction; A–C are the first round, kept for reference.
const VARIANTS: VariantModule[] = [VariantD, VariantA, VariantB, VariantC];

export function PrototypeDesign() {
  const params = useParams();
  const now = useMemo(() => new Date(data.now), []);
  const dark = params.theme === "dark";

  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.lang = params.lang;
  }, [dark, params.lang]);

  const variant = VARIANTS.find((v) => v.key === params.variant) ?? VARIANTS[0];

  // Default Task: the nearest unsubmitted one. Default course: the one whose
  // Presence window is open at the demo moment, else the first.
  const defaultTask =
    data.tasks.find((t) => t.status !== "submitted" && t.dueAt && new Date(t.dueAt) > now) ?? data.tasks[0];
  const baseTask = data.tasks.find((t) => t.id === params.task) ?? defaultTask;
  const openPresence = data.presence.find((p) => new Date(p.opensAt) <= now && now < new Date(p.closesAt));
  const course =
    data.courses.find((c) => c.code === params.course) ??
    data.courses.find((c) => c.code === openPresence?.courseCode) ??
    data.courses[0];

  const props: VariantProps = {
    data,
    now,
    screen: params.screen,
    go: (screen, opts) =>
      setParams({
        screen,
        ...(opts?.task ? { task: opts.task, status: null } : {}),
        ...(opts?.course ? { course: opts.course } : {}),
        // Tabs and overlays belong to one visit; a plain navigation clears them.
        tab: opts?.tab ?? null,
        overlay: opts?.overlay ?? null,
        step: null,
      }),
    task: withStatus(baseTask, params.status, now),
    course,
    lang: params.lang,
    t: (key) => translate(params.lang, key),
    tr: (text) => pick(params.lang, text),
    f: makeFormat(params.lang, now),
    dark,
  };

  return (
    <>
      <variant.Component key={variant.key} {...props} />
      <PrototypeSwitcher params={params} variants={VARIANTS.map(({ key, name }) => ({ key, name }))} />
    </>
  );
}
