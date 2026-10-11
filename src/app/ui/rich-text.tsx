// Lecturers' formatted text (Task instructions, text materials, announcements)
// shown safely: the HTML is parsed, and only plain formatting tags are
// rebuilt as React elements. No markup, script, style or event handler from
// EduNex ever reaches the page; links open in the browser through the bridge.
import { createElement, type ReactNode } from "react";
import { cx } from "./cx";

const BLOCK: Record<string, string> = {
  p: "my-2 first:mt-0 last:mb-0",
  div: "my-1 first:mt-0 last:mb-0",
  ul: "my-2 list-disc pl-5",
  ol: "my-2 list-decimal pl-5",
  li: "my-0.5",
  blockquote: "my-2 border-l-2 border-line pl-3 text-muted",
  pre: "my-2 overflow-x-auto rounded-lg bg-fill p-3 font-mono text-small whitespace-pre-wrap",
  table: "my-2 border-collapse text-small",
  thead: "",
  tbody: "",
  tr: "",
  td: "border border-line px-2 py-1 align-top",
  th: "border border-line px-2 py-1 text-left font-semibold",
};
const INLINE: Record<string, string> = {
  b: "font-semibold",
  strong: "font-semibold",
  i: "italic",
  em: "italic",
  u: "underline",
  s: "line-through",
  code: "rounded bg-fill px-1 font-mono text-small",
  span: "",
  sub: "",
  sup: "",
  small: "text-small",
};
const HEADING = /^h[1-6]$/;

export function RichText({ html, onOpenLink, className }: { html: string; onOpenLink: (url: string) => void; className?: string }) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return <div className={cx("text-body leading-relaxed break-words", className)}>{children(doc.body, onOpenLink, "r")}</div>;
}

/** The text alone, for previews and search. */
export function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

const STRUCTURAL = new Set(["table", "thead", "tbody", "tr", "ul", "ol"]);

function children(node: Node, open: (url: string) => void, key: string): ReactNode[] {
  // Whitespace between rows or list items isn't content.
  const structural = node.nodeType === Node.ELEMENT_NODE && STRUCTURAL.has((node as Element).tagName.toLowerCase());
  return [...node.childNodes]
    .filter((child) => !(structural && child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()))
    .map((child, index) => render(child, open, `${key}.${index}`));
}

function render(node: Node, open: (url: string) => void, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") return <br key={key} />;
  if (tag === "script" || tag === "style" || tag === "iframe" || tag === "object" || tag === "embed" || tag === "form") return null;
  const inner = children(element, open, key);
  if (tag === "a") {
    const href = element.getAttribute("href") ?? "";
    if (!/^https:\/\//i.test(href)) return <span key={key}>{inner}</span>;
    return (
      <a
        key={key}
        href={href}
        onClick={(event) => {
          event.preventDefault();
          open(href);
        }}
        className="focus-ring rounded-sm text-accent-fg underline decoration-accent-fg/40 underline-offset-2 hover:decoration-accent-fg"
      >
        {inner}
      </a>
    );
  }
  if (HEADING.test(tag)) return <p key={key} className="mt-3 mb-1 font-semibold first:mt-0">{inner}</p>;
  if (tag in BLOCK) return createElement(tag, { key, className: BLOCK[tag] || undefined }, ...inner);
  if (tag in INLINE) return createElement(tag, { key, className: INLINE[tag] || undefined }, ...inner);
  // Anything else (img, font, custom tags): keep its text, drop the element.
  return <span key={key}>{inner}</span>;
}
