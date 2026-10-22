// A Task's instructions as a reader sees their words, so two copies can be
// compared by what they say rather than by their markup: a <p> turned <div>,
// or a space turned &nbsp;, is no change. Blocks keep their line breaks and
// list items their bullets or numbers; links keep their address and pictures
// stand in by name (a swapped picture or a changed link is a change); scripts
// and styles are dropped. Edunex's HTML, read with cheerio (as answer-html.ts).
import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { normalText } from "../../../core/task-edits";

const BLOCKS = new Set([
  "p",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "blockquote",
  "pre",
  "figure",
  "figcaption",
  "table",
  "tr",
  "ul",
  "ol",
  "dl",
  "dt",
  "dd",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
]);
const DROP = "script, style, template, noscript";

/** A picture's stand-in: its alt text or file name, and where it comes from (an inline one by a short hash). */
function picture(element: Element): string {
  const src = element.attribs.src ?? "";
  const name = (element.attribs.alt ?? "").trim() || decodeURIComponent(src.split(/[?#]/)[0]?.split("/").pop() ?? "") || "gambar";
  const from = src.startsWith("data:") ? `data:${createHash("sha256").update(src).digest("hex").slice(0, 12)}` : src;
  return `[gambar: ${name}]${from ? ` (${from})` : ""}`;
}

export function instructionsText(html: string): string {
  if (!html.trim()) return "";
  const $ = load(html, null, false);
  $(DROP).remove();
  const out: string[] = [];
  const line = () => {
    if (out.length && out[out.length - 1] !== "\n") out.push("\n");
  };
  const walk = (nodes: AnyNode[], list: { ordered: boolean; n: number } | null) => {
    for (const node of nodes) {
      if (node.type === "text") {
        out.push(("data" in node ? String(node.data) : "").replace(/\s+/g, " "));
        continue;
      }
      if (node.type !== "tag" && node.type !== "script" && node.type !== "style") continue;
      const element = node as Element;
      const tag = element.tagName.toLowerCase();
      if (tag === "br") {
        out.push("\n");
        continue;
      }
      if (tag === "img") {
        out.push(picture(element));
        continue;
      }
      if (tag === "li") {
        line();
        if (list) list.n += 1;
        out.push(list?.ordered ? `${list.n}. ` : "• ");
        walk(element.children, null);
        line();
        continue;
      }
      if (tag === "ul" || tag === "ol") {
        line();
        walk(element.children, { ordered: tag === "ol", n: 0 });
        line();
        continue;
      }
      if (tag === "a") {
        walk(element.children, list);
        const href = (element.attribs.href ?? "").trim();
        if (href && !$(element).text().includes(href)) out.push(` (${href})`);
        continue;
      }
      if (tag === "td" || tag === "th") {
        walk(element.children, list);
        out.push(" ");
        continue;
      }
      const block = BLOCKS.has(tag);
      if (block) line();
      walk(element.children, list);
      if (block) line();
    }
  };
  walk($.root().contents().toArray(), null);
  return normalText(out.join(""));
}
