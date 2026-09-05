import { Kbd } from "@/components/ui/kbd";
import { cx } from "@/utils/cx";
import { NAV_ITEMS, type NavKey } from "@/nav";

/**
 * Floating curated rail per the #8 BoardUI revision — same visual recipe as
 * BoardUI's dashboard sidebar: floating neutral panel, white hairline border,
 * "Sidebar Elevation" shadow; the selected nav item is the accent-500→600
 * gradient pill with the "Sidebar selected" ring + inner top highlight.
 * Shell slice (#32): switching between placeholder views only — feature
 * content and hideable-features controls land in later slices (#20–#22).
 */

export interface AppSidebarProps {
  activeKey: NavKey;
  onSelect: (key: NavKey) => void;
}

export function AppSidebar({ activeKey, onSelect }: AppSidebarProps) {
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

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const selected = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cx(
                "flex cursor-pointer items-center gap-2 overflow-hidden rounded-2lg p-2 text-body-medium transition-colors duration-300",
                selected
                  ? "bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected"
                  : "font-medium text-text-secondary hover:bg-background-secondary-hover",
              )}
            >
              <i
                className={cx(
                  item.icon,
                  "text-[20px] shrink-0",
                  selected ? "text-white" : "text-foreground-icon-secondary",
                )}
                aria-hidden
              />
              <span className={cx("whitespace-nowrap", selected && "font-semibold text-white")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-separator-border pt-3">
        <div className="flex items-center gap-2.5 rounded-2lg p-2">
          <span className="grid size-8 place-items-center rounded-full bg-background-tertiary-default text-foreground-icon-secondary">
            <i className="ri-user-3-line text-[16px]" aria-hidden />
          </span>
          <div>
            <div className="text-body-medium font-semibold leading-tight">Not signed in</div>
            <div className="text-caption-1-regular text-text-tertiary">
              INA sign-in lands in #18
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
