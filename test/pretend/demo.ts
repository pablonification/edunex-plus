// The demo's world, shared by the desktop demo (scripts/demo/setup.ts) and the phone's demo build
// (mobile/src/demo/world.ts): the pretend Edunex, SIX and ITB with the made-up student, a scenario
// and its variants applied, on a clock that starts at a chosen moment, plays the first sync fast,
// then runs in real time. Phone-safe: no Node, no Electron (test/kit/phone-safe.test.ts).
//
// The options are the desktop demo's EDUNEX_DEMO_* settings (see scripts/demo/setup.ts for what each
// one does); demoOptions() reads them from the environment, or from a phone's demo link.
import type { Engine } from "../../src/engine/engine";
import { PRETEND_TOKEN } from "./edunex";
import { PRETEND_RELAY } from "./relay";
import { PRETEND_SIX_COOKIE } from "./six";
import { PretendWorld } from "./world";

export type DemoScenario = "signed-in" | "edunex-only" | "first-run";

export interface DemoOptions {
  scenario: DemoScenario;
  /** EDUNEX_DEMO_NOW: the moment the demo starts. */
  now?: string;
  checkIn?: "open";
  quiz?: boolean;
  afterClass?: "counted" | "absent" | "missing";
  signIn?: "asks" | "fails";
  relay?: boolean;
  edit?: boolean;
  sick?: boolean;
  odd?: boolean;
  courseTable?: "changed" | "lost" | "blank";
  timetable?: "unread";
}

const oneOf = <T extends string>(name: string, value: string | undefined, allowed: readonly T[]): T | undefined => {
  if (value === undefined || value === "") return undefined;
  if (!allowed.includes(value as T)) throw new Error(`Unknown ${name} "${value}"`);
  return value as T;
};
const flag = (value: string | undefined) => value === "1";

/** The options from EDUNEX_DEMO_* values (the desktop demo's environment, or a phone demo link's query). */
export function demoOptions(env: Record<string, string | undefined>): DemoOptions {
  return {
    scenario: oneOf("EDUNEX_DEMO scenario", env.EDUNEX_DEMO, ["signed-in", "edunex-only", "first-run"] as const) ?? "signed-in",
    now: env.EDUNEX_DEMO_NOW || undefined,
    checkIn: oneOf("EDUNEX_DEMO_CHECK_IN", env.EDUNEX_DEMO_CHECK_IN, ["open"] as const),
    quiz: flag(env.EDUNEX_DEMO_QUIZ),
    afterClass: oneOf("EDUNEX_DEMO_AFTER_CLASS", env.EDUNEX_DEMO_AFTER_CLASS, ["counted", "absent", "missing"] as const),
    signIn: oneOf("EDUNEX_DEMO_SIGN_IN", env.EDUNEX_DEMO_SIGN_IN, ["asks", "fails"] as const),
    relay: flag(env.EDUNEX_DEMO_RELAY),
    edit: flag(env.EDUNEX_DEMO_EDIT),
    sick: flag(env.EDUNEX_DEMO_SICK),
    odd: flag(env.EDUNEX_DEMO_ODD),
    courseTable: oneOf("EDUNEX_DEMO_COURSE_TABLE", env.EDUNEX_DEMO_COURSE_TABLE, ["changed", "lost", "blank"] as const),
    timetable: oneOf("EDUNEX_DEMO_TIMETABLE", env.EDUNEX_DEMO_TIMETABLE, ["unread"] as const),
  };
}

/**
 * Signed-in demos start a few minutes early: the first sync (SIX at a page every two seconds, ITB's
 * catalog) is played fast before the screens show. Played on through the day, it starts before the
 * morning's class, so the app watches it from the start.
 */
export function demoStart(options: DemoOptions): string {
  return (
    options.now ??
    (options.scenario === "first-run" ? "2026-10-08T08:10:00+07:00" : options.afterClass ? "2026-10-08T07:30:00+07:00" : "2026-10-08T08:07:00+07:00")
  );
}

/** The pretend world with the scenario's variants on its pages (the ones that hold from the start). */
export function demoWorld(options: DemoOptions): PretendWorld {
  const world = new PretendWorld({ now: demoStart(options) });
  if (options.checkIn === "open") world.six.openCheckIn("2194342");
  if (options.sick)
    world.six.editPage(/\/statusmhs$/, (html) =>
      html.replace(
        '<span title="Hadir 4 dari 6 pertemuan">66.67%</span>',
        '<span title="Hadir 4 dari 6 pertemuan">66.67%</span> / <span title="Hadir dan sakit 5 dari 6 pertemuan">83.33%</span>',
      ),
    );
  if (options.odd) {
    world.six.editPage(/\/keuangan$/, (html) =>
      html.replace(
        /(<td class="text-right">\s*5\.400\.000\s*<\/td><td class="text-right">\s*)5\.400\.000(\s*<\/td><td class="text-left">\s*24 Agu 2026)/,
        "$1Lunas$2",
      ),
    );
    world.six.editPage(/\/transkrip\/historis\/\d+$/, (html) =>
      html.replace(/(<td>FI1101<span[^>]*>-19<\/span><\/td><td>[^<]*<\/td><td>4<\/td><td>)\s*A\s*/, "$1A (remedial)"),
    );
  }
  if (options.courseTable === "lost") world.six.changeLayout(/\/statusmhs$/, "<td>KU5014</td>", "<td>KU-5014</td>");
  if (options.courseTable === "blank")
    world.six.editPage(/\/statusmhs$/, (html) =>
      html.replace('<th class="text-right">Kehadiran</th>', "").replace(/<td class="text-right">[\s\S]*?<\/td>/g, ""),
    );
  if (options.timetable === "unread") world.six.moveMeeting("2153983", "11.00", "12.59");
  if (options.quiz)
    world.edunex.exams.set(93409, [
      { id: 88002, type: "exams", attributes: { name: "Kuis Brand Equity", start_at: "2026-10-19T08:00:00+07:00", end_at: "2026-10-30T23:59:00+07:00" } },
    ]);
  return world;
}

export interface DemoRun {
  world: PretendWorld;
  /** The pretend report relay's address when the options ask for one. */
  relay: string | undefined;
  /** Lets the pretend clock run fast until `work` is done. */
  fastForward<T>(work: Promise<T>): Promise<T>;
  /** From now on the pretend clock keeps pace with the real one. */
  runInRealTime(): void;
  /** What a sign-in hands back (Edunex's token, SIX's cookie), as the demo's sign-in window would; null when a quiet try gives up. */
  signIn(source: "edunex" | "six", how: { quiet: boolean; onStep(step: "finishing" | null): void }): Promise<string | null>;
  /** Signs in and syncs before the screens show; `brief` is the PDF the EDIT variant's revised Task links. True when it started the engine. */
  prepare(engine: Engine, extras?: { brief?: Uint8Array; afterSignIn?(engine: Engine): Promise<void> }): Promise<boolean>;
}

export function demoRun(options: DemoOptions): DemoRun {
  const world = demoWorld(options);
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Ten pretend minutes fly by in under a second, which on a busy machine can be sooner than the
   * sync's real disk writes finish: past them the clock slows down, and the work gets up to half a
   * minute of real time before the demo gives up.
   */
  async function fastForward<T>(work: Promise<T>): Promise<T> {
    let outcome: { value: T } | { error: unknown } | null = null;
    void work.then(
      (value) => (outcome = { value }),
      (error: unknown) => (outcome = { error }),
    );
    const deadline = Date.now() + 30_000;
    for (let second = 0; !outcome && (second < 600 || Date.now() < deadline); second++) {
      await world.clock.advance(1_000);
      if (second >= 600) await wait(50);
    }
    if (!outcome) throw new Error("the demo's first sync didn't finish");
    const done = outcome as { value: T } | { error: unknown };
    if ("error" in done) throw done.error;
    return done.value;
  }

  function runInRealTime(): void {
    let last = Date.now();
    let busy = false;
    const timer = setInterval(() => {
      if (busy) return;
      busy = true;
      const now = Date.now();
      void world.clock.advance(now - last).finally(() => {
        last = now;
        busy = false;
      });
    }, 200);
    // Node: the timer alone never keeps the process up.
    (timer as { unref?: () => void }).unref?.();
  }

  /** Runs the pretend clock to `iso`, a minute at a time, so every feed and alert on the way has its turn. */
  async function runUntil(iso: string): Promise<void> {
    const until = Date.parse(iso);
    while (world.clock.now() < until) await world.clock.advance(Math.min(60_000, until - world.clock.now()));
  }

  /** The day goes on to 16:05: SIX counts PL3002's morning class, then does what afterClass says with DK4073's 11:00. */
  async function playTheDay(engine: Engine, result: NonNullable<DemoOptions["afterClass"]>): Promise<void> {
    await runUntil("2026-10-08T10:30:00+07:00");
    world.six.setAttendance("PL3002", 7, 8);
    await runUntil("2026-10-08T13:30:00+07:00");
    if (result === "counted") world.six.setAttendance("DK4073", 5, 7);
    if (result === "absent") world.six.setAttendance("DK4073", 4, 7);
    await runUntil("2026-10-08T16:05:00+07:00");
    // SIX read once more past DK4073's check (15:59), as its hourly read would soon.
    await fastForward(engine.refresh("six"));
  }

  return {
    world,
    relay: options.relay ? PRETEND_RELAY : undefined,
    fastForward,
    runInRealTime,
    async signIn(source, { quiet, onStep }) {
      // About as long as a sign-in window that remembers the Microsoft account, then the website reading its
      // session out of sight. A quiet try for the other system finds Microsoft's session, unless signIn says
      // Microsoft asks for the Student again.
      if (options.signIn === "fails" && !quiet) throw new Error("The pretend sign-in page couldn't open");
      await wait(900);
      if (quiet && options.signIn === "asks") return null;
      if (!quiet) {
        onStep("finishing");
        await wait(1_500);
      }
      return source === "edunex" ? PRETEND_TOKEN : PRETEND_SIX_COOKIE;
    },
    async prepare(engine, extras = {}) {
      // The demo's pictures and the scripts that drive it read the screens in Bahasa Indonesia; the app itself
      // starts in English (DEFAULT_SETTINGS), and `demo.settings({ lang: "en" })` switches.
      await engine.updateSettings({ lang: "id" });
      if (options.scenario === "first-run") {
        runInRealTime();
        return false;
      }
      engine.start();
      await fastForward(engine.signIn("edunex", { token: PRETEND_TOKEN }));
      if (options.scenario === "signed-in") await fastForward(engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
      // ITB's calendar, the public catalog's pages (one every 3.5 s), and the first alerts settle.
      await world.clock.advance(200_000);
      if (options.edit) {
        const brief = "https://edunexfixture.blob.core.windows.net/edunex/fixture-brief-v2";
        if (extras.brief) world.putFile(brief, extras.brief);
        // Saved 3 minutes after the demo's start (08:10), not when the sign-ins above happened to end: their
        // pretend time depends on how fast the machine runs, and the Task's "Diubah dosen" shows this moment.
        world.edunex.editTask(
          117001,
          {
            end_at: "2026-10-12T23:59:00+07:00",
            description:
              "<p>Kumpulkan ulang Bab I yang sudah direvisi memakai template terbaru, paling lambat Senin, 12 Oktober 2026 pukul 23.59.</p><p>Format berkas PDF, nama berkas NIM_Bab1.pdf.</p>",
            files: [{ name: "brief-v2.pdf", file: brief }],
          },
          Date.parse(demoStart(options)) + 180_000,
        );
        await fastForward(engine.refresh("edunex"));
      }
      if (options.courseTable === "changed" && options.scenario === "signed-in") {
        world.six.joinCodeAndName();
        await fastForward(engine.refresh("six"));
      }
      await engine.updateSettings({ firstScanDone: true });
      await extras.afterSignIn?.(engine);
      if (options.afterClass && options.scenario === "signed-in") await playTheDay(engine, options.afterClass);
      runInRealTime();
      return true;
    },
  };
}
