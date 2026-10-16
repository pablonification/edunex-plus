// The real engine with its alert center, against the pretend world, catching
// every OS notification it would show and every message to the phone (a pretend ntfy).
import type { Event } from "../../src/core/contract";
import { translate } from "../../src/core/strings";
import type { AlertNotice } from "../../src/engine/alerts/center";
import type { Detector } from "../../src/engine/alerts/detector";
import { DETECTORS } from "../../src/engine/alerts/detectors";
import { createEngine, type Engine } from "../../src/engine/engine";
import { edunex } from "../../src/engine/sources/edunex";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendNtfy } from "../pretend/ntfy";
import { PretendWorld } from "../pretend/world";

export interface Shown extends AlertNotice {
  /** When it was shown (fake clock). */
  shownAt: number;
  /** Its title and body as the Student reads them in Indonesian. */
  text: string;
}

export async function startAlerts(
  options: { world?: PretendWorld; storage?: MemoryStorage; vault?: MemoryVault; ntfy?: PretendNtfy; signIn?: boolean; detectors?: readonly Detector[] } = {},
) {
  const world = options.world ?? new PretendWorld();
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const ntfy = options.ntfy ?? new PretendNtfy();
  const shown: Shown[] = [];
  const events: Event[] = [];
  const engine: Engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault,
    version: "2.0.0-test",
    emit: (event) => events.push(event),
    random: () => 0.5,
    sources: [edunex],
    detectors: options.detectors ?? DETECTORS,
    alert: (notice) => {
      const text = [notice.title, notice.body].flatMap((part) => (part ? [translate("id", part.key, part.vars)] : [])).join(" — ");
      shown.push({ ...notice, shownAt: world.clock.now(), text });
    },
    phone: { ntfy: ntfy.send, newTopic: ntfy.newTopic },
  });
  await engine.load();
  engine.start();
  if (options.signIn !== false) await engine.signIn("edunex", { token: PRETEND_TOKEN });
  return {
    world,
    engine,
    storage,
    vault,
    ntfy,
    shown,
    events,
    history: () =>
      engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { id: string; kind: string }[]; readAt: number } | undefined,
    wait: (ms: number) => world.clock.advance(ms),
    until: (iso: string) => world.clock.advanceTo(iso),
  };
}
