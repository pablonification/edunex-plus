// SIX's public course catalog as one dataset. The program list comes first,
// then program pages one at a time, at least 3 seconds apart, the Student's
// own program first. Pages are kept for days; a page that doesn't answer is
// skipped and tried again later, and one with a new layout marks the source
// "changed" while every other program stays usable.
import type { CatalogCourse, CatalogProgram, CourseCatalog } from "../../../core/models";
import { EngineError, isEngineError } from "../../errors";
import type { SourceContext } from "../source";
import { readProgramList, readProgramPage, type ListedProgram, type ProgramPage } from "./catalog-pages";
import { PageError, PublicClient } from "./client";

export const CATALOG_URL = "https://six.itb.ac.id/pub/kur2024";
/** SIX is read at human pace: never two catalog pages within this. */
export const CATALOG_GAP_MS = 3_500;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Pages younger than this are used as they are. */
const FRESH = 3 * DAY;
/** A page that didn't answer or changed layout is tried again after this. */
const RETRY = DAY;
/** Store progress every few pages, so the screens don't redraw for each one. */
const SAVE_EVERY = 5;

const emptyProgram = (listed: ListedProgram): CatalogProgram => ({
  ...listed,
  state: "pending",
  checkedAt: null,
  prefix: null,
  required: [],
  electives: [],
  specializations: [],
  multidisciplinary: [],
  minors: [],
  catalog: [],
});

/** The program list read again: programs keep what was read of them; ones no longer listed go. */
export function withProgramList(previous: CourseCatalog | undefined, listed: ListedProgram[], now: number): CourseCatalog {
  const known = new Map(previous?.programs.map((p) => [p.id, p]));
  const programs = listed.map((l) => {
    const old = known.get(l.id);
    return old ? { ...old, ...l } : emptyProgram(l);
  });
  return tidy({ checkedAt: now, programs, courses: previous?.courses ?? [], minors: previous?.minors ?? [] });
}

/** The prefix most of a program's own courses carry ("II" for Sistem dan Teknologi Informasi). */
function prefixOf(codes: string[]): string | null {
  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code.slice(0, 2), (counts.get(code.slice(0, 2)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/** A program page read. */
export function withProgramPage(catalog: CourseCatalog, id: string, page: ProgramPage, now: number): CourseCatalog {
  const own = page.catalog.map((c) => c.code);
  const requiredCodes = new Set(page.required.map((r) => r.code));
  const programs = catalog.programs.map((p) =>
    p.id !== id
      ? p
      : {
          ...p,
          state: "ready" as const,
          checkedAt: now,
          prefix: prefixOf(own),
          required: page.required,
          electives: own.filter((code) => !requiredCodes.has(code)),
          specializations: page.specializations,
          multidisciplinary: page.multidisciplinary,
          minors: page.minors.map((m) => m.id),
          catalog: own,
        },
  );
  const courses = new Map(catalog.courses.map((c) => [c.code, c]));
  for (const seen of page.courses) {
    const old = courses.get(seen.code);
    // A program's own catalog tab is the truth for a course; a mention elsewhere only fills a gap.
    if (seen.category !== null) courses.set(seen.code, { code: seen.code, name: seen.name, sks: seen.sks, category: seen.category, owner: old?.owner ?? null });
    else if (!old) courses.set(seen.code, { code: seen.code, name: seen.name, sks: seen.sks, category: null, owner: null });
  }
  const minors = new Map(catalog.minors.map((m) => [m.id, m]));
  for (const minor of page.minors) minors.set(minor.id, minor);
  return tidy({ ...catalog, programs, courses: [...courses.values()], minors: [...minors.values()] });
}

/** A program page that failed: "missing" (no answer) or "changed" (new layout). What was read before stays. */
export function withProgramFailure(catalog: CourseCatalog, id: string, state: "missing" | "changed", now: number): CourseCatalog {
  const programs = catalog.programs.map((p) => {
    if (p.id !== id) return p;
    // A page read before that doesn't answer now keeps its copy and is tried again next time.
    if (state === "missing" && p.state === "ready") return p;
    return { ...p, state, checkedAt: now };
  });
  return { ...catalog, programs };
}

/**
 * Owners and housekeeping: a course belongs to the program whose own prefix
 * it carries (FI1101 is Fisika's even when another program requires it), and
 * courses or minors no program mentions any more are dropped.
 */
function tidy(catalog: CourseCatalog): CourseCatalog {
  const ownerOf = new Map<string, { id: string; count: number }>();
  for (const p of catalog.programs) {
    if (!p.prefix) continue;
    const count = p.catalog.filter((code) => code.startsWith(p.prefix!)).length;
    const best = ownerOf.get(p.prefix);
    // Two programs with the same prefix (a campus copy): the one offering more of those courses owns them.
    if (!best || count > best.count || (count === best.count && p.id < best.id)) ownerOf.set(p.prefix, { id: p.id, count });
  }
  const minorIds = new Set(catalog.programs.flatMap((p) => p.minors));
  const minors = catalog.minors.filter((m) => minorIds.has(m.id)).sort((a, b) => a.id.localeCompare(b.id));
  const mentioned = new Set([
    ...catalog.programs.flatMap((p) => [...p.catalog, ...p.required.map((r) => r.code), ...[...p.specializations, ...p.multidisciplinary].flatMap((t) => t.courses)]),
    ...minors.flatMap((m) => m.courses),
  ]);
  const courses: CatalogCourse[] = catalog.courses
    .filter((c) => mentioned.has(c.code))
    .map((c) => ({ ...c, owner: ownerOf.get(c.code.slice(0, 2))?.id ?? null }))
    .sort((a, b) => a.code.localeCompare(b.code));
  return { ...catalog, minors, courses };
}

const due = (p: CatalogProgram, now: number) =>
  p.checkedAt === null || p.state === "pending" || now - p.checkedAt >= (p.state === "ready" ? FRESH : RETRY);

const normal = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

/** The Student's own program, once SIX has said which it is (the "six.student" dataset). */
function ownProgram(context: SourceContext, catalog: CourseCatalog): string | null {
  // Read by name: the SIX side may publish it after this source started.
  const student = context.get("six.student");
  if (!student) return null;
  // SIX's program number is exact; the name alone is shared by a campus copy ("… (Kampus Cirebon)").
  if (student.programCode && catalog.programs.some((p) => p.id === student.programCode)) return student.programCode;
  const program = student.program;
  if (!program) return null;
  return catalog.programs.find((p) => normal(p.name) === normal(program))?.id ?? null;
}

export function registerCatalogFeed(context: SourceContext): void {
  // In SIX's own line: the signed-in SIX source reads the same site.
  const client = new PublicClient(context.transport, context.clock, context.userAgent, "SIX", CATALOG_GAP_MS, context.pace(new URL(CATALOG_URL).host));
  context.feed({
    name: "itb.catalog",
    every: 6 * HOUR,
    jitter: 30 * MINUTE,
    async run(current) {
      let catalog = context.get("itb.catalog");
      if (!catalog || context.clock.now() - catalog.checkedAt >= FRESH) {
        const listed = readProgramList(await client.text(CATALOG_URL));
        if (!current()) return;
        catalog = withProgramList(catalog, listed, context.clock.now());
        await context.set("itb.catalog", catalog);
      }

      const tried = new Set<string>();
      let unsaved = 0;
      const save = async () => {
        if (unsaved > 0 && current()) await context.set("itb.catalog", catalog!);
        unsaved = 0;
      };
      for (;;) {
        if (!current()) return;
        const now = context.clock.now();
        const waiting = catalog.programs.filter((p) => !tried.has(p.id) && due(p, now));
        if (waiting.length === 0) break;
        const own = ownProgram(context, catalog);
        const next = waiting.find((p) => p.id === own) ?? waiting[0]!;
        tried.add(next.id);
        try {
          const page = readProgramPage(await client.text(`${CATALOG_URL}/${next.id}`));
          catalog = withProgramPage(catalog, next.id, page, context.clock.now());
        } catch (error) {
          if (error instanceof PageError && error.status !== 429) catalog = withProgramFailure(catalog, next.id, "missing", context.clock.now());
          else if (isEngineError(error, "VendorChanged")) catalog = withProgramFailure(catalog, next.id, "changed", context.clock.now());
          else {
            // Offline or asked to slow down: keep what was read and stop for now.
            await save();
            throw error;
          }
        }
        unsaved++;
        if (next.id === own || unsaved >= SAVE_EVERY) await save();
      }
      await save();

      const changed = catalog.programs.find((p) => p.state === "changed");
      if (changed) throw new EngineError("VendorChanged", `SIX's catalog page for ${changed.name} (${changed.id}) changed`);
    },
  });
}
