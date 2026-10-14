// A PowerPoint presentation (.pptx, .ppsx) as the viewer shows it: each
// visible slide, in order, as its background and the text boxes, shapes,
// pictures and tables placed on it. Unpacked with JSZip (loaded on first use,
// its own chunk) and its XML read with the browser's own parser, as ./sheets.ts
// does. Nothing in it runs, and what's kept is plain data: text, colours that
// are colours, pictures only in formats a page shows without running anything
// (as data: addresses), and only links to web pages. A slide's look comes from
// its layout and master too (where text sits, its size and colour, bullets,
// the theme's colours), as far as that's simple. Freeform shapes become SVG
// path data built from their numbers. Charts, SmartArt, video, sound and
// animations aren't drawn.
import type JSZip from "jszip";
import { isWebLink } from "../../core/links";

/** A presentation: its slides' size and its visible slides. Lengths are in EMU (914,400 to the inch), text sizes in points. */
export interface Deck {
  width: number;
  height: number;
  slides: Slide[];
}

/** A slide: what's behind it (null for white), then what's on it, back to front. */
export interface Slide {
  background: { color: string } | { gradient: Gradient } | { picture: string } | null;
  items: Item[];
}

/** A straight gradient: its colours ("rrggbb") and where each is, from 0 to 1, along its direction (`angle` degrees clockwise from left to right). */
export interface Gradient {
  angle: number;
  stops: { color: string; at: number }[];
}

/** How a shape is filled: one colour ("rrggbb") or a gradient. */
export type Fill = string | Gradient;

/** One outline of a freeform shape: SVG path data in EMU from the shape's top left corner, and whether it's filled and drawn round. */
export interface FreeformPath {
  d: string;
  fill: boolean;
  stroke: boolean;
}

/** Where something sits on the slide; turned by `rotation` degrees clockwise. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** An outline or a line: its colour ("rrggbb") and width. */
export interface Stroke {
  color: string;
  width: number;
}

/** What's on a slide: a shape or text box, a straight line, a picture or a table. */
export type Item =
  | {
      kind: "shape";
      box: Box;
      /** A freeform shape has its `paths`; any other shape but these is drawn as a rectangle. */
      geometry: "rect" | "roundRect" | "ellipse" | "freeform";
      paths: FreeformPath[];
      /** A rounded rectangle's corners: their radius, as a share of its shorter side. */
      corner: number;
      fill: Fill | null;
      outline: Stroke | null;
      text: TextBody | null;
    }
  | { kind: "line"; from: { x: number; y: number }; to: { x: number; y: number }; stroke: Stroke }
  | {
      kind: "picture";
      box: Box;
      /** A data: address. */
      url: string;
      /** How much is cut off each side, as a share of the picture: left, top, right, bottom. */
      crop: [number, number, number, number];
      flip: { x: boolean; y: boolean };
    }
  | { kind: "table"; box: Box; columns: number[]; rows: TableRow[]; size: number; header: boolean };

export interface TableRow {
  height: number;
  cells: { text: string; columns: number; rows: number; fill: string | null }[];
}

/** A box's text: where it sits in the box, how far in from its edges (left, top, right, bottom), whether lines wrap, and its paragraphs. */
export interface TextBody {
  anchor: "top" | "middle" | "bottom";
  inset: [number, number, number, number];
  wrap: boolean;
  paragraphs: Paragraph[];
}

export interface Paragraph {
  align: "left" | "center" | "right" | "justify";
  /** Its outline level, from 0. */
  level: number;
  /** Its left margin, and its first line's indent from that (negative for a bullet hanging in the margin). */
  margin: number;
  indent: number;
  bullet: { text: string; color: string | null; size: number } | null;
  /** Its lines' height, as a multiple of single spacing; the space before and after it, in points. */
  lineSpacing: number;
  spaceBefore: number;
  spaceAfter: number;
  /** Its text size when it has no text (an empty line keeps its height). */
  size: number;
  runs: Run[];
}

/** A stretch of text in one style; "\n" is a line break. `link` is only ever a web page. */
export interface Run {
  text: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  caps: boolean;
  color: string | null;
  font: string | null;
  link: string | null;
}

const RELATIONSHIPS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
/** The most slides read, and things on them all together (shapes, paragraphs, runs, cells), groups in groups, and the biggest picture kept. */
const MAX_SLIDES = 2000;
const MAX_THINGS = 500_000;
const MAX_DEPTH = 32;
const MAX_PICTURE = 20 * 1024 * 1024;
/** The most colours a gradient keeps (evenly picked), of the most it reads. */
const MAX_STOPS = 32;
const MAX_STOPS_READ = 1000;
/** The most kept of all the pictures together (as data: addresses); past it, the rest are left out. */
const MAX_PICTURES = 150 * 1024 * 1024;
/** PowerPoint's own defaults: 18 pt text, and text 0.1" in from a box's sides and 0.05" from its top and bottom. */
const DEFAULT_SIZE = 18;
const DEFAULT_INSET: [number, number, number, number] = [91440, 45720, 91440, 45720];
/** PowerPoint's single line spacing, as a multiple of the text's size. */
const SINGLE_LINE = 1.2;
const HEX = /^[0-9a-f]{6}$/i;
/** A font's name, used as it is only when it's plainly one. */
const FONT_NAME = /^[\p{L}\p{N} ._-]{1,64}$/u;
/** Bullets from the symbol fonts, as the characters they draw. */
const SYMBOL_BULLETS: Readonly<Record<string, string>> = { "§": "▪", Ø: "➢", ü: "✓", q: "❑", n: "■", l: "●", v: "❖", è: "➔", Ÿ: "•" };
const PRESET_COLORS: Readonly<Record<string, string>> = {
  black: "000000",
  white: "ffffff",
  red: "ff0000",
  green: "008000",
  blue: "0000ff",
  yellow: "ffff00",
  gray: "808080",
};

const parse = (text: string) => new DOMParser().parseFromString(text, "application/xml");
/** Elements by their name anywhere inside, whatever namespace prefix the file gives them. */
const all = (node: Document | Element, name: string) => [...node.getElementsByTagNameNS("*", name)];
/** An element's own children by name. */
const children = (node: Element | null | undefined, name: string) => (node ? [...node.children].filter((c) => c.localName === name) : []);
/** Follows children by name: `child(sp, "nvSpPr", "nvPr", "ph")`. */
const child = (node: Element | null | undefined, ...names: string[]): Element | null =>
  names.reduce<Element | null>((at, name) => (at ? ([...at.children].find((c) => c.localName === name) ?? null) : null), node ?? null);
const num = (node: Element | null | undefined, name: string) => {
  const value = node?.getAttribute(name);
  return value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
};
const flag = (node: Element | null | undefined, name: string) => node?.getAttribute(name) === "1" || node?.getAttribute(name) === "true";
const relationId = (node: Element | null | undefined, name: string) => node?.getAttributeNS(RELATIONSHIPS, name) || node?.getAttribute(`r:${name}`) || null;

/** A relationship's target as a path in the ZIP, from the part it's in; null when it leads out of it. */
function resolve(from: string, target: string): string | null {
  const parts = target.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const piece of target.split("/")) {
    if (piece === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else if (piece !== "." && piece !== "") parts.push(piece);
  }
  return parts.join("/");
}

interface Relation {
  type: string;
  /** Inside the ZIP; null when it's outside (a web page). */
  path: string | null;
  target: string;
}
interface Part {
  path: string;
  root: Element;
  relations: Map<string, Relation>;
}
interface Theme {
  colors: Map<string, string>;
  fonts: { major: string | null; minor: string | null };
  /** The outline widths a shape's style refers to, from 1. */
  lines: number[];
}
interface Master {
  part: Part;
  theme: Theme;
  colorMap: Element | null;
  placeholders: Element[];
  styles: { title: Element | null; body: Element | null; other: Element | null };
}
interface Layout {
  part: Part;
  master: Master;
  placeholders: Element[];
}
/** What a slide's shapes are read with: the part they're in (for its relationships), the theme's colours as mapped for the slide, and the layout and master behind it. */
interface Context {
  part: Part;
  layout: Layout | null;
  master: Master | null;
  color: (name: string) => string | null;
  defaults: Element | null;
  /** Placeholders here are left out (a layout's or master's are prompts, not content). */
  ownOnly: boolean;
}
/** Moves a group's children onto the slide. */
interface Transform {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
}

/** The presentation's visible slides, in order. Throws when the file isn't a presentation it can read, or holds more than it reads. */
export async function readPresentation(bytes: Uint8Array): Promise<Deck> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  const parts = new Map<string, Promise<Part | null>>();
  const pictures = new Map<string, Promise<string | null>>();
  const masters = new Map<string, Promise<Master | null>>();
  const layouts = new Map<string, Promise<Layout | null>>();
  let things = 0;
  let pictureBytes = 0;

  const read = (path: string, kind: string): Promise<Part | null> => {
    let part = parts.get(path);
    if (!part) {
      part = readPart(zip, path);
      parts.set(path, part);
    }
    return part.then((p) => (p?.root.localName === kind ? p : null));
  };
  const picture = (path: string) => {
    let url = pictures.get(path);
    if (!url) {
      url = readPicture(zip, path).then((found) => {
        pictureBytes += found?.length ?? 0;
        return pictureBytes <= MAX_PICTURES ? found : null;
      });
      pictures.set(path, url);
    }
    return url;
  };
  const master = (path: string) => {
    let found = masters.get(path);
    if (!found)
      masters.set(
        path,
        (found = (async () => {
          const part = await read(path, "sldMaster");
          if (!part) return null;
          const theme = [...part.relations.values()].find((r) => r.type.endsWith("/theme"))?.path;
          const styles = child(part.root, "txStyles");
          return {
            part,
            theme: readTheme(theme ? await read(theme, "theme") : null),
            colorMap: child(part.root, "clrMap"),
            placeholders: placeholdersOf(part.root),
            styles: { title: child(styles, "titleStyle"), body: child(styles, "bodyStyle"), other: child(styles, "otherStyle") },
          };
        })()),
      );
    return found;
  };
  const layout = (path: string) => {
    let found = layouts.get(path);
    if (!found)
      layouts.set(
        path,
        (found = (async () => {
          const part = await read(path, "sldLayout");
          const next = part && [...part.relations.values()].find((r) => r.type.endsWith("/slideMaster"))?.path;
          const behind = next ? await master(next) : null;
          return part && behind ? { part, master: behind, placeholders: placeholdersOf(part.root) } : null;
        })()),
      );
    return found;
  };
  const count = (n = 1) => {
    things += n;
    if (things > MAX_THINGS) throw new Error("Too much in the presentation to show");
  };

  /** The shapes in a shape tree or group, back to front, into `out`. */
  async function readTree(tree: Element | null, context: Context, transform: Transform, depth: number, out: Item[]): Promise<void> {
    if (depth > MAX_DEPTH) throw new Error("Groups nested too deep");
    for (const node of tree?.children ?? []) {
      count();
      switch (node.localName) {
        case "sp":
        case "cxnSp": {
          const item = readShape(node, context, transform);
          if (item) out.push(item);
          break;
        }
        case "pic": {
          const item = await readPictureShape(node, context, transform);
          if (item) out.push(item);
          break;
        }
        case "graphicFrame": {
          const item = readTable(node, context, transform);
          if (item) out.push(item);
          break;
        }
        case "grpSp": {
          const xfrm = child(node, "grpSpPr", "xfrm");
          const box = readBox(xfrm);
          const from = child(xfrm, "chOff");
          const span = child(xfrm, "chExt");
          const sx = box && num(span, "cx") ? box.width / num(span, "cx")! : 1;
          const sy = box && num(span, "cy") ? box.height / num(span, "cy")! : 1;
          const inner = box
            ? {
                dx: transform.dx + transform.sx * (box.x - (num(from, "x") ?? 0) * sx),
                dy: transform.dy + transform.sy * (box.y - (num(from, "y") ?? 0) * sy),
                sx: transform.sx * sx,
                sy: transform.sy * sy,
              }
            : transform;
          await readTree(node, context, inner, depth + 1, out);
          break;
        }
        // Something newer with an older stand-in (an equation drawn as a picture): the stand-in.
        case "AlternateContent":
          await readTree(child(node, "Fallback"), context, transform, depth + 1, out);
          break;
      }
    }
  }

  /** A shape, a text box or a line, with what its placeholder on the layout and master gives it. */
  function readShape(sp: Element, context: Context, transform: Transform): Item | null {
    const ph = child(sp, "nvSpPr", "nvPr", "ph") ?? child(sp, "nvCxnSpPr", "nvPr", "ph");
    if (ph && context.ownOnly) return null;
    const inherited = ph ? placeholderChain(ph, context) : [];
    const spPr = child(sp, "spPr");
    const box = readBox(child(spPr, "xfrm") ?? placeOf(inherited));
    if (!box) return null;
    const style = child(sp, "style");
    const geometry = child(spPr, "prstGeom")?.getAttribute("prst") ?? "rect";
    const outline = readOutline(spPr, style, context);
    const placed = moved(box, transform);
    const xfrm = child(spPr, "xfrm");
    const flip = { x: flag(xfrm, "flipH"), y: flag(xfrm, "flipV") };
    if (sp.localName === "cxnSp" || geometry === "line" || geometry.startsWith("straightConnector")) {
      if (!outline) return null;
      // From corner to corner (the other two when flipped), turned about its middle.
      const [cx, cy] = [placed.x + placed.width / 2, placed.y + placed.height / 2];
      const [dx, dy] = [(flip.x ? -1 : 1) * (placed.width / 2), (flip.y ? -1 : 1) * (placed.height / 2)];
      const [cos, sin] = [Math.cos((placed.rotation * Math.PI) / 180), Math.sin((placed.rotation * Math.PI) / 180)];
      const end = (sign: number) => ({ x: cx + sign * (dx * cos - dy * sin), y: cy + sign * (dx * sin + dy * cos) });
      return { kind: "line", from: end(-1), to: end(1), stroke: outline };
    }
    let fill = readPaint(spPr, context.color);
    // A flipped shape's gradient flips with it.
    if (typeof fill === "object" && fill && (flip.x || flip.y)) {
      const angle = flip.x ? 180 - fill.angle : fill.angle;
      fill = { ...fill, angle: (((flip.y ? -angle : angle) % 360) + 360) % 360 };
    }
    if (fill === undefined) {
      const ref = child(style, "fillRef");
      fill = (num(ref, "idx") ?? 0) > 0 ? readColor(ref, context.color) : null;
    }
    const type = ph ? placeholderType(ph, inherited) : null;
    const text = readText(child(sp, "txBody"), context, inherited, type, readColor(child(style, "fontRef"), context.color));
    if (!fill && !outline && !text) return null;
    const custom = child(spPr, "custGeom");
    const paths = custom ? readFreeform(custom, box, placed, flip) : [];
    const shape = paths.length ? "freeform" : geometry === "ellipse" || geometry === "roundRect" ? geometry : "rect";
    // Only a plain number for the corner (PowerPoint's own is a sixth of the shorter side).
    const adjust = /^val (\d+)$/.exec(child(spPr, "prstGeom", "avLst", "gd")?.getAttribute("fmla") ?? "")?.[1];
    const corner = Math.min(adjust ? Number(adjust) / 100000 : 16667 / 100000, 0.5);
    return { kind: "shape", box: placed, geometry: shape, paths, corner: shape === "roundRect" ? corner : 0, fill, outline, text };
  }

  /**
   * A freeform shape's paths, mapped from each one's own space onto the shape's
   * box. Only plain numbers are read: a path that uses the shape's formulas
   * (guides) is left out, as is one that comes out as no number.
   */
  function readFreeform(custGeom: Element, own: Box, placed: Box, flip: { x: boolean; y: boolean }): FreeformPath[] {
    const paths: FreeformPath[] = [];
    for (const path of children(child(custGeom, "pathLst"), "path")) {
      count();
      // A path without its own size is in the shape's.
      const [width, height] = [num(path, "w") || own.width || 1, num(path, "h") || own.height || 1];
      const d = pathData(path, { width, height, sx: placed.width / width, sy: placed.height / height, flip });
      const stroke = path.getAttribute("stroke");
      if (d) paths.push({ d, fill: path.getAttribute("fill") !== "none", stroke: stroke !== "0" && stroke !== "false" });
    }
    return paths;
  }

  /** A path's commands as SVG path data, from its own space (`width` by `height`, mirrored as the shape is) scaled by sx and sy; null when it uses anything but numbers. */
  function pathData(
    path: Element,
    { width, height, sx, sy, flip }: { width: number; height: number; sx: number; sy: number; flip: { x: boolean; y: boolean } },
  ): string | null {
    const out: string[] = [];
    // Where the pen is, and where the outline it's drawing began, in the path's own space.
    let [x, y] = [0, 0];
    let [startX, startY] = [0, 0];
    const at = (px: number, py: number) => `${Math.round((flip.x ? width - px : px) * sx)} ${Math.round((flip.y ? height - py : py) * sy)}`;
    for (const command of path.children) {
      count();
      const points = children(command, "pt").map((pt) => [num(pt, "x"), num(pt, "y")]);
      if (points.some(([px, py]) => px === null || py === null)) return null;
      const pts = points as [number, number][];
      const needs = { moveTo: 1, lnTo: 1, cubicBezTo: 3, quadBezTo: 2 }[command.localName as "moveTo"] ?? 0;
      if (pts.length < needs) return null;
      // A path that doesn't start by moving starts from its corner.
      if (!out.length && command.localName !== "moveTo") out.push(`M${at(0, 0)}`);
      switch (command.localName) {
        case "moveTo":
          [x, y] = [startX, startY] = pts[0];
          out.push(`M${at(x, y)}`);
          break;
        case "lnTo":
          [x, y] = pts[0];
          out.push(`L${at(x, y)}`);
          break;
        case "cubicBezTo":
          [x, y] = pts[2];
          out.push(
            `C${pts
              .slice(0, 3)
              .map(([px, py]) => at(px, py))
              .join(" ")}`,
          );
          break;
        case "quadBezTo":
          [x, y] = pts[1];
          out.push(
            `Q${pts
              .slice(0, 2)
              .map(([px, py]) => at(px, py))
              .join(" ")}`,
          );
          break;
        case "close":
          [x, y] = [startX, startY];
          out.push("Z");
          break;
        case "arcTo": {
          const [wR, hR, stAng, swAng] = ["wR", "hR", "stAng", "swAng"].map((name) => num(command, name));
          if (wR === null || hR === null || stAng === null || swAng === null) return null;
          const [rx, ry] = [Math.abs(wR), Math.abs(hR)];
          // The angles are where on the ellipse it is as seen from its centre; drawing needs the ellipse's own (parametric) angle.
          const own = (degrees: number) => Math.atan2(rx * Math.sin((degrees * Math.PI) / 180), ry * Math.cos((degrees * Math.PI) / 180));
          const [start, sweep] = [stAng / 60000, swAng / 60000];
          const from = own(start);
          let turn = own(start + sweep) - from;
          // Keep its direction and size: a whole turn stays one, a sweep one way never goes the other.
          if (Math.abs(sweep) >= 360) turn = Math.sign(sweep) * 2 * Math.PI;
          else if (sweep > 0 && turn <= 0) turn += 2 * Math.PI;
          else if (sweep < 0 && turn >= 0) turn -= 2 * Math.PI;
          else if (sweep === 0) turn = 0;
          const [cx, cy] = [x - rx * Math.cos(from), y - ry * Math.sin(from)];
          const point = (angle: number) => [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)] as const;
          // In two halves, so a whole circle draws too (an SVG arc can't end where it starts).
          for (const angle of [from + turn / 2, from + turn]) {
            [x, y] = point(angle);
            // Mirrored once, it turns the other way.
            out.push(`A${Math.round(rx * sx)} ${Math.round(ry * sy)} 0 0 ${turn > 0 !== (flip.x !== flip.y) ? 1 : 0} ${at(x, y)}`);
          }
          break;
        }
      }
    }
    const d = out.join("");
    return out.length && !/NaN|Infinity/.test(d) ? d : null;
  }

  async function readPictureShape(pic: Element, context: Context, transform: Transform): Promise<Item | null> {
    const ph = child(pic, "nvPicPr", "nvPr", "ph");
    if (ph && context.ownOnly) return null;
    const xfrm = child(pic, "spPr", "xfrm");
    const box = readBox(xfrm ?? placeOf(ph ? placeholderChain(ph, context) : []));
    const blipFill = child(pic, "blipFill");
    const path = context.part.relations.get(relationId(child(blipFill, "blip"), "embed") ?? "")?.path;
    const url = box && path ? await picture(path) : null;
    if (!box || !url) return null;
    const rect = child(blipFill, "srcRect");
    const share = (name: string) => Math.min(Math.max((num(rect, name) ?? 0) / 100000, -1), 0.99);
    const crop: [number, number, number, number] = [share("l"), share("t"), share("r"), share("b")];
    if (crop[0] + crop[2] >= 0.99 || crop[1] + crop[3] >= 0.99) return null;
    return { kind: "picture", box: moved(box, transform), url, crop, flip: { x: flag(xfrm, "flipH"), y: flag(xfrm, "flipV") } };
  }

  /** A table's cells as text; any other frame (a chart, SmartArt, an embedded file) isn't drawn. */
  function readTable(frame: Element, context: Context, transform: Transform): Item | null {
    const table = child(frame, "graphic", "graphicData", "tbl");
    const box = readBox(child(frame, "xfrm"));
    if (!table || !box) return null;
    // Every row, column and cell counts, empty ones too: a table of millions of empty rows is no table to draw.
    const grid = children(child(table, "tblGrid"), "gridCol");
    count(grid.length);
    const columns = grid.map((c) => Math.max(0, num(c, "w") ?? 0));
    const sized = all(table, "rPr").find((r) => r.hasAttribute("sz")) ?? null;
    const rows: TableRow[] = children(table, "tr").map((tr) => {
      const cells = children(tr, "tc");
      count(1 + cells.length);
      return {
        height: Math.max(0, num(tr, "h") ?? 0),
        cells: cells
          .filter((tc) => !flag(tc, "hMerge") && !flag(tc, "vMerge"))
          .map((tc) => {
            const paragraphs = children(child(tc, "txBody"), "p");
            count(paragraphs.length);
            const fill = readFill(child(tc, "tcPr"), context.color);
            return {
              text: paragraphs
                .map((p) =>
                  all(p, "t")
                    .map((t) => t.textContent ?? "")
                    .join(""),
                )
                .join("\n"),
              columns: Math.min(Math.max(1, num(tc, "gridSpan") ?? 1), 1000),
              rows: Math.min(Math.max(1, num(tc, "rowSpan") ?? 1), 1000),
              fill: fill ?? null,
            };
          }),
      };
    });
    const header = flag(child(table, "tblPr"), "firstRow");
    return { kind: "table", box: moved(box, transform), columns, rows, size: (num(sized, "sz") ?? DEFAULT_SIZE * 100) / 100, header };
  }

  /** A box's paragraphs, each with its style taken from the paragraph, then the shape, its placeholders, the master's text styles and the presentation's. */
  function readText(txBody: Element | null, context: Context, inherited: Element[], type: string | null, shapeColor: string | null): TextBody | null {
    if (!txBody) return null;
    const bodies = [child(txBody, "bodyPr"), ...inherited.map((p) => child(p, "txBody", "bodyPr"))];
    const body = (name: string) => bodies.find((b) => b?.hasAttribute(name))?.getAttribute(name) ?? null;
    const fit = child(bodies[0], "normAutofit");
    const fontScale = (num(fit, "fontScale") ?? 100000) / 100000;
    const lineReduction = (num(fit, "lnSpcReduction") ?? 0) / 100000;
    const styles = context.master?.styles;
    const masterStyle = type === "title" ? styles?.title : type && !["dt", "ftr", "sldNum", "hdr"].includes(type) ? styles?.body : styles?.other;
    const lists = [child(txBody, "lstStyle"), ...inherited.map((p) => child(p, "txBody", "lstStyle")), masterStyle ?? null, context.defaults];
    const numbering: number[] = [];

    const paragraphs: Paragraph[] = [];
    for (const p of children(txBody, "p")) {
      count();
      const pPr = child(p, "pPr");
      const level = Math.min(Math.max(num(pPr, "lvl") ?? 0, 0), 8);
      const levels = lists.map((list) => child(list, `lvl${level + 1}pPr`));
      const chain = [pPr, ...levels].filter((e): e is Element => e !== null);
      const attribute = (name: string) => chain.find((e) => e.hasAttribute(name)) ?? null;
      const spacing = (name: string, size: number) => {
        const found = chain.map((e) => child(e, name)).find(Boolean);
        const points = num(child(found, "spcPts"), "val");
        return points !== null ? points / 100 : ((num(child(found, "spcPct"), "val") ?? 0) / 100000) * size;
      };
      const runDefaults = levels.map((e) => child(e, "defRPr"));
      const runStyle = (rPr: Element | null): Omit<Run, "text" | "link"> => {
        const own = [rPr, runDefaults[0]];
        const rest = runDefaults.slice(1);
        const pick = (name: string) => [...own, ...rest].find((e) => e?.hasAttribute(name))?.getAttribute(name) ?? null;
        const filled = (list: (Element | null)[]) => list.map((e) => readFill(e, context.color)).find((c) => c !== undefined);
        const typeface = [...own, ...rest].map((e) => child(e, "latin")?.getAttribute("typeface")).find(Boolean) ?? null;
        const font = typeface === "+mj-lt" ? context.master?.theme.fonts.major : typeface === "+mn-lt" ? context.master?.theme.fonts.minor : typeface;
        const size = ((num([...own, ...rest].find((e) => e?.hasAttribute("sz")) ?? null, "sz") ?? DEFAULT_SIZE * 100) / 100) * fontScale;
        return {
          size: Math.min(Math.max(size, 1), 4000),
          bold: pick("b") === "1" || pick("b") === "true",
          italic: pick("i") === "1" || pick("i") === "true",
          underline: (pick("u") ?? "none") !== "none",
          strike: (pick("strike") ?? "noStrike") !== "noStrike",
          caps: pick("cap") === "all",
          color: filled(own) ?? shapeColor ?? filled(rest) ?? context.color("tx1"),
          font: font && FONT_NAME.test(font) ? font : null,
        };
      };

      const runs: Run[] = [];
      // A bullet takes its text's colour, not a link's.
      let textColor: string | null | undefined;
      for (const node of p.children) {
        if (node.localName !== "r" && node.localName !== "br" && node.localName !== "fld") continue;
        count();
        const rPr = child(node, "rPr");
        const target = context.part.relations.get(relationId(child(rPr, "hlinkClick"), "id") ?? "");
        const link = target && !target.path && isWebLink(target.target) ? target.target : null;
        const style = runStyle(rPr);
        const text = node.localName === "br" ? "\n" : (child(node, "t")?.textContent ?? "");
        if (!text) continue;
        textColor ??= style.color;
        runs.push({ ...style, text, link, ...(link ? { underline: true, color: context.color("hlink") ?? style.color } : {}) });
      }
      const size = runs[0]?.size ?? runStyle(child(p, "endParaRPr")).size;

      const marker = chain.map((e) => [...e.children].find((c) => ["buNone", "buChar", "buAutoNum", "buBlip"].includes(c.localName))).find(Boolean);
      const hasText = runs.some((r) => r.text.trim());
      // A numbered list counts on while its paragraphs stay numbered; a paragraph further out starts the ones further in again.
      numbering.length = level + 1;
      if (marker?.localName !== "buAutoNum") numbering[level] = 0;
      let bullet: Paragraph["bullet"] = null;
      if (marker && marker.localName !== "buNone" && hasText) {
        const font = chain.map((e) => child(e, "buFont")?.getAttribute("typeface")).find(Boolean) ?? "";
        const char = marker.getAttribute("char") ?? "•";
        let text = /wingdings|symbol/i.test(font) ? (SYMBOL_BULLETS[char] ?? "•") : char.slice(0, 2);
        if (marker.localName === "buAutoNum") {
          numbering[level] = (numbering[level] || (num(marker, "startAt") ?? 1) - 1) + 1;
          text = autoNumber(numbering[level], marker.getAttribute("type") ?? "arabicPeriod");
        } else if (marker.localName === "buBlip") text = "•";
        const colorOf = chain.map((e) => child(e, "buClr")).find(Boolean);
        const sizeOf = chain.map((e) => num(child(e, "buSzPct"), "val")).find((v) => v !== null);
        bullet = { text, color: (colorOf && readColor(colorOf, context.color)) ?? textColor ?? null, size: size * ((sizeOf ?? 100000) / 100000) };
      }

      // Line spacing as a share of single spacing, or exactly so many points.
      const lines = chain.map((e) => child(e, "lnSpc")).find(Boolean);
      const [percent, points] = [num(child(lines, "spcPct"), "val"), num(child(lines, "spcPts"), "val")];
      const lineSpacing = percent !== null ? percent / 100000 : points !== null ? points / 100 / SINGLE_LINE / size : 1;
      const align = attribute("algn")?.getAttribute("algn");
      paragraphs.push({
        align: align === "ctr" ? "center" : align === "r" ? "right" : align === "just" || align === "dist" ? "justify" : "left",
        level,
        margin: num(attribute("marL"), "marL") ?? 0,
        indent: num(attribute("indent"), "indent") ?? 0,
        bullet,
        lineSpacing: Math.max(lineSpacing - lineReduction, 0.5),
        spaceBefore: spacing("spcBef", size),
        spaceAfter: spacing("spcAft", size),
        size,
        runs,
      });
    }
    if (!paragraphs.some((p) => p.runs.some((r) => r.text.trim()))) return null;
    const anchor = body("anchor");
    const inset = DEFAULT_INSET.map((fallback, i) => {
      const value = Number(body(["lIns", "tIns", "rIns", "bIns"][i]) ?? fallback);
      return Number.isFinite(value) && value >= 0 ? value : fallback;
    }) as TextBody["inset"];
    return { anchor: anchor === "ctr" ? "middle" : anchor === "b" ? "bottom" : "top", inset, wrap: body("wrap") !== "none", paragraphs };
  }

  /** A slide's background: a colour or a picture (from the part it's set in). */
  async function readBackground(bg: Element, part: Part, color: Context["color"]): Promise<Slide["background"]> {
    const properties = child(bg, "bgPr");
    const blip = child(properties, "blipFill", "blip");
    if (blip) {
      const path = part.relations.get(relationId(blip, "embed") ?? "")?.path;
      const url = path ? await picture(path) : null;
      return url ? { picture: url } : null;
    }
    const found = properties ? readPaint(properties, color) : readColor(child(bg, "bgRef"), color);
    return typeof found === "string" ? { color: found } : found ? { gradient: found } : null;
  }

  /** A shape's outline: its own, else the one its style refers to in the theme. */
  function readOutline(spPr: Element | null, style: Element | null, context: Context): Stroke | null {
    const ln = child(spPr, "ln");
    const own = ln ? readFill(ln, context.color) : undefined;
    if (own === null) return null;
    const ref = child(style, "lnRef");
    const index = num(ref, "idx") ?? 0;
    const color = own ?? (index > 0 ? readColor(ref, context.color) : null);
    if (!color) return null;
    const width = num(ln, "w") ?? context.master?.theme.lines[index - 1] ?? 9525;
    return { color, width: Math.min(Math.max(width, 0), 2_000_000) };
  }

  const presentation = await read("ppt/presentation.xml", "presentation");
  if (!presentation) throw new Error("Not a presentation");
  const size = child(presentation.root, "sldSz");
  const width = num(size, "cx") ?? 9144000;
  const height = num(size, "cy") ?? 6858000;
  if (!(width > 0 && height > 0 && width < 1e9 && height < 1e9)) throw new Error("Not a slide size");
  const ids = children(child(presentation.root, "sldIdLst"), "sldId");
  if (ids.length > MAX_SLIDES) throw new Error("Too many slides to show");
  const defaults = child(presentation.root, "defaultTextStyle");

  const slides: Slide[] = [];
  for (const id of ids) {
    const path = presentation.relations.get(relationId(id, "id") ?? "")?.path;
    const part = path ? await read(path, "sld") : null;
    if (!part || part.root.getAttribute("show") === "0" || part.root.getAttribute("show") === "false") continue;
    const layoutPath = [...part.relations.values()].find((r) => r.type.endsWith("/slideLayout"))?.path;
    const behind = layoutPath ? await layout(layoutPath) : null;
    const color = colorScheme(behind?.master ?? null, [behind?.part.root, part.root]);
    const context = (at: Part, ownOnly: boolean): Context => ({ part: at, layout: behind, master: behind?.master ?? null, color, defaults, ownOnly });

    const items: Item[] = [];
    const showLayout = part.root.getAttribute("showMasterSp") !== "0";
    const showMaster = showLayout && behind?.part.root.getAttribute("showMasterSp") !== "0";
    const place = { dx: 0, dy: 0, sx: 1, sy: 1 };
    if (behind && showMaster) await readTree(child(behind.master.part.root, "cSld", "spTree"), context(behind.master.part, true), place, 0, items);
    if (behind && showLayout) await readTree(child(behind.part.root, "cSld", "spTree"), context(behind.part, true), place, 0, items);
    await readTree(child(part.root, "cSld", "spTree"), context(part, false), place, 0, items);

    let background: Slide["background"] = null;
    for (const at of [part, behind?.part, behind?.master.part]) {
      const bg = at && child(at.root, "cSld", "bg");
      if (bg) {
        background = await readBackground(bg, at, color);
        break;
      }
    }
    slides.push({ background, items });
  }
  if (!slides.length) throw new Error("No slide to show");
  return { width, height, slides };
}

async function readPart(zip: JSZip, path: string): Promise<Part | null> {
  const file = zip.file(path);
  if (!file) return null;
  const doc = parse(await file.async("string"));
  if (doc.getElementsByTagName("parsererror").length) return null;
  const relations = new Map<string, Relation>();
  const slash = path.lastIndexOf("/") + 1;
  const rels = zip.file(`${path.slice(0, slash)}_rels/${path.slice(slash)}.rels`);
  if (rels)
    for (const r of all(parse(await rels.async("string")), "Relationship")) {
      const target = r.getAttribute("Target") ?? "";
      const external = r.getAttribute("TargetMode") === "External";
      relations.set(r.getAttribute("Id") ?? "", { type: r.getAttribute("Type") ?? "", path: external ? null : resolve(path, target), target });
    }
  return { path, root: doc.documentElement, relations };
}

/** A picture as a data: address, when its bytes are a PNG, JPEG, GIF or WebP no bigger than MAX_PICTURE; null for any other (EMF, WMF, SVG, TIFF). */
async function readPicture(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  if (!file) return null;
  const bytes = await file.async("uint8array");
  const type = bytes.length <= MAX_PICTURE ? pictureType(bytes) : null;
  if (!type) return null;
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** What a picture is by its first bytes: only formats a page shows without running anything. */
function pictureType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}

function readTheme(part: Part | null): Theme {
  const colors = new Map<string, string>();
  const root = part?.root;
  for (const entry of (root && all(root, "clrScheme")[0]?.children) ?? []) {
    const value = entry.firstElementChild;
    const hex = value?.localName === "sysClr" ? value.getAttribute("lastClr") : value?.getAttribute("val");
    if (hex && HEX.test(hex)) colors.set(entry.localName, hex.toLowerCase());
  }
  const fonts = root ? all(root, "fontScheme")[0] : null;
  return {
    colors,
    fonts: {
      major: child(fonts, "majorFont", "latin")?.getAttribute("typeface") ?? null,
      minor: child(fonts, "minorFont", "latin")?.getAttribute("typeface") ?? null,
    },
    lines: root ? children(all(root, "lnStyleLst")[0], "ln").map((ln) => num(ln, "w") ?? 9525) : [],
  };
}

/** The theme's colours by name, as the master maps them (bg1 to lt1, tx1 to dk1), unless the layout or slide maps them otherwise. */
function colorScheme(master: Master | null, overrides: (Element | undefined)[]): (name: string) => string | null {
  let map = master?.colorMap ?? null;
  for (const root of overrides) map = child(root, "clrMapOvr", "overrideClrMapping") ?? map;
  return (name) => master?.theme.colors.get(map?.getAttribute(name) ?? name) ?? null;
}

/** A fill as it's drawn: a straight gradient as one, any other fill as its colour (see readFill). */
function readPaint(node: Element | null, color: (name: string) => string | null): Fill | null | undefined {
  const fill = [...(node?.children ?? [])].find((c) => ["noFill", "solidFill", "gradFill", "pattFill", "blipFill"].includes(c.localName));
  // One along a path (round, or from a corner) stays its first colour.
  if (fill?.localName === "gradFill" && !child(fill, "path")) {
    const read = children(child(fill, "gsLst"), "gs")
      .slice(0, MAX_STOPS_READ)
      .map((gs) => ({ color: readColor(gs, color), at: Math.min(Math.max((num(gs, "pos") ?? 0) / 100000, 0), 1) }))
      .filter((stop): stop is { color: string; at: number } => stop.color !== null)
      .sort((a, b) => a.at - b.at);
    // Many stops (LibreOffice writes a gradient as a hundred steps): some from all along it, the first and last kept.
    const step = Math.max(1, (read.length - 1) / (MAX_STOPS - 1));
    const stops = read.length > MAX_STOPS ? Array.from({ length: MAX_STOPS }, (_, i) => read[Math.round(i * step)]) : read;
    if (stops.length > 1) return { angle: ((((num(child(fill, "lin"), "ang") ?? 0) / 60000) % 360) + 360) % 360, stops };
  }
  return readFill(node, color);
}

/** A fill's colour: a solid one, the colour a gradient starts with, a pattern's; null for none, undefined when it isn't said. */
function readFill(node: Element | null, color: (name: string) => string | null): string | null | undefined {
  for (const fill of node?.children ?? [])
    switch (fill.localName) {
      case "noFill":
        return null;
      case "solidFill":
        return readColor(fill, color);
      case "gradFill":
        // The colour it starts with.
        return readColor(
          children(child(fill, "gsLst"), "gs").reduce<Element | null>(
            (first, gs) => (first && (num(first, "pos") ?? 0) <= (num(gs, "pos") ?? 0) ? first : gs),
            null,
          ),
          color,
        );
      case "pattFill":
        return readColor(child(fill, "fgClr"), color);
      case "blipFill":
        return null;
    }
  return undefined;
}

/** The colour in an element ("rrggbb"), changed as it says (lighter, darker); null when there's none, or it isn't one. */
function readColor(node: Element | null, color: (name: string) => string | null): string | null {
  const value = [...(node?.children ?? [])].find((c) => ["srgbClr", "schemeClr", "sysClr", "prstClr"].includes(c.localName));
  if (!value) return null;
  const name = value.getAttribute("val") ?? "";
  const hex =
    value.localName === "srgbClr"
      ? name
      : value.localName === "schemeClr"
        ? color(name)
        : value.localName === "sysClr"
          ? value.getAttribute("lastClr")
          : (PRESET_COLORS[name] ?? null);
  return hex && HEX.test(hex) ? adjusted(hex.toLowerCase(), value) : null;
}

/** A colour with its luminance, tint and shade changes applied. */
function adjusted(hex: string, value: Element): string {
  if (!value.children.length) return hex;
  let [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
  for (const change of value.children) {
    const amount = (num(change, "val") ?? 100000) / 100000;
    if (change.localName === "tint") [r, g, b] = [r, g, b].map((c) => 1 - (1 - c) * amount);
    else if (change.localName === "shade") [r, g, b] = [r, g, b].map((c) => c * amount);
    else if (change.localName === "lumMod" || change.localName === "lumOff") {
      const [h, s, l] = toHsl(r, g, b);
      [r, g, b] = toRgb(h, s, change.localName === "lumMod" ? l * amount : l + amount);
    }
  }
  return [r, g, b]
    .map((c) =>
      Math.round(Math.min(Math.max(c, 0), 1) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function toRgb(h: number, s: number, l: number): [number, number, number] {
  const light = Math.min(Math.max(l, 0), 1);
  if (s === 0) return [light, light, light];
  const q = light < 0.5 ? light * (1 + s) : light + s - light * s;
  const p = 2 * light - q;
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    return u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

/** Where a shape sits, from its xfrm; null when it doesn't say. */
function readBox(xfrm: Element | null): Box | null {
  const off = child(xfrm, "off");
  const ext = child(xfrm, "ext");
  const [x, y, width, height] = [num(off, "x"), num(off, "y"), num(ext, "cx"), num(ext, "cy")];
  if (x === null || y === null || width === null || height === null) return null;
  return { x, y, width: Math.max(width, 0), height: Math.max(height, 0), rotation: (num(xfrm, "rot") ?? 0) / 60000 };
}

const moved = (box: Box, t: Transform): Box => ({ ...box, x: t.dx + t.sx * box.x, y: t.dy + t.sy * box.y, width: t.sx * box.width, height: t.sy * box.height });

/** Where the first of these placeholders that says sits. */
const placeOf = (placeholders: Element[]) => placeholders.map((p) => child(p, "spPr", "xfrm")).find(Boolean) ?? null;

/** A layout's or master's placeholders. */
const placeholdersOf = (root: Element) => children(child(root, "cSld", "spTree"), "sp").filter((sp) => child(sp, "nvSpPr", "nvPr", "ph"));

/** A placeholder's kind as its master knows it: a centred title is a title; a subtitle, content or one without a kind is body text. */
const masterType = (type: string) => (type === "ctrTitle" ? "title" : ["title", "body", "dt", "ftr", "sldNum", "hdr"].includes(type) ? type : "body");

/** The placeholders a slide's placeholder takes after: the layout's (by number, else by kind), then the master's (by kind). */
function placeholderChain(ph: Element, context: Context): Element[] {
  const type = ph.getAttribute("type") ?? "obj";
  const idx = ph.getAttribute("idx");
  const kind = (sp: Element) => child(sp, "nvSpPr", "nvPr", "ph")?.getAttribute("type") ?? "obj";
  const onLayout =
    (idx !== null && context.layout?.placeholders.find((sp) => child(sp, "nvSpPr", "nvPr", "ph")?.getAttribute("idx") === idx)) ||
    context.layout?.placeholders.find((sp) => kind(sp) === type) ||
    context.layout?.placeholders.find((sp) => masterType(kind(sp)) === masterType(type) && type !== "obj");
  const wanted = masterType(onLayout ? kind(onLayout) : type);
  const onMaster = context.master?.placeholders.find((sp) => masterType(kind(sp)) === wanted);
  return [onLayout, onMaster].filter((sp): sp is Element => !!sp);
}

/** A placeholder's kind as its master knows it, from itself or the layout's it takes after. */
function placeholderType(ph: Element, inherited: Element[]): string {
  const own = ph.getAttribute("type");
  const layout = inherited[0] && child(inherited[0], "nvSpPr", "nvPr", "ph")?.getAttribute("type");
  return masterType(own ?? layout ?? "obj");
}

/** A numbered list's mark: 3 as "3.", "c)", "iii." and the like. */
function autoNumber(n: number, type: string): string {
  const roman = (value: number) => {
    let out = "";
    let left = Math.min(value, 3999);
    for (const [step, mark] of [
      [1000, "m"],
      [900, "cm"],
      [500, "d"],
      [400, "cd"],
      [100, "c"],
      [90, "xc"],
      [50, "l"],
      [40, "xl"],
      [10, "x"],
      [9, "ix"],
      [5, "v"],
      [4, "iv"],
      [1, "i"],
    ] as const)
      for (; left >= step; left -= step) out += mark;
    return out;
  };
  const letters = (value: number) => {
    let out = "";
    for (let v = Math.min(value, 18278); v > 0; v = Math.floor((v - 1) / 26)) out = String.fromCharCode(97 + ((v - 1) % 26)) + out;
    return out;
  };
  const value = type.startsWith("alphaLc")
    ? letters(n)
    : type.startsWith("alphaUc")
      ? letters(n).toUpperCase()
      : type.startsWith("romanLc")
        ? roman(n)
        : type.startsWith("romanUc")
          ? roman(n).toUpperCase()
          : String(n);
  return type.endsWith("ParenBoth") ? `(${value})` : type.endsWith("ParenR") ? `${value})` : type.endsWith("Plain") ? value : `${value}.`;
}
