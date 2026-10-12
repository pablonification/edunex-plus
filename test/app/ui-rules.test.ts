// The window's look comes from the design system's tokens (docs/design-system.md),
// so a hand-typed size, corner or layer, a blur, a glow, spaced-out capitals or
// an arrival animation the app dropped can't creep back in one line at a time.
// This reads the classes in the window's source (every string, grouped per
// className or cx() call) and fails on each, saying what to use instead.
// Comments are fine.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

/** One rule per thing that stays out, and what to use instead, in plain words. */
const RULES: { name: string; matches: (token: string) => boolean; instead: string }[] = [
  {
    name: "text size",
    matches: (token) => /^text-\[\d/.test(token),
    instead: "a size from the type scale: text-micro, text-caption, text-small, text-body, text-lead, text-title, text-heading, text-figure, text-display",
  },
  {
    name: "corner",
    matches: (token) => /^rounded(-[a-z]{1,2})?-\[/.test(token),
    instead: "a radius from the scale: rounded-xs, rounded-sm, rounded-tag (keys and tags), rounded-md, rounded-lg, rounded-xl, rounded-2xl, rounded-full",
  },
  {
    name: "layer",
    matches: (token) => /^-?z-\[/.test(token),
    instead: "z-(--z-dialog), z-(--z-popover), z-(--z-tooltip) or z-(--z-toast) over the window; a plain number (z-10, z-20) inside one panel",
  },
  {
    name: "blur",
    matches: (token) => token.startsWith("backdrop-blur"),
    instead: "a solid surface (bg-surface, bg-raised): nothing blurs what's behind it",
  },
  {
    name: "glow",
    matches: (token) => token.startsWith("drop-shadow-["),
    instead: "a shadow token (shadow-card, shadow-raised, shadow-pop, shadow-dialog): no coloured glow",
  },
  {
    name: "arrival animation",
    matches: (token) => /^(stagger|animate-rise|animate-enter)(-|$)/.test(token) || token === "--i",
    instead: "nothing: rows and screens appear at once; motion only explains a change (see Motion in the design system)",
  },
  {
    name: "screen height",
    matches: (token) => /^(min-|max-)?h-screen$/.test(token),
    instead: "h-dvh for the window's height, or h-full inside the shell",
  },
];
const CAPITALS = "capitals with their own letter-spacing";
const CAPITALS_INSTEAD = "drop uppercase or the tracking-[…]: labels are sentence case, and the type scale sets the spacing";

/** A real exception, with why: the file and the class it may use. */
const ALLOWED: { file: string; token: string }[] = [
  // The app icons' corners grow with their size, like the platform's own icons; no fixed radius does that.
  { file: "src/app/ui/brand.tsx", token: "rounded-[22%]" },
  { file: "src/app/ui/brand.tsx", token: "rounded-[24%]" },
];

function sources(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(file);
    return /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

const isText = (node: ts.Node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node) || ts.isJsxText(node);

/**
 * The classes of a file, as groups: every string in one className or cx() call
 * together (so "uppercase" and "tracking-[…]" are seen side by side), any other
 * string on its own. Each with its line number.
 */
function classGroups(file: string, code = readFileSync(path.join(root, file), "utf8")): { line: number; tokens: string[] }[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const groups: { line: number; tokens: string[] }[] = [];
  const texts = (node: ts.Node): string[] => (isText(node) ? [(node as ts.LiteralLikeNode).text] : node.getChildren(source).flatMap(texts));
  const visit = (node: ts.Node) => {
    const whole =
      (ts.isJsxAttribute(node) && node.name.getText(source) === "className") ||
      (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cx");
    if (whole || isText(node)) {
      const tokens = texts(node).flatMap((text) => text.split(/\s+/).filter(Boolean));
      if (tokens.length) groups.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, tokens });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return groups;
}

/** What breaks a rule in a file: "file:line class (what it is): use …". */
function broken(file: string, code?: string): string[] {
  const allowed = (token: string) => ALLOWED.some((a) => a.file === file && a.token === token);
  return classGroups(file, code).flatMap(({ line, tokens }) => {
    // A variant (hover:, dark:, motion-safe:) doesn't change what the class is.
    const bare = tokens.map((token) => ({ token, base: token.replace(/^([\w-]+:)+/, "") })).filter(({ token }) => !allowed(token));
    const found = bare.flatMap(({ token, base }) =>
      RULES.filter((rule) => rule.matches(base)).map((rule) => `${file}:${line} ${token} (${rule.name}): use ${rule.instead}`),
    );
    const capitals = bare.some(({ base }) => base === "uppercase") && bare.find(({ base }) => base.startsWith("tracking-["));
    if (capitals) found.push(`${file}:${line} uppercase ${capitals.token} (${CAPITALS}): ${CAPITALS_INSTEAD}`);
    return found;
  });
}

describe("the window's classes", () => {
  it("use the design system's tokens: no hand-typed sizes, corners or layers, no blur, glow or arrival animation", () => {
    expect(sources("src/app").flatMap((file) => broken(file))).toEqual([]);
  });

  it("the check sees what it's meant to see", () => {
    const sample = [
      "// A comment may say text-[10px], z-[5] or h-screen.",
      'const a = <span className="px-1 text-[10px] leading-none">{n}</span>;',
      'const b = <div className={cx("absolute z-[15]", open && "rounded-[3px]")} />;',
      'const c = <p className={cx("text-caption uppercase", "tracking-[0.06em]")} />;',
      'const d = <li className="motion-safe:stagger" style={{ "--i": index } as CSSProperties} />;',
      'const e = <div className="h-screen backdrop-blur-md drop-shadow-[0_0_8px_var(--accent)]" />;',
      'const f = <div className="rounded-tag text-micro z-10 rounded-[22%] uppercase tracking-normal" />;',
    ].join("\n");
    expect(broken("sample.tsx", sample).map((found) => found.replace(/ \(.*$/, ""))).toEqual([
      "sample.tsx:2 text-[10px]",
      "sample.tsx:3 z-[15]",
      "sample.tsx:3 rounded-[3px]",
      "sample.tsx:4 uppercase tracking-[0.06em]",
      "sample.tsx:5 motion-safe:stagger",
      "sample.tsx:5 --i",
      "sample.tsx:6 h-screen",
      "sample.tsx:6 backdrop-blur-md",
      "sample.tsx:6 drop-shadow-[0_0_8px_var(--accent)]",
      "sample.tsx:7 rounded-[22%]",
    ]);
  });
});
