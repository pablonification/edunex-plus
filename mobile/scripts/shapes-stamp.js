// The stamp of the datasets' schemas a build carries (app.config.ts → extra.shapes → src/host/version.ts): a hash of
// every file in src/core, where the schemas and everything they're built from live (test/mobile/cold-start.test.ts
// checks that), and the version of zod that checks them. A dataset the app saved under the same stamp loads at the next
// start without its schema being checked again (src/engine/store/datasets.ts); any change to src/core makes a new stamp,
// and the first start after it checks every saved dataset once, as every start used to.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CORE = path.join(__dirname, "..", "..", "src", "core");

/** Every file under `dir`, by path, in a fixed order. */
function filesIn(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => (entry.isDirectory() ? filesIn(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

function shapesStamp() {
  const hash = crypto.createHash("sha256");
  hash.update(`zod ${require("zod/package.json").version}\n`);
  for (const file of filesIn(CORE)) {
    hash.update(`${path.relative(CORE, file).replace(/\\/g, "/")}\n`);
    hash.update(fs.readFileSync(file));
  }
  return hash.digest("hex").slice(0, 16);
}

module.exports = { shapesStamp, CORE };
