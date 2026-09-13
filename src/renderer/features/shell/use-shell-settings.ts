import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SHELL_SETTINGS,
  type NavKey,
  type ShellSettings,
} from "@shared/shell";

export interface ShellSettingsState extends ShellSettings {
  /** True once main's persisted settings have resolved (defaults before that). */
  loaded: boolean;
  /** Main ignores non-hideable views (Home is pinned), so NavKey is safe here. */
  setViewHidden(view: NavKey, hidden: boolean): void;
  setQuitOnClose(quitOnClose: boolean): void;
  isHidden(key: NavKey): boolean;
}

/**
 * Shell preferences over the mock-IPC seam (#22): main owns the persisted
 * settings file and pushes updates on shell:settings-updated; writes apply
 * the resolved settings so the UI stays correct even against a mock bridge
 * that never pushes.
 */
export function useShellSettings(): ShellSettingsState {
  const [settings, setSettings] = useState<ShellSettings>({
    ...DEFAULT_SHELL_SETTINGS,
    hiddenViews: [...DEFAULT_SHELL_SETTINGS.hiddenViews],
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.edunex.getShellSettings().then((result) => {
      if (!cancelled) {
        setSettings(result);
        setLoaded(true);
      }
    });
    const unsubscribe = window.edunex.onShellSettings((next) => {
      if (!cancelled) setSettings(next);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const setViewHidden = useCallback((view: NavKey, hidden: boolean) => {
    void window.edunex.setViewHidden(view, hidden).then((next) => setSettings(next));
  }, []);

  const setQuitOnClose = useCallback((quitOnClose: boolean) => {
    void window.edunex.setQuitOnClose(quitOnClose).then((next) => setSettings(next));
  }, []);

  const isHidden = useCallback(
    (key: NavKey) => (settings.hiddenViews as readonly string[]).includes(key),
    [settings.hiddenViews],
  );

  return { ...settings, loaded, setViewHidden, setQuitOnClose, isHidden };
}
