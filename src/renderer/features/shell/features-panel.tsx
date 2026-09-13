import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { NAV_ITEMS } from "@/nav";
import { isHideableNavKey } from "@shared/shell";
import type { ShellSettingsState } from "./use-shell-settings";

export interface FeaturesPanelProps {
  shell: ShellSettingsState;
  onClose: () => void;
}

/**
 * The one features panel (#22): every page with a Hide/Show control, so
 * re-enabling a hidden page is one gesture away without touching Settings.
 * Home is pinned — it is the course home base, never hideable.
 */
export function FeaturesPanel({ shell, onClose }: FeaturesPanelProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Features"
        className="w-full max-w-md rounded-2xl bg-background-primary-default p-6 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-semibold tracking-tight text-text-primary">Features</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close features"
            className="ml-auto grid size-7 cursor-pointer place-items-center rounded-lg text-text-tertiary outline-none transition-colors hover:bg-black/[0.04] hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <i className="ri-close-line text-[16px]" aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-text-secondary">
          Hide pages you never use. Hidden pages leave the sidebar — or right-click a page
          there to hide it directly.
        </p>
        <ul aria-label="Hideable features" className="mt-4 rounded-xl bg-background-secondary-default/80 p-1.5">
          {NAV_ITEMS.map((item) => {
            const hideable = isHideableNavKey(item.key);
            const hidden = shell.isHidden(item.key);
            return (
              <li
                key={item.key}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
              >
                <i className={`${item.icon} text-[17px] text-text-tertiary`} aria-hidden />
                <span className="text-[13px] leading-5 text-text-primary">{item.label}</span>
                <span className="ml-auto">
                  {!hideable ? (
                    <Chip color="soft" variant="caption">Always visible</Chip>
                  ) : hidden ? (
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => shell.setViewHidden(item.key, false)}
                      aria-label={`Show ${item.label}`}
                    >
                      Show
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => shell.setViewHidden(item.key, true)}
                      aria-label={`Hide ${item.label}`}
                    >
                      Hide
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
