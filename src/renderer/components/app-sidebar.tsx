import { useEffect, useState } from "react";
import { cx } from "@/utils/cx";
import { NAV_ITEMS, type NavKey } from "@/nav";
import { isHideableNavKey } from "@shared/shell";

/**
 * Flush curated rail, t3code-style native pass: quiet tinted row selection
 * (no gradient pill, no glow), compact 32px rows with muted 17px icons, 8px
 * control radius. The accent gradient survives only in the brand mark. On
 * macOS the rail sits over the window's sidebar vibrancy and its header
 * carries the traffic lights (the brand row indents past them, and re-aligns
 * with the nav when fullscreen hides the lights); on Windows/Linux it's a
 * solid secondary surface beside the standard frame.
 *
 * Hideable features (#22): hidden views leave the rail, and right-clicking a
 * hideable row hides it directly. Features and Settings open the panel and
 * the modal that re-enable hidden pages.
 */

export interface AppSidebarProps {
  activeKey: NavKey;
  onSelect: (key: NavKey) => void;
  signedIn: boolean;
  hiddenViews?: readonly string[];
  onHideView?: (key: NavKey) => void;
  onOpenFeatures?: () => void;
  onOpenSettings?: () => void;
}

export function AppSidebar({
  activeKey,
  onSelect,
  signedIn,
  hiddenViews = [],
  onHideView,
  onOpenFeatures,
  onOpenSettings,
}: AppSidebarProps) {
  const isMac = window.edunex.platform === "darwin";
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => window.edunex.onFullscreenChange(setIsFullscreen), []);

  const visibleItems = NAV_ITEMS.filter((item) => !hiddenViews.includes(item.key));

  return (
    <aside
      className={cx(
        "flex w-[232px] shrink-0 flex-col pb-2",
        isMac ? "bg-white/55 backdrop-blur-2xl" : "bg-background-secondary-default",
      )}
    >
      <header
        className={cx(
          "flex h-[52px] shrink-0 items-center transition-[padding] duration-150",
          isMac && "app-drag",
          isMac && !isFullscreen ? "pl-[84px]" : "px-4",
        )}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-linear-to-b from-accent-500 to-accent-600 text-[13px] font-bold text-white">
          e+
        </span>
        <span className="ml-2 text-[15px] font-semibold tracking-tight">Edunex Plus</span>
      </header>

      <nav
        className={cx("flex flex-col gap-px px-2", isMac && "app-no-drag")}
        aria-label="Main"
      >
        {visibleItems.map((item) => {
          const selected = item.key === activeKey;
          const hideable = isHideableNavKey(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              onContextMenu={(event) => {
                if (!hideable) return;
                event.preventDefault();
                onHideView?.(item.key);
              }}
              title={hideable ? "Right-click to hide" : undefined}
              className={cx(
                "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] leading-5 transition-colors duration-100",
                selected
                  ? "bg-black/[0.07] font-medium text-text-primary"
                  : "text-text-secondary hover:bg-black/[0.04]",
              )}
            >
              <i
                className={cx(
                  item.icon,
                  "text-[17px] shrink-0",
                  selected ? "text-text-secondary" : "text-text-tertiary",
                )}
                aria-hidden
              />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto px-2 pt-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenFeatures}
            aria-label="Open features"
            title="Features"
            className="grid size-8 cursor-pointer place-items-center rounded-lg text-text-tertiary outline-none transition-colors duration-100 hover:bg-black/[0.04] hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <i className="ri-layout-grid-line text-[16px]" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
            className="grid size-8 cursor-pointer place-items-center rounded-lg text-text-tertiary outline-none transition-colors duration-100 hover:bg-black/[0.04] hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <i className="ri-settings-3-line text-[16px]" aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg p-1.5">
          <span className="grid size-7 place-items-center rounded-full bg-black/[0.06] text-text-tertiary">
            <i className="ri-user-3-line text-[15px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-[13px] font-medium leading-4">
              {signedIn ? "Signed in" : "Not signed in"}
            </div>
            <div className="text-caption-1-regular text-text-tertiary">
              {signedIn ? "INA account" : "Sign in with your INA account"}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
