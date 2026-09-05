/**
 * The shell views, shared by the renderer's curated rail and the main
 * process's application menu (⌘1–6 must map to the same views in the same
 * order). Main can't import from src/renderer (separate tsconfig + module
 * systems), so the list lives here in src/main and the renderer re-uses it
 * over the nav module — keys must stay in sync with src/renderer/nav.ts.
 */
export const NAV_VIEWS = [
  { key: "home", label: "Home" },
  { key: "todo", label: "To Do" },
  { key: "agenda", label: "Agenda" },
  { key: "presence", label: "Presence" },
  { key: "materials", label: "Materials" },
  { key: "exams", label: "Exams" },
] as const;
