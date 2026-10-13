// Quick search's way in: the top bar's button and ⌘K (Ctrl+K elsewhere). The
// palette itself (./search.tsx) loads after the first screen.
import { useEffect } from "react";
import { useT } from "../i18n";
import { useStore } from "../store";
import { Kbd } from "../ui/display";
import { Icons } from "../ui/icons";

/** ⌘K on macOS, Ctrl+K elsewhere, from anywhere in the window. */
export function useSearchShortcut(toggle: () => void): void {
  const store = useStore();
  useEffect(() => {
    const mac = store.platform === "darwin";
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.altKey || event.shiftKey || !(mac ? event.metaKey : event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k" && event.code !== "KeyK") return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, toggle]);
}

/** The top bar's way in, with the shortcut on it. */
export function SearchButton({ onOpen }: { onOpen: () => void }) {
  const t = useT();
  const mac = useStore().platform === "darwin";
  return (
    <button
      type="button"
      aria-label={t("search.open")}
      aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      onClick={onOpen}
      className="focus-ring flex h-8 w-[208px] min-w-[120px] shrink items-center gap-2 rounded-lg border border-edge bg-surface px-2.5 text-small text-muted transition-colors duration-150 hover:bg-hover hover:text-fg"
    >
      <Icons.Search className="size-3.5" />
      <span className="flex-1 text-left">{t("search.open")}</span>
      <span aria-hidden className="flex gap-0.5">
        <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
