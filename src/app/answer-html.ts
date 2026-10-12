// The Student's written answer on screen: whether the app's writing box can
// hold an answer written on Edunex's website without losing anything
// (pictures, tables and formulas it can't), and whether the Student changed
// the text, compared the way Edunex's editor writes it.

/** What the writing box would drop: pictures, tables, formulas, embeds. */
const LOSSY = "img, picture, figure, table, iframe, video, audio, object, embed, svg, math, canvas, sub, sup, .math-tex, script, oembed";
/** The same formatting under another name. */
const SAME: Record<string, string> = { b: "strong", i: "em", strike: "s", del: "s" };
const BLOCK = new Set(["p", "li", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "div"]);

/** Whether the writing box can edit this answer and keep everything in it. */
export function editableInApp(html: string): boolean {
  return !new DOMParser().parseFromString(html, "text/html").body.querySelector(LOSSY);
}

/** An answer reduced to what it says and how it's formatted: no attributes, no spacing, no empty paragraphs. */
export function answerShape(html: string): string {
  return shape(new DOMParser().parseFromString(html, "text/html").body).trim();
}

function shape(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/[\s ]+/g, " ");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as Element;
  const tag = SAME[element.tagName.toLowerCase()] ?? element.tagName.toLowerCase();
  if (tag === "br") return "<br>";
  const inner = [...element.childNodes].map(shape).join("");
  const body = BLOCK.has(tag) ? inner.trim() : inner;
  if (tag === "body") return body;
  if (tag === "p" && !body.replace(/<br>/g, "").trim()) return "";
  // A list item holding one paragraph is the same item without it.
  if (tag === "p" && element.parentElement?.tagName === "LI" && element.parentElement.childNodes.length === 1) return body;
  const href = tag === "a" ? ` ${element.getAttribute("href") ?? ""}` : "";
  return `<${tag}${href}>${body}</${tag}>`;
}
