// Opening a PDF in the app from anywhere: usePdfViewer().open(...) shows the
// viewer over the current screen. A file on Edunex is read in by the main
// process (or taken from a copy on this computer) and can be downloaded from
// the viewer; any other file (one the Student is about to hand in) comes as
// bytes the caller reads. The viewer itself loads on first use, like pdf.js.
import { createContext, lazy, type ReactNode, Suspense, useCallback, useContext, useMemo, useState } from "react";
import type { FileProblem } from "../core/actions/files";
import { ActionError } from "./bridge";
import { useOpenExternal, useOpenLink } from "./hooks";
import { useT } from "./i18n";
import { useBridge, useStore } from "./store";
import { Button } from "./ui/controls";
import { Icons } from "./ui/icons";
import { Tooltip, toast } from "./ui/overlays";
import type { PdfProblem } from "./ui/pdf-viewer";

const PdfViewer = lazy(() => import("./ui/pdf-viewer").then((module) => ({ default: module.PdfViewer })));

export type PdfSource =
  /** A file on Edunex's storage; `edunexUrl`: its page on Edunex, offered when it can't be shown. */
  | { kind: "edunex"; url: string; name: string; edunexUrl?: string }
  /** Any other file (one the Student is about to hand in): its bytes, or why they can't be shown. */
  | { kind: "bytes"; name: string; load: () => Promise<Uint8Array | { problem: FileProblem }> };

/** A file the viewer can show, by its name. */
export const isPdfName = (name: string) => /\.pdf$/i.test(name.trim());

interface PdfViewerControl {
  open(source: PdfSource): void;
  /** Shuts it (the screen behind is changing). */
  close(): void;
}

const Context = createContext<PdfViewerControl | null>(null);

export function usePdfViewer(): PdfViewerControl {
  const viewer = useContext(Context);
  if (!viewer) throw new Error("usePdfViewer needs a PdfViewerProvider");
  return viewer;
}

export function PdfViewerProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const bridge = useBridge();
  const mac = useStore().platform === "darwin";
  const openLink = useOpenLink();
  const openExternal = useOpenExternal();
  const [source, setSource] = useState<PdfSource | null>(null);
  // Closing keeps the last file's viewer mounted but shut, so focus goes back to what opened it.
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useMemo(() => {
    if (!source) return async () => new Uint8Array();
    if (source.kind === "bytes") return source.load;
    return async (): Promise<Uint8Array | { problem: FileProblem }> => {
      try {
        const result = await bridge.invoke("files.read", { url: source.url, as: "pdf" });
        return "problem" in result ? result : result.bytes;
      } catch (error) {
        return { problem: error instanceof ActionError && error.kind === "Rejected" ? "unreadable" : "unreachable" };
      }
    };
  }, [source, bridge]);

  const download = useCallback(async () => {
    if (source?.kind !== "edunex") return;
    setBusy(true);
    try {
      await bridge.invoke("files.download", { url: source.url, name: source.name.slice(0, 200) });
      toast(t("material.downloaded"));
    } catch (error) {
      toast(t("error.action", { message: error instanceof Error ? error.message : String(error) }), "danger");
    } finally {
      setBusy(false);
    }
  }, [source, bridge, t]);

  const downloadButton =
    source?.kind === "edunex" ? (
      <Tooltip content={t("pdf.downloadHint")}>
        <Button size="sm" variant="ghost" busy={busy} icon={<Icons.Download className="size-3.5" />} onClick={() => void download()}>
          {t("material.download")}
        </Button>
      </Tooltip>
    ) : null;
  // One way forward that can work: a link that stopped working or a file that's gone is only on Edunex's page now;
  // one the app can't draw (too big, locked, not a PDF it reads) still opens in the computer's PDF app.
  const fallback = (problem: PdfProblem) => {
    if (source?.kind !== "edunex") return null;
    if (problem === "expired" || problem === "missing")
      return source.edunexUrl ? (
        <Button variant="primary" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => openExternal(source.edunexUrl!)}>
          {t("action.openInEdunex")}
        </Button>
      ) : null;
    return (
      <Button variant="primary" icon={<Icons.Download className="size-3.5" />} busy={busy} onClick={() => void download()}>
        {t("material.download")}
      </Button>
    );
  };

  const viewer = useMemo(
    () => ({
      open: (next: PdfSource) => {
        setSource(next);
        setOpen(true);
      },
      close: () => setOpen(false),
    }),
    [],
  );
  return (
    <Context value={viewer}>
      {children}
      {source && (
        <Suspense fallback={null}>
          <PdfViewer
            open={open}
            onOpenChange={setOpen}
            name={source.name}
            load={load}
            actions={downloadButton}
            fallback={fallback}
            onOpenLink={openLink}
            clearTitleBar={mac}
          />
        </Suspense>
      )}
    </Context>
  );
}
