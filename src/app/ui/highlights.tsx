// Highlighting in the file viewers ("Sorotan"), what the PDF viewer
// (./pdf-viewer.tsx) and the one for Word documents and text files
// (./file-viewer.tsx) share: the highlights drawn on the text, the bar that
// floats over selected text (a color each) or over a highlight (its colors,
// then Remove; the pointer turns to a hand over one, saying a click opens
// it), the viewer's "⋯" menu that removes all of a file's at once, the
// keyboard (⌘⇧H highlights what's selected in the color picked last; on a
// highlight, Enter opens its bar and Delete removes it; ⌘Z puts back what was
// just removed), and a line said to screen readers after each. The caller
// saves them (../highlights.ts); each is kept where its text is
// (./text-anchor.ts), so it comes back at any zoom.
import { HighlighterIcon } from "@phosphor-icons/react/dist/csr/Highlighter";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { colorOf, DEFAULT_HIGHLIGHT_COLOR, HIGHLIGHT_COLORS, type HighlightColor, locate, quoteOf, trimmed } from "../../core/highlights";
import type { Highlight } from "../../core/models";
import { useT } from "../i18n";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Icons, icon } from "./icons";
import { Menu } from "./menu";
import { Tooltip, toast } from "./overlays";
import { around, type Box, boxesOf, offsetsIn, rangeAt, selectedRange, textOf } from "./text-anchor";

const MarkerIcon = icon(HighlighterIcon);
const DeleteIcon = icon(TrashIcon);

/** One file's highlights and the ways to change them; saved by the caller. */
export interface Highlights {
  items: readonly Highlight[];
  add(highlights: Highlight[]): void;
  recolor(id: string, color: HighlightColor): void;
  remove(id: string): void;
  /** Every one in the file. */
  clear(): void;
  restore(highlights: readonly Highlight[]): void;
}

/** Where a file's text is now: a PDF page's text (and which page), or a whole document, maybe in a shadow root. */
export interface TextRoot {
  page?: number;
  node: Node;
  shadow?: ShadowRoot | null;
}

/** The highlighter's ink: the same in both themes, as it's drawn on paper. */
const INK: Record<HighlightColor, string> = {
  yellow: "bg-(--highlight-yellow)",
  green: "bg-(--highlight-green)",
  blue: "bg-(--highlight-blue)",
  pink: "bg-(--highlight-pink)",
};

/** The color picked last, which ⌘⇧H highlights in: yellow until the Student picks another, for as long as the app runs. */
let lastColor: HighlightColor = DEFAULT_HIGHLIGHT_COLOR;
let made = 0;
const newId = () => `${Date.now().toString(36)}-${(++made).toString(36)}`;

/** The keys, as each system writes them. */
const keysFor = (mac: boolean) => ({ highlight: mac ? "⌘⇧H" : "Ctrl+Shift+H", remove: mac ? "⌫" : "Delete", undo: mac ? "⌘Z" : "Ctrl+Z" });

interface Placed {
  highlight: Highlight;
  /** Where it's drawn, at scale 1. */
  boxes: Box[];
}

/**
 * The highlights on one text (a PDF page, a document), each where its text is
 * now; one whose text isn't there any more isn't drawn. On paper (`under`
 * false) the ink is multiplied into the page, so the text stays as dark as it
 * was; on the app's own surface it sits under the text. Each is a stop for the
 * keyboard, named by its color and text; the mouse goes through to the text,
 * so it can still be selected and copied.
 */
export function MarkLayer({
  root,
  origin,
  scale = 1,
  version,
  highlights,
  open,
  under = false,
  onOpen,
  onRemove,
}: {
  root: RefObject<Node | null>;
  /** What the boxes are measured from. */
  origin: RefObject<HTMLElement | null>;
  scale?: number;
  /** Bumped when the text is drawn again (a zoom, a page back in view), to place them again. */
  version: number;
  highlights: readonly Highlight[];
  /** The highlight whose bar is open. */
  open: string | null;
  under?: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [resized, setResized] = useState(0);
  const any = highlights.length > 0;

  // Text that wraps (a text file in a narrower window) moves: they move with it.
  useLayoutEffect(() => {
    const element = origin.current;
    if (!any || !element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setResized((n) => n + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, [origin, any]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version and resized say the text was drawn again
  useLayoutEffect(() => {
    const node = root.current;
    const element = origin.current;
    if (!node || !element || !any) {
      setPlaced([]);
      return;
    }
    const text = textOf(node);
    setPlaced(
      highlights.flatMap((highlight) => {
        const where = locate(text, highlight);
        const range = where && rangeAt(node, where.start, where.end);
        return range ? [{ highlight, boxes: boxesOf(range, element, scale) }] : [];
      }),
    );
  }, [root, origin, highlights, any, scale, version, resized]);

  if (!placed.length) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {placed.map(({ highlight, boxes }) => {
        const color = colorOf(highlight.color);
        const all = around(boxes) ?? { left: 0, top: 0, width: 0, height: 0 };
        return (
          <button
            key={highlight.id}
            type="button"
            data-highlight-id={highlight.id}
            aria-label={t("highlight.label", { color: t(`highlight.color.${color}`), text: highlight.text })}
            aria-expanded={open === highlight.id}
            aria-keyshortcuts="Delete Backspace"
            // The keyboard's way in (Enter, Space); a click lands on the text under it, and the viewer finds the highlight there.
            onClick={() => onOpen(highlight.id)}
            onKeyDown={(event) => {
              if (event.key !== "Delete" && event.key !== "Backspace") return;
              event.preventDefault();
              event.stopPropagation();
              onRemove(highlight.id);
            }}
            style={{ left: all.left * scale, top: all.top * scale, width: all.width * scale, height: all.height * scale }}
            className="focus-ring absolute rounded-xs"
          >
            {boxes.map((box) => (
              <span
                key={`${box.left}:${box.top}`}
                className={cx("absolute rounded-xs", INK[color], under ? "dark:opacity-30" : "mix-blend-multiply")}
                style={{ left: (box.left - all.left) * scale, top: (box.top - all.top) * scale, width: box.width * scale, height: box.height * scale }}
              />
            ))}
          </button>
        );
      })}
    </div>
  );
}

/** Where the bar goes, in the container's own pixels: centred over (or under) what it's for. */
interface BarAt {
  left: number;
  top: number;
  bottom: number;
  above: boolean;
}

type Part = Pick<Highlight, "page" | "start" | "end" | "text">;
type BarState = { mode: "new"; parts: Part[]; at: BarAt } | { mode: "edit"; id: string; at: BarAt; keyboard: boolean };

/** A range of a selection that may be a StaticRange (in a shadow root), as a live one to measure. */
function live(range: AbstractRange): Range {
  if (range instanceof Range) return range;
  const copy = document.createRange();
  copy.setStart(range.startContainer, range.startOffset);
  copy.setEnd(range.endContainer, range.endOffset);
  return copy;
}

/** What a click or a key on the file shouldn't be taken for: a link, a field, a button, the bar. */
const CONTROLS = "a, button, input, textarea, select, [contenteditable], [data-highlight-bar], [data-added-text]";

/**
 * Highlighting in one viewer: the bar and what it does, the keys, and what's
 * said. Wire `onMouseDown` and `onMouseUp` to the scrolling file, `onKey` to
 * the viewer's keys, `escape` before the viewer's own Escape; put `bar` in
 * `container` (which scrolls with the file) and `announcer` anywhere in the
 * viewer. Without `highlights` (a file that isn't Edunex's) it does nothing.
 */
export function useHighlighter({
  highlights,
  container,
  scroller,
  roots,
  mac,
}: {
  highlights?: Highlights;
  container: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  roots: () => TextRoot[];
  mac: boolean;
}) {
  const t = useT();
  const keys = keysFor(mac);
  const [bar, setBar] = useState<BarState | null>(null);
  const [said, setSaid] = useState({ text: "", n: 0 });
  /** What was just removed (one highlight, or all of the file's), which ⌘Z puts back; forgotten once anything else changes. */
  const removed = useRef<{ highlights: readonly Highlight[]; from: Highlights } | null>(null);
  const pointer = useRef(false);
  /** The pointer is over a highlight: the file says so with a hand (see styles.css). */
  const hovering = useRef(false);
  const latest = useRef({ highlights, bar, roots, t, keys });
  latest.current = { highlights, bar, roots, t, keys };

  const say = useCallback((text: string) => setSaid((before) => ({ text, n: before.n + 1 })), []);

  /** Where the bar goes for something on screen: over it, or under it when it's at the top of the view. */
  const place = useCallback(
    (rect: DOMRect): BarAt | null => {
      const box = container.current?.getBoundingClientRect();
      const view = scroller.current?.getBoundingClientRect();
      if (!box || !view) return null;
      // Kept inside the view, its half-width from either side.
      const half = 100;
      const middle = Math.max(view.left + half, Math.min(rect.left + rect.width / 2, view.right - half));
      return { left: middle - box.left, top: rect.top - box.top, bottom: rect.bottom - box.top, above: rect.top - view.top > 56 };
    },
    [container, scroller],
  );

  /** What's selected, as the part of each text it covers; null when it covers none of the file's text. */
  const selection = useCallback((): { parts: Part[]; range: AbstractRange } | null => {
    const found = latest.current.roots();
    const range = selectedRange(found.find((root) => root.shadow)?.shadow);
    if (!range) return null;
    const parts: Part[] = [];
    for (const root of found) {
      const at = offsetsIn(root.node, range);
      if (!at) continue;
      const text = textOf(root.node);
      const cut = trimmed(text, at.start, at.end);
      if (cut) parts.push({ ...(root.page ? { page: root.page } : {}), start: cut.start, end: cut.end, text: quoteOf(text.slice(cut.start, cut.end)) });
    }
    return parts.length ? { parts, range } : null;
  }, []);

  const focusMark = useCallback(
    (id: string) => {
      for (const element of container.current?.querySelectorAll<HTMLElement>("[data-highlight-id]") ?? [])
        if (element.dataset.highlightId === id) return element.focus();
    },
    [container],
  );

  /** The bar over what's selected now, or none when nothing of the file's text is. */
  const showForSelection = useCallback(() => {
    if (!latest.current.highlights) return;
    const found = selection();
    const at = found && place(live(found.range).getBoundingClientRect());
    setBar((before) => (found && at ? { mode: "new", parts: found.parts, at } : before?.mode === "new" ? null : before));
  }, [selection, place]);

  const openFor = useCallback(
    (id: string, keyboard: boolean) => {
      const element = [...(container.current?.querySelectorAll<HTMLElement>("[data-highlight-id]") ?? [])].find((found) => found.dataset.highlightId === id);
      const at = element && place(element.getBoundingClientRect());
      if (at) setBar({ mode: "edit", id, at, keyboard });
    },
    [container, place],
  );

  /** The highlight under a click: the smallest one there, where two overlap. */
  const markAt = (x: number, y: number): string | null => {
    let best: { id: string; area: number } | null = null;
    for (const piece of container.current?.querySelectorAll<HTMLElement>("[data-highlight-id] > span") ?? []) {
      const r = piece.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
      const mark = piece.parentElement as HTMLElement;
      const whole = mark.getBoundingClientRect();
      if (!best || whole.width * whole.height < best.area) best = { id: mark.dataset.highlightId ?? "", area: whole.width * whole.height };
    }
    return best?.id ?? null;
  };

  const add = useCallback(
    (color: HighlightColor, parts?: Part[]) => {
      const { highlights: now, t } = latest.current;
      const list = parts ?? selection()?.parts;
      if (!now || !list?.length) return;
      const at = Date.now();
      now.add(list.map((part) => ({ ...part, id: newId(), color, at })));
      lastColor = color;
      removed.current = null;
      // The highlight shows where the selection was.
      document.getSelection()?.removeAllRanges();
      setBar(null);
      say(t("highlight.added", { color: t(`highlight.color.${color}`) }));
    },
    [selection, say],
  );

  const recolor = (id: string, color: HighlightColor) => {
    const current = latest.current.bar;
    latest.current.highlights?.recolor(id, color);
    lastColor = color;
    removed.current = null;
    setBar(null);
    if (current?.mode === "edit" && current.keyboard) focusMark(id);
    say(t("highlight.recolored", { color: t(`highlight.color.${color}`) }));
  };

  const remove = useCallback(
    (id: string, keyboard: boolean) => {
      const { highlights: from, t, keys } = latest.current;
      const highlight = from?.items.find((item) => item.id === id);
      if (!from || !highlight) return;
      from.remove(id);
      const gone = { highlights: [highlight], from };
      removed.current = gone;
      setBar(null);
      // Its stop has gone: the keyboard carries on from the pages.
      if (keyboard) scroller.current?.focus();
      toast(t("highlight.removed"), "neutral", {
        label: t("action.undo"),
        onClick: () => {
          from.restore(gone.highlights);
          if (removed.current === gone) removed.current = null;
        },
      });
      say(t("highlight.removedUndo", { keys: keys.undo }));
    },
    [scroller, say],
  );

  /** Every highlight in the file, removed at once, with Undo in the toast and ⌘Z, as one is. */
  const clearAll = useCallback(() => {
    const { highlights: from, t, keys } = latest.current;
    if (!from?.items.length) return;
    const gone = { highlights: from.items, from };
    const count = gone.highlights.length;
    from.clear();
    removed.current = gone;
    setBar(null);
    toast(t("highlight.cleared", { count }), "neutral", {
      label: t("action.undo"),
      onClick: () => {
        from.restore(gone.highlights);
        if (removed.current === gone) removed.current = null;
      },
    });
    say(t("highlight.clearedUndo", { count, keys: keys.undo }));
  }, [say]);

  const undo = useCallback(() => {
    const last = removed.current;
    if (!last) return false;
    last.from.restore(last.highlights);
    removed.current = null;
    const count = last.highlights.length;
    say(count === 1 ? latest.current.t("highlight.restored") : latest.current.t("highlight.restoredAll", { count }));
    return true;
  }, [say]);

  // A selection made from the keyboard or a screen reader (the mouse's is read as the button comes up).
  const enabled = highlights !== undefined;
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      if (pointer.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => latest.current.bar?.mode !== "edit" && showForSelection(), 200);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [enabled, showForSelection]);

  /** Closes the bar; true when there was one (Escape is then the bar's, not the viewer's). */
  const escapeBar = useCallback(() => {
    const current = latest.current.bar;
    if (!current) return false;
    setBar(null);
    if (current.mode === "edit" && current.keyboard) focusMark(current.id);
    return true;
  }, [focusMark]);

  const close = useCallback(() => setBar(null), []);
  const forgetUndo = useCallback(() => {
    removed.current = null;
  }, []);

  const onMouseDown = () => {
    pointer.current = true;
  };
  /** A hand over a highlight, since a click there opens its bar; not while the mouse is selecting text. */
  const hover = (over: boolean) => {
    if (over === hovering.current) return;
    hovering.current = over;
    scroller.current?.toggleAttribute("data-on-highlight", over);
  };
  const onMouseMove = (event: MouseEvent) => hover(Boolean(highlights?.items.length) && event.buttons === 0 && markAt(event.clientX, event.clientY) !== null);
  // Gone from the file (to the toolbar's "Tambah teks", say): its own pointer is back.
  const onMouseLeave = () => hover(false);
  const onMouseUp = (event: MouseEvent) => {
    pointer.current = false;
    if (!highlights || (event.target instanceof Element && event.target.closest(CONTROLS))) return;
    if (selection()) return showForSelection();
    const id = markAt(event.clientX, event.clientY);
    if (id) openFor(id, false);
    else setBar(null);
  };

  /** ⌘⇧H highlights what's selected; ⌘Z puts back the highlight just removed. True when the key was one of them. */
  const onKey = (event: KeyboardEvent) => {
    if (!highlights || !(event.metaKey || event.ctrlKey)) return false;
    const key = event.key.toLowerCase();
    if (event.shiftKey && key === "h") {
      event.preventDefault();
      add(lastColor);
      return true;
    }
    if (!event.shiftKey && key === "z" && removed.current) {
      event.preventDefault();
      return undo();
    }
    return false;
  };

  // A highlight whose bar is open and that's gone meanwhile (put back by another Undo, removed) takes its bar with it.
  const shown = bar?.mode === "edit" && !highlights?.items.some((item) => item.id === bar.id) ? null : bar;
  const editing = shown?.mode === "edit" ? (highlights?.items.find((item) => item.id === shown.id) ?? null) : null;

  return {
    /** The highlight whose bar is open. */
    open: editing?.id ?? null,
    onMouseDown,
    onMouseMove,
    onMouseLeave,
    onMouseUp,
    onKey,
    escape: escapeBar,
    close,
    forgetUndo,
    openFor,
    remove,
    bar: shown && (
      <HighlightBar
        // Another highlight's bar opens afresh, on its own color.
        key={shown.mode === "edit" ? `edit:${shown.id}` : "new"}
        at={shown.at}
        current={editing ? colorOf(editing.color) : null}
        focus={shown.mode === "edit" && shown.keyboard}
        mac={mac}
        onPick={(color) => (shown.mode === "new" ? add(color, shown.parts) : recolor(shown.id, color))}
        onRemove={shown.mode === "edit" ? () => remove(shown.id, shown.keyboard) : undefined}
      />
    ),
    /** The viewer's "⋯" menu, for its toolbar: Remove all highlights. None for a file that can't be highlighted. */
    menu: highlights && (
      <Menu
        label={t("viewer.more")}
        trigger={{ icon: <Icons.MoreHorizontal className="size-4" /> }}
        items={[
          {
            label: t("highlight.clearAll"),
            hint: highlights.items.length ? t("highlight.clearAllHint", { count: highlights.items.length }) : t("highlight.clearAllNone"),
            icon: <DeleteIcon className="size-4" />,
            disabled: !highlights.items.length,
            onSelect: clearAll,
          },
        ]}
      />
    ),
    announcer: (
      <div aria-live="polite" className="sr-only">
        <span key={said.n}>{said.text}</span>
      </div>
    ),
  };
}

/**
 * The bar over selected text (`current` null: a color each, the one ⌘⇧H uses
 * saying so) or over a highlight (its colors, the one it is marked, then
 * Remove). It never takes the selection or the keyboard from the page, except
 * when opened from the keyboard (`focus`), where it starts on the highlight's color.
 */
function HighlightBar({
  at,
  current,
  focus,
  mac,
  onPick,
  onRemove,
}: {
  at: BarAt;
  current: HighlightColor | null;
  focus: boolean;
  mac: boolean;
  onPick: (color: HighlightColor) => void;
  onRemove?: () => void;
}) {
  const t = useT();
  const keys = keysFor(mac);
  const ref = useRef<HTMLDivElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only as it opens
  useLayoutEffect(() => {
    if (focus) ref.current?.querySelector<HTMLElement>("[aria-pressed=true]")?.focus();
  }, []);
  const swatches: ReactNode = HIGHLIGHT_COLORS.map((color) => {
    const name = t(`highlight.color.${color}`);
    const label = current ? name.charAt(0).toLocaleUpperCase() + name.slice(1) : t("highlight.add", { color: name });
    const shortcut = !current && color === lastColor;
    return (
      <Tooltip key={color} side={at.above ? "top" : "bottom"} content={shortcut ? t("highlight.addKeys", { color: name, keys: keys.highlight }) : label}>
        <IconButton
          label={label}
          size="sm"
          aria-pressed={current ? current === color : undefined}
          aria-keyshortcuts={shortcut ? (mac ? "Meta+Shift+H" : "Control+Shift+H") : undefined}
          onClick={() => onPick(color)}
        >
          <span className={cx("grid size-4.5 place-items-center rounded-full ring-1 ring-black/15 ring-inset", INK[color])}>
            {current === color && <Icons.Check className="size-3 text-black/75" weight="bold" />}
          </span>
        </IconButton>
      </Tooltip>
    );
  });
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={t(current ? "highlight.edit" : "highlight.bar")}
      data-highlight-bar
      // A press here keeps the selection it's for, and leaves the keyboard where it was.
      onMouseDown={(event) => event.preventDefault()}
      style={{ left: at.left, top: at.above ? at.top - 8 : at.bottom + 8 }}
      className={cx(
        "absolute z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-edge bg-raised p-1 text-fg shadow-pop motion-safe:animate-popover-in",
        at.above ? "origin-bottom -translate-y-full" : "origin-top",
      )}
    >
      {current ? (
        <>
          {/* biome-ignore lint/a11y/useSemanticElements: a few buttons named together, not a form's fields */}
          <div role="group" aria-label={t("highlight.colors")} className="flex items-center gap-0.5">
            {swatches}
          </div>
          <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />
          <Tooltip side={at.above ? "top" : "bottom"} content={t("highlight.removeKeys", { keys: keys.remove })}>
            {/* Its word beside the bin, so removing a highlight is plain at a glance. */}
            <Button variant="ghost" size="sm" aria-label={t("highlight.remove")} icon={<DeleteIcon className="size-4" />} onClick={onRemove} className="px-2">
              {t("highlight.removeShort")}
            </Button>
          </Tooltip>
        </>
      ) : (
        <>
          <MarkerIcon className="mx-1.5 size-4 shrink-0 text-muted" />
          {swatches}
        </>
      )}
    </div>
  );
}
