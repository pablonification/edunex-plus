import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { cx } from "@/utils/cx";

/**
 * Slim stand-in for BoardUI's DashboardSidebar block (Pro template) — same
 * visual recipe: floating neutral-100 panel, white hairline border, "Sidebar
 * Elevation" shadow; the selected nav item is the accent-500→600 gradient
 * pill with the "Sidebar selected" ring + inner top highlight. Nav entries
 * are v1 features per the #6 MVP scope; presence is hard-selected false for
 * now — active view switching lands with the shell slice of the implementation.
 */

const NAV = [
  { key: "home", label: "Home", icon: "ri-home-5-line" },
  { key: "tasks", label: "Tasks", icon: "ri-checkbox-line", badge: 4, selected: true },
  { key: "agenda", label: "Agenda", icon: "ri-calendar-line" },
  { key: "presence", label: "Presence", icon: "ri-hand-heart-line", badge: 2 },
  { key: "materials", label: "Materials", icon: "ri-folder-3-line" },
] as const;

export function AppSidebar() {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-4 rounded-3xl border border-white bg-background-secondary-default p-3 shadow-sidebar">
      <div className="flex items-center gap-2 px-1 pt-1">
        <span className="grid size-8 place-items-center rounded-2lg bg-linear-to-b from-accent-500 to-accent-600 text-[15px] font-bold text-white shadow-nav-selected">
          e+
        </span>
        <span className="text-title-3-bold tracking-tight">Edunex Plus</span>
      </div>

      <button
        type="button"
        className="flex cursor-pointer items-center gap-2 rounded-full bg-background-tertiary-default px-3 py-2 text-body-medium text-text-placeholder hover:bg-background-tertiary-hover"
      >
        <i className="ri-search-line text-[16px]" aria-hidden />
        <span className="flex-1 text-left">Search</span>
        <Kbd>⌘L</Kbd>
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => (
          <a
            key={item.key}
            className={cx(
              "flex cursor-pointer items-center justify-between overflow-hidden rounded-2lg p-2 text-body-medium transition-colors duration-300",
              "selected" in item && item.selected
                ? "bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected"
                : "font-medium text-text-secondary hover:bg-background-secondary-hover",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <i
                className={cx(
                  item.icon,
                  "text-[20px] shrink-0",
                  "selected" in item && item.selected ? "text-white" : "text-foreground-icon-secondary",
                )}
                aria-hidden
              />
              <span
                className={cx(
                  "whitespace-nowrap",
                  "selected" in item && item.selected && "font-semibold text-white",
                )}
              >
                {item.label}
              </span>
            </span>
            {"badge" in item && item.badge != null && <Badge color="primary">{item.badge}</Badge>}
          </a>
        ))}
      </nav>

      <div className="mt-auto border-t border-separator-border pt-3">
        <div className="flex cursor-pointer items-center gap-2.5 rounded-2lg p-2 hover:bg-background-secondary-hover">
          <span className="grid size-8 place-items-center rounded-full bg-avatar-neutral-background text-xs font-bold text-text-secondary">
            RF
          </span>
          <div>
            <div className="text-body-medium font-semibold leading-tight">Rafi F.</div>
            <div className="text-caption-1-regular text-text-tertiary">Student · 2026-1</div>
          </div>
          <i className="ri-expand-up-down-line ml-auto text-foreground-icon-secondary" aria-hidden />
        </div>
      </div>
    </aside>
  );
}
