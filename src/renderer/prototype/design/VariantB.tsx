// PROTOTYPE (#83) — throwaway. Variant B — "Lists": a Things 3 / Apple-style
// take on Edunex Plus v2. Calm lists and big titles; typography does the work.
// Sidebar smart lists (Today ★, Upcoming, All Tasks) and courses as projects
// with progress pies; each screen is one column of headed lists.
import { useState } from "react";
import { VBContext, type Nav, type SidebarKey, type TasksView, type VB } from "./variant-b-context";
import { CourseScreen } from "./variant-b-course";
import { TasksScreen, TodayScreen } from "./variant-b-lists";
import { buildModel } from "./variant-b-model";
import { BackButton, Shell } from "./variant-b-shell";
import { SignInScreen } from "./variant-b-signin";
import { TaskScreen } from "./variant-b-task";
import type { VariantModule, VariantProps } from "./variant-props";

/** Where the Task page was opened from, for the back button and the sidebar highlight. */
interface Origin {
  screen: "today" | "tasks" | "course";
  view: TasksView;
  course?: string;
}

// The Upcoming smart list is a second view of the Tasks screen. It lives in the
// URL too (?bview=upcoming) so it survives reloads and can be screenshotted.
const VIEW_PARAM = "bview";
function readView(): TasksView {
  return new URLSearchParams(window.location.search).get(VIEW_PARAM) === "upcoming" ? "upcoming" : "all";
}
function writeView(view: TasksView) {
  const q = new URLSearchParams(window.location.search);
  if (view === "upcoming") q.set(VIEW_PARAM, view);
  else q.delete(VIEW_PARAM);
  window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
}

function VariantBApp(p: VariantProps) {
  const [view, setView] = useState<TasksView>(readView);
  const [origin, setOrigin] = useState<Origin>({ screen: "tasks", view: "all" });
  const m = buildModel(p.data, p.now, p.f, p.lang, p.task);

  const nav: Nav = {
    today: () => p.go("today"),
    tasks: (next) => {
      setView(next);
      writeView(next);
      p.go("tasks");
    },
    task: (id) => {
      if (p.screen === "today" || p.screen === "tasks" || p.screen === "course") {
        setOrigin({ screen: p.screen, view, course: p.course.code });
      }
      p.go("task", { task: id });
    },
    course: (code) => p.go("course", { course: code }),
    back: () => {
      if (origin.screen === "course" && origin.course) p.go("course", { course: origin.course });
      else if (origin.screen === "today") p.go("today");
      else nav.tasks(origin.view);
    },
  };

  const listKey = (v: TasksView): SidebarKey => (v === "upcoming" ? "upcoming" : "all");
  const active: SidebarKey =
    p.screen === "today"
      ? "today"
      : p.screen === "tasks"
        ? listKey(view)
        : p.screen === "course"
          ? `course:${p.course.code}`
          : origin.screen === "course" && origin.course
            ? `course:${origin.course}`
            : origin.screen === "today"
              ? "today"
              : listKey(origin.view);

  const upcomingLabel = p.tr({ en: "Upcoming", id: "Mendatang" });
  const allLabel = p.tr({ en: "All Tasks", id: "Semua tugas" });
  const backLabel =
    origin.screen === "course" && origin.course
      ? m.courseName(origin.course)
      : origin.screen === "today"
        ? p.t("today")
        : origin.view === "upcoming"
          ? upcomingLabel
          : allLabel;

  const value: VB = { p, m, nav, view, active, backLabel };

  if (p.screen === "signin") {
    return (
      <>
        <style>{CSS}</style>
        <SignInScreen p={p} />
      </>
    );
  }

  const title =
    p.screen === "today"
      ? p.t("today")
      : p.screen === "tasks"
        ? view === "upcoming"
          ? upcomingLabel
          : allLabel
        : p.screen === "course"
          ? p.course.name
          : p.task.title.replace(/\s+/g, " ").trim();

  const scrollKey = `${p.screen}:${view}:${p.screen === "task" ? p.task.id : ""}:${p.screen === "course" ? p.course.code : ""}`;

  return (
    <VBContext.Provider value={value}>
      <style>{CSS}</style>
      <Shell title={title} scrollKey={scrollKey} toolbar={p.screen === "task" ? <BackButton /> : null}>
        {p.screen === "today" && <TodayScreen />}
        {p.screen === "tasks" && <TasksScreen key={view} />}
        {p.screen === "task" && <TaskScreen />}
        {p.screen === "course" && <CourseScreen />}
      </Shell>
    </VBContext.Provider>
  );
}

/* Keyframes and the instructions prose live here: prototype.css is shared by
   all variants, so Variant B brings its own (all prefixed vb-). */
const CSS = `
@keyframes vb-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes vb-pop { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: none; } }
.vb-prose { overflow-wrap: anywhere; }
.vb-prose p { margin: 0 0 0.6em; }
.vb-prose p:last-child { margin-bottom: 0; }
.vb-prose ol, .vb-prose ul { margin: 0.3em 0 0.75em; padding-left: 1.45em; }
.vb-prose ol { list-style: decimal; }
.vb-prose ul { list-style: disc; }
.vb-prose ol ol { list-style: lower-alpha; margin: 0.3em 0; }
.vb-prose li { margin: 0.28em 0; padding-left: 0.2em; }
.vb-prose li::marker { color: #8E8E93; }
.vb-prose strong, .vb-prose b { font-weight: 600; }
.vb-prose a { color: #0068D6; text-decoration: underline; text-decoration-color: rgb(0 104 214 / 0.35); text-underline-offset: 2px; }
.dark .vb-prose a { color: #2B8FFF; text-decoration-color: rgb(43 143 255 / 0.4); }
.vb-prose [style] { color: inherit !important; background-color: transparent !important; }
.vb-prose img { max-width: 100%; height: auto; border-radius: 10px; }
.vb-prose figure { margin: 0.4em 0; }
`;

export const VariantB: VariantModule = { key: "B", name: "Lists", Component: VariantBApp };
