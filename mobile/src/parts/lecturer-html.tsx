// What lecturers write (Task instructions, notes) and the Student's own answer as Edunex keeps it,
// on the phone: src/app/lecturer-html.tsx and src/app/ui/rich-text.tsx's rules, drawn as native
// text instead of a web view. The HTML is parsed (cheerio, the browser's rules) and only plain
// formatting is rebuilt: paragraphs, headings, lists, quotes, tables, bold, italic, links. No
// markup, script or style from Edunex runs. Links open in the browser (useOpenLink); pictures on
// Edunex's storage are read in by the host ("files.read") and shown from the app's cache.
// Native text, not a web view: it's selectable, follows the app's type and theme, sizes itself
// in the scrolling page, and a screen reader (and a test) reads it as the page's own text.

import { type AnyNode, type Element, isTag, isText } from "domhandler";
import { Directory, File, Paths } from "expo-file-system";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Image, Text as RNText, ScrollView, StyleSheet, type TextStyle, View } from "react-native";
import { useOpenLink } from "../../../src/app/hooks";
import { type Translate, useT } from "../../../src/app/i18n";
import { useBridge } from "../../../src/app/store";
import type { FileProblem } from "../../../src/core/actions/files";
import { isStorageFile, isWebLink, linkHost } from "../../../src/core/links";
import { parseBody } from "../screens/tasks/html";
import { Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { Text, type TextSize } from "../ui/text";
import { radius, space, type Theme, useTheme } from "../ui/theme";

const BLOCKS = new Set([
  "p",
  "div",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "section",
  "article",
  "img",
  "iframe",
  "oembed",
]);
const DROPPED = new Set(["script", "style", "object", "embed", "form", "input", "button", "select", "textarea", "template", "svg", "math", "head"]);
const STRUCTURAL = new Set(["table", "thead", "tbody", "tr", "ul", "ol"]);
const SPACER = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"]);
const INLINE_PICTURE = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i;

interface Context {
  t: Translate;
  theme: Theme;
  open(url: string): void;
  size: TextSize;
  /** What a picture with no description of its own is called. */
  alt?: string;
  /** Inside a lecturer's link: one link, never a second one inside it. */
  inLink?: boolean;
  /** Inside <pre>: spacing kept as written. */
  pre?: boolean;
}

const textOf = (node: AnyNode): string => (isText(node) ? node.data : isTag(node) ? node.children.map(textOf).join("") : "");

function hasBlock(element: Element): boolean {
  return element.children.some((child) => isTag(child) && (BLOCKS.has(child.name) || hasBlock(child)));
}

function isEmptyBlock(element: Element): boolean {
  if (!SPACER.has(element.name)) return false;
  if (textOf(element).replace(/[\s ]+/g, "")) return false;
  const visual = (node: Element): boolean =>
    node.children.some((child) => isTag(child) && (["img", "iframe", "oembed", "hr"].includes(child.name) || visual(child)));
  return !visual(element);
}

function shownChildren(element: Element): AnyNode[] {
  const structural = STRUCTURAL.has(element.name);
  return element.children.filter((child) => {
    if (structural && isText(child) && !child.data.trim()) return false;
    if (isTag(child) && isEmptyBlock(child)) return false;
    return true;
  });
}

/** Inline content as nested text: one native text, so a paragraph reads as one piece. */
function inline(node: AnyNode, ctx: Context, key: string): ReactNode {
  if (isText(node)) return ctx.pre ? node.data : node.data.replace(/[ \t\n\r\f]+/g, " ");
  if (!isTag(node)) return null;
  const tag = node.name;
  if (DROPPED.has(tag)) return null;
  if (tag === "br") return "\n";
  const kids = (next: Context = ctx) => node.children.map((child, i) => inline(child, next, `${key}.${i}`));
  const c = ctx.theme.color;
  if (tag === "a") {
    const href = node.attribs.href?.trim() ?? "";
    if (ctx.inLink || !isWebLink(href)) return <RNText key={key}>{kids()}</RNText>;
    return (
      <RNText
        key={key}
        accessibilityRole="link"
        accessibilityHint={ctx.t("link.opensIn", { host: linkHost(href) ?? href })}
        onPress={() => ctx.open(href)}
        style={{ color: c.accentFg, textDecorationLine: "underline" }}
      >
        {kids({ ...ctx, inLink: true })}
      </RNText>
    );
  }
  const style: TextStyle | null =
    tag === "b" || tag === "strong"
      ? { fontWeight: "600" }
      : tag === "i" || tag === "em"
        ? { fontStyle: "italic" }
        : tag === "u"
          ? { textDecorationLine: "underline" }
          : tag === "s" || tag === "strike" || tag === "del"
            ? { textDecorationLine: "line-through" }
            : tag === "code"
              ? { fontFamily: "monospace", backgroundColor: c.fill }
              : tag === "mark"
                ? { backgroundColor: c.warningBg, color: c.fg }
                : null;
  return (
    <RNText key={key} style={style}>
      {kids()}
    </RNText>
  );
}

/** A block's children: runs of inline content become one text each, blocks stack under them. */
function blocks(element: Element, ctx: Context, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let run: ReactNode[] = [];
  let runText = "";
  const flush = () => {
    if (run.length && (ctx.pre || runText.trim())) {
      if (!ctx.pre) {
        if (typeof run[0] === "string") run[0] = run[0].replace(/^\s+/, "");
        const last = run.length - 1;
        if (typeof run[last] === "string") run[last] = (run[last] as string).replace(/\s+$/, "");
      }
      out.push(
        <Text key={`${key}.t${out.length}`} size={ctx.size} selectable style={ctx.pre ? { fontFamily: "monospace" } : undefined}>
          {run}
        </Text>,
      );
    }
    run = [];
    runText = "";
  };
  shownChildren(element).forEach((child, i) => {
    const childKey = `${key}.${i}`;
    if (isTag(child) && !DROPPED.has(child.name) && (BLOCKS.has(child.name) || hasBlock(child))) {
      flush();
      const drawn = block(child, ctx, childKey);
      if (drawn) out.push(drawn);
    } else {
      run.push(inline(child, ctx, childKey));
      runText += textOf(child);
    }
  });
  flush();
  return out;
}

function Stack({ children, gap = space[2] }: { children: ReactNode; gap?: number }) {
  return <View style={{ gap }}>{children}</View>;
}

function block(element: Element, ctx: Context, key: string): ReactNode {
  const tag = element.name;
  const c = ctx.theme.color;
  if (tag === "hr") return <View key={key} style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginVertical: space[2] }} />;
  if (tag === "img") {
    const src = element.attribs.src?.trim() ?? "";
    const alt = element.attribs.alt?.trim() || ctx.alt || ctx.t("image.alt");
    if (INLINE_PICTURE.test(src)) return <Picture key={key} uri={src.replace(/\s+/g, "")} alt={alt} />;
    if (!isWebLink(src)) return null;
    if (isStorageFile(src)) return <RemoteImage key={key} src={src} alt={alt} />;
    return <LinkLine key={key} url={src} label={ctx.t("image.from", { host: linkHost(src) ?? src })} ctx={ctx} />;
  }
  // An embedded video or page can't play here: it becomes its link.
  if (tag === "oembed" || tag === "iframe") {
    const url = element.attribs[tag === "oembed" ? "url" : "src"]?.trim() ?? "";
    if (!isWebLink(url)) return null;
    return <LinkLine key={key} url={url} label={url} ctx={ctx} />;
  }
  if (/^h[1-6]$/.test(tag))
    return (
      <Text key={key} size={tag === "h1" || tag === "h2" ? "title" : ctx.size} weight="semibold" selectable style={{ marginTop: space[2] }}>
        {element.children.map((child, i) => inline(child, ctx, `${key}.${i}`))}
      </Text>
    );
  if (tag === "ul" || tag === "ol") {
    const items = shownChildren(element).filter((child): child is Element => isTag(child));
    return (
      <View key={key} style={{ gap: space[1] }}>
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a node's place in the parsed HTML is its identity
          <View key={`${key}.${i}`} style={{ flexDirection: "row", gap: space[2], paddingLeft: space[1] }}>
            <Text size={ctx.size} tone="muted" tabular style={{ minWidth: tag === "ol" ? 20 : 10 }}>
              {tag === "ol" ? `${i + 1}.` : "•"}
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Stack gap={space[1]}>{item.name === "li" ? blocks(item, ctx, `${key}.${i}`) : block(item, ctx, `${key}.${i}`)}</Stack>
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (tag === "blockquote")
    return (
      <View key={key} style={{ borderLeftWidth: 2, borderLeftColor: c.line, paddingLeft: space[3] }}>
        <Stack>{blocks(element, ctx, key)}</Stack>
      </View>
    );
  if (tag === "pre")
    return (
      <View key={key} style={{ backgroundColor: c.fill, borderRadius: radius.lg, padding: space[3] }}>
        <Stack>{blocks(element, { ...ctx, pre: true, size: "small" }, key)}</Stack>
      </View>
    );
  // A wide table scrolls sideways on its own instead of squeezing its columns.
  if (tag === "table") {
    const rows: Element[] = [];
    const collect = (node: Element) => {
      for (const child of node.children) if (isTag(child)) child.name === "tr" ? rows.push(child) : collect(child);
    };
    collect(element);
    return (
      <ScrollView key={key} horizontal showsHorizontalScrollIndicator>
        <View style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}>
          {rows.map((row, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a node's place in the parsed HTML is its identity
            <View key={`${key}.${r}`} style={{ flexDirection: "row" }}>
              {row.children.filter(isTag).map((cell, i) => (
                <View
                  // biome-ignore lint/suspicious/noArrayIndexKey: a node's place in the parsed HTML is its identity
                  key={`${key}.${r}.${i}`}
                  style={{ minWidth: 96, maxWidth: 240, padding: space[2], borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}
                >
                  <Stack gap={space[1]}>{blocks(cell, { ...ctx, size: "small" }, `${key}.${r}.${i}`)}</Stack>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }
  if (tag === "figcaption")
    return (
      <Text key={key} size="small" tone="muted" selectable>
        {element.children.map((child, i) => inline(child, ctx, `${key}.${i}`))}
      </Text>
    );
  // p, div, li, figure, an inline element holding a block: its content, stacked.
  const inner = blocks(element, ctx, key);
  return inner.length ? <Stack key={key}>{inner}</Stack> : null;
}

function LinkLine({ url, label, ctx }: { url: string; label: string; ctx: Context }) {
  if (ctx.inLink)
    return (
      <Text size={ctx.size} selectable>
        {label}
      </Text>
    );
  return (
    <Text size={ctx.size} accessibilityRole="link" onPress={() => ctx.open(url)} style={{ color: ctx.theme.color.accentFg, textDecorationLine: "underline" }}>
      {label}
    </Text>
  );
}

/** A picture at its own shape, as wide as the page at most, a screenful tall at most. */
function Picture({ uri, alt }: { uri: string; alt: string }) {
  const theme = useTheme();
  const [ratio, setRatio] = useState<number | null>(null);
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={alt}
      resizeMode="contain"
      onLoad={(event) => {
        const { width, height } = event.nativeEvent.source;
        if (width > 0 && height > 0) setRatio(width / height);
      }}
      style={{ width: "100%", aspectRatio: ratio ?? 16 / 9, maxHeight: 480, borderRadius: radius.lg, backgroundColor: theme.color.fill }}
    />
  );
}

type Picked = { state: "loading" } | { state: "ready"; uri: string } | { state: "failed"; problem: FileProblem };

/** Pictures already read in this run, by link: drawn again without reading again. */
const ready = new Map<string, string>();

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** A picture on Edunex's storage: a placeholder while it loads, and why when it can't show. */
function RemoteImage({ src, alt }: { src: string; alt: string }) {
  const t = useT();
  const theme = useTheme();
  const bridge = useBridge();
  const [picture, setPicture] = useState<Picked>(() => {
    const uri = ready.get(src);
    return uri ? { state: "ready", uri } : { state: "loading" };
  });
  useEffect(() => {
    if (ready.has(src)) return;
    let live = true;
    bridge.invoke("files.read", { url: src, as: "image" }).then(
      (result) => {
        if ("problem" in result) return live && setPicture({ state: "failed", problem: result.problem });
        const folder = new Directory(Paths.cache, "pictures");
        if (!folder.exists) folder.create({ intermediates: true });
        const file = new File(folder, `${hash(src)}.${EXT[result.type] ?? "img"}`);
        if (!file.exists) file.create();
        file.write(result.bytes);
        ready.set(src, file.uri);
        if (live) setPicture({ state: "ready", uri: file.uri });
      },
      () => live && setPicture({ state: "failed", problem: "unreachable" }),
    );
    return () => {
      live = false;
    };
  }, [bridge, src]);
  if (picture.state === "loading") return <Skeleton height={160} style={{ borderRadius: radius.lg }} />;
  if (picture.state === "failed")
    return (
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: space[2], borderRadius: radius.lg, backgroundColor: theme.color.sunken, padding: space[3] }}
      >
        <Icons.ImageBroken size={16} color={theme.color.muted} />
        <Text size="small" tone="muted" style={{ flex: 1 }}>
          {t(`file.problem.${picture.problem}`)}
        </Text>
      </View>
    );
  return <Picture uri={picture.uri} alt={alt} />;
}

export function LecturerHtml({ html, pictureAlt, size = "body" }: { html: string; pictureAlt?: string; size?: TextSize }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenLink();
  const body = useMemo(() => parseBody(html), [html]);
  return <Stack gap={space[2.5]}>{blocks(body, { t, theme, open, size, alt: pictureAlt }, "r")}</Stack>;
}
