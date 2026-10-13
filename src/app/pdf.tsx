// Opening a PDF in the app from anywhere: usePdfViewer().open(...) shows the
// viewer over the current screen. A file on Edunex is read in by the main
// process (or taken from a copy on this computer) and can be downloaded from
// the viewer; any other file (one the Student is about to hand in) comes as
// bytes the caller reads. The viewer itself loads on first use, like pdf.js.
// What the Student fills in there is saved as a copy where they choose, or,
// opened from a Task whose answer can still change, attached to that answer
// (the Task's hand-in card offers itself with useAnswerAttach).
import { createContext, lazy, type ReactNode, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

export type PdfSource = (
  | /** A file on Edunex's storage; `edunexUrl`: its page on Edunex, offered when it can't be shown. */
  { kind: "edunex"; url: string; name: string; edunexUrl?: string }
  /** Any other file (one the Student is about to hand in): its bytes, or why they can't be shown. */
  | { kind: "bytes"; name: string; load: () => Promise<Uint8Array | { problem: FileProblem }> }
) & {
  /** The Task it's on, whose answer a filled-in copy can go into. */
  taskId?: number;
};

/** Puts a filled-in PDF into the answer: as a file attached there, the way one picked from the computer is. */
export type AnswerAttach = (file: { name: string; bytes: Uint8Array }) => Promise<void>;

/** A file the viewer can show, by its name. */
export const isPdfName = (name: string) => /\.pdf$/i.test(name.trim());

interface PdfViewerControl {
  open(source: PdfSource): void;
  /**
   * Shuts it, then runs `then` (the screen behind changing). With filling not
   * saved it asks first: `then` waits for "Buang", and "Lanjut mengisi" drops it.
   */
  close(then?: () => void): void;
  /** A Task's answer taking filled-in PDFs, until the returned function says it no longer does. */
  offerAnswer(taskId: number, attach: AnswerAttach): () => void;
}

const Context = createContext<PdfViewerControl | null>(null);

export function usePdfViewer(): PdfViewerControl {
  const viewer = useContext(Context);
  if (!viewer) throw new Error("usePdfViewer needs a PdfViewerProvider");
  return viewer;
}

/**
 * While `attach` is given, a PDF opened from this Task can be attached to its
 * answer from the viewer ("Lampirkan ke jawaban"); null while the answer can't change.
 */
export function useAnswerAttach(taskId: number, attach: AnswerAttach | null): void {
  const { offerAnswer } = usePdfViewer();
  const latest = useRef(attach);
  latest.current = attach;
  const offered = attach !== null;
  useEffect(() => (offered ? offerAnswer(taskId, (file) => latest.current?.(file) ?? Promise.resolve()) : undefined), [offerAnswer, taskId, offered]);
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
  const [answers, setAnswers] = useState<ReadonlyMap<number, AnswerAttach>>(new Map());
  const [closeRequest, setCloseRequest] = useState(0);
  const dirty = useRef(false);
  /** What waits for the viewer to shut (going to another screen) while it asks about unsaved filling. */
  const leaving = useRef<(() => void) | null>(null);

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

  /** "Formulir.pdf" filled in: "Formulir (diisi).pdf". */
  const filledName = (name: string) => {
    const base = name.replace(/\.pdf$/i, "").slice(0, 180);
    // Filled in again: still one "(diisi)".
    return `${base.endsWith(t("pdf.filledName", { name: "" }).trim()) ? base : t("pdf.filledName", { name: base })}.pdf`;
  };

  const saveCopy = async (bytes: Uint8Array) => {
    try {
      const { file } = await bridge.invoke("files.saveCopy", { name: filledName(source?.name ?? "PDF"), bytes });
      if (file) toast(t("pdf.savedAs", { file }), "success");
      return file !== null;
    } catch (error) {
      toast(t("error.action", { message: error instanceof Error ? error.message : String(error) }), "danger");
      return false;
    }
  };

  const answer = source?.taskId !== undefined ? answers.get(source.taskId) : undefined;
  const attach = answer
    ? async (bytes: Uint8Array) => {
        const name = filledName(source?.name ?? "PDF");
        try {
          await answer({ name, bytes });
          toast(t("pdf.attached", { name }), "success");
          return true;
        } catch (error) {
          toast(t("error.action", { message: error instanceof Error ? error.message : String(error) }), "danger");
          return false;
        }
      }
    : undefined;

  const viewer = useMemo(
    () => ({
      open: (next: PdfSource) => {
        setSource(next);
        setOpen(true);
      },
      close: (then?: () => void) => {
        if (dirty.current) {
          leaving.current = then ?? null;
          setCloseRequest((n) => n + 1);
          return;
        }
        setOpen(false);
        then?.();
      },
      offerAnswer: (taskId: number, attach: AnswerAttach) => {
        setAnswers((all) => new Map(all).set(taskId, attach));
        return () =>
          setAnswers((all) => {
            if (all.get(taskId) !== attach) return all;
            const rest = new Map(all);
            rest.delete(taskId);
            return rest;
          });
      },
    }),
    [],
  );
  const onDirtyChange = useCallback((now: boolean) => {
    dirty.current = now;
  }, []);
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    const then = leaving.current;
    leaving.current = null;
    if (!next) then?.();
  };
  return (
    <Context value={viewer}>
      {children}
      {source && (
        <Suspense fallback={null}>
          <PdfViewer
            open={open}
            onOpenChange={onOpenChange}
            name={source.name}
            load={load}
            actions={downloadButton}
            fallback={fallback}
            onOpenLink={openLink}
            onSaveCopy={saveCopy}
            onAttach={attach}
            closeRequest={closeRequest}
            onStay={() => {
              leaving.current = null;
            }}
            onDirtyChange={onDirtyChange}
            clearTitleBar={mac}
          />
        </Suspense>
      )}
    </Context>
  );
}
