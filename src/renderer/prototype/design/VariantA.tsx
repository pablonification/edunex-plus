// PROTOTYPE (#83) — throwaway. Variant A — "Calendar" (Notion Calendar-like):
// time is the backbone. A sidebar with a mini month, a day timeline for Today,
// an agenda for Tasks, calendar cards for a course's sessions.
import { useState } from "react";
import { TrafficLights } from "./chrome";
import type { VariantModule, VariantProps } from "./variant-props";
import { CourseScreen } from "./variant-a-course";
import { keyOf } from "./variant-a-kit";
import { Sidebar } from "./variant-a-sidebar";
import { SignInScreen } from "./variant-a-signin";
import { TaskScreen } from "./variant-a-task";
import { TasksScreen } from "./variant-a-tasks";
import { TodayScreen } from "./variant-a-today";

/** Instructions HTML from EduNex: readable type, and inline colours neutralised
 * so lecturer-pasted `color:#000` stays legible in dark mode. */
const PROSE_CSS = `
.va-prose { font-size: 14px; line-height: 1.62; overflow-wrap: anywhere; }
.va-prose > :first-child { margin-top: 0; }
.va-prose > :last-child { margin-bottom: 0; }
.va-prose p { margin: 0 0 0.7em; }
.va-prose ol, .va-prose ul { margin: 0 0 0.8em; padding-left: 1.35em; }
.va-prose ol { list-style: decimal; }
.va-prose ul { list-style: disc; }
.va-prose ol ol { list-style: lower-alpha; margin: 0.35em 0 0.2em; }
.va-prose li { margin: 0.32em 0; padding-left: 0.2em; }
.va-prose li::marker { color: #8A8A90; font-variant-numeric: tabular-nums; }
.va-prose strong, .va-prose b { font-weight: 600; }
.va-prose a { color: #2468E0; text-decoration: underline; text-decoration-color: rgb(36 104 224 / 0.35); text-underline-offset: 2px; }
.va-prose a:hover { text-decoration-color: currentColor; }
.va-prose [style] { color: inherit !important; background-color: transparent !important; }
.va-prose img { max-width: 100%; height: auto; border-radius: 10px; }
.va-prose figure { margin: 0 0 0.8em; }
.dark .va-prose a { color: #6AA6FF; text-decoration-color: rgb(106 166 255 / 0.4); }
.dark .va-prose li::marker { color: #77777D; }
`;

function CalendarApp(props: VariantProps) {
  const { screen, task, course } = props;
  const [day, setDay] = useState(() => keyOf(props.now.getTime()));
  const nav = { day, onDay: setDay };

  if (screen === "signin") return <SignInScreen {...props} />;

  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden bg-white text-[13px] text-[#1D1D1F] dark:bg-[#141416] dark:text-[#F2F2F3]">
      <style>{PROSE_CSS}</style>
      <TrafficLights />
      <Sidebar {...props} {...nav} />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          key={`${screen}:${screen === "task" ? task.id + task.status : ""}:${screen === "course" ? course.code : ""}`}
          className="flex min-h-0 flex-1 flex-col motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-[3px] motion-safe:starting:opacity-0"
        >
          {screen === "today" && <TodayScreen {...props} {...nav} />}
          {screen === "tasks" && <TasksScreen {...props} />}
          {screen === "task" && <TaskScreen {...props} />}
          {screen === "course" && <CourseScreen {...props} />}
        </div>
      </main>
    </div>
  );
}

export const VariantA: VariantModule = { key: "A", name: "Calendar", Component: CalendarApp };
