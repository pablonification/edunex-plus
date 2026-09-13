import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NAV_ITEMS } from "@/nav";
import type { ShellSettingsState } from "./use-shell-settings";

export interface SettingsModalProps {
  shell: ShellSettingsState;
  onClose: () => void;
}

/**
 * BoardUI Settings Modal (#22): the tray-notification opt-out carried over
 * from #32 plus the hidden-features list for re-enabling. Plain fixed
 * overlay + panel on the shared tokens — no Pro components involved.
 */
export function SettingsModal({ shell, onClose }: SettingsModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hiddenItems = NAV_ITEMS.filter((item) => shell.isHidden(item.key));

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
        aria-label="Settings"
        className="w-full max-w-md rounded-2xl bg-background-primary-default p-6 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-semibold tracking-tight text-text-primary">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="ml-auto grid size-7 cursor-pointer place-items-center rounded-lg text-text-tertiary outline-none transition-colors hover:bg-black/[0.04] hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <i className="ri-close-line text-[16px]" aria-hidden />
          </button>
        </div>

        <section aria-labelledby="settings-notifications-heading" className="mt-5">
          <h3
            id="settings-notifications-heading"
            className="text-caption-1-semibold uppercase tracking-[0.08em] text-text-tertiary"
          >
            Notifications
          </h3>
          <div className="mt-2 rounded-xl bg-background-secondary-default/80 p-3.5">
            <Switch
              checked={shell.quitOnClose}
              onChange={shell.setQuitOnClose}
              label="Quit when the window is closed"
              description="When on, closing the window quits Edunex Plus and stops notifications. When off, the app keeps running in the tray."
            />
          </div>
        </section>

        <section aria-labelledby="settings-hidden-heading" className="mt-5">
          <h3
            id="settings-hidden-heading"
            className="text-caption-1-semibold uppercase tracking-[0.08em] text-text-tertiary"
          >
            Hidden features
          </h3>
          {hiddenItems.length === 0 ? (
            <p className="mt-2 rounded-xl bg-background-secondary-default/80 px-3.5 py-3 text-[13px] leading-5 text-text-secondary">
              All features are visible. Right-click any page in the sidebar to hide it.
            </p>
          ) : (
            <ul className="mt-2 rounded-xl bg-background-secondary-default/80 p-1.5">
              {hiddenItems.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
                >
                  <i className={`${item.icon} text-[17px] text-text-tertiary`} aria-hidden />
                  <span className="text-[13px] leading-5 text-text-primary">{item.label}</span>
                  <span className="ml-auto">
                    <Button
                      variant="secondary"
                      size="xs"
                      onClick={() => shell.setViewHidden(item.key, false)}
                      aria-label={`Show ${item.label}`}
                    >
                      Show
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
