// A file from Edunex that's on this computer (downloaded, or saved for
// offline) opens from where it's listed, like an editor's "Open in" button:
// "Buka di Preview", its arrow listing the other apps that open it (on
// Windows, the system's own "Open with" window), and a folder button that
// shows it in Finder or File Explorer. The app the Student picks is
// remembered for files of its kind. Downloading never opens anything itself.
import { useCallback, useEffect, useState } from "react";
import type { LocalCopy } from "../core/actions/files";
import { useT } from "./i18n";
import { useBridge, useStore } from "./store";
import { Button, IconButton } from "./ui/controls";
import { Icons } from "./ui/icons";
import { Menu, type MenuItem } from "./ui/menu";
import { Tooltip, toast } from "./ui/overlays";

/** The copy of `url` on this computer (null: none, or not asked yet); `refresh` asks again, after a download. */
export function useLocalCopy(url: string | null): { copy: LocalCopy | null; refresh: () => Promise<void> } {
  const bridge = useBridge();
  const [copy, setCopy] = useState<LocalCopy | null>(null);
  const refresh = useCallback(async () => {
    if (!url) return setCopy(null);
    setCopy(await bridge.invoke("files.local", { url }).catch(() => null));
  }, [bridge, url]);
  useEffect(() => {
    let live = true;
    if (url)
      bridge.invoke("files.local", { url }).then(
        (next) => live && setCopy(next),
        () => live && setCopy(null),
      );
    else setCopy(null);
    return () => {
      live = false;
    };
  }, [bridge, url]);
  return { copy, refresh };
}

/** "Tampilkan di Finder" on a Mac, "… di File Explorer" on Windows. */
function useRevealLabel(): string {
  const t = useT();
  return t(`file.reveal.${useStore().platform}`);
}

/** Says where a download went, with a way to see it there. */
export function useDownloadedToast(): (url: string, existing: boolean) => void {
  const t = useT();
  const bridge = useBridge();
  return useCallback(
    (url, existing) =>
      toast(t(existing ? "material.openedCopy" : "material.downloaded"), "neutral", {
        label: t("file.revealShort"),
        onClick: () => void bridge.invoke("files.reveal", { url }).catch(() => undefined),
      }),
    [t, bridge],
  );
}

/** The open button, its menu of other apps, and the folder button, for a file `copy` says is here. */
/** `onChange`: ask "files.local" again (another app picked, or the copy gone). */
export function OpenFile({ url, copy, onChange }: { url: string; copy: LocalCopy; onChange?: () => void }) {
  const t = useT();
  const bridge = useBridge();
  const reveal = useRevealLabel();
  const [busy, setBusy] = useState(false);
  const preferred = copy.apps.find((found) => found.id === copy.preferred) ?? null;

  const run = async (input: { app?: string; choose?: boolean } = {}) => {
    setBusy(true);
    try {
      await bridge.invoke("files.open", { url, ...input });
      // Another app picked: the button offers it from now on.
      if (input.app && input.app !== copy.preferred) onChange?.();
    } catch {
      toast(t("file.openFailed", { name: copy.name }), "danger");
      // Moved or deleted since: it's no longer here.
      onChange?.();
    } finally {
      setBusy(false);
    }
  };
  const show = () =>
    void bridge.invoke("files.reveal", { url }).catch(() => {
      toast(t("file.openFailed", { name: copy.name }), "danger");
      onChange?.();
    });

  const items: MenuItem[] = [
    ...copy.apps.map((found) => ({ label: found.name, icon: <AppIcon icon={found.icon} />, onSelect: () => void run({ app: found.id }) })),
    ...(copy.chooser ? [{ label: t("file.chooseApp"), icon: <Icons.AppWindow className="size-4" />, onSelect: () => void run({ choose: true }) }] : []),
  ];
  const label = preferred ? t("file.openIn", { app: preferred.name }) : t("file.open");

  return (
    <span className="flex shrink-0 items-center gap-1">
      <span className="inline-flex">
        <Button
          size="sm"
          busy={busy}
          icon={preferred ? <AppIcon icon={preferred.icon} /> : <Icons.ArrowUpRight className="size-3.5" />}
          aria-label={`${label}: ${copy.name}`}
          onClick={() => void run(preferred ? { app: preferred.id } : {})}
          className={items.length > 0 ? "rounded-r-none" : undefined}
        >
          {label}
        </Button>
        {items.length > 0 && (
          <Menu
            label={`${t("file.otherApps")}: ${copy.name}`}
            items={items}
            trigger={{
              icon: <Icons.ChevronDown className="size-3" weight="bold" />,
              text: t("file.otherApps"),
              className: "rounded-l-none border border-l-0 border-edge bg-surface",
            }}
            className="w-[240px]"
          />
        )}
      </span>
      <Tooltip content={reveal}>
        <IconButton label={`${reveal}: ${copy.name}`} size="sm" onClick={show}>
          <Icons.FolderDown className="size-4" />
        </IconButton>
      </Tooltip>
    </span>
  );
}

/** An app's own icon, or a plain window where the system gave none. */
function AppIcon({ icon }: { icon: string | null }) {
  return icon ? <img src={icon} alt="" className="size-4 shrink-0" draggable={false} /> : <Icons.AppWindow className="size-4" />;
}
