// The repository is public. These checks fail the run if a session token, a
// signed file link, a meeting link or a student's details made it into any
// tracked file. Only the made-up values listed here may appear; test/fixtures
// has its own, stricter checks (privacy.test.ts).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

// The made-up student Dimas Pratama (NIM 182239xx) and two other fake students in tests.
const FAKE_NIM = /^(?:18223(?:9\d\d)|18222001|18224999)$/;
const FAKE_EMAILS = new Set(["dimas.pratama@mahasiswa.itb.ac.id"]);
const FAKE_PHONES = new Set(["080000000000"]);
// Header and payload of the sign-in test's tokens: {"sub":"900001"} and {"refresh":true}.
const FAKE_JWTS = new Set(["eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI5MDAwMDEifQ", "eyJhbGciOiJIUzI1NiJ9.eyJyZWZyZXNoIjp0cnVlfQ"]);
const FAKE_SIGNATURES = new Set(["pretend"]);
// The pretend Edunex's file storage (test/pretend) and the scrubbed recordings' links.
const FAKE_BLOB_PATHS = ["edunex/fixture-", "edunex/upload/", "edunex/website-"];

/** Tracked text files, minus the fixtures and the generated lockfile; null outside a git checkout. */
function trackedTexts(): { file: string; text: string }[] | null {
  let listed: string;
  try {
    listed = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
  const out: { file: string; text: string }[] = [];
  for (const file of listed.split("\0")) {
    if (!file || file.startsWith("test/fixtures/") || file === "package-lock.json") continue;
    const stat = fs.lstatSync(path.join(ROOT, file), { throwIfNoEntry: false });
    if (!stat?.isFile()) continue;
    const bytes = fs.readFileSync(path.join(ROOT, file));
    if (bytes.includes(0)) continue; // pictures, icons
    out.push({ file, text: bytes.toString("utf8") });
  }
  return out;
}

const texts = trackedTexts();

/** "file:line: start-of-match…" for each match not allowed; never the whole value (CI logs are public too). */
function hits(pattern: RegExp, allowed: (match: string) => boolean): string[] {
  const out: string[] = [];
  for (const { file, text } of texts ?? [])
    for (const match of text.matchAll(pattern)) {
      if (allowed(match[0])) continue;
      const line = text.slice(0, match.index).split("\n").length;
      out.push(`${file}:${line}: ${match[0].slice(0, 12)}…`);
    }
  return out;
}

const isFakeBlobLink = (link: string) => FAKE_BLOB_PATHS.some((prefix) => link.slice(link.indexOf("/") + 1).startsWith(prefix));
// Real Teams links carry a long meeting number or a meetup-join id; the fakes use zeros or short numbers.
const isFakeMeetingLink = (link: string) => !/meetup-join/i.test(link) && !/\d{9,}/.test(link.replace(/0{9,}/g, ""));

function isAllowedEmail(email: string): boolean {
  const lower = email.toLowerCase();
  const domain = lower.slice(lower.lastIndexOf("@") + 1);
  return (
    FAKE_EMAILS.has(lower) ||
    /(?:^|\.)example\.(?:com|org|net)$/.test(domain) ||
    domain === "users.noreply.github.com" ||
    lower === "noreply@anthropic.com" ||
    /\.(?:png|jpe?g|svg|webp|gif|ico)$/.test(domain) // asset names like tray@2x.png
  );
}

describe.skipIf(texts === null)("tracked files hold nothing personal or secret", () => {
  it("reads the repository's files", () => {
    expect(texts?.length).toBeGreaterThan(100);
  });

  it("has only the fake student numbers", () => {
    expect(hits(/(?<!\d)1\d{2}(?:1[5-9]|2\d)\d{3}(?!\d)/g, (m) => FAKE_NIM.test(m))).toEqual([]);
  });

  it("has no real email addresses or phone numbers", () => {
    expect(hits(/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi, isAllowedEmail)).toEqual([]);
    expect(hits(/(?<!\d)(?:\+62|62|0)8\d{7,11}(?!\d)/g, (m) => FAKE_PHONES.has(m))).toEqual([]);
  });

  it("has no session tokens", () => {
    expect(hits(/eyJ[\w-]{8,}\.eyJ[\w-]{8,}/g, (m) => FAKE_JWTS.has(m))).toEqual([]);
  });

  it("has no signed file links", () => {
    expect(hits(/[?&]sig=[\w%+/=-]+/g, (m) => FAKE_SIGNATURES.has(m.slice(5)))).toEqual([]);
    expect(hits(/\.blob\.core\.windows\.net\/[^"'`\s<)]+/g, isFakeBlobLink)).toEqual([]);
  });

  it("has no real meeting links", () => {
    expect(hits(/teams\.(?:microsoft|live)\.com\/[^"'`\s<)]+/g, isFakeMeetingLink)).toEqual([]);
  });
});
