// The Student's written answer on screen: whether the app's writing box can
// hold an answer written on Edunex's website without losing anything (its
// pictures, tables, formulas, colours, sizes, alignment), and whether the
// Student changed the text, compared the way Edunex's editor writes it.

/** What the writing box holds, and sends back, as it is: the plain formatting of Edunex's editor. */
const HELD = new Set(["p", "br", "strong", "b", "em", "i", "u", "s", "strike", "del", "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "code", "pre"]);
/** Where pasted black text sits inside ordinary text, so losing the colour only makes it match. */
const PLAIN = new Set(["p", "li", "ul", "ol", "span", "strong", "b", "em", "i", "u", "s", "strike", "del"]);
const LINK = /^(https?:\/\/|mailto:)/i;
const BLACK = /^(black|#000|#000000|rgb\(0,0,0\))$/;
/** The same formatting under another name. */
const SAME: Record<string, string> = { b: "strong", i: "em", strike: "s", del: "s" };
const BLOCK = new Set(["p", "li", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "pre", "div"]);

/** Whether the writing box can edit this answer and keep everything a reader sees in it. */
export function editableInApp(html: string): boolean {
  return [...new DOMParser().parseFromString(html, "text/html").body.querySelectorAll("*")].every(kept);
}

/** A tag the box holds (or a span it can drop unseen), with nothing on it the box would drop that shows. */
function kept(element: Element): boolean {
  const tag = element.tagName.toLowerCase();
  if (!HELD.has(tag) && tag !== "span") return false;
  return [...element.attributes].every(({ name, value }) => {
    if (tag === "a") return name === "href" ? LINK.test(value.trim()) : name === "target" || name === "rel";
    if (tag === "code" && name === "class") return /^language-[\w-]+$/.test(value) && element.parentElement?.tagName === "PRE";
    return name === "style" && unseen(element, value);
  });
}

/**
 * Styles pasting from a document leaves on Edunex ("background-color:transparent;color:#000000").
 * A transparent background shows nothing. Black is a shade darker than Edunex's grey text (and
 * nearly vanishes in its dark theme), so dropping it on save only makes the pasted words match the
 * rest; locking the draft for it would make an ordinary pasted answer read-only.
 */
function unseen(element: Element, style: string): boolean {
  return style.split(";").every((declaration) => {
    const [property, value = ""] = declaration.split(":").map((part) => part.trim().toLowerCase());
    if (!property) return true;
    if (property === "background-color") return value === "transparent";
    if (property !== "color" || !BLACK.test(value.replace(/\s+/g, ""))) return false;
    for (let at: Element | null = element; at && at.tagName !== "BODY"; at = at.parentElement) if (!PLAIN.has(at.tagName.toLowerCase())) return false;
    return true;
  });
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
