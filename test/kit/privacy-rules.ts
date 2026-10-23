// What may never appear in anything that's made public: the shapes of student numbers, emails,
// phone numbers, meeting and file links and session tokens, the made-up values the tests use
// allowed. privacy.test.ts holds the committed test data to them; the report tests hold what the
// app would send the maintainer to them too (src/engine/report).

/** The made-up Student's NIM and anyone else's (18223901, 18223902, …). */
const FAKE_NIM = /^18223(?:9\d\d)$/;

const RULES: { what: string; pattern: RegExp; allowed: (match: string) => boolean }[] = [
  { what: "student number", pattern: /(?<!\d)1\d{2}(?:1[5-9]|2\d)\d{3}(?!\d)/g, allowed: (m) => FAKE_NIM.test(m) },
  { what: "meeting link", pattern: /teams\.(?:microsoft|live)\.com\/[^"'\s<]+/g, allowed: (m) => m.includes("000000000000") },
  { what: "file link", pattern: /\.blob\.core\.windows\.net\/[^"'\s<]+/g, allowed: (m) => m.includes("/edunex/fixture-") },
  { what: "signed link", pattern: /[?&]sig=[\w%+/=-]+/g, allowed: (m) => m.endsWith("=fixture") },
  { what: "session token", pattern: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}/g, allowed: () => false },
  {
    what: "email",
    pattern: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
    allowed: (m) => m.endsWith("@example.com") || m === "dimas.pratama@mahasiswa.itb.ac.id",
  },
  { what: "phone number", pattern: /(?<!\d)(?:\+62|62|0)8\d{7,11}(?!\d)/g, allowed: (m) => m === "080000000000" },
  // An Indonesian civil servant's staff number (NIP) starts with their birth date: "19580206 198503 1 002".
  {
    what: "staff number",
    pattern: /(?<!\d)(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:[0-2]\d|3[01])(?:19|20)\d{2}(?:0[1-9]|1[0-2])[12]\d{3}(?!\d)/g,
    allowed: () => false,
  },
  { what: "named photo", pattern: /cdn-edunex\.itb\.ac\.id\/avatar\/[^"'\s<]+/g, allowed: (m) => m.endsWith("/avatar/fixture-avatar.jpg") },
];

/** Each value in `text` shaped like something personal and not one of the made-up ones: "email: rahmat@…". */
export function personalHits(text: string): string[] {
  const out: string[] = [];
  for (const { what, pattern, allowed } of RULES)
    for (const match of text.matchAll(pattern)) if (!allowed(match[0])) out.push(`${what}: ${match[0].slice(0, 40)}`);
  return out;
}
