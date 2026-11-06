// Bundles the scrubbed recordings in test/fixtures (Edunex's answers, SIX's pages, ITB's public
// pages) for a demo build: the phone can't read the repository's files, so its test/kit/fixtures
// (src/demo/fixtures.ts, swapped in by metro.config.js) reads them from src/demo/recorded.js,
// which this writes. Run by `npm run demo:fixtures`; the output isn't kept in git.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const fixtures = path.join(root, "test", "fixtures");
const out = path.join(import.meta.dirname, "..", "src", "demo", "recorded.js");

/** Every file under test/fixtures, by its path there ("six/index.json"), in a stable order. */
const files = {};
const visit = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(full);
    else files[path.relative(fixtures, full).split(path.sep).join("/")] = fs.readFileSync(full, "utf8");
  }
};
visit(fixtures);

fs.writeFileSync(
  out,
  `// Made by mobile/scripts/demo-fixtures.mjs from test/fixtures. Don't edit: run \`npm run demo:fixtures\`.\nexport default ${JSON.stringify(files)};\n`,
);
console.log(`${Object.keys(files).length} recordings → ${path.relative(root, out)}`);
