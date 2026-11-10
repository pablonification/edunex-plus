// Search's services (the phone's own layer, not src/core/search.ts): every service on Semua layanan, plus Materi
// (/material) and Ujian (/exams), found by the name it carries tonight in either language. They stand in for the
// desktop's "screen" results, which name the desktop's sidebar, not the phone's tiles.
import { fold } from "../../../../src/core/search";
import { type StringKey, translate } from "../../../../src/core/strings";
import { SERVICE_GROUPS, type Service } from "../services/list";

/** (Their `icon` is unused: search draws every service with ServiceIcons, see parts.tsx.) Materi and Ujian, the two views another track is building, found here by the name their tiles carry. */
const EXTRA: readonly Service[] = [
  { id: "material", label: "search.group.material", icon: "BookOpen28Filled", tone: "teal", open: "/material" },
  { id: "exams", label: "search.group.exam", icon: "Form28Filled", tone: "red", open: "/exams" },
];

/** Every service once, in Semua layanan's order, then Materi and Ujian. */
export const SEARCH_SERVICES: readonly Service[] = (() => {
  const seen = new Set<string>();
  const all: Service[] = [];
  for (const service of [...EXTRA, ...SERVICE_GROUPS.flatMap((group) => group.services)]) {
    if (seen.has(service.id)) continue;
    seen.add(service.id);
    all.push(service);
  }
  return all;
})();

const words = (key: StringKey) => `${translate("id", key)} ${translate("en", key)}`;

/** Each service with the folded words it's found by: its name in both languages. */
const INDEX = SEARCH_SERVICES.map((service) => ({ service, words: fold(words(service.label)).split(" ") }));

/** The services every typed word begins (or, from 3 letters, sits inside) a word of. */
export function matchServices(query: string): Service[] {
  const tokens = fold(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];
  return INDEX.filter(({ words }) => tokens.every((token) => words.some((word) => word.startsWith(token) || (token.length >= 3 && word.includes(token))))).map(
    ({ service }) => service,
  );
}

/** Where the typed words sit in a name, as [part, marked] pieces. Only plain letters are matched in place. */
export function markedSpans(text: string, query: string): [string, boolean][] {
  const tokens = fold(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [[text, false]];
  const lower = text.toLowerCase();
  const on = new Array<boolean>(text.length).fill(false);
  for (const token of tokens) {
    const at = lower.indexOf(token);
    if (at >= 0) on.fill(true, at, at + token.length);
  }
  const spans: [string, boolean][] = [];
  for (let i = 0; i < text.length; i++) {
    const last = spans[spans.length - 1];
    if (last && last[1] === on[i]) last[0] += text[i];
    else spans.push([text[i], on[i]]);
  }
  return spans;
}
