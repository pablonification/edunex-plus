// Edunex's HTML on the phone, which has no DOMParser: parsed with cheerio (parse5, the browser's
// own rules) instead. `plainText` is src/app/ui/rich-text.tsx's; `answerShape` and
// `editableInApp` are src/app/answer-html.ts's, the same rules on the same tree. The rest is the
// phone's answer box: a plain multi-line text box, which can hold an answer only while it's plain
// paragraphs, and writes what's typed back as Edunex's editor writes plain paragraphs.
import { load } from "cheerio";
import { type AnyNode, type Element, isTag, isText } from "domhandler";

/** The document's body, parsed as a browser would. */
export function parseBody(html: string): Element {
  const $ = load(html);
  return $("body")[0] as Element;
}

const textOf = (node: AnyNode): string => (isText(node) ? node.data : isTag(node) ? node.children.map(textOf).join("") : "");

/** The text alone, for "is there anything written" (src/app/ui/rich-text.tsx's plainText). */
export function plainText(html: string): string {
  if (!html) return "";
  return textOf(parseBody(html)).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------- src/app/answer-html.ts

const HELD = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "del", "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "code", "pre"]);
const PLAIN = new Set(["p", "li", "ul", "ol", "span", "strong", "b", "em", "i", "u", "s", "strike", "del"]);
const LINK = /^(https?:\/\/|mailto:)/i;
const BLACK = /^(black|#000|#000000|rgb\(0,0,0\))$/;
const SAME: Record<string, string> = { b: "strong", i: "em", strike: "s", del: "s" };
const BLOCK = new Set(["p", "li", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "div"]);

function elements(node: Element): Element[] {
  return node.children.filter(isTag).flatMap((child) => [child, ...elements(child)]);
}

const parentTag = (element: Element) => (element.parent && isTag(element.parent) ? element.parent.name.toLowerCase() : null);

/** Whether the desktop's writing box can edit this answer and keep everything a reader sees in it. */
export function editableInApp(html: string): boolean {
  return elements(parseBody(html)).every(kept);
}

function kept(element: Element): boolean {
  const tag = element.name.toLowerCase();
  if (!HELD.has(tag) && tag !== "span") return false;
  return Object.entries(element.attribs).every(([name, value]) => {
    if (tag === "a") return name === "href" ? LINK.test(value.trim()) : name === "target" || name === "rel";
    if (tag === "code" && name === "class") return /^language-[\w-]+$/.test(value) && parentTag(element) === "pre";
    return name === "style" && unseen(element, value);
  });
}

function unseen(element: Element, style: string): boolean {
  return style.split(";").every((declaration) => {
    const [property, value = ""] = declaration.split(":").map((part) => part.trim().toLowerCase());
    if (!property) return true;
    if (property === "background-color") return value === "transparent";
    if (property !== "color" || !BLACK.test(value.replace(/\s+/g, ""))) return false;
    for (let at: Element | null = element; at && at.name !== "body"; at = at.parent && isTag(at.parent) ? at.parent : null)
      if (!PLAIN.has(at.name.toLowerCase())) return false;
    return true;
  });
}

/** An answer reduced to what it says and how it's formatted: no attributes, no spacing, no empty paragraphs. */
export function answerShape(html: string): string {
  return shape(parseBody(html)).trim();
}

function shape(node: AnyNode): string {
  if (isText(node)) return node.data.replace(/[\s ]+/g, " ");
  if (!isTag(node)) return "";
  const tag = SAME[node.name.toLowerCase()] ?? node.name.toLowerCase();
  if (tag === "br") return "<br>";
  const inner = node.children.map(shape).join("");
  const body = BLOCK.has(tag) ? inner.trim() : inner;
  if (tag === "body") return body;
  if (tag === "p" && !body.replace(/<br>/g, "").trim()) return "";
  const parent = node.parent;
  if (tag === "p" && parent && isTag(parent) && parent.name.toLowerCase() === "li" && parent.children.length === 1) return body;
  const href = tag === "a" ? ` ${node.attribs.href ?? ""}` : "";
  return `<${tag}${href}>${body}</${tag}>`;
}

// ---------------------------------------------------------------- the phone's answer box

/**
 * Whether the phone's plain box can hold this answer without losing anything: paragraphs and line
 * breaks only (and the spans pasting leaves that show nothing). Bold, lists, links and the rest
 * stay as Edunex has them: changed on Edunex.
 */
export function boxEditable(html: string): boolean {
  if (!editableInApp(html)) return false;
  return elements(parseBody(html)).every((element) => {
    const tag = element.name.toLowerCase();
    return tag === "p" || tag === "br" || tag === "span";
  });
}

/** The answer as the box shows it: a blank line between paragraphs, a line break as a new line. */
export function boxText(html: string): string {
  const body = parseBody(html);
  const inline = (node: AnyNode): string =>
    isText(node) ? node.data.replace(/[\s ]+/g, " ") : isTag(node) ? (node.name === "br" ? "\n" : node.children.map(inline).join("")) : "";
  const paragraphs: string[] = [];
  let loose = "";
  for (const child of body.children) {
    if (isTag(child) && child.name === "p") {
      if (loose.trim()) paragraphs.push(loose);
      loose = "";
      paragraphs.push(inline(child));
    } else loose += inline(child);
  }
  if (loose.trim()) paragraphs.push(loose);
  return paragraphs
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n");
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** What's typed, as Edunex's editor writes plain text: a paragraph per blank-line block, a line break inside one. */
export function boxHtml(text: string): string {
  return text
    .split(/\n[ \t]*\n/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter((line, i, lines) => line || (i > 0 && i < lines.length - 1))
        .map(escapeHtml)
        .join("<br>"),
    )
    .filter((paragraph) => paragraph.replace(/<br>/g, "").trim())
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}
