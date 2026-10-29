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
  return { EDUNEX_DEMO: process.env.EXPO_PUBLIC_DEMO_SCENARIO };
}

export async function createDemoWorld() {
  const run = demoRun(demoOptions(await settings()));
  const signInWindows: SignInWindows = {
    open: (source, how) => run.signIn(source, how),
    stopQuiet: () => undefined,
    forget: async () => undefined,
  };
  return {
    signInWindows,
    transport: run.world,
    clock: run.world.clock,
    world: run.world,
    clockOffset: () => run.world.clock.now() - Date.now(),
    prepare: async (engine: Parameters<typeof run.prepare>[0]) => void (await run.prepare(engine)),
  };
}
