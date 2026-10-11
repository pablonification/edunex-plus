// The real engine with its alert center, the pretend SIX's record pages (KRS,
// bills…) read the way the SIX client does, and ITB's calendar, on a fake
// clock. Catches every OS notification the engine would show.
import { z } from "zod";
import { translate } from "../../src/core/strings";
import { DETECTORS } from "../../src/engine/alerts/detectors";
import { createEngine, type Engine } from "../../src/engine/engine";
import { EngineError } from "../../src/engine/errors";
import { registerCalendarFeed } from "../../src/engine/sources/itb/calendar";
import type { SixPages } from "../../src/engine/sources/six/pages";
import { registerSixRecordFeeds } from "../../src/engine/sources/six/records";
import type { Source } from "../../src/engine/sources/source";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PRETEND_SIX_COOKIE, SIX_ORIGIN } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import type { Shown } from "./alerts-harness";

const IDENTITY = { nim: "18223901", studentId: "2021000001", term: "2026-1" };

function pagesOver(world: PretendWorld): SixPages {
  return {
    who: async () => IDENTITY,
    async page(path) {
      const response = await world.request({ method: "GET", url: `${SIX_ORIGIN}${path}`, headers: { cookie: PRETEND_SIX_COOKIE }, redirect: "manual" });
      if (response.status === 302) throw new EngineError("Unauthorized", "SIX ended the session");
      if (response.status === 429 || response.status >= 500) throw new EngineError("Offline", `SIX answered ${response.status}`);
      if (response.status !== 200) throw new EngineError("Failed", `SIX answered ${response.status} for ${path}`);
      return response.body;
    },
  };
}

export async function startAcademic(options: { world: PretendWorld; storage?: MemoryStorage; vault?: MemoryVault; signIn?: boolean }) {
  const { world } = options;
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const shown: Shown[] = [];
  const six: Source<{ cookie: string }> = { id: "six", session: z.object({ cookie: z.string() }), liveness: null, start: (context) => registerSixRecordFeeds(context, pagesOver(world)) };
  const calendar: Source<null> = { id: "itb", session: null, liveness: null, start: registerCalendarFeed };
  const engine: Engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault,
    version: "2.0.0-test",
    emit: () => undefined,
    random: () => 0.5,
    sources: [six, calendar],
    detectors: DETECTORS,
    alert: (notice) => {
      const text = [notice.title, notice.body].flatMap((part) => (part ? [translate("id", part.key, part.vars)] : [])).join(" — ");
      shown.push({ ...notice, shownAt: world.clock.now(), text });
    },
  });
  await engine.load();
  engine.start();
  if (options.signIn !== false) await engine.signIn("six", { cookie: PRETEND_SIX_COOKIE });
  await world.clock.advance(1_000);
  return {
    world,
    engine,
    storage,
    vault,
    shown,
    of: (kind: string) => shown.filter((n) => n.kind === kind),
    texts: (kind: string) => shown.filter((n) => n.kind === kind).map((n) => n.text),
    history: () => (engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { id: string; kind: string; title: { key: string } }[] } | undefined)?.items ?? [],
    until: (iso: string) => world.clock.advanceTo(iso),
    /** SIX is read again now (as after the Student's refresh), and the alert center has time to group. */
    sixRefresh: async () => {
      await engine.refresh("six");
      await world.clock.advance(30_000);
    },
  };
}
