// Lecturers' formatted text (notes, Task instructions) shown safely and the
// way Edunex shows it: the HTML is parsed, and only plain formatting tags are
// rebuilt as React elements. No markup, script, style or event handler from
// Edunex ever reaches the page. Links to any web page open in the browser
// (the host shows on hover and focus); pictures are drawn by the caller (the
// app reads them in through the main process), else shown as a link.
import { createElement, Fragment, type ReactNode } from "react";
import { isWebLink, linkHost } from "../../core/links";
import { useT } from "../i18n";
import { cx } from "./cx";
import { Tooltip } from "./overlays";

const BLOCK: Record<string, string> = {
  p: "my-2 first:mt-0 last:mb-0",
  div: "my-1 first:mt-0 last:mb-0",
  ul: "my-2 list-disc pl-5",
  ol: "my-2 list-decimal pl-5",
  li: "my-0.5",
  blockquote: "my-2 border-l-2 border-line pl-3 text-muted",
  pre: "my-2 overflow-x-auto rounded-lg bg-fill p-3 font-mono text-small whitespace-pre-wrap",
  figure: "my-3 first:mt-0 last:mb-0",
  figcaption: "mt-1.5 text-small text-muted",
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
  // CKEditor's highlighter.
  mark: "rounded-sm bg-warning-bg px-0.5 text-fg",
  span: "",
  sub: "",
  sup: "",
  small: "text-small",
};
const HEADING = /^h[1-6]$/;
const DROPPED = new Set(["script", "style", "object", "embed", "form", "input", "button", "select", "textarea", "template", "svg", "math"]);
/** Pictures written right into the HTML: only formats that never run anything. */
const INLINE_PICTURE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

export interface RichTextImage {
  src: string;
  alt: string;
}

interface Hooks {
  open: (url: string) => void;
  image?: (image: RichTextImage) => ReactNode | null;
  /** Inside a lecturer's link: what's in it is part of that one link, never a second one (one click, one page). */
  inLink?: boolean;
  /** What a picture with no description of its own is called. */
  alt?: string;
}

export function RichText({
  html,
  onOpenLink,
  renderImage,
  pictureAlt,
  className,
}: {
  html: string;
  onOpenLink: (url: string) => void;
  /** Draws a picture from the web; null (or no function) shows it as a link to where it is. */
  renderImage?: (image: RichTextImage) => ReactNode | null;
  /** What a picture with no description of its own is called; the lecturer's by default. */
  pictureAlt?: string;
  className?: string;
}) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (
    // Lines no longer than reading is comfortable (65 characters); a wide table scrolls in its own box.
    <div className={cx("max-w-prose text-body leading-relaxed break-words", className)}>
      {children(doc.body, { open: onOpenLink, image: renderImage, alt: pictureAlt }, "r")}
    </div>
  );
}

/** The text alone, for previews and search. */
export function plainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A link a lecturer wrote: it opens in the browser, and says where on hover and focus. */
export function WebLink({ href, onOpen, children, className }: { href: string; onOpen: (url: string) => void; children: ReactNode; className?: string }) {
  const t = useT();
  return (
    <Tooltip content={t("link.opensIn", { host: linkHost(href) ?? href })} side="top">
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          onOpen(href);
        }}
        className={cx(
          "focus-ring rounded-sm text-accent-fg underline decoration-accent-fg/40 underline-offset-2 transition-colors duration-150 hover:decoration-accent-fg",
          className,
        )}
      >
        {children}
      </a>
    </Tooltip>
  );
}

/** A picture from elsewhere that isn't drawn here: named by where it is, and opened there (inside a link, just named). */
function PictureLink({ src, hooks }: { src: string; hooks: Hooks }) {
  const t = useT();
  const name = t("image.from", { host: linkHost(src) ?? src });
  if (hooks.inLink) return <>{name}</>;
  return (
    <WebLink href={src} onOpen={hooks.open}>
      {name}
    </WebLink>
  );
}

/** A picture written right into the HTML; most have no description of their own. */
function InlinePicture({ src, alt, fallback }: RichTextImage & { fallback?: string }) {
  const t = useT();
  return (
    <img
      src={src}
      alt={alt || fallback || t("image.alt")}
      className="h-auto max-w-full rounded-lg outline -outline-offset-1 outline-black/10 dark:outline-white/10"
    />
  );
}

const STRUCTURAL = new Set(["table", "thead", "tbody", "tr", "ul", "ol"]);
/** Blocks that hold nothing to read: CKEditor's spacer paragraphs (<p>&nbsp;</p>), which Edunex removes too. */
const SPACER = new Set(["p", "div", "li", ...["h1", "h2", "h3", "h4", "h5", "h6"]]);

function isEmptyBlock(element: Element): boolean {
  return SPACER.has(element.tagName.toLowerCase()) && !element.textContent?.trim() && !element.querySelector("img, iframe, oembed, hr");
}

function children(node: Node, hooks: Hooks, key: string): ReactNode[] {
  // Whitespace between rows or list items isn't content.
  const structural = node.nodeType === Node.ELEMENT_NODE && STRUCTURAL.has((node as Element).tagName.toLowerCase());
  return [...node.childNodes]
    .filter((child) => !(structural && child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()))
    .filter((child) => !(child.nodeType === Node.ELEMENT_NODE && isEmptyBlock(child as Element)))
    .map((child, index) => render(child, hooks, `${key}.${index}`));
}

function render(node: Node, hooks: Hooks, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const element = node as Element;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") return <br key={key} />;
  if (tag === "hr") return <hr key={key} className="my-4 border-line" />;
  if (DROPPED.has(tag)) return null;
  if (tag === "img") {
    const src = element.getAttribute("src")?.trim() ?? "";
    const alt = element.getAttribute("alt")?.trim() ?? "";
    if (INLINE_PICTURE.test(src)) return <InlinePicture key={key} src={src} alt={alt} fallback={hooks.alt} />;
    if (!isWebLink(src)) return null;
    const drawn = hooks.image?.({ src, alt });
    return <Fragment key={key}>{drawn ?? <PictureLink src={src} hooks={hooks} />}</Fragment>;
  }
  // An embedded video or page (CKEditor's media embed, an iframe) can't play here: it becomes its link.
  if (tag === "oembed" || tag === "iframe") {
    const url = element.getAttribute(tag === "oembed" ? "url" : "src")?.trim() ?? "";
    if (!isWebLink(url)) return null;
    if (hooks.inLink) return url;
    return (
      <span key={key} className="my-2 block">
        <WebLink href={url} onOpen={hooks.open}>
          {url}
        </WebLink>
      </span>
    );
  }
  if (tag === "a") {
    const href = element.getAttribute("href")?.trim() ?? "";
    if (hooks.inLink || !isWebLink(href)) return <span key={key}>{children(element, hooks, key)}</span>;
    const inner = children(element, { ...hooks, inLink: true }, key);
    return (
      <WebLink key={key} href={href} onOpen={hooks.open}>
        {inner}
      </WebLink>
    );
  }
  const inner = children(element, hooks, key);
  if (HEADING.test(tag))
    return (
      <p key={key} className={cx("mb-1 font-semibold first:mt-0", tag === "h1" || tag === "h2" ? "mt-4 text-title" : "mt-3")}>
        {inner}
      </p>
    );
  // A wide table scrolls on its own instead of widening the page.
  if (tag === "table")
    return (
      <div key={key} className="my-2 overflow-x-auto">
        <table className="border-collapse text-small">{inner}</table>
      </div>
    );
  if (tag === "td" || tag === "th") {
    // A merged cell (a schedule's header over two columns) keeps its span, or every later cell shifts.
    const span = (name: string) => {
      const value = Number(element.getAttribute(name));
      return Number.isInteger(value) && value > 1 && value <= 50 ? value : undefined;
    };
    return createElement(tag, { key, className: BLOCK[tag], colSpan: span("colspan"), rowSpan: span("rowspan") }, ...inner);
  }
  if (tag in BLOCK) return createElement(tag, { key, className: BLOCK[tag] || undefined }, ...inner);
  if (tag in INLINE) return createElement(tag, { key, className: INLINE[tag] || undefined }, ...inner);
  // Anything else (font, custom tags): keep its text, drop the element.
  return <span key={key}>{inner}</span>;
}
