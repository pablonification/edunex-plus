// The demo on the phone: the desktop demo's own world (test/pretend/demo.ts): the pretend Edunex, SIX
// and ITB with the made-up student, its scenario and variants, the first sync played fast, then the
// clock in real time. Nothing reaches a real system. Only demo builds carry this file
// (metro.config.js).
//
// Which scenario: the link that opened the app, with the desktop demo's settings as its query
// (edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_QUIZ=1, what the flows open), else
// EXPO_PUBLIC_DEMO_QUERY (that query) or EXPO_PUBLIC_DEMO_SCENARIO from Metro, else signed-in.
//
// The states for pictures (./states.ts; every screen's list: mobile/qa/superapp-states.md), each off when absent:
//   EDUNEX_DEMO_OFFLINE=1       no network from the start, over saved data (resumes as EDUNEX_DEMO_RESUME=1 does; with
//                               nothing saved, the first read plays online and the network drops right after it)
//   EDUNEX_DEMO_OFFLINE=later   the network drops 5 seconds after the first read
//   EDUNEX_DEMO_FAIL=edunex|six|both   that system answers a server error (500) from right after the first read;
//                               with EDUNEX_DEMO_FAIL_AT=start, from the first read on (nothing saved: "couldn't load")
//   EDUNEX_DEMO_ENDED=six|edunex       that session ends right after the first read and Microsoft asks again
//                               (EDUNEX_DEMO_SIGN_IN=asks unless the link says otherwise): the "Masuk lagi" banner
//   EDUNEX_DEMO_HOLD=1          the first read never begins: every screen's loading shape, for as long as it's open
//   EDUNEX_DEMO_SLOW=<seconds>  the first read waits that long before it begins, then plays as usual
//   EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades   Edunex has none of those (a Student with nothing yet);
//                               a week with no classes is EDUNEX_DEMO_NOW instead (superapp-states.md says which)
import { Linking } from "react-native";
import type { SignInWindows } from "../../../src/desktop/signin-both";
import { fillablePdf } from "../../../test/kit/fillable-pdf";
import { demoOptions, demoRun } from "../../../test/pretend/demo";
import { BARE_PDF_URL, DOCX_URL, FILES_MODULE, PICTURE_URL, sampleDocx, samplePicture, streamed } from "./files";
import { applyAfterFirstRead, applyBeforeFirstRead, demoStates, OFFLINE_LATER_MS } from "./states";

async function settings(): Promise<Record<string, string | undefined>> {
  const link = await Linking.getInitialURL().catch(() => null);
  const query = link?.startsWith("edunexplusdemo://demo") ? new URL(link).searchParams : null;
  if (query) return Object.fromEntries(query.entries());
  // A dev build opens on Metro's link, not the demo's: Metro gives the same query instead (EXPO_PUBLIC_DEMO_QUERY).
  const fromMetro = process.env.EXPO_PUBLIC_DEMO_QUERY;
  if (fromMetro) return Object.fromEntries(new URLSearchParams(fromMetro).entries());
  return { EDUNEX_DEMO: process.env.EXPO_PUBLIC_DEMO_SCENARIO, EDUNEX_DEMO_THEME: process.env.EXPO_PUBLIC_DEMO_THEME };
}

export async function createDemoWorld() {
  const asked = await settings();
  const states = demoStates(asked);
  // An ended session shows its banner only if Microsoft asks again (else the app signs back in by itself).
  if (states.ended && !asked.EDUNEX_DEMO_SIGN_IN) asked.EDUNEX_DEMO_SIGN_IN = "asks";
  const run = demoRun(demoOptions(asked));
  applyBeforeFirstRead(run.world, states);
  // Offline from the start: the saved data's start has no first read to wait for; a fresh one goes online for it.
  if (states.offline === "start") run.world.setOffline(true);
  // The phone's own: the theme and language to picture it in (EDUNEX_DEMO_THEME=dark, EDUNEX_DEMO_LANG=en), for the
  // flows that take its pictures beside the desktop's.
  const theme = asked.EDUNEX_DEMO_THEME === "dark" || asked.EDUNEX_DEMO_THEME === "light" ? asked.EDUNEX_DEMO_THEME : undefined;
  const lang = asked.EDUNEX_DEMO_LANG === "en" || asked.EDUNEX_DEMO_LANG === "id" ? asked.EDUNEX_DEMO_LANG : undefined;
  // EDUNEX_DEMO_RESUME=1: start from what the demo saved last time, as a real start does, instead of a fresh first
  // sync: what the cold-start measure (PROGRESS.md, the performance round) times.
  const resume = asked.EDUNEX_DEMO_RESUME === "1" || states.offline === "start";
  // EDUNEX_DEMO_NOTIFY=1: its alerts go to Android as the real app's do, booked ahead too (with EDUNEX_DEMO_NOW a
  // few minutes before a class, the class-start reminder comes with the app closed).
  const notify = asked.EDUNEX_DEMO_NOTIFY === "1";
  // EDUNEX_DEMO_FILES=1: II4091's Modul 3 holds a Word document and a PDF its storage names with no extension and no
  // type, beside its slides (W1's flow: every kind opens in the phone's app, or says why with the way forward).
  if (asked.EDUNEX_DEMO_FILES === "1") {
    run.world.edunex.postMaterial(FILES_MODULE.courseId, {
      moduleId: FILES_MODULE.moduleId,
      name: "Rubrik Penilaian Proposal",
      type: "docx",
      content: DOCX_URL,
    });
    run.world.edunex.postMaterial(FILES_MODULE.courseId, {
      moduleId: FILES_MODULE.moduleId,
      name: "Contoh Proposal Terbaik",
      type: "file",
      content: BARE_PDF_URL,
    });
  }
  // The engine the demo prepared, for the links below that make it read again at once.
  let engine: Parameters<typeof run.prepare>[0] | null = null;
  // While the demo runs, its link with ?end=six (or ?end=edunex) ends that system's pretend session, as SIX's
  // 30-day cookie does, and the app reads it at once: it signs back in by itself (../host/resignin.ts), with no
  // banner, unless EDUNEX_DEMO_SIGN_IN=asks has Microsoft ask for the Student.
  Linking.addEventListener("url", ({ url }) => {
    if (!url.startsWith("edunexplusdemo://demo")) return;
    const end = new URL(url).searchParams.get("end");
    if (end !== "six" && end !== "edunex") return;
    run.world[end].expireSession();
    void engine?.refresh(end).catch(() => undefined);
  });
  // While the demo runs, its link with ?post=kuis puts a new Task on the pretend Edunex, as the desktop demo's pictures
  // do before the bell's (scripts/demo/capture.mjs): the next read finds it and the bell gets an unread alert.
  Linking.addEventListener("url", ({ url }) => {
    if (!url.startsWith("edunexplusdemo://demo") || new URL(url).searchParams.get("post") !== "kuis") return;
    run.world.edunex.postTask(95001, {
      name: "Kuis Kilat Bab 5",
      description: "<p>Kerjakan 5 soal tentang inovasi proses di Bab 5. Unggah jawaban dalam satu PDF.</p>",
      end_at: "2026-10-15T23:59:00+07:00",
      file_required: true,
      is_lateable: false,
    });
  });
  const demoFile = async (url: string, init?: RequestInit): Promise<Response> => {
    // The note's picture and W1's two files, as a real storage answers for them: the picture and the Word document
    // with their types, the bare PDF as bytes with no name and no type.
    if (url === PICTURE_URL) return new Response(samplePicture(), { status: 200, headers: { "content-type": "image/png" } });
    if (url === DOCX_URL)
      return new Response(sampleDocx(), {
        status: 200,
        headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      });
    if (url === BARE_PDF_URL) return new Response(new Uint8Array(fillablePdf()), { status: 200, headers: { "content-type": "application/octet-stream" } });
    const stored = await run.world.fetch(url, { signal: init?.signal ?? undefined });
    return stored.status === 200 ? stored : new Response(new Uint8Array(fillablePdf()), { status: 200, headers: { "content-type": "application/pdf" } });
  };
  const signInWindows: SignInWindows = {
    open: (source, how) => run.signIn(source, how),
    stopQuiet: () => undefined,
    forget: async () => undefined,
  };
  return {
    resume,
    notify,
    signInWindows,
    transport: run.world,
    // Files from the pretend storage, as the desktop demo serves them (scripts/demo/setup.ts): what's stored there,
    // else (a lecturer's file the pretend Edunex only names) a made-up PDF.
    fetchFile: async (url: string, init?: RequestInit) => streamed(await demoFile(url, init)),
    clock: run.world.clock,
    world: run.world,
    clockOffset: () => run.world.clock.now() - Date.now(),
    prepare: async (prepared: Parameters<typeof run.prepare>[0]) => {
      engine = prepared;
      // EDUNEX_DEMO_HOLD=1: the first read never begins, so the screens keep their loading shapes.
      if (states.hold) return new Promise<void>(() => undefined);
      if (states.slowSeconds) await new Promise((done) => setTimeout(done, states.slowSeconds * 1_000));
      if (states.offline === "start") run.world.setOffline(false);
      // Each step of the demo's start timed for the lab ("[startup] demo …"): where a fresh install's seconds go.
      const signIn = prepared.signIn.bind(prepared);
      let at = Date.now();
      const began = at;
      prepared.signIn = async (...args: Parameters<typeof signIn>) => {
        const result = await signIn(...args);
        console.info(`[startup] demo sign-in ${args[0]} ${Date.now() - at}`);
        at = Date.now();
        return result;
      };
      await run.prepare(prepared);
      prepared.signIn = signIn;
      const again = (source: "edunex" | "six") => void prepared.refresh(source).catch(() => undefined);
      applyAfterFirstRead(run.world, states, again);
      if (states.offline === "later")
        setTimeout(() => {
          run.world.setOffline(true);
          again("edunex");
          again("six");
        }, OFFLINE_LATER_MS);
      console.info(`[startup] demo rest ${Date.now() - at} total ${Date.now() - began}`);
      if (theme || lang) await prepared.updateSettings({ ...(theme ? { theme } : {}), ...(lang ? { lang } : {}) });
    },
  };
}
