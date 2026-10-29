// What may never appear in anything that's made public: the shapes of student numbers, emails,
// phone numbers, meeting and file links and session tokens, the made-up values the tests use
// allowed. privacy.test.ts holds the committed test data to them; the report tests hold what the
// app would send the maintainer to them too (src/engine/report).

/** The made-up Student's NIM and anyone else's (18223901, 18223902, …). */
const FAKE_NIM = /^18223(?:9\d\d)$/;

/** A link as it reads with its "/" plain, where JSON wrote them "\/" (Edunex does) or "\\/" (a report's page, inside the report). */
const plain = (link: string) => link.replace(/\\+\//g, "/");

// Links match with their "/" escaped too: a page whose "/" are still "\/" would carry a real link past them.
const RULES: { what: string; pattern: RegExp; allowed: (match: string) => boolean }[] = [
  { what: "student number", pattern: /(?<!\d)1\d{2}(?:1[5-9]|2\d)\d{3}(?!\d)/g, allowed: (m) => FAKE_NIM.test(m) },
  { what: "meeting link", pattern: /teams\.(?:microsoft|live)\.com\\*\/[^"'\s<]+/g, allowed: (m) => m.includes("000000000000") },
  { what: "file link", pattern: /\.blob\.core\.windows\.net\\*\/[^"'\s<]+/g, allowed: (m) => plain(m).includes("/edunex/fixture-") },
  { what: "signed link", pattern: /[?&]sig=[\w%+/=-]+/g, allowed: (m) => m.endsWith("=fixture") },
  // Only where a run of a token's characters starts, as a token does (after a quote, a space, an =):
  // tried from every "eyJ" in one long run, "eyJ" a million times over took hours.
  { what: "session token", pattern: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}/g, allowed: () => false },
  // At most 64 characters before the @, as an address has: a long run of letters with no @ after it
  // stays quick to search (unbounded, a million of them took hours). The report relay runs these
  // rules on whatever anyone sends it (relay/), so each must stay quick on any text.
  {
    what: "email",
    pattern: /[\w.+-]{1,64}@[\w-]+(?:\.[\w-]+)+/g,
    allowed: (m) => m.endsWith("@example.com") || m === "dimas.pratama@mahasiswa.itb.ac.id",
  },
  { what: "phone number", pattern: /(?<!\d)(?:\+62|62|0)8\d{7,11}(?!\d)/g, allowed: (m) => m === "080000000000" },
  // An Indonesian civil servant's staff number (NIP) starts with their birth date: "19580206 198503 1 002".
  {
    what: "staff number",
    pattern: /(?<!\d)(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])(?:19|20)\d{2}(?:0[1-9]|1[0-2])[12]\d{3}(?!\d)/g,
    allowed: () => false,
  },
  { what: "named photo", pattern: /cdn-edunex\.itb\.ac\.id\\*\/avatar\\*\/[^"'\s<]+/g, allowed: (m) => plain(m).endsWith("/avatar/fixture-avatar.jpg") },
];

/**
 * SIX's pages that hold passwords or family data. The app never reads them, so neither the test
 * data nor a report may carry one (privacy.test.ts, the report relay).
 */
export const PRIVATE_PAGES = /controlpanel|datainduk|ktm|pddikti/i;

/** Each value in `text` shaped like something personal and not one of the made-up ones: "email: rahmat@…". */
export function personalHits(text: string): string[] {
  const out: string[] = [];
  for (const { what, pattern, allowed } of RULES)
    for (const match of text.matchAll(pattern)) if (!allowed(match[0])) out.push(`${what}: ${match[0].slice(0, 40)}`);
  return out;
}
