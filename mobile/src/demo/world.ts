// The demo on the phone: the desktop demo's own world (test/pretend/demo.ts): the pretend Edunex, SIX
// and ITB with the made-up student, its scenario and variants, the first sync played fast, then the
// clock in real time. Nothing reaches a real system. Only demo builds carry this file
// (metro.config.js).
//
// Which scenario: the link that opened the app, with the desktop demo's settings as its query
// (edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_QUIZ=1, what the flows open), else
// EXPO_PUBLIC_DEMO_SCENARIO from Metro, else signed-in.
import { Linking } from "react-native";
import type { SignInWindows } from "../../../src/desktop/signin-both";
import { demoOptions, demoRun } from "../../../test/pretend/demo";

async function settings(): Promise<Record<string, string | undefined>> {
  const link = await Linking.getInitialURL().catch(() => null);
  const query = link?.startsWith("edunexplusdemo://demo") ? new URL(link).searchParams : null;
  if (query) return Object.fromEntries(query.entries());
  return { EDUNEX_DEMO: process.env.EXPO_PUBLIC_DEMO_SCENARIO, EDUNEX_DEMO_THEME: process.env.EXPO_PUBLIC_DEMO_THEME };
}

export async function createDemoWorld() {
  const asked = await settings();
  const run = demoRun(demoOptions(asked));
  // The phone's own: the theme and language to picture it in (EDUNEX_DEMO_THEME=dark, EDUNEX_DEMO_LANG=en), for the
  // flows that take its pictures beside the desktop's.
  const theme = asked.EDUNEX_DEMO_THEME === "dark" || asked.EDUNEX_DEMO_THEME === "light" ? asked.EDUNEX_DEMO_THEME : undefined;
  const lang = asked.EDUNEX_DEMO_LANG === "en" || asked.EDUNEX_DEMO_LANG === "id" ? asked.EDUNEX_DEMO_LANG : undefined;
  const signInWindows: SignInWindows = {
    open: (source, how) => run.signIn(source, how),
    stopQuiet: () => undefined,
    forget: async () => undefined,
  };
  return {
    signInWindows,
    transport: run.world,
    // Files from the pretend storage, as the desktop demo serves them (scripts/demo/setup.ts).
    fetchFile: (url: string, init?: RequestInit) => run.world.fetch(url, { signal: init?.signal ?? undefined }),
    clock: run.world.clock,
    world: run.world,
    clockOffset: () => run.world.clock.now() - Date.now(),
    prepare: async (engine: Parameters<typeof run.prepare>[0]) => {
      await run.prepare(engine);
      if (theme || lang) await engine.updateSettings({ ...(theme ? { theme } : {}), ...(lang ? { lang } : {}) });
    },
  };
}
