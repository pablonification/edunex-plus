// mobile/qa/layout-read.mjs and targets-read.mjs read a dump of the phone's screen (Maestro's JSON or uiautomator's XML).
// Two made-up Beranda screens (no student's data): one that reaches the top of tonight's hill, one that doesn't.
import { describe, expect, it } from "vitest";
import { readDump } from "../../mobile/qa/dump-lib.mjs";
import { MAX_WORDS, MIN_TAPS, readLayout } from "../../mobile/qa/layout-read.mjs";
import { readTargets } from "../../mobile/qa/targets-read.mjs";

interface Spec {
  id?: string;
  box: [number, number, number, number];
  text?: string;
  desc?: string;
  tap?: boolean;
  kids?: Spec[];
}
const bounds = ([a, b, c, d]: Spec["box"]) => `[${a},${b}][${c},${d}]`;

/** A node as Maestro's `hierarchy` writes it. */
const maestro = (s: Spec): object => ({
  attributes: {
    text: s.text ?? "",
    accessibilityText: s.desc ?? "",
    "resource-id": s.id ?? "",
    clickable: String(!!s.tap),
    bounds: bounds(s.box),
    class: "android.view.View",
  },
  children: (s.kids ?? []).map(maestro),
});
/** The same node as `uiautomator dump` writes it. */
const xml = (s: Spec): string => {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const attrs = `index="0" text="${esc(s.text ?? "")}" resource-id="${s.id ?? ""}" class="android.view.View" package="x.edunexplus" content-desc="${esc(s.desc ?? "")}" clickable="${!!s.tap}" bounds="${bounds(s.box)}"`;
  return s.kids?.length ? `<node ${attrs}>${s.kids.map(xml).join("")}</node>` : `<node ${attrs} />`;
};
const screen = (kids: Spec[]): Spec => ({ box: [0, 0, 1080, 2400], kids });
const asMaestro = (s: Spec) => JSON.stringify(maestro(s));
const asXml = (s: Spec) => `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">${xml(s)}</hierarchy>`;

const TAB_IDS = ["home", "schedule", "tasks", "courses", "profile"];
const tabBar = (ids = TAB_IDS): Spec[] =>
  ids.map((id, i) => ({
    id: `tab.${id}`,
    desc: id,
    tap: true,
    box: [i * 216, 2063, (i + 1) * 216, 2274],
    kids: [{ text: id, box: [i * 216 + 40, 2190, i * 216 + 176, 2232] }],
  }));

const LABELS = ["Presensi", "Tugas", "Nilai", "Jadwal", "Ujian", "Modul", "Kalender", "Lainnya"];
const grid = (labels: string[], bottom = 1500): Spec => ({
  id: "home.grid",
  box: [42, 1000, 1038, bottom],
  kids: labels.map((label, i) => {
    const x = 42 + (i % 4) * 249;
    const y = 1000 + Math.floor(i / 4) * 240;
    return { id: `service.${i}`, tap: true, box: [x, y, x + 249, y + 240], kids: [{ text: label, box: [x + 30, y + 150, x + 219, y + 192] }] };
  }),
});

/** Search, now, strip, grid, in order and above the bar; 14 taps and 20 words. */
const good = (): Spec[] => [
  { id: "home.search", tap: true, box: [42, 150, 1038, 270], kids: [{ text: "Cari kuliah", box: [140, 190, 500, 240] }] },
  {
    id: "home.now",
    box: [42, 300, 1038, 700],
    kids: [
      { id: "action.nowClass", tap: true, box: [84, 330, 996, 520], kids: [{ text: "Sekarang di R.101", box: [140, 340, 700, 390] }] },
      { id: "action.presence", tap: true, box: [84, 560, 996, 680], kids: [{ text: "Isi Presensi", box: [300, 590, 700, 650] }] },
    ],
  },
  {
    id: "home.strip",
    box: [42, 730, 1038, 970],
    kids: [
      { id: "strip.due", tap: true, box: [42, 730, 390, 970], kids: [{ text: "2 tugas", box: [60, 800, 300, 850] }] },
      { id: "strip.absence", tap: true, box: [390, 730, 710, 970], kids: [{ text: "Aman", box: [410, 800, 600, 850] }] },
      { id: "strip.exam", tap: true, box: [710, 730, 1038, 970], kids: [{ text: "UTS Kam", box: [730, 800, 1000, 850] }] },
    ],
  },
  grid(LABELS),
];

describe("layout-read: a Beranda at the top of the hill", () => {
  const layout = readLayout(readDump(asMaestro(screen([...good(), ...tabBar()]))));
  const row = (key: string) => layout.rows.find((r: { key: string }) => r.key === key);

  it("passes every row", () => {
    expect(layout.rows.filter((r: { ok: boolean }) => !r.ok)).toEqual([]);
    expect(layout.ok).toBe(true);
  });

  it("reads the bar, the taps, the words and the tiles", () => {
    expect(layout.tabs).toEqual(TAB_IDS.map((id) => `tab.${id}`));
    expect(layout.tabbarTop).toBe(2063);
    expect(layout.taps).toHaveLength(MIN_TAPS);
    expect(layout.words).toBeLessThanOrEqual(MAX_WORDS);
    expect(layout.words).toBe(2 + 3 + 2 + 2 + 1 + 2 + LABELS.length); // search, now, its button, three strip tiles, the grid
    expect(layout.grid.map((t: { label: string }) => t.label)).toEqual(LABELS);
    expect(row("service grid")?.value).toContain("8 tiles (4+4 across)");
  });

  it("gives the same rows from uiautomator's XML", () => {
    const fromXml = readLayout(readDump(asXml(screen([...good(), ...tabBar()]))));
    expect(fromXml.format).toBe("xml");
    expect(fromXml.rows.map((r: { ok: boolean; value: string }) => [r.ok, r.value])).toEqual(
      layout.rows.map((r: { ok: boolean; value: string }) => [r.ok, r.value]),
    );
  });

  it("takes a tab bar top from the call when no tab shows", () => {
    const bare = readLayout(readDump(asMaestro(screen(good()))), { tabbarTop: 2063 });
    expect(bare.tabbarTop).toBe(2063);
    expect(bare.rows.find((r: { key: string }) => r.key === "blocks in order, fully visible")?.ok).toBe(true);
  });
});

describe("layout-read: a Beranda below it", () => {
  // Today's shape with the new blocks put wrong: an avatar, Akademik last, a grid pushed under the bar, one tile cut and
  // not "Lainnya" last, "0" on the strip, and too few things to tap.
  const bad = (): Spec[] => {
    const [search, now, strip] = good();
    const stripWithZero: Spec = {
      ...strip,
      kids: [{ id: "strip.due", tap: true, box: [42, 730, 1038, 970], kids: [{ text: "0", box: [60, 800, 120, 850] }] }],
    };
    const cut = grid(["Presensi", "Tugas", "Nilai", "Jadwal", "Ujian", "Modul", "Kalender", "Pengumuman…"], 2063);
    return [
      { id: "action.account", tap: true, desc: "Akun dan pengaturan", box: [944, 109, 1070, 235], kids: [{ text: "DP", box: [980, 143, 1034, 201] }] },
      search,
      now,
      stripWithZero,
      cut,
    ];
  };
  const layout = readLayout(readDump(asMaestro(screen([...bad(), ...tabBar(["home", "schedule", "tasks", "courses", "academic"])]))));
  const failing = layout.rows.filter((r: { ok: boolean }) => !r.ok).map((r: { key: string }) => r.key);

  it("fails the rows it should, and only those", () => {
    expect(layout.ok).toBe(false);
    expect([...failing].sort()).toEqual(
      ["bottom bar", "no avatar in a top bar", "blocks in order, fully visible", "things to tap", 'no "0" on the strip', "service grid"].sort(),
    );
    expect(failing).toContain("bottom bar");
    expect(failing).toContain("no avatar in a top bar");
    expect(failing).toContain("blocks in order, fully visible");
    expect(failing).toContain("things to tap");
    expect(failing).toContain('no "0" on the strip');
    expect(failing).toContain("service grid");
    expect(failing).not.toContain("words");
  });

  it("says why", () => {
    const text = (key: string) => JSON.stringify(layout.rows.find((r: { key: string }) => r.key === key));
    expect(text("bottom bar")).toContain("tab.academic");
    expect(text("no avatar in a top bar")).toContain("action.account");
    expect(text("blocks in order, fully visible")).toContain("touches the tab bar");
    expect(text("service grid")).toContain('not \\"Lainnya\\"');
    expect(text("service grid")).toContain("ellipsis");
  });

  it("leaves a missing block as a failure, not a crash", () => {
    const none = readLayout(readDump(asMaestro(screen([...tabBar()]))));
    expect(none.ok).toBe(false);
    expect(JSON.stringify(none.rows)).toContain("home.search: missing");
  });
});

describe("targets-read", () => {
  const dump = readDump(
    asMaestro(
      screen([
        { id: "action.search", tap: true, desc: "Cari", box: [692, 109, 818, 235] }, // 126 px: 48 dp
        { id: "action.small", tap: true, desc: "Kecil", box: [0, 300, 100, 400] }, // 38 dp
        { id: "action.nameless", tap: true, box: [0, 500, 300, 700] },
        { id: "row.fine", tap: true, box: [0, 800, 1080, 1000], kids: [{ text: "Baris", box: [100, 850, 300, 900] }] },
        { id: "row.nested", tap: true, desc: "Dalam", box: [0, 1100, 1080, 1300], kids: [{ id: "row.nested.icon", tap: true, box: [10, 1110, 60, 1160] }] },
      ]),
    ),
  );
  const found = readTargets(dump);

  it("lists clickable nodes under 48 dp (2.625 px a dp), and the ones nothing can read", () => {
    expect(found.small.map((f: { node: { id: string } }) => f.node.id)).toEqual(["action.small"]);
    expect(found.small[0].dp).toEqual([38.1, 38.1]);
    expect(found.unnamed.map((f: { node: { id: string } }) => f.node.id)).toEqual(["action.nameless"]);
  });

  it("leaves a tap inside another tap to the one around it", () => {
    expect([...found.small, ...found.unnamed].map((f: { node: { id: string } }) => f.node.id)).not.toContain("row.nested.icon");
  });
});
