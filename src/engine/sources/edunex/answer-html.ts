// The Student's written answer, cleaned before it goes to Edunex: only the
// plain formatting Edunex's own editor (CKEditor) writes for an answer
// (paragraphs, bold, italic, underline, strike, links, lists, quotes,
// headings, code) and no attribute but a link's address. Edunex shows answers
// to lecturers as they are, without cleaning them, so nothing else is sent.
import { load } from "cheerio";
import { htmlText } from "../../../core/course-materials";

const KEEP = new Set(["p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li", "blockquote", "h2", "h3", "h4", "code", "pre"]);
/** The same formatting under another name. */
const SAME: Record<string, string> = { b: "strong", i: "em", strike: "s", del: "s", h1: "h2", h5: "h4", h6: "h4" };
/** Gone with what's inside: none of it is text the Student wrote. */
const DROP = "script, style, template, noscript, iframe, object, embed, svg, math, img, picture, video, audio, canvas, input, button, select, textarea";
const LINK = /^(https?:\/\/|mailto:)/i;
/** Blocks Edunex's editor doesn't write: one holding only text becomes a paragraph, so words never run together. */
const BLOCK = new Set([
  "div",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "aside",
  "nav",
  "address",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "dl",
  "dt",
  "dd",
  "center",
]);
const HOLDS_BLOCKS = "p, ul, ol, blockquote, h2, h3, h4, pre";

export function cleanAnswer(html: string): string {
  const $ = load(html, null, false);
  $(DROP).remove();
  // Innermost first, so unwrapping an element never skips its children.
  for (const element of $("*").toArray().reverse()) {
    if (!("attribs" in element)) continue;
    const tag = SAME[element.tagName.toLowerCase()] ?? element.tagName.toLowerCase();
    const node = $(element);
    const href = tag === "a" ? (node.attr("href") ?? "").trim() : "";
    if (BLOCK.has(tag) && !node.find(HOLDS_BLOCKS).length) {
      node.replaceWith($("<p>").append(node.contents()));
      continue;
    }
    if (!KEEP.has(tag) || (tag === "a" && !LINK.test(href))) {
      node.replaceWith(node.contents());
      continue;
    }
    element.tagName = tag;
    for (const name of Object.keys(element.attribs)) node.removeAttr(name);
    if (tag === "a") node.attr("href", href);
  }
  // A list item holding one paragraph is written without it, as CKEditor writes lists.
  $("li").each((_, item) => {
    const only = $(item).children();
    if (only.length === 1 && only.is("p") && $(item).contents().length === 1) only.replaceWith(only.contents());
  });
  // Empty paragraphs are only spacing; Edunex's reader drops them too.
  $("p").each((_, paragraph) => {
    const node = $(paragraph);
    if (!node.text().replace(/ /g, " ").trim() && node.find("br").length === node.children().length) node.remove();
  });
  return ($.root().html() ?? "").trim();
}

/** The words of an answer, without its formatting: what Edunex requires before it saves one. */
export const answerWords = (html: string) => htmlText(html).replace(/\s+/g, " ").trim();
