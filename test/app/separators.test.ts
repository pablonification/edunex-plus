// The "·" between facts lives in one place, the kit's Meta, so a row can't end
// in a stray dot again ("DK4073 · Thu, 15 Oct, 11:00–12:59 · TVST C ·"). This
// reads the window's source and fails on any "·" written by hand in text or a
// string: facts go through <Meta>, plain labels (aria-label, tooltips) through
// factsLabel(). Comments are fine.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
/** Where the separator is defined. */
const KIT = "src/app/ui/layout.tsx";
/** Code that isn't facts on a line (the source line holds `code`), each with why. */
const ALLOWED: { file: string; code: string }[] = [
  // The crash report copied to the clipboard, never laid out.
  { file: "src/app/ui/panel-boundary.tsx", code: "`Edunex Plus · " },
  // Reads the semester ("Smt 6") back out of a term's name; not a separator on screen.
  { file: "src/app/screens/grades.tsx", code: '.split(" · ")' },
];

function sources(dir: string): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sources(file);
    return /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

/** Every "·" in a string, a template or JSX text of a file, with its line number. */
function handWritten(file: string, code = readFileSync(path.join(root, file), "utf8")): { line: number; text: string }[] {
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node) || ts.isJsxText(node)) &&
      node.text.includes("·")
    )
      found.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: node.text });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("separators between facts", () => {
  it("are written only by the kit: no '·' by hand in the window's code", () => {
    const stray = sources("src/app")
      .filter((file) => file !== KIT)
      .flatMap((file) =>
        handWritten(file)
          .filter(({ line }) => {
            const code = readFileSync(path.join(root, file), "utf8").split("\n")[line - 1] ?? "";
            return !ALLOWED.some((allowed) => allowed.file === file && code.includes(allowed.code));
          })
          .map(({ line, text }) => `${file}:${line} ${JSON.stringify(text.trim())}`),
      );
    expect(stray, "use <Meta> for facts on screen, factsLabel() for a label or tooltip").toEqual([]);
  });

  it("the check sees what it's meant to see", () => {
    const sample = [
      '// A comment may say "Kam · 08:00".',
      'const a = <span className="truncate">· {when}</span>;',
      'const b = <span>{" · "}</span>;',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: a line of sample source with a template in it
      "const c = `${code} · ${room}`;",
      'const d = ["x", "y"].join(" · ");',
    ].join("\n");
    expect(handWritten("sample.tsx", sample)).toEqual([
      { line: 2, text: "· " },
      { line: 3, text: " · " },
      { line: 4, text: " · " },
      { line: 5, text: " · " },
    ]);
  });
});
