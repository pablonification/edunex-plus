// Where a highlight is in what a viewer shows, both ways: the text under a
// root (a PDF page's text layer, a Word document's pages, a text file) as one
// string, a selection as the characters it covers in it, those characters as
// a range again, and the boxes that range is drawn in. Only text that shows
// counts, never a style sheet's; the characters don't change with the zoom.

/** A box on the page, from its top left, in the page's own units (CSS pixels at scale 1). */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const HIDDEN = "style, script, noscript, template";

/** The text nodes under `root` that show, in reading order. */
function textNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (node.parentElement?.closest(HIDDEN) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
  return nodes;
}

/** All the text under `root`, as the offsets count it. */
export function textOf(root: Node): string {
  return textNodes(root)
    .map((node) => node.data)
    .join("");
}

/** How many characters of `root`'s text come before a point inside it. */
function offsetAt(nodes: readonly Text[], container: Node, offset: number): number {
  const point = document.createRange();
  point.setStart(container, offset);
  let count = 0;
  for (const node of nodes) {
    if (node === container) return count + Math.min(offset, node.length);
    // Wholly before the point: all of it. Otherwise the point is reached.
    if (point.comparePoint(node, node.length) > 0) break;
    count += node.length;
  }
  return count;
}

/** The characters of `root`'s text that `range` covers (the part of it inside `root`); null when it covers none. */
export function offsetsIn(root: Node, range: AbstractRange): { start: number; end: number } | null {
  const nodes = textNodes(root);
  const all = document.createRange();
  all.selectNodeContents(root);
  try {
    // Starts before `root` (a selection from the page before): from its first character; ends after it: to its last.
    const from = all.comparePoint(range.startContainer, range.startOffset);
    const to = all.comparePoint(range.endContainer, range.endOffset);
    if (from > 0 || to < 0) return null;
    const length = nodes.reduce((sum, node) => sum + node.length, 0);
    const start = from < 0 ? 0 : offsetAt(nodes, range.startContainer, range.startOffset);
    const end = to > 0 ? length : offsetAt(nodes, range.endContainer, range.endOffset);
    return end > start ? { start, end } : null;
  } catch {
    // A point in another tree (the page's, for a document in a shadow root): not this text's.
    return null;
  }
}

/** The range of `root`'s text from character `start` to `end`; null past its end. */
export function rangeAt(root: Node, start: number, end: number): Range | null {
  const range = document.createRange();
  let count = 0;
  let started = false;
  for (const node of textNodes(root)) {
    const next = count + node.length;
    // A start at a node's end belongs to the next node, an end at a node's start to the one before.
    if (!started && start < next) {
      range.setStart(node, start - count);
      started = true;
    }
    if (started && end <= next) {
      range.setEnd(node, end - count);
      return range;
    }
    count = next;
  }
  return null;
}

/** On one line: they overlap by most of the shorter one's height. */
const sameLine = (a: Box, b: Box) => Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top) > Math.min(a.height, b.height) / 2;

/**
 * The boxes `range` is drawn in, relative to `origin` and at scale 1: one
 * per line, the words on a line joined (across the space between them), so
 * a highlight reads as one stroke and never darkens where two parts meet.
 */
export function boxesOf(range: Range, origin: Element, scale: number): Box[] {
  const at = origin.getBoundingClientRect();
  const pieces: Box[] = [];
  const root = range.commonAncestorContainer;
  const nodes = root instanceof Text ? [root] : textNodes(root).filter((node) => range.intersectsNode(node));
  for (const node of nodes) {
    const part = document.createRange();
    part.setStart(node, node === range.startContainer ? range.startOffset : 0);
    part.setEnd(node, node === range.endContainer ? range.endOffset : node.length);
    for (const rect of part.getClientRects())
      if (rect.width >= 0.5 && rect.height >= 0.5)
        pieces.push({ left: (rect.left - at.left) / scale, top: (rect.top - at.top) / scale, width: rect.width / scale, height: rect.height / scale });
  }
  const lines: Box[] = [];
  for (const piece of pieces.sort((a, b) => a.top - b.top || a.left - b.left)) {
    const gap = Math.min(piece.height, 40);
    const line = lines.find((l) => sameLine(l, piece) && piece.left <= l.left + l.width + gap && piece.left + piece.width >= l.left - gap);
    if (!line) {
      lines.push({ ...piece });
      continue;
    }
    const right = Math.max(line.left + line.width, piece.left + piece.width);
    const bottom = Math.max(line.top + line.height, piece.top + piece.height);
    line.left = Math.min(line.left, piece.left);
    line.top = Math.min(line.top, piece.top);
    line.width = right - line.left;
    line.height = bottom - line.top;
  }
  return lines;
}

/** The smallest box holding all of them; null for none. */
export function around(boxes: readonly Box[]): Box | null {
  if (!boxes.length) return null;
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  return { left, top, width: Math.max(...boxes.map((b) => b.left + b.width)) - left, height: Math.max(...boxes.map((b) => b.top + b.height)) - top };
}

type WithComposedRanges = Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] };

/**
 * What the Student has selected, as a range; null when nothing is. A
 * selection inside a shadow root (a Word document's pages) is asked for in it,
 * so its own nodes come back rather than the element it's drawn in.
 */
export function selectedRange(shadow?: ShadowRoot | null): AbstractRange | null {
  const selection = document.getSelection() as WithComposedRanges | null;
  if (!selection || selection.rangeCount === 0) return null;
  if (shadow && selection.getComposedRanges) {
    const [composed] = selection.getComposedRanges({ shadowRoots: [shadow] });
    return composed && !composed.collapsed ? composed : null;
  }
  const range = selection.getRangeAt(0);
  return range.collapsed ? null : range;
}
