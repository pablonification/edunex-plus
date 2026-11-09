// A Task's instructions without their first line when that line is the Task's own name (round 3's final pair: the
// title sat in the bar and again as Instruksi's first lines). Lecturers often start with the name, sometimes with more
// after it ("Tugas 3: Analisis Pasar (individu)"): a first line that equals or starts with the name goes. Anything
// else stays as written.
import { type CheerioAPI, load } from "cheerio";
import { type AnyNode, isTag, isText } from "domhandler";

const BLOCK = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6"]);
const INLINE = new Set(["strong", "b", "em", "i", "u", "span"]);

/** Lower case, letters and digits only, one space between words. */
const words = (text: string) =>
  text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const textOf = (node: AnyNode): string => (isText(node) ? node.data : isTag(node) ? node.children.map(textOf).join("") : "");
const blank = (node: AnyNode) => (isText(node) && !node.data.trim()) || (isTag(node) && node.name === "br");

/** The nodes of a first line: up to the first <br>, or the first block (in which, up to its first <br>). */
function firstLine(nodes: readonly AnyNode[]): { line: AnyNode[]; br: AnyNode | null } {
  const line: AnyNode[] = [];
  for (const node of nodes) {
    if (isTag(node) && node.name === "br") return { line, br: node };
    if (isTag(node) && !INLINE.has(node.name)) break;
    line.push(node);
  }
  return { line, br: null };
}

function same(text: string, title: string): boolean {
  const line = words(text);
  const name = words(title);
  return name.length > 0 && line.length > 0 && (line === name || line.startsWith(`${name} `));
}

export function withoutTitleLine(html: string, title: string): string {
  if (!html || !words(title)) return html;
  const $: CheerioAPI = load(html);
  const body = $("body")[0];
  if (!body || !isTag(body)) return html;
  const kids = body.children.filter((node) => !blank(node));
  const first = kids[0];
  if (!first) return html;
  if (isTag(first) && BLOCK.has(first.name)) {
    const inner = first.children.filter((node) => !(isText(node) && !node.data.trim()));
    const { line, br } = firstLine(inner);
    if (br && same(line.map(textOf).join(""), title)) {
      for (const node of [...line, br]) $(node).remove();
    } else if (same(textOf(first), title)) {
      $(first).remove();
    } else return html;
  } else {
    const { line, br } = firstLine(body.children);
    if (!same(line.map(textOf).join(""), title)) return html;
    for (const node of br ? [...line, br] : line) $(node).remove();
  }
  // Nothing written after the name: keep it as it was, so "Tidak ada instruksi" never replaces a lecturer's line.
  const left = $("body").html() ?? "";
  return words(textOf(body)) ? left : html;
}
