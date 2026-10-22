// The in-app viewer for files that aren't PDFs (those have ./pdf-viewer.tsx):
// a Word document as its pages, a spreadsheet (Excel, old Excel, CSV) as a
// table per sheet, PowerPoint slides as pages (./slide-deck.tsx), text and code
// as they are, a picture whole, an old Word document or PowerPoint as its text
// (./text-only.tsx). The same panel over the current screen as the PDF viewer,
// with the file's name, Download and Close; Esc closes and focus goes back.
// What reads each kind loads on first use, in a chunk of its own. Nothing in a
// file runs: a Word document is drawn in a shadow root (its styles stay
// inside), slides are built as elements from plain data, links go through the
// app's own link rules or nowhere, and text is only ever shown as text.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FileProblem } from "../../core/actions/files";
import { isWebLink } from "../../core/links";
import { useT } from "../i18n";
import { Button } from "./controls";
import { cx } from "./cx";
import type { Block } from "./doc";
import { Icons } from "./icons";
import { ignoreClosingClick, PANEL_MOTION_CLASS, SCRIM_CLASS, useReturnFocus } from "./overlays";
import { PanelBoundary } from "./panel-boundary";
import type { Slide } from "./ppt";
import { MAX_COLUMNS, MAX_ROWS, readCsv, type Sheet } from "./sheets";
import { SlideDeck } from "./slide-deck";
import type { Deck } from "./slides";
import { TabBar } from "./tabs";
import { DocPages, SlideCards } from "./text-only";
import { Failed, Loading, Toolbar } from "./viewer-frame";

/** What the viewer shows a file as: a Word document, an Excel workbook, PowerPoint slides, a CSV (or TSV) table, text, a picture; an old Word, Excel or PowerPoint file. */
export type FileKind = "docx" | "xlsx" | "pptx" | "csv" | "tsv" | "text" | "image" | "doc" | "xls" | "ppt";
/** Why a file isn't shown: it couldn't be read, or it isn't one the viewer can read. */
export type FileViewProblem = FileProblem | "broken";

type Shown =
  | { kind: "docx"; nodes: Node[] }
  | { kind: "sheets"; sheets: Sheet[] }
  | { kind: "slides"; deck: Deck }
  | { kind: "text"; text: string }
  | { kind: "image"; url: string }
  | { kind: "doc"; pages: Block[][] }
  | { kind: "ppt"; slides: Slide[] };
type View = { phase: "loading" } | { phase: "ready"; shown: Shown } | { phase: "failed"; problem: FileViewProblem };

/** A Word, Excel or PowerPoint file's generations: the new is a ZIP, the old a compound file. */
const NEWER = { doc: "docx", xls: "xlsx", ppt: "pptx" } as const;
const OLDER = { docx: "doc", xlsx: "xls", pptx: "ppt" } as const;

/**
 * Which reader the bytes need: a name can say the other generation of the
 * same app (a .pptx under Edunex's label "ppt"), and main took either, each
 * checked as itself.
 */
function readerFor(kind: FileKind, bytes: Uint8Array): FileKind {
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (zip && Object.hasOwn(NEWER, kind)) return NEWER[kind as keyof typeof NEWER];
  if (!zip && Object.hasOwn(OLDER, kind)) return OLDER[kind as keyof typeof OLDER];
  return kind;
}

/** The file's bytes as what it shows: the readers of Word, Excel and PowerPoint files, old and new, load here, the first time one opens. */
async function show(named: FileKind, bytes: Uint8Array): Promise<Shown> {
  const kind = readerFor(named, bytes);
  switch (kind) {
    case "docx":
      return { kind, nodes: await (await import("./docx")).drawDocx(bytes) };
    case "xlsx":
      return { kind: "sheets", sheets: await (await import("./sheets")).readWorkbook(bytes) };
    case "pptx":
      return { kind: "slides", deck: await (await import("./slides")).readPresentation(bytes) };
    case "csv":
    case "tsv":
      return { kind: "sheets", sheets: [{ name: "", rows: readCsv(new TextDecoder().decode(bytes), kind === "tsv") }] };
    case "text":
      return { kind, text: new TextDecoder().decode(bytes) };
    case "image":
      return { kind, url: URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>])) };
    case "doc":
      return { kind, pages: (await import("./doc")).readDoc(bytes) };
    case "xls":
      return { kind: "sheets", sheets: (await import("./xls")).readXls(bytes) };
    case "ppt":
      return { kind, slides: (await import("./ppt")).readPpt(bytes) };
  }
}

export interface FileViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The file's name, as its title. */
  name: string;
  kind: FileKind;
  /** Reads the file: its bytes, or why it couldn't. */
  load: () => Promise<Uint8Array | { problem: FileProblem }>;
  /** Buttons for the toolbar while the file is there to read (Download). */
  actions?: ReactNode;
  /** The way forward when it can't be shown, for that reason (Open in Edunex, Download). Storage out of reach is the viewer's own "Try again". */
  fallback?: (problem: FileViewProblem) => ReactNode;
  onOpenLink: (url: string) => void;
  /** The system whose window buttons it leaves room for at the top; none in tests. */
  platform?: "darwin" | "win32" | "linux";
}

export function FileViewer({ open, onOpenChange, name, kind, load, actions, fallback, onOpenLink, platform }: FileViewerProps) {
  const t = useT();
  const returnFocus = useReturnFocus();
  const scroller = useRef<HTMLElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>({ phase: "loading" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: "Coba lagi" bumps attempt to read the file again
  useEffect(() => {
    if (!open) return;
    let live = true;
    let picture: string | null = null;
    setView({ phase: "loading" });
    void (async () => {
      try {
        const read = await load();
        if (!live) return;
        if ("problem" in read) {
          setView({ phase: "failed", problem: read.problem });
          return;
        }
        const shown = await show(kind, read);
        if (shown.kind === "image") picture = shown.url;
        // Shut while it was being read: the picture goes now (the cleanup below already ran).
        if (!live) {
          if (picture) URL.revokeObjectURL(picture);
          return;
        }
        setView({ phase: "ready", shown });
      } catch {
        if (live) setView({ phase: "failed", problem: "broken" });
      }
    })();
    return () => {
      live = false;
      if (picture) URL.revokeObjectURL(picture);
    };
  }, [open, load, kind, attempt]);

  // The file replaces the placeholder that had the keyboard: it takes it over, so arrows and Page Down scroll at once.
  useEffect(() => {
    if (view.phase === "ready" && open) scroller.current?.focus();
  }, [view.phase, open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cx(SCRIM_CLASS, "z-(--z-dialog)")} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            returnFocus.onOpenAutoFocus();
            event.preventDefault();
            scroller.current?.focus();
          }}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
          onClickCapture={ignoreClosingClick}
          className={cx(
            "fixed inset-x-3 bottom-3 z-(--z-dialog) flex flex-col overflow-hidden rounded-2xl bg-raised text-fg border border-transparent shadow-dialog ring-1 ring-black/10 focus:outline-none dark:ring-white/10",
            PANEL_MOTION_CLASS,
            // Below macOS's traffic lights, and below the top bar where Windows and Linux draw their window buttons.
            platform === "darwin" ? "top-10" : platform ? "top-[calc(var(--title-bar)+--spacing(2))]" : "top-3",
          )}
        >
          {/* Whatever in the viewer fails breaks the viewer, not the window; its title and Close stay. */}
          <PanelBoundary name="file viewer" compact header={<Toolbar name={name} />}>
            <Toolbar name={name} actions={view.phase === "failed" ? undefined : actions} />
            {view.phase === "ready" && view.shown.kind === "sheets" ? (
              <Sheets sheets={view.shown.sheets} name={name} scroller={scroller} />
            ) : (
              <section
                ref={scroller}
                // The file scrolls, so once it's there it takes the keyboard (arrows, Page Down).
                tabIndex={view.phase === "ready" ? 0 : -1}
                aria-label={name}
                className={cx(
                  "min-h-0 flex-1 overflow-auto overscroll-contain bg-sunken outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]",
                  view.phase !== "ready" && "grid place-items-center p-6",
                )}
              >
                {view.phase === "loading" ? (
                  <Loading label={t("viewer.loading")} />
                ) : view.phase === "failed" ? (
                  <Failed title={t("viewer.failed")} detail={view.problem === "broken" ? t("viewer.broken") : t(`file.problem.${view.problem}`)}>
                    {view.problem === "unreachable" ? (
                      <Button variant="primary" icon={<Icons.RefreshCw className="size-3.5" />} onClick={() => setAttempt((n) => n + 1)}>
                        {t("action.tryAgain")}
                      </Button>
                    ) : (
                      fallback?.(view.problem)
                    )}
                  </Failed>
                ) : view.shown.kind === "docx" ? (
                  <WordPages nodes={view.shown.nodes} onOpenLink={onOpenLink} />
                ) : view.shown.kind === "slides" ? (
                  <SlideDeck deck={view.shown.deck} onOpenLink={onOpenLink} />
                ) : view.shown.kind === "text" ? (
                  <pre className="m-6 min-h-[calc(100%-3rem)] rounded-lg bg-surface p-5 font-mono text-small break-words whitespace-pre-wrap text-fg shadow-card select-text">
                    {view.shown.text}
                  </pre>
                ) : view.shown.kind === "doc" ? (
                  <DocPages pages={view.shown.pages} />
                ) : view.shown.kind === "ppt" ? (
                  <SlideCards slides={view.shown.slides} />
                ) : view.shown.kind === "image" ? (
                  <div className="grid min-h-full place-items-center p-6">
                    <img
                      src={view.shown.url}
                      alt={name}
                      className="h-auto max-w-full rounded-sm shadow-card outline -outline-offset-1 outline-black/10 dark:outline-white/10"
                    />
                  </div>
                ) : null}
              </section>
            )}
          </PanelBoundary>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** The viewer's own touches on a Word document: its pages on the viewer's background, as paper in both themes. */
const WORD_STYLE = `
:host { color-scheme: light; }
.docx-wrapper { background: transparent; padding: 24px; }
.docx-wrapper > section.docx { margin-bottom: 16px; box-shadow: 0 1px 3px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(0 0 0 / 0.05); }
`;

/**
 * A Word document's pages, in a shadow root of their own so its styles stay
 * there. A link to a web page opens through the app's link rules; one to a
 * place in the document goes there; any other goes nowhere.
 */
function WordPages({ nodes, onOpenLink }: { nodes: Node[]; onOpenLink: (url: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const root = element.shadowRoot ?? element.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = WORD_STYLE;
    root.replaceChildren(...nodes, style);
    const follow = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link) return;
      event.preventDefault();
      if (event.type !== "click") return;
      const href = link.getAttribute("href") ?? "";
      if (href.startsWith("#")) root.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView();
      else if (isWebLink(href)) onOpenLink(href);
    };
    root.addEventListener("click", follow);
    // A middle click would open the link in a new window.
    root.addEventListener("auxclick", follow);
    return () => {
      root.removeEventListener("click", follow);
      root.removeEventListener("auxclick", follow);
    };
  }, [nodes, onOpenLink]);
  return <div ref={host} />;
}

const columnName = (index: number) => {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

/** A workbook's sheets, a tab each when there's more than one; each a table with Excel's column letters and row numbers. */
function Sheets({ sheets, name, scroller }: { sheets: Sheet[]; name: string; scroller: RefObject<HTMLElement | null> }) {
  const t = useT();
  const [picked, setPicked] = useState("0");
  const sheet = sheets[Number(picked)] ?? sheets[0];
  const rows = sheet.rows.slice(0, MAX_ROWS);
  const columns = Math.min(Math.max(1, ...rows.map((row) => row.length)), MAX_COLUMNS);
  const cut = sheet.rows.length > MAX_ROWS || rows.some((row) => row.length > MAX_COLUMNS);
  const head = "sticky z-10 border-line bg-surface px-2 font-normal text-faint";
  return (
    <Tabs.Root value={picked} onValueChange={setPicked} className="flex min-h-0 flex-1 flex-col">
      {sheets.length > 1 && (
        <TabBar
          size="sm"
          value={picked}
          label={t("sheet.sheets")}
          tabs={sheets.map((s, index) => ({ value: String(index), label: s.name || t("sheet.untitled", { number: index + 1 }) }))}
          className="shrink-0 overflow-x-auto border-b border-line px-4"
        />
      )}
      <section
        ref={scroller}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the table scrolls, so it takes the keyboard (arrows, Page Down)
        tabIndex={0}
        aria-label={sheet.name || name}
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-surface outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]"
      >
        <table className="border-separate border-spacing-0 text-small">
          <thead>
            <tr>
              <th aria-hidden className={cx(head, "top-0 left-0 z-20 border-r border-b")} />
              {Array.from({ length: columns }, (_, index) => (
                <th key={columnName(index)} scope="col" className={cx(head, "top-0 h-7 border-r border-b text-center")}>
                  {columnName(index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a sheet's rows are its positions
              <tr key={r}>
                <th scope="row" className={cx(head, "left-0 border-r border-b text-right tabular-nums")}>
                  {r + 1}
                </th>
                {Array.from({ length: columns }, (_, c) => (
                  <td
                    key={columnName(c)}
                    className="h-7 max-w-[40ch] truncate border-r border-b border-line px-2 whitespace-nowrap select-text"
                    title={(row[c] ?? "").length > 40 ? row[c] : undefined}
                  >
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {cut && <p className="sticky left-0 px-4 py-3 text-small text-muted">{t("sheet.cut", { rows: Math.min(sheet.rows.length, MAX_ROWS), columns })}</p>}
      </section>
    </Tabs.Root>
  );
}
