// The in-app PDF viewer: a panel over the current screen with the file's
// pages one under another, white as paper in both themes and sharp at any
// zoom. Only the pages near the view are drawn, so long PDFs stay smooth.
// "3 dari 12" with a box to jump, zoom (fit width, fit the page, − / +), the
// keyboard (arrows, PgUp/PgDn, Space, Home/End, ⌘+ ⌘− ⌘0, Esc closes and
// focus goes back), text that can be selected and copied, and links that go
// where they point. pdf.js loads on first use (./pdf-engine.ts).
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FileProblem } from "../../core/actions/files";
import { linkHost } from "../../core/links";
import { useT } from "../i18n";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Skeleton } from "./display";
import { Icons } from "./icons";
import { Tooltip, useReturnFocus } from "./overlays";
import { PanelBoundary } from "./panel-boundary";
import { openPdf, type PdfDocument, type PdfLink, PdfOpenError, type PdfPage, type PdfSize, type PdfTask } from "./pdf-engine";

/** 100%: a page at its printed size (PDF points are 1/72 inch, the screen's CSS pixels 1/96). */
const ACTUAL = 96 / 72;
const STEPS = [25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400];
/** Space around the pages, so a fitted page doesn't touch the panel's edges. */
const PAD = 24;

type Zoom = { fit: "width" | "page" } | { percent: number };
/** Why a PDF isn't shown: its file couldn't be read, it asks for a password, or it isn't a PDF that can be read. */
export type PdfProblem = FileProblem | "locked" | "broken";

type View = { phase: "loading" } | { phase: "ready"; doc: PdfDocument; sizes: PdfSize[] } | { phase: "failed"; problem: PdfProblem };

export interface PdfViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The file's name, as its title. */
  name: string;
  /** Reads the file: its bytes, or why it couldn't. */
  load: () => Promise<Uint8Array | { problem: FileProblem }>;
  /** Buttons for the toolbar while the PDF is there to read (Download). */
  actions?: ReactNode;
  /** The way forward when it can't be shown, for that reason (Open in Edunex, Download). Storage out of reach is the viewer's own "Try again". */
  fallback?: (problem: PdfProblem) => ReactNode;
  onOpenLink: (url: string) => void;
  /** Leaves room at the top for macOS's window buttons. */
  clearTitleBar?: boolean;
}

export function PdfViewer({ open, onOpenChange, name, load, actions, fallback, onOpenLink, clearTitleBar = false }: PdfViewerProps) {
  const t = useT();
  const returnFocus = useReturnFocus();
  const scroller = useRef<HTMLElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<View>({ phase: "loading" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: "Coba lagi" bumps attempt to read the file again
  useEffect(() => {
    if (!open) return;
    let live = true;
    let doc: PdfDocument | null = null;
    setView({ phase: "loading" });
    void (async () => {
      try {
        const read = await load();
        if (!live) return;
        if ("problem" in read) {
          setView({ phase: "failed", problem: read.problem });
          return;
        }
        const opened = await openPdf(read);
        // Shut while it opened: the cleanup below already ran, so it's freed here (each holds a worker and the whole file).
        if (!live) return opened.destroy();
        doc = opened;
        const first = (await doc.page(1)).size;
        if (!live) return;
        let sizes: PdfSize[] = Array.from({ length: doc.pages }, () => first);
        setView({ phase: "ready", doc, sizes });
        // Every page's own size, a few at a time, so a landscape page among portrait ones gets its own place.
        for (let n = 2; n <= doc.pages && live; n++) {
          const size = (await doc.page(n)).size;
          if (size.width !== first.width || size.height !== first.height) sizes = sizes.with(n - 1, size);
          if ((n % 25 === 0 || n === doc.pages) && live) setView({ phase: "ready", doc, sizes });
        }
      } catch (error) {
        if (live) setView({ phase: "failed", problem: error instanceof PdfOpenError ? error.reason : "broken" });
      }
    })();
    return () => {
      live = false;
      doc?.destroy();
    };
  }, [open, load, attempt]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] motion-safe:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            returnFocus.onOpenAutoFocus();
            // The pages take the keyboard first, so arrows and Page Down read on at once.
            event.preventDefault();
            scroller.current?.focus();
          }}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
          onEscapeKeyDown={(event) => {
            // Escape while typing a page number only lets go of the number (the page box does that); the next one closes.
            if (event.target instanceof HTMLElement && event.target.dataset.editing) event.preventDefault();
          }}
          className={cx(
            "fixed inset-x-3 bottom-3 z-50 flex flex-col overflow-hidden rounded-2xl bg-raised text-fg shadow-dialog ring-1 ring-black/10 focus:outline-none motion-safe:animate-pop-in dark:ring-white/10",
            clearTitleBar ? "top-10" : "top-3",
          )}
        >
          {/* Whatever in the viewer fails breaks the viewer, not the window; its title and Close stay. */}
          <PanelBoundary name="pdf viewer" compact header={<Toolbar name={name} />}>
            {view.phase === "ready" ? (
              <Reader doc={view.doc} sizes={view.sizes} name={name} actions={actions} scroller={scroller} onOpenLink={onOpenLink} />
            ) : (
              <>
                <Toolbar name={name} actions={view.phase === "failed" ? undefined : actions} />
                <section
                  ref={scroller}
                  tabIndex={-1}
                  aria-label={name}
                  className="grid min-h-0 flex-1 place-items-center overflow-auto bg-sunken p-6 outline-none"
                >
                  {view.phase === "loading" ? (
                    <div role="status" className="flex w-full flex-col items-center gap-3">
                      <Skeleton className="aspect-[1/1.414] w-full max-w-[520px] rounded-sm" />
                      <span className="text-small text-muted">{t("pdf.loading")}</span>
                    </div>
                  ) : (
                    <div role="alert" className="flex max-w-[44ch] flex-col items-center gap-3 text-center">
                      <span className="grid size-10 place-items-center rounded-full bg-surface text-muted shadow-card">
                        <Icons.FileText className="size-5" />
                      </span>
                      <div>
                        <p className="text-body font-semibold">{t("pdf.failed")}</p>
                        <p className="mt-1 text-small text-muted">
                          {view.problem === "locked" ? t("pdf.locked") : view.problem === "broken" ? t("pdf.broken") : t(`file.problem.${view.problem}`)}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {view.problem === "unreachable" ? (
                          <Button variant="primary" icon={<Icons.RefreshCw className="size-3.5" />} onClick={() => setAttempt((n) => n + 1)}>
                            {t("action.tryAgain")}
                          </Button>
                        ) : (
                          fallback?.(view.problem)
                        )}
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}
          </PanelBoundary>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Toolbar({ name, actions, children }: { name: string; actions?: ReactNode; children?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line pr-2 pl-4">
      <Icons.FileText className="mr-1.5 size-4 shrink-0 text-muted" />
      <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-body font-semibold" title={name}>
        {name}
      </DialogPrimitive.Title>
      {children}
      {actions}
      <DialogPrimitive.Close asChild>
        <IconButton label={t("action.close")} size="sm">
          <Icons.X className="size-4" />
        </IconButton>
      </DialogPrimitive.Close>
    </div>
  );
}

/** A zoom button at its limit: dimmed, still focusable; a click there changes nothing (zoomBy has no step further). */
const LIMIT = "aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted";

const Divider = () => <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-line" />;

function Reader({
  doc,
  sizes,
  name,
  actions,
  scroller,
  onOpenLink,
}: {
  doc: PdfDocument;
  sizes: PdfSize[];
  name: string;
  actions?: ReactNode;
  scroller: RefObject<HTMLElement | null>;
  onOpenLink: (url: string) => void;
}) {
  const t = useT();
  const total = useId();
  const pages = useRef<(HTMLElement | null)[]>([]);
  // Slides (landscape) open whole; a document fills the width, as people read it.
  const [zoom, setZoom] = useState<Zoom>(() => ({ fit: sizes[0].width > sizes[0].height ? "page" : "width" }));
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [current, setCurrent] = useState(1);
  const [draft, setDraft] = useState<string | null>(null);
  const [near, setNear] = useState<ReadonlySet<number>>(() => new Set([1, 2]));
  /** Where the reader is, kept across a zoom: the page, and how far down it. */
  const anchor = useRef({ page: 1, within: 0 });

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setBox({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scroller]);

  // The pages replace the loading placeholder that had the keyboard: they take it over.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || active.getAttribute("role") === "dialog") scroller.current?.focus();
  }, [scroller]);

  const widest = useMemo(() => Math.max(...sizes.map((size) => size.width)), [sizes]);
  const fitWidth = box.width > PAD * 2 ? (box.width - PAD * 2) / widest : ACTUAL;
  const fitPage = box.height > PAD * 2 ? Math.min(fitWidth, (box.height - PAD * 2) / sizes[0].height) : fitWidth;
  const raw = "fit" in zoom ? (zoom.fit === "width" ? fitWidth : fitPage) : (zoom.percent / 100) * ACTUAL;
  const scale = Math.min(Math.max(raw, 0.15), 6);
  const percent = Math.round((scale / ACTUAL) * 100);

  // Only pages in or near the view are drawn.
  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) =>
        setNear((before) => {
          const next = new Set(before);
          for (const entry of entries) {
            const number = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting) next.add(number);
            else next.delete(number);
          }
          return next;
        }),
      { root, rootMargin: "100% 0px" },
    );
    for (const page of pages.current) if (page) observer.observe(page);
    return () => observer.disconnect();
  }, [scroller]);

  const track = useCallback(() => {
    const root = scroller.current;
    if (!root) return;
    const line = root.scrollTop + root.clientHeight * 0.35;
    let at = 1;
    for (const [index, page] of pages.current.entries()) {
      if (!page || page.offsetTop > line) break;
      at = index + 1;
    }
    const page = pages.current[at - 1];
    anchor.current = { page: at, within: page ? Math.max(0, (root.scrollTop - page.offsetTop) / page.offsetHeight) : 0 };
    setCurrent(at);
  }, [scroller]);

  // After a zoom the same place stays in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs after each zoom on purpose; the place comes from the anchor
  useLayoutEffect(() => {
    const root = scroller.current;
    const page = pages.current[anchor.current.page - 1];
    if (!root || !page || (anchor.current.page === 1 && anchor.current.within === 0)) return;
    // At a page's very top, its margin stays in view too.
    root.scrollTop = anchor.current.within === 0 ? page.offsetTop - PAD / 2 : page.offsetTop + anchor.current.within * page.offsetHeight;
    root.scrollLeft = (root.scrollWidth - root.clientWidth) / 2;
  }, [scale, scroller]);

  const go = useCallback(
    (number: number) => {
      const target = Math.min(Math.max(Math.round(number), 1), doc.pages);
      const page = pages.current[target - 1];
      if (scroller.current && page) scroller.current.scrollTop = page.offsetTop - PAD / 2;
      anchor.current = { page: target, within: 0 };
      setCurrent(target);
    },
    [doc.pages, scroller],
  );

  const zoomBy = (direction: 1 | -1) => {
    const next = direction > 0 ? STEPS.find((step) => step > percent + 1) : STEPS.findLast((step) => step < percent - 1);
    if (next) setZoom({ percent: next });
  };
  const fitted = "fit" in zoom ? zoom.fit : null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const root = scroller.current;
    if (!root) return;
    const mod = event.metaKey || event.ctrlKey;
    const target = event.target as HTMLElement;
    const typing = target instanceof HTMLInputElement;
    const onControl = typing || Boolean(target.closest("button, a"));
    const wide = root.scrollWidth > root.clientWidth + 1;
    if (mod && (event.key === "=" || event.key === "+")) zoomBy(1);
    else if (mod && event.key === "-") zoomBy(-1);
    else if (mod && event.key === "0") setZoom({ fit: "width" });
    else if (mod || typing) return;
    else if (event.key === "PageDown" || (event.key === " " && !event.shiftKey && !onControl)) go(current + 1);
    else if (event.key === "PageUp" || (event.key === " " && event.shiftKey && !onControl)) go(current - 1);
    else if (event.key === "Home") go(1);
    else if (event.key === "End") go(doc.pages);
    else if (event.key === "ArrowDown" && target !== root) root.scrollBy({ top: 56 });
    else if (event.key === "ArrowUp" && target !== root) root.scrollBy({ top: -56 });
    else if (event.key === "ArrowRight" && !wide) go(current + 1);
    else if (event.key === "ArrowLeft" && !wide) go(current - 1);
    else return;
    event.preventDefault();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: keys for the whole viewer, wherever focus is inside it
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <Toolbar name={name} actions={actions}>
        <label className="flex shrink-0 items-center gap-1.5 text-small text-muted">
          <input
            value={draft ?? String(current)}
            inputMode="numeric"
            aria-label={t("pdf.page")}
            aria-describedby={total}
            data-editing={draft !== null || undefined}
            onFocus={(event) => event.target.select()}
            onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 5))}
            onBlur={() => setDraft(null)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && draft) {
                go(Number(draft));
                setDraft(null);
                scroller.current?.focus();
              } else if (event.key === "Escape" && draft !== null) {
                // The viewer stays open for this one (see onEscapeKeyDown); the next Escape closes it.
                setDraft(null);
              }
            }}
            className="h-7 w-11 rounded-md border border-edge bg-surface text-center text-small text-fg tabular-nums focus:border-focus focus:outline-none"
          />
          <span id={total} className="tabular-nums">
            {t("pdf.of", { count: doc.pages })}
          </span>
        </label>
        <Divider />
        <Tooltip content={t("pdf.zoomOut")}>
          {/* At a limit the button says so but keeps the keyboard: a disabled button would drop focus out of the viewer. */}
          <IconButton label={t("pdf.zoomOut")} size="sm" aria-disabled={percent <= STEPS[0]} className={LIMIT} onClick={() => zoomBy(-1)}>
            <Icons.Minus className="size-4" />
          </IconButton>
        </Tooltip>
        <span aria-live="polite" className="w-11 shrink-0 text-center text-small text-muted tabular-nums">
          {percent}%
        </span>
        <Tooltip content={t("pdf.zoomIn")}>
          <IconButton label={t("pdf.zoomIn")} size="sm" aria-disabled={percent >= STEPS.at(-1)!} className={LIMIT} onClick={() => zoomBy(1)}>
            <Icons.Plus className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip content={t(fitted === "width" ? "pdf.fitPage" : "pdf.fitWidth")}>
          <IconButton
            label={t(fitted === "width" ? "pdf.fitPage" : "pdf.fitWidth")}
            size="sm"
            onClick={() => {
              // A whole page shows from its top.
              if (fitted === "width") anchor.current = { ...anchor.current, within: 0 };
              setZoom({ fit: fitted === "width" ? "page" : "width" });
            }}
          >
            {fitted === "width" ? <Icons.FitPage className="size-4" /> : <Icons.FitWidth className="size-4" />}
          </IconButton>
        </Tooltip>
        {actions && <Divider />}
      </Toolbar>
      <section
        ref={scroller}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the pages scroll, so they take the keyboard (arrows, Page Down)
        tabIndex={0}
        aria-label={name}
        onScroll={track}
        className="min-h-0 flex-1 overflow-auto bg-sunken outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]"
      >
        {/* A page that fails to draw breaks the pages, not the window; the toolbar and Close stay. */}
        <PanelBoundary name="pdf pages" compact>
          <div className="relative flex w-max min-w-full flex-col items-center gap-4" style={{ padding: PAD }}>
            {sizes.map((size, index) => (
              <PageView
                // biome-ignore lint/suspicious/noArrayIndexKey: a PDF's pages are its positions
                key={index}
                ref={(element) => {
                  pages.current[index] = element;
                }}
                doc={doc}
                number={index + 1}
                count={doc.pages}
                size={size}
                scale={scale}
                near={near.has(index + 1)}
                onOpenLink={onOpenLink}
                onGoTo={go}
              />
            ))}
          </div>
        </PanelBoundary>
      </section>
    </div>
  );
}

/** A drawing no longer shown gives its memory back now, not whenever it's collected (zooming makes a new one each step). */
function free(node: Node | null | undefined): void {
  if (node instanceof HTMLCanvasElement) {
    node.width = 0;
    node.height = 0;
  }
}

function PageView({
  ref,
  doc,
  number,
  count,
  size,
  scale,
  near,
  onOpenLink,
  onGoTo,
}: {
  ref: (element: HTMLDivElement | null) => void;
  doc: PdfDocument;
  number: number;
  count: number;
  size: PdfSize;
  scale: number;
  near: boolean;
  onOpenLink: (url: string) => void;
  onGoTo: (page: number) => void;
}) {
  const t = useT();
  const paper = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PdfPage | null>(null);
  const [links, setLinks] = useState<PdfLink[]>([]);
  const drawn = useRef(false);

  useEffect(() => {
    if (!near) return;
    let live = true;
    void doc.page(number).then(
      (loaded) => live && setPage(loaded),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [doc, number, near]);

  // Far out of view: the drawing goes, to keep memory low; the page keeps its place.
  useEffect(() => {
    if (near || !page) return;
    free(paper.current?.firstChild);
    paper.current?.replaceChildren();
    text.current?.replaceChildren();
    drawn.current = false;
    page.release();
    setPage(null);
  }, [near, page]);

  useEffect(() => {
    if (!near || !page) return;
    let task: PdfTask | null = null;
    // Drawn on a fresh canvas, swapped in when done: zooming never flashes a blank page.
    const draw = () => {
      const canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 size-full";
      task = page.render(canvas, scale, window.devicePixelRatio || 1);
      task.promise.then(
        () => {
          if (!paper.current) return free(canvas);
          const before = paper.current.firstChild;
          paper.current.replaceChildren(canvas);
          free(before);
          drawn.current = true;
        },
        () => free(canvas),
      );
    };
    // Zooming in quick steps draws once, at the end.
    const timer = setTimeout(draw, drawn.current ? 120 : 0);
    return () => {
      clearTimeout(timer);
      task?.cancel();
    };
  }, [near, page, scale]);

  useEffect(() => {
    if (!near || !page || !text.current) return;
    const task = page.text(text.current, scale);
    return () => task.cancel();
  }, [near, page, scale]);

  useEffect(() => {
    if (!near || !page) return;
    let live = true;
    void page.links().then(
      (found) => live && setLinks(found),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [near, page]);

  const style = {
    width: Math.floor(size.width * scale),
    height: Math.floor(size.height * scale),
    "--total-scale-factor": scale,
    "--scale-round-x": "1px",
    "--scale-round-y": "1px",
  } as CSSProperties;
  const place = (link: PdfLink): CSSProperties => ({ left: link.left * scale, top: link.top * scale, width: link.width * scale, height: link.height * scale });
  return (
    // biome-ignore lint/a11y/useSemanticElements: a page of the PDF, not a set of form fields
    <div
      ref={ref}
      role="group"
      data-page={number}
      aria-label={t("pdf.pageOf", { page: number, count })}
      style={style}
      className="relative shrink-0 bg-white shadow-card ring-1 ring-black/5"
    >
      <div ref={paper} aria-hidden />
      <div ref={text} className="pdf-text" />
      {near &&
        links.map((link) => {
          const className = "focus-ring absolute rounded-[2px] hover:bg-[rgb(47_111_235/0.12)]";
          return link.url ? (
            <a
              key={`${link.left}:${link.top}`}
              href={link.url}
              title={linkHost(link.url) ?? link.url}
              style={place(link)}
              className={className}
              onClick={(event) => {
                event.preventDefault();
                onOpenLink(link.url!);
              }}
            >
              <span className="sr-only">{linkHost(link.url) ?? link.url}</span>
            </a>
          ) : (
            <button
              key={`${link.left}:${link.top}`}
              type="button"
              aria-label={t("pdf.toPage", { page: link.page ?? 1 })}
              style={place(link)}
              className={className}
              onClick={() => onGoTo(link.page ?? 1)}
            />
          );
        })}
    </div>
  );
}
