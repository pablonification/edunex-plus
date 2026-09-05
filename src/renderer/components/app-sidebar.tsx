import { cx } from "@/utils/cx";
import { NAV_ITEMS, type NavKey } from "@/nav";

/**
 * Flush curated rail per the #8 BoardUI revision, restyled native (#32):
 * runs to the window's top and bottom edges with no card chrome. On macOS it
 * sits over the window's sidebar vibrancy (translucent), holds the traffic
 * lights in its header (which doubles as the titlebar drag region); on
 * Windows/Linux it's a solid secondary background next to the standard frame.
 * Selected nav item keeps the accent-500→600 gradient pill. Feature content
 * and hideable-features controls land in later slices (#20–#22).
 */

export interface AppSidebarProps {
  activeKey: NavKey;
  onSelect: (key: NavKey) => void;
}

export function AppSidebar({ activeKey, onSelect }: AppSidebarProps) {
  const isMac = window.edunex.platform === "darwin";

  return (
    <aside
      className={cx(
        "flex w-[232px] shrink-0 flex-col pb-3",
        isMac ? "bg-white/55 backdrop-blur-2xl" : "bg-background-secondary-default",
      )}
    >
      <header
        className={cx(
          "app-drag flex h-[52px] shrink-0 items-center",
          isMac ? "pl-[80px]" : "px-4 pt-2",
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-2lg bg-linear-to-b from-accent-500 to-accent-600 text-[15px] font-bold text-white shadow-nav-selected">
          e+
        </span>
        <span className="ml-2 text-title-3-bold tracking-tight">Edunex Plus</span>
      </header>

      <nav className={cx("flex flex-col gap-0.5 px-2", isMac && "app-no-drag")} aria-label="Main">
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

      <div className="mt-auto border-t border-separator-border px-2 pt-3">
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
