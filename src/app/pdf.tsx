// Opening a file in the app from anywhere: usePdfViewer().open(...) shows the
// viewer over the current screen. A PDF opens in the PDF viewer; a Word
// document, a spreadsheet, PowerPoint slides, text or code, a picture, or an
// old Word, Excel or PowerPoint file in the viewer for other files (viewerKind
// says which, by the name); anything else isn't opened here but downloaded and
// opened in the computer's own app. A file on Edunex is read in by the main
// process (or taken from a copy on this computer) and can be downloaded from
// the viewer; any other PDF (one the Student is about to hand in) comes as
// bytes the caller reads. Each viewer loads on first use. What the Student
// fills in there is saved as a copy where they choose, or, opened from a Task
// whose answer can still change, attached to that answer (the Task's hand-in
// card offers itself with useAnswerAttach).
import { createContext, lazy, type ReactNode, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { FileProblem, ReadAs } from "../core/actions/files";
import { ActionError, errorKey } from "./bridge";
import { useOpenExternal, useOpenLink } from "./hooks";
import { useT } from "./i18n";
import { OpenFile, useDownloadedToast, useLocalCopy } from "./open-file";
import { useBridge, useStore } from "./store";
import { Button } from "./ui/controls";
import type { FileKind } from "./ui/file-viewer";
import { Icons } from "./ui/icons";
import { Tooltip, toast } from "./ui/overlays";
import type { PdfProblem } from "./ui/pdf-viewer";

const PdfViewer = lazy(() => import("./ui/pdf-viewer").then((module) => ({ default: module.PdfViewer })));
const FileViewer = lazy(() => import("./ui/file-viewer").then((module) => ({ default: module.FileViewer })));

export type PdfSource = (
  | /** A file on Edunex's storage; `edunexUrl`: its page on Edunex, offered when it can't be shown. */
  { kind: "edunex"; url: string; name: string; edunexUrl?: string }
  /** Any other PDF (one the Student is about to hand in): its bytes, or why they can't be shown. */
  | { kind: "bytes"; name: string; load: () => Promise<Uint8Array | { problem: FileProblem }> }
) & {
  /** The Task it's on, whose answer a filled-in copy can go into. */
  taskId?: number;
};

/** Puts a filled-in PDF into the answer: as a file attached there, the way one picked from the computer is. */
export type AnswerAttach = (file: { name: string; bytes: Uint8Array }) => Promise<void>;

export type ViewerKind = "pdf" | FileKind;

/** By extension, what the viewer shows a file as. Archives, videos and Office templates (.dot, .xlt, .pot) aren't here. */
const KINDS: Readonly<Record<string, ViewerKind>> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  ...Object.fromEntries(["pptx", "ppsx"].map((ext) => [ext, "pptx" as const])),
  csv: "csv",
  tsv: "tsv",
  doc: "doc",
  xls: "xls",
  ppt: "ppt",
  pps: "ppt",
  ...Object.fromEntries(["png", "jpg", "jpeg", "gif", "webp"].map((ext) => [ext, "image" as const])),
  // Text and code, shown as they are.
  ...Object.fromEntries(
    "txt md markdown log py java c h cpp cc cxx hpp cs js mjs cjs ts tsx jsx json xml yaml yml toml ini cfg sql sh bat ps1 r m go rs kt swift php rb lua scala dart hs asm s v vhd vhdl sv tex bib css scss"
      .split(" ")
      .map((ext) => [ext, "text" as const]),
  ),
};

/** How a file is read in for each kind (a CSV is text, checked as text). */
const READ_AS: Readonly<Record<ViewerKind, ReadAs>> = {
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  csv: "text",
  tsv: "text",
  text: "text",
  image: "image",
  doc: "doc",
  xls: "xls",
  ppt: "ppt",
};

/** What the viewer shows a file as, by its name; null when it can't, and the file downloads and opens in the computer's own app. */
export function viewerKind(name: string): ViewerKind | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name.trim())?.[1].toLowerCase();
  return ext && Object.hasOwn(KINDS, ext) ? KINDS[ext] : null;
}

/** A file the viewer can show, by its name. */
export const canView = (name: string) => viewerKind(name) !== null;
/** A PDF, by its name: only PDFs can be filled in, and the Student's own files waiting to go up only open if they're one. */
export const isPdfName = (name: string) => viewerKind(name) === "pdf";

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
  const { platform } = useStore();
  const openLink = useOpenLink();
  const openExternal = useOpenExternal();
  const [source, setSource] = useState<PdfSource | null>(null);
  // Closing keeps the last file's viewer mounted but shut, so focus goes back to what opened it.
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const local = useLocalCopy(source?.kind === "edunex" ? source.url : null);
  const downloaded = useDownloadedToast();
  const [answers, setAnswers] = useState<ReadonlyMap<number, AnswerAttach>>(new Map());
  const [closeRequest, setCloseRequest] = useState(0);
  const dirty = useRef(false);
  /** What waits for the viewer to shut (going to another screen) while it asks about unsaved filling. */
  const leaving = useRef<(() => void) | null>(null);

  // Bytes handed in are always a PDF; a name the viewer doesn't know (a caller's mistake) is tried as one.
  const kind: ViewerKind = source?.kind === "edunex" ? (viewerKind(source.name) ?? "pdf") : "pdf";
  const load = useMemo(() => {
    if (!source) return async () => new Uint8Array();
    if (source.kind === "bytes") return source.load;
    const as = READ_AS[kind];
    return async (): Promise<Uint8Array | { problem: FileProblem }> => {
      try {
        const result = await bridge.invoke("files.read", { url: source.url, as });
        return "problem" in result ? result : result.bytes;
      } catch (error) {
        return { problem: error instanceof ActionError && error.kind === "Rejected" ? "unreadable" : "unreachable" };
      }
    };
  }, [source, kind, bridge]);

  const download = useCallback(async () => {
    if (source?.kind !== "edunex") return;
    setBusy(true);
    try {
      const { existing } = await bridge.invoke("files.download", { url: source.url, name: source.name.slice(0, 200) });
      downloaded(source.url, existing);
      await local.refresh();
    } catch {
      toast(t("file.downloadFailed", { name: source.name }), "danger");
    } finally {
      setBusy(false);
    }
  }, [source, bridge, t, downloaded, local.refresh]);

  // Once it's on this computer: open it in another app, or see it in its folder.
  const downloadButton =
    source?.kind === "edunex" && local.copy ? (
      <OpenFile url={source.url} copy={local.copy} onChange={() => void local.refresh()} />
    ) : source?.kind === "edunex" ? (
      <Tooltip content={t(kind === "pdf" ? "pdf.downloadHint" : "viewer.downloadHint")}>
        <Button size="sm" variant="ghost" busy={busy} icon={<Icons.Download className="size-3.5" />} onClick={() => void download()}>
          {t("material.download")}
        </Button>
      </Tooltip>
    ) : null;
  // One way forward that can work: a link that stopped working or a file that's gone is only on Edunex's page now;
  // one the app can't draw (too big, locked, not one it reads) still opens in the computer's own app.
  const fallback = (problem: PdfProblem) => {
    if (source?.kind !== "edunex") return null;
    if (problem === "expired" || problem === "missing")
      return source.edunexUrl ? (
        <Button variant="primary" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => openExternal(source.edunexUrl!)}>
          {t("action.openInEdunex")}
        </Button>
      ) : null;
    if (local.copy) return <OpenFile url={source.url} copy={local.copy} onChange={() => void local.refresh()} />;
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
      toast(t(errorKey(error, "pdf.saveCopyFailed")), "danger");
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
          toast(t(errorKey(error)), "danger");
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
      {source && kind !== "pdf" && (
        <Suspense fallback={null}>
          <FileViewer
            open={open}
            onOpenChange={onOpenChange}
            name={source.name}
            kind={kind}
            load={load}
            actions={downloadButton}
            fallback={fallback}
            onOpenLink={openLink}
            platform={platform}
          />
        </Suspense>
      )}
      {source && kind === "pdf" && (
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
            platform={platform}
          />
        </Suspense>
      )}
    </Context>
  );
}
