// The demo's states for pictures (mobile/qa/superapp-states.md): offline, a server error, an ended session, a held
// first read, and a Student with nothing. Each is a query option on the demo's link, read at start-up by ./world.ts;
// none changes the demo when it's absent. No React Native here, so Node's tests read it (test/mobile/demo-states.test.ts).
import type { PretendWorld } from "../../../test/pretend/world";

export type DemoSource = "edunex" | "six";
export type EmptyKind = "tasks" | "exams" | "material" | "alerts" | "grades";

export interface DemoStates {
  /** EDUNEX_DEMO_OFFLINE=1: no network from the start, over saved data. `later`: it goes down a few seconds in. */
  offline?: "start" | "later";
  /** EDUNEX_DEMO_FAIL=edunex|six|both: that system answers a server error (500) once the first read is saved. */
  fail: DemoSource[];
  /** EDUNEX_DEMO_FAIL_AT=start: the error from the very first read, so nothing is saved ("couldn't load"). */
  failAtStart: boolean;
  /** EDUNEX_DEMO_ENDED=six|edunex: that system's session ends right after the first read; Microsoft asks again. */
  ended?: DemoSource;
  /** EDUNEX_DEMO_HOLD=1: the first read never begins (every screen's loading shape, for good). */
  hold: boolean;
  /** EDUNEX_DEMO_SLOW=<seconds>: the first read waits this long (real time) before it begins, then plays as usual. */
  slowSeconds: number;
  /** EDUNEX_DEMO_EMPTY=tasks,exams,material,alerts,grades: Edunex has none of these kinds. */
  empty: EmptyKind[];
  /**
   * EDUNEX_DEMO_LONG=1: II4091, Task 117001 and the Student themself carry the longest names a Student might meet (a
   * big font's worst case).
   */
  long: boolean;
}

/** How long after the first read `offline=later` drops the network (real time). */
export const OFFLINE_LATER_MS = 5_000;

const SOURCES = ["edunex", "six"] as const;
const EMPTY_KINDS = ["tasks", "exams", "material", "alerts", "grades"] as const;

function listOf<T extends string>(name: string, value: string | undefined, allowed: readonly T[]): T[] {
  if (!value) return [];
  const all = value.split(",").map((part) => part.trim());
  if (value === "both" && (allowed as readonly string[]).includes("six")) return [...allowed];
  for (const part of all) if (!allowed.includes(part as T)) throw new Error(`Unknown ${name} "${part}"`);
  return all as T[];
}

/** The states the link asks for (its EDUNEX_DEMO_* query). */
export function demoStates(asked: Record<string, string | undefined>): DemoStates {
  const offline = asked.EDUNEX_DEMO_OFFLINE;
  if (offline && offline !== "1" && offline !== "later") throw new Error(`Unknown EDUNEX_DEMO_OFFLINE "${offline}"`);
  const ended = asked.EDUNEX_DEMO_ENDED;
  if (ended && ended !== "six" && ended !== "edunex") throw new Error(`Unknown EDUNEX_DEMO_ENDED "${ended}"`);
  const slow = Number(asked.EDUNEX_DEMO_SLOW ?? 0);
  return {
    offline: offline === "1" ? "start" : offline === "later" ? "later" : undefined,
    fail: listOf("EDUNEX_DEMO_FAIL", asked.EDUNEX_DEMO_FAIL, SOURCES),
    failAtStart: asked.EDUNEX_DEMO_FAIL_AT === "start",
    ended: ended === "six" || ended === "edunex" ? ended : undefined,
    hold: asked.EDUNEX_DEMO_HOLD === "1",
    slowSeconds: Number.isFinite(slow) && slow > 0 ? slow : 0,
    empty: listOf("EDUNEX_DEMO_EMPTY", asked.EDUNEX_DEMO_EMPTY, EMPTY_KINDS),
    long: asked.EDUNEX_DEMO_LONG === "1",
  };
}

/** Every Edunex path but the one its sign-in checks, so a failing Edunex still lets the Student in. */
const EDUNEX_DATA = /^(?!\/login\/me$)/;
/** Every SIX page but its sign-in pages. */
const SIX_DATA = /^\/app\//;

/** Makes `source` answer a server error on every read of its data, until the demo restarts. */
export function failSource(world: PretendWorld, source: DemoSource): void {
  if (source === "edunex") world.edunex.fail(EDUNEX_DATA, 500);
  else world.six.fail(SIX_DATA, 500);
}

/** Edunex with none of `kinds`, before the first read: what a first-term Student with nothing yet sees. */
export function emptyWorld(world: PretendWorld, kinds: readonly EmptyKind[]): void {
  const edunex = world.edunex;
  if (kinds.includes("tasks")) for (const id of edunex.tasks.keys()) edunex.tasks.set(id, []);
  if (kinds.includes("exams")) edunex.exams.clear();
  if (kinds.includes("material")) {
    edunex.contents.clear();
    for (const id of edunex.modules.keys()) edunex.modules.delete(id);
  }
  if (kinds.includes("alerts")) {
    edunex.announcements.clear();
    edunex.activeAnnouncements = [];
  }
  if (kinds.includes("grades")) edunex.gradebooks.clear();
}

/** II4091's name on SIX ("Proposal Tugas Akhir") and on Edunex ("Final Project Proposal"), made long. */
export const LONG_COURSE = "Proposal Tugas Akhir dan Metodologi Penelitian Sistem dan Teknologi Informasi";
export const LONG_COURSE_EDUNEX = "Final Project Proposal and Research Methodology for Information Systems and Technology";
/** Task 117001's title, made a sentence long. */
export const LONG_TASK =
  "Tugas 01 Bab I: Latar Belakang, Rumusan Masalah, Tujuan, Batasan Masalah, dan Sistematika Penulisan Proposal Tugas Akhir (revisi kedua)";
const LONG_TASK_ID = 117001;
/** The made-up Student's own name ("Dimas Pratama" in the recordings), made long: the first minute's door, Profil's card. */
const STUDENT = "Dimas Pratama";
const LONG_STUDENT = "Muhammad Rizky Ramadhan Pratama";

/** One course, one Task and the Student with long names, on SIX's pages and in Edunex's answers, without a new recording. */
export function longNames(world: PretendWorld): void {
  world.six.editPage(/./, (html) => html.split("Proposal Tugas Akhir").join(LONG_COURSE).split(STUDENT).join(LONG_STUDENT));
  const lengthen = <T>(value: T): T => JSON.parse(JSON.stringify(value).split("Final Project Proposal").join(LONG_COURSE_EDUNEX)) as T;
  const edunex = world.edunex;
  edunex.me = JSON.parse(JSON.stringify(edunex.me).split(STUDENT).join(LONG_STUDENT));
  edunex.myCourses = lengthen(edunex.myCourses);
  edunex.agenda = lengthen(edunex.agenda);
  for (const map of [edunex.courseDetail, edunex.coursePlain]) for (const [id, course] of map) map.set(id, lengthen(course));
  for (const list of edunex.tasks.values()) for (const task of list) if (Number(task.id) === LONG_TASK_ID) task.attributes.name = LONG_TASK;
}

/** The states that hold before the first read (the world as the link asks for it). */
export function applyBeforeFirstRead(world: PretendWorld, states: DemoStates): void {
  emptyWorld(world, states.empty);
  if (states.long) longNames(world);
  if (states.failAtStart) for (const source of states.fail) failSource(world, source);
}

/** The states that come once the first read is saved; `refresh` reads that system again at once. */
export function applyAfterFirstRead(world: PretendWorld, states: DemoStates, refresh: (source: DemoSource) => void): void {
  if (!states.failAtStart) for (const source of states.fail) failSource(world, source);
  if (states.ended) world[states.ended].expireSession();
  if (states.offline === "start") world.setOffline(true);
  for (const source of SOURCES)
    if (states.offline === "start" || (!states.failAtStart && states.fail.includes(source)) || states.ended === source) refresh(source);
}
