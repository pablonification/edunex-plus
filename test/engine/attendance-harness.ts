// The real engine with its alert center, the pretend EduNex and ITB, and a
// stand-in SIX the test controls (until #76 lands its source): its count of
// each course ("Hadir X dari Y pertemuan") and its timetable, stored under
// the shared SIX dataset names every 15 minutes, like a real feed.
import type { ClassSession, DatasetName, DatasetValue, SixCourse, SixStudent } from "../../src/core/models";
import { translate } from "../../src/core/strings";
import { DETECTORS } from "../../src/engine/alerts/detectors";
import { createEngine, type Engine } from "../../src/engine/engine";
import { EngineError } from "../../src/engine/errors";
import { edunex } from "../../src/engine/sources/edunex";
import { itb } from "../../src/engine/sources/itb";
import type { Source } from "../../src/engine/sources/source";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";
import type { Shown } from "./alerts-harness";

export interface PretendSixState {
  student: SixStudent;
  courses: SixCourse[];
  schedule: ClassSession[];
  /** SIX can't be reached: its feed fails and nothing is read. */
  offline?: boolean;
}

const as = <T>(name: string, value: T) => [name as DatasetName, value as unknown as DatasetValue<DatasetName>] as const;

export function standInSix(state: PretendSixState): Source<null> {
  return {
    id: "six",
    session: null,
    liveness: null,
    start(context) {
      context.feed({
        name: "six.status",
        every: 15 * 60_000,
        jitter: 0,
        async run(current) {
          if (!current()) return;
          if (state.offline) throw new EngineError("Offline", "SIX is unreachable");
          for (const [name, value] of [as("six.student", state.student), as("six.courses", state.courses), as("six.schedule", state.schedule)]) await context.set(name, structuredClone(value));
        },
      });
    },
  };
}

export const STUDENT: SixStudent = { nim: "18223901", name: "Pretend Student", studentId: "900001", term: "2026-1", program: null, programCode: null };

export async function startAttendance(options: { world?: PretendWorld; six: PretendSixState; storage?: MemoryStorage; vault?: MemoryVault; signIn?: boolean }) {
  const world = options.world ?? new PretendWorld();
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const shown: Shown[] = [];
  const engine: Engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault,
    version: "2.0.0-test",
    emit: () => undefined,
    random: () => 0.5,
    sources: [edunex, standInSix(options.six), itb],
    detectors: DETECTORS,
    alert: (notice) => {
      const text = [notice.title, notice.body].flatMap((part) => (part ? [translate("id", part.key, part.vars)] : [])).join(" — ");
      shown.push({ ...notice, shownAt: world.clock.now(), text });
    },
  });
  await engine.load();
  engine.start();
  if (options.signIn !== false) await engine.signIn("edunex", { token: PRETEND_TOKEN });
  return {
    world,
    engine,
    storage,
    vault,
    shown,
    of: (kind: string) => shown.filter((n) => n.kind === kind),
    until: (iso: string) => world.clock.advanceTo(iso),
    /** SIX refreshes now (as after the Student's own refresh). */
    sixRefresh: () => engine.refresh("six"),
  };
}
