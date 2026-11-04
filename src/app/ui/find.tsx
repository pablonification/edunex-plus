// Finding words in a file open in a viewer (⌘F, Ctrl+F): a small bar over the
// top right of the file, with the box, "2 dari 7", the previous and next match
// and Close. Enter (and ⌘G) goes to the next, ⇧Enter (⌘⇧G) to the one before,
// Escape closes the bar and gives the keyboard back to the file. Case doesn't
// count, and a space in what's typed also finds the words split over two lines.
// Every match is tinted, the one it's on more strongly, with the browser's own
// highlights (CSS Custom Highlight API), so nothing is added to the file's
// text. The viewer finds the matches (a PDF's in every page's text, drawn or
// not) and says where each is; this keeps the bar and which one it's on.
import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { useT } from "../i18n";
import { IconButton } from "./controls";
import { Icons } from "./icons";
import { Tooltip } from "./overlays";

/** The bar, for a viewer's Escape and keys: what's typed there is the bar's own. */
export const FIND_AREA = "[data-find-bar]";

/** Lower case, each character kept to its own length so offsets in it are offsets in the text ("İ" stays as it is). */
function fold(text: string): string {
  let out = "";
  for (const character of text) {
    const lower = character.toLowerCase();
    out += lower.length === character.length ? lower : character;
  }
  return out;
}

const isSpace = (character: string | undefined) => character !== undefined && /\s/.test(character);

/** Where `query` is in `text`, as character offsets; none for an empty query. */
export function matchesIn(text: string, query: string): { start: number; end: number }[] {
  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const haystack = fold(text);
  const out: { start: number; end: number }[] = [];
  for (let start = haystack.indexOf(words[0]); start >= 0; ) {
    let end = start + words[0].length;
    // Between two words any run of space, or none: a PDF's lines meet with nothing between them.
    for (const word of words.slice(1)) {
      while (isSpace(haystack[end])) end++;
      if (!haystack.startsWith(word, end)) {
        end = -1;
        break;
      }
      end += word.length;
    }
    if (end > start) out.push({ start, end });
    start = haystack.indexOf(words[0], end > start ? end : start + 1);
  }
  return out;
}

/** Not the file's own words: style sheets, what's hidden from reading, a sheet's column letters and row numbers, the highlight bar. */
const SKIP = "style, script, noscript, template, [aria-hidden=true], [data-find-skip], [data-highlight-bar]";

/** Where `query` is in the text under `root` that shows, as ranges in reading order, each with its offsets in that text. */
export function rangesIn(root: Node, query: string): { start: number; end: number; range: Range }[] {
  if (!query.trim()) return [];
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  const starts: number[] = [];
  let length = 0;
  for (const node of nodes) {
    starts.push(length);
    length += node.length;
  }
  /** The text node holding character `at`, and where in it; an end at a node's start belongs to the one before. */
  const point = (at: number, end: boolean): [Text, number] => {
    let index = 0;
    while (index < nodes.length - 1 && (end ? starts[index + 1] < at : starts[index + 1] <= at)) index++;
    return [nodes[index], at - starts[index]];
  };
  return matchesIn(nodes.map((node) => node.data).join(""), query).map(({ start, end }) => {
    const range = document.createRange();
    range.setStart(...point(start, false));
    range.setEnd(...point(end, true));
    return { start, end, range };
  });
}

type HighlightRegistry = { set(name: string, highlight: unknown): void; delete(name: string): void };
const registry = (): HighlightRegistry | null =>
  typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined" ? (CSS.highlights as unknown as HighlightRegistry) : null;

/** Tints every match, and the one it's on more strongly (`find` and `find-current` in styles.css). */
export function paintMatches(ranges: readonly Range[], current: Range | null): void {
  const highlights = registry();
  if (!highlights) return;
  highlights.set("find", new Highlight(...ranges.filter((range) => range !== current)));
  if (current) highlights.set("find-current", new Highlight(current));
  else highlights.delete("find-current");
}

export function clearMatches(): void {
  const highlights = registry();
  highlights?.delete("find");
  highlights?.delete("find-current");
}

/** Scrolls `scroller` so the match is in view, a third of the way down, unless it's in view already. */
export function revealMatch(range: Range, scroller: HTMLElement): void {
  if (typeof range.getBoundingClientRect !== "function") return;
  const at = range.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  if (at.top < view.top + 48 || at.bottom > view.bottom - 16) scroller.scrollTop += at.top - view.top - view.height / 3;
  if (at.left < view.left || at.right > view.right) scroller.scrollLeft += at.left - view.left - view.width / 2 + at.width / 2;
}

export interface Find {
  open: boolean;
  /** What's typed, as it's searched (after a short pause in the typing). */
  query: string;
  /** Which match it's on; null until the viewer picks the first (the first from where the Student is reading). */
  at: number | null;
  /** Bumped each time the Student moves to a match, to show it even when it's the same one. */
  seek: number;
  pick(at: number): void;
  /** ⌘F, ⌘G, F3 wherever the keyboard is in the viewer; true when it was one. */
  onKey(event: KeyboardEvent): boolean;
  /** Escape in the bar closes it; true when it did, so the viewer stays open. */
  escape(target: EventTarget | null): boolean;
  /** The toolbar's button that opens it; none while there's no file to look in. */
  button: React.ReactNode;
  /** The bar, for a box over the file that doesn't scroll with it. */
  bar: React.ReactNode;
}

/** The first of `ranges` from the top of what's in view, where reading goes on; the first of all when none is below it. */
export function firstFromView(ranges: readonly Range[], scroller: HTMLElement | null): number {
  if (!scroller || typeof Range.prototype.getBoundingClientRect !== "function") return 0;
  const top = scroller.getBoundingClientRect().top;
  const index = ranges.findIndex((range) => range.getBoundingClientRect().bottom > top);
  return Math.max(index, 0);
}

/**
 * The find bar of one viewer. `total`: how many matches the viewer found for
 * `query` so far; `searching`: it's still looking (a long PDF's pages);
 * `available`: there's a file to look in (it shuts when there isn't).
 * `onClose` gives the keyboard back to the file.
 */
export function useFind({
  total,
  searching,
  available,
  mac,
  onClose,
}: {
  total: number;
  searching: boolean;
  available: boolean;
  mac: boolean;
  onClose: () => void;
}): Find {
  const t = useT();
  const count = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [at, setAt] = useState<number | null>(null);
  const [seek, setSeek] = useState(0);
  const keys = mac ? "⌘F" : "Ctrl+F";

  // A short pause in the typing, then it's searched: a long PDF isn't read again on every letter.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(open ? typed : ""), typed.trim() ? 150 : 0);
    return () => clearTimeout(timer);
  }, [typed, open]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new search starts from where the Student is reading
  useEffect(() => setAt(null), [query]);
  useEffect(() => {
    if (!available) setOpen(false);
  }, [available]);
  useEffect(() => {
    if (!open) clearMatches();
  }, [open]);
  useEffect(() => clearMatches, []);

  const show = useCallback(() => {
    setOpen(true);
    // Open already: the box takes the keyboard again, what's in it selected to type over.
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
  }, []);
  const close = () => {
    setOpen(false);
    onClose();
  };
  const step = (by: 1 | -1) => {
    if (!total) return;
    setAt((now) => (now === null ? (by > 0 ? 0 : total - 1) : (now + by + total) % total));
    setSeek((n) => n + 1);
  };

  const onKey = (event: KeyboardEvent) => {
    const mod = event.metaKey || event.ctrlKey;
    const letter = event.key.toLowerCase();
    if (!available) return false;
    if (mod && !event.altKey && (letter === "f" || event.code === "KeyF")) show();
    else if (open && ((mod && (letter === "g" || event.code === "KeyG")) || event.key === "F3")) step(event.shiftKey ? -1 : 1);
    else return false;
    event.preventDefault();
    return true;
  };

  const said =
    !query.trim() || typed !== query
      ? ""
      : at !== null && total
        ? t("find.count", { at: at + 1, count: total })
        : searching
          ? t("find.searching")
          : t("find.none");

  return {
    open,
    query,
    at,
    seek,
    pick: useCallback((next: number) => {
      setAt(next);
      setSeek((n) => n + 1);
    }, []),
    onKey,
    escape: (target) => {
      if (!(target instanceof Element && target.closest(FIND_AREA))) return false;
      close();
      return true;
    },
    button: available && (
      <Tooltip content={t("find.openKeys", { keys })}>
        <IconButton label={t("find.open")} size="sm" aria-keyshortcuts={mac ? "Meta+F" : "Control+F"} aria-pressed={open} onClick={show}>
          <Icons.Search className="size-4" />
        </IconButton>
      </Tooltip>
    ),
    bar: open && (
      // biome-ignore lint/a11y/useSemanticElements: <search> is too new for every renderer the tests use
      <div
        role="search"
        data-find-bar
        aria-label={t("find.open")}
        className="absolute top-3 right-3 z-20 flex items-center gap-0.5 rounded-control border border-line bg-raised py-1 pr-1 pl-2.5 shadow-dialog"
      >
        <Icons.Search className="size-3.5 shrink-0 text-muted" />
        <input
          ref={input}
          // biome-ignore lint/a11y/noAutofocus: ⌘F is asking to type here
          autoFocus
          type="text"
          enterKeyHint="search"
          value={typed}
          aria-label={t("find.open")}
          aria-describedby={count}
          placeholder={t("find.placeholder")}
          spellCheck={false}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            step(event.shiftKey ? -1 : 1);
          }}
          className="h-7 w-44 min-w-0 bg-transparent px-1.5 text-small text-fg placeholder:text-faint focus:outline-none"
        />
        <span id={count} aria-live="polite" className="min-w-16 shrink-0 px-1 text-right text-small text-muted tabular-nums">
          {said}
        </span>
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-line" />
        <Tooltip content={t("find.previousKeys", { keys: mac ? "⇧⏎" : "Shift+Enter" })}>
          <IconButton label={t("find.previous")} size="sm" aria-disabled={!total} onClick={() => step(-1)}>
            <Icons.ChevronDown className="size-4 rotate-180" />
          </IconButton>
        </Tooltip>
        <Tooltip content={t("find.nextKeys", { keys: mac ? "⏎" : "Enter" })}>
          <IconButton label={t("find.next")} size="sm" aria-disabled={!total} onClick={() => step(1)}>
            <Icons.ChevronDown className="size-4" />
          </IconButton>
        </Tooltip>
        <Tooltip content={t("find.close")}>
          <IconButton label={t("find.close")} size="sm" onClick={close}>
            <Icons.X className="size-4" />
          </IconButton>
        </Tooltip>
      </div>
    ),
  };
}
