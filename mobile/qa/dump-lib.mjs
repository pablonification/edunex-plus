// Reads a screen dump into one tree of nodes, for layout-read.mjs and targets-read.mjs. Two formats come in:
//
//   - Android's `uiautomator dump` (XML: `resource-id`, `text`, `content-desc`, `clickable`, `bounds`, `package`);
//   - Maestro's `maestro hierarchy` (JSON: the same, with `accessibilityText` for the content description and no
//     package). The conductor uses it when uiautomator can't dump a screen that never goes still.
//
// A node: { id, cls, pkg, text, desc, clickable, x1, y1, x2, y2, children, parent, system }. `id` is the React Native
// testID (the resource-id; `pkg:id/` prefixes are left on, the app's own testIDs have none). `system` marks the status
// bar, the navigation bar and other apps' overlays (Samsung's edge panel): nothing in them is the app's.
//
// Bounds in both formats are already cut to what shows: a row half under the tab bar reports only its visible half.
import fs from "node:fs";

/** The words a Student counts (words-now.mjs): letters or digits, with what holds a word together: . : , × % – - */
export const WORD = /[\p{L}\p{N}][\p{L}\p{N}.:,×%–-]*/gu;
export const wordsIn = (text) => (text.match(WORD) || []).length;

const decodeXml = (text) =>
  text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const BOUNDS = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/;
const SYSTEM_ID = /^(?:com\.android\.systemui|com\.samsung\.|com\.sec\.|com\.google\.android\.permissioncontroller)/;

function make(attrs, source) {
  const bounds = BOUNDS.exec(attrs.bounds ?? "");
  const [x1, y1, x2, y2] = bounds ? bounds.slice(1).map(Number) : [0, 0, 0, 0];
  const id = attrs["resource-id"] ?? "";
  return {
    id,
    cls: attrs.class ?? "",
    pkg: attrs.package ?? (id.includes(":id/") ? id.slice(0, id.indexOf(":id/")) : ""),
    text: source === "xml" ? decodeXml(attrs.text ?? "") : (attrs.text ?? ""),
    desc: source === "xml" ? decodeXml(attrs["content-desc"] ?? "") : (attrs.accessibilityText ?? ""),
    clickable: attrs.clickable === "true",
    x1,
    y1,
    x2,
    y2,
    children: [],
    parent: null,
    system: false,
  };
}

function parseXml(xml) {
  const root = { id: "", cls: "root", pkg: "", text: "", desc: "", clickable: false, x1: 0, y1: 0, x2: 0, y2: 0, children: [], parent: null, system: false };
  const stack = [root];
  for (const [, closing, body, selfClosing] of xml.matchAll(/<(\/?)node\b([^>]*?)(\/?)>/g)) {
    if (closing) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const attrs = {};
    for (const [, name, value] of body.matchAll(/([\w:.-]+)="([^"]*)"/g)) attrs[name] = value;
    const node = make(attrs, "xml");
    node.parent = stack[stack.length - 1];
    node.parent.children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root;
}

function parseMaestro(raw) {
  const walk = (item, parent) => {
    const node = make(item.attributes ?? {}, "json");
    node.parent = parent;
    for (const child of item.children ?? []) node.children.push(walk(child, node));
    return node;
  };
  return walk(JSON.parse(raw.slice(raw.indexOf("{"))), null);
}

/** Every node in document order (the root, a made-up wrapper, is left out). */
export function flatten(root) {
  const all = [];
  const walk = (node) => {
    for (const child of node.children) {
      all.push(child);
      walk(child);
    }
  };
  walk(root);
  return all;
}

/**
 * Reads a dump's text. `app` (a package name) says which package is the app's in an XML dump; without it the package of the
 * `tab.*` nodes is the app's, and with no tabs on screen every package but the system's is.
 * @returns {{ root: object, nodes: object[], width: number, height: number, format: "xml" | "maestro" }}
 */
export function readDump(raw, { app } = {}) {
  const format = raw.trimStart().startsWith("<") ? "xml" : "maestro";
  const root = format === "xml" ? parseXml(raw) : parseMaestro(raw);
  const nodes = flatten(root);
  const appPkg = app ?? nodes.find((node) => /^tab\./.test(node.id) && node.pkg)?.pkg ?? "";
  const mark = (node, inherited) => {
    node.system = inherited || SYSTEM_ID.test(node.id) || (format === "xml" && node.pkg !== "" && (appPkg ? node.pkg !== appPkg : SYSTEM_ID.test(node.pkg)));
    for (const child of node.children) mark(child, node.system);
  };
  for (const child of root.children) mark(child, false);
  const width = Math.max(0, ...nodes.map((node) => node.x2));
  const height = Math.max(0, ...nodes.map((node) => node.y2));
  return { root, nodes, width, height, format };
}

export function readDumpFile(file, options) {
  return readDump(fs.readFileSync(file, "utf8"), options);
}

export const widthOf = (node) => node.x2 - node.x1;
export const heightOf = (node) => node.y2 - node.y1;

/** The node and everything under it, in document order. */
export function within(node) {
  const all = [node];
  for (const child of node.children) all.push(...within(child));
  return all;
}

/** True when a node that can be tapped sits above this one (a Pressable around its own children). */
export function insideTap(node) {
  for (let up = node.parent; up; up = up.parent) if (up.clickable) return true;
  return false;
}

/** What a node says: its text, else its content description, else what its children say (their texts, in order). */
export function labelOf(node) {
  if (node.text.trim()) return node.text.replace(/\s+/g, " ").trim();
  if (node.desc.trim()) return node.desc.replace(/\s+/g, " ").trim();
  const parts = [];
  for (const child of node.children) {
    const part = labelOf(child);
    if (part) parts.push(part);
  }
  return parts.join(" ");
}

/** What TalkBack can read from a node: its own text or description, or a labelled child's. */
export const isLabelled = (node) => labelOf(node) !== "";

/** The share (0..1) of a node's box inside a rectangle. */
export function shareInside(node, rect) {
  const area = widthOf(node) * heightOf(node);
  if (area <= 0) return 0;
  const w = Math.min(node.x2, rect.x2) - Math.max(node.x1, rect.x1);
  const h = Math.min(node.y2, rect.y2) - Math.max(node.y1, rect.y1);
  return w > 0 && h > 0 ? (w * h) / area : 0;
}

/** A node as a person reads it in a list: "action.search "Cari" [692,109][818,235]". */
export function describe(node) {
  const label = labelOf(node);
  const where = `[${node.x1},${node.y1}][${node.x2},${node.y2}]`;
  return `${node.id || "(no id)"}${label ? ` "${label.length > 60 ? `${label.slice(0, 57)}...` : label}"` : ""} ${where}`;
}
