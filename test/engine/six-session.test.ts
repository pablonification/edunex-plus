// v2-08 (#76): SIX sign-in → this term's courses, and the timetable. The real
// engine against the pretend SIX, on a fake clock: SIX is read at human pace
// (a page every two seconds), so tests let time pass while it reads.
import { describe, expect, it } from "vitest";
import type { ClassSession } from "../../src/core/models";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PRETEND_SIX_COOKIE, SIX_ORIGIN } from "../pretend/six";
import { type Harness, startEngine } from "./harness";

const SIX = { cookie: PRETEND_SIX_COOKIE };
const at = (iso: string) => Date.parse(iso);

/** Lets the fake clock run until `work` is done. */
async function until<T>(h: Harness, work: Promise<T>): Promise<T> {
  let outcome: { value: T } | { error: unknown } | null = null;
  void work.then(
    (value) => (outcome = { value }),
    (error: unknown) => (outcome = { error }),
  );
  for (let second = 0; second < 600 && !outcome; second++) await h.world.clock.advance(1_000);
  if (!outcome) throw new Error("still waiting after ten minutes");
  const done = outcome as { value: T } | { error: unknown };
  if ("error" in done) throw done.error;
  return done.value;
}

async function signedIn(options: Parameters<typeof startEngine>[0] = {}) {
  const h = await startEngine(options);
  await until(h, h.engine.signIn("six", SIX));
  return h;
}

const sixRequests = (h: Harness, since = 0) => h.world.log.filter((r) => r.url.startsWith(SIX_ORIGIN) && r.at >= since);
const meeting = (h: Harness, id: string) => h.dataset("six.schedule")?.find((s) => s.id === id);

const COURSES = [
  { code: "DK4073", name: "Komunikasi Pemasaran", classNo: "01", sks: 3, attendance: { attended: 4, held: 6 } },
  { code: "II4091", name: "Proposal Tugas Akhir", classNo: "01", sks: 2, attendance: { attended: 3, held: 3 } },
  { code: "KU5014", name: "Teknik Penyelesaian Masalah Terstruktur", classNo: "01", sks: 3, attendance: { attended: 2, held: 6 } },
  { code: "PL3002", name: "Ekonomi dan Inovasi dalam Perencanaan", classNo: "01", sks: 3, attendance: { attended: 6, held: 7 } },
  { code: "PL3032", name: "Ekonomi Infrastruktur dan Transportasi", classNo: "01", sks: 3, attendance: { attended: 4, held: 7 } },
];

describe("SIX sign-in → this term's courses", () => {
  it("first sign-in loads the Student, this term's courses with exact attendance, and the timetable", async () => {
    const h = await startEngine();
    expect(h.status("six").state).toBe("signed-out");
    await until(h, h.engine.signIn("six", SIX));
    expect(h.status("six")).toMatchObject({ state: "live", detail: null });
    expect(h.dataset("six.student")).toEqual({
      nim: "18223901",
      name: "Dimas Pratama",
      studentId: "2021000001",
      term: "2026-1",
      program: "Sistem dan Teknologi Informasi",
      programCode: "182",
    });
    expect(h.dataset("six.courses")).toEqual(COURSES);

    const schedule = h.dataset("six.schedule")!;
    expect(schedule).toHaveLength(22);
    expect(schedule.map((s) => s.start)).toEqual([...schedule.map((s) => s.start)].sort((a, b) => a - b));
    expect(meeting(h, "2194342")).toEqual({
      id: "2194342",
      courseCode: "PL3002",
      courseName: "Ekonomi dan Inovasi dalam Perencanaan",
      start: at("2026-10-08T08:00:00+07:00"),
      end: at("2026-10-08T10:00:00+07:00"),
      activity: "Kuliah",
      room: "R.SG PWK LT.6",
    });
    expect(meeting(h, "2179909")).toMatchObject({
      courseCode: "DK4073",
      activity: "UTS",
      room: "TVST C",
      start: at("2026-10-15T11:00:00+07:00"),
      end: at("2026-10-15T12:59:00+07:00"),
    });
    // A meeting SIX lists without a room.
    expect(meeting(h, "2311195")).toMatchObject({
      courseCode: "II4091",
      room: null,
      start: at("2026-10-16T15:00:00+07:00"),
      end: at("2026-10-16T23:00:00+07:00"),
    });
  });

  it("reads this month and the next one the term has", async () => {
    const h = await signedIn();
    const months = sixRequests(h)
      .map((r) => new URL(r.url).searchParams.get("bulan"))
      .filter(Boolean);
    expect(months).toEqual(["202610", "202611"]);
    expect(h.dataset("six.scheduleMonths")).toEqual(["2026-10", "2026-11"]);
  });

  it("a month counts as read only from its own page, not from the edge of another month's grid", async () => {
    const h = await startEngine();
    // November's page also shows 1–4 December: PL3002's class on Thursday 3 December is listed there.
    h.world.six.addMeeting({
      id: "2194354",
      code: "PL3002",
      name: "Ekonomi dan Inovasi dalam Perencanaan",
      day: "2026-12-03",
      start: "08:00",
      end: "09:30",
      room: "R.SG PWK LT.6",
    });
    await until(h, h.engine.signIn("six", SIX));
    expect(meeting(h, "2194354")).toMatchObject({ start: at("2026-12-03T08:00:00+07:00"), room: "R.SG PWK LT.6" });
    expect(h.dataset("six.scheduleMonths")).toEqual(["2026-10", "2026-11"]);
  });

  it("in the term's last month, doesn't ask for a month the term doesn't have", async () => {
    const h = await signedIn({ now: "2027-01-11T09:00:00+07:00" });
    const months = sixRequests(h)
      .map((r) => new URL(r.url).searchParams.get("bulan"))
      .filter(Boolean);
    expect(months).toEqual(["202701"]);
    expect(h.status("six").state).toBe("live");
    expect(h.dataset("six.schedule")).toEqual([]);
    expect(h.dataset("six.scheduleMonths")).toEqual(["2027-01"]);
  });

  it("keeps the session only in the vault, never in saved data", async () => {
    const h = await signedIn();
    expect(JSON.parse(h.vault.secrets.get("six.session")!).cookie).toBe(PRETEND_SIX_COOKIE);
    for (const text of h.storage.files.values()) expect(text).not.toContain("pretend-six-session");
  });

  it("every request carries the session cookie and says who the app is", async () => {
    const seen: Record<string, string>[] = [];
    const h = await startEngine();
    const answer = h.world.six.handle.bind(h.world.six);
    h.world.six.handle = (request, url) => {
      seen.push(request.headers ?? {});
      return answer(request, url);
    };
    await until(h, h.engine.signIn("six", SIX));
    expect(seen.length).toBeGreaterThanOrEqual(4);
    for (const headers of seen) {
      expect(headers.cookie).toBe(PRETEND_SIX_COOKIE);
      expect(headers["user-agent"]).toMatch(/^EdunexPlus\/2\.0\.0-test /);
    }
  });
});

describe("human pace", () => {
  it("reads one page at a time, at least two seconds apart", async () => {
    const h = await signedIn();
    await h.wait(10_000);
    // Both feeds at once, on a slow network: still one page at a time.
    h.world.setLatency(3_000);
    const since = h.world.clock.now();
    await until(h, h.engine.refresh("six"));
    const starts = sixRequests(h, since).map((r) => r.at);
    expect(starts.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(3_000);

    h.world.setLatency(0);
    await h.wait(10_000);
    const again = h.world.clock.now();
    await until(h, h.engine.refresh("six"));
    const quick = sixRequests(h, again).map((r) => r.at);
    for (let i = 1; i < quick.length; i++) expect(quick[i] - quick[i - 1]).toBeGreaterThanOrEqual(2_000);
  });

  it("a rate-limit answer leaves SIX alone for at least 15 minutes, then recovers", async () => {
    const h = await signedIn();
    h.world.six.rateLimit(1);
    const limited = h.world.clock.now();
    await until(h, h.engine.refresh("six"));
    expect(h.status("six")).toMatchObject({ state: "offline", detail: "SIX answered 429" });
    expect(h.dataset("six.courses")).toEqual(COURSES);
    const before = sixRequests(h).length;
    await h.wait(14 * 60_000);
    // The feeds kept trying on their own, but nothing reached SIX.
    expect(sixRequests(h).length).toBe(before);
    expect(h.status("six").state).toBe("offline");
    await h.wait(3 * 60_000);
    expect(sixRequests(h).length).toBeGreaterThan(before);
    expect(sixRequests(h, limited + 15 * 60_000).length).toBe(sixRequests(h).length - before);
    expect(h.status("six").state).toBe("live");
  });

  it("SIX's hourly and twice-a-day rhythm", async () => {
    const h = await signedIn();
    const since = h.world.clock.now() + 1;
    await h.wait(24 * 3_600_000 + 60_000);
    const paths = sixRequests(h, since).map((r) => new URL(r.url).pathname);
    // The status page about hourly; the timetable's two month pages twice a day.
    expect(paths.filter((p) => p.endsWith("/statusmhs")).length).toBeGreaterThanOrEqual(23);
    expect(paths.filter((p) => p.endsWith("/statusmhs")).length).toBeLessThanOrEqual(26);
    expect(paths.filter((p) => p.includes("/kelas/jadwal/")).length).toBe(4);
  });
});

describe("sessions", () => {
  it("a redirect to sign-in ends SIX only; Edunex keeps going and SIX's data stays readable", async () => {
    const h = await signedIn();
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    h.world.six.expireSession();
    await until(h, h.engine.refresh());
    expect(h.status("six").state).toBe("expired");
    expect(h.status("edunex").state).toBe("live");
    expect(h.vault.secrets.has("six.session")).toBe(false);
    expect(h.vault.secrets.has("edunex.session")).toBe(true);
    expect(h.dataset("six.courses")).toEqual(COURSES);
    expect(h.dataset("six.schedule")).toHaveLength(22);
    // Still ended after a restart, until the Student signs in again.
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault });
    expect(again.status("six").state).toBe("expired");
    expect(again.status("edunex").state).toBe("connecting");
  });

  it("Edunex ending its session leaves SIX live", async () => {
    const h = await signedIn();
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    h.world.edunex.expireSession();
    await until(h, h.engine.refresh());
    expect(h.status("edunex").state).toBe("expired");
    expect(h.status("six").state).toBe("live");
  });

  it("SIX showing its sign-in page instead of a redirect also ends the session", async () => {
    const h = await signedIn();
    h.world.six.editPage(/\/statusmhs$/, () => '<html><body><a href="/login/MS365">Login dengan ITB Account</a></body></html>');
    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("expired");
  });

  it("only the status page may end the session: another page refusing asks it first", async () => {
    const h = await signedIn();
    h.world.six.editPage(/\/kelas\/jadwal\/mahasiswa\/\d+$/, () => '<html><body><a href="/login/MS365">Login dengan ITB Account</a></body></html>');
    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("live");
    expect(h.vault.secrets.has("six.session")).toBe(true);
  });

  it("a different Student signing in to SIX never sees the previous one's SIX data", async () => {
    const h = await signedIn();
    for (const [path, html] of [...h.world.six.pages]) {
      h.world.six.pages.delete(path);
      if (/\/kelas\/jadwal\//.test(path)) continue; // the new Student's timetable isn't there
      const next = html.replaceAll("18223901", "18224999").replaceAll("Dimas Pratama", "Rina Sari");
      h.world.six.pages.set(path.replace("18223901", "18224999"), next);
    }
    await until(h, h.engine.signIn("six", SIX));
    expect(h.dataset("six.student")).toMatchObject({ nim: "18224999", name: "Rina Sari" });
    // The last Student's meetings are gone, not shown as this one's.
    expect(h.dataset("six.schedule")).toBeUndefined();
    expect(h.status("six").state).toBe("changed");
  });

  it("sign-out of SIX removes its session and data, and leaves Edunex alone", async () => {
    const h = await signedIn();
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    await h.engine.signOut("six");
    expect(h.status("six")).toMatchObject({ state: "signed-out", updatedAt: null });
    expect(h.vault.secrets.has("six.session")).toBe(false);
    expect(h.engine.snapshot().datasets.filter((d) => d.name.startsWith("six."))).toEqual([]);
    expect(h.status("edunex").state).toBe("live");
    expect(h.dataset("edunex.courses")).toHaveLength(5);
  });

  it("offline: says so and keeps the data; back online it recovers", async () => {
    const h = await signedIn();
    h.world.setOffline(true);
    await until(h, h.engine.refresh("six"));
    expect(h.status("six")).toMatchObject({ state: "offline", detail: "SIX is unreachable" });
    expect(h.dataset("six.courses")).toEqual(COURSES);
    h.world.setOffline(false);
    await h.wait(2 * 60_000);
    expect(h.status("six").state).toBe("live");
  });

  it("SIX down (503) counts as offline", async () => {
    const h = await signedIn();
    h.world.six.fail(/\/statusmhs$/, 503, 1);
    await until(h, h.engine.refresh("six"));
    expect(h.status("six")).toMatchObject({ state: "offline", detail: "SIX answered 503" });
  });
});

describe("what SIX shows changes", () => {
  it("attendance counts follow SIX", async () => {
    const h = await signedIn();
    h.world.six.setAttendance("KU5014", 3, 7);
    await until(h, h.engine.refresh("six"));
    expect(h.dataset("six.courses")?.find((c) => c.code === "KU5014")?.attendance).toEqual({ attended: 3, held: 7 });
  });

  it("a moved meeting shows its new time and room", async () => {
    const h = await signedIn();
    h.world.six.moveMeeting("2194342", "13:00", "14:40", "7602");
    await until(h, h.engine.refresh("six"));
    expect(meeting(h, "2194342")).toMatchObject({ start: at("2026-10-08T13:00:00+07:00"), end: at("2026-10-08T14:40:00+07:00"), room: "7602" });
  });

  it("pages in English read the same", async () => {
    const world = (await startEngine({ start: false })).world;
    world.six.useEnglish();
    expect(world.six.page(/\/statusmhs$/)).toContain("Attended 4 of 6 meetings");
    const h = await signedIn({ world });
    expect(h.status("six").state).toBe("live");
    expect(h.dataset("six.student")).toMatchObject({ nim: "18223901", studentId: "2021000001", term: "2026-1" });
    expect(h.dataset("six.courses")).toEqual(COURSES);
    const schedule = h.dataset("six.schedule")!;
    expect(schedule).toHaveLength(22);
    expect(meeting(h, "2194342")).toMatchObject({ activity: "Lecture", room: "R.SG PWK LT.6", start: at("2026-10-08T08:00:00+07:00") });
    expect(meeting(h, "2179909")).toMatchObject({ activity: "UTS", room: "TVST C" });
  });
});

describe("SIX changed something", () => {
  const STATUS = /\/statusmhs$/;
  const TIMETABLE = /\/kelas\/jadwal\/mahasiswa\/\d+$/;
  it.each([
    ["the course table gains a column", STATUS, '<th class="text-center">Nilai</th>', '<th class="text-center">Nilai</th><th>Dosen</th>', "different layout"],
    ["attendance loses its exact count", STATUS, 'title="Hadir', 'data-note="Hadir', "attendance without its count"],
    ["the course list loses its term", STATUS, "Daftar Kuliah Semester 1-2026/2027", "Daftar Kuliah", "course list is missing"],
    ["a course code changes shape", STATUS, "<td>PL3002</td>", "<td>PL-3002</td>", "no course code"],
    ["the timetable's meetings lose their address", TIMETABLE, 'data-url="', 'data-href="', "can't read"],
    // A Sunday column before Monday: every date would be a day off.
    ["the timetable's grid starts on another weekday", TIMETABLE, "<tr><td >", '<tr><td ><div class="">27</div></td><td >', "line up with the weekdays"],
  ] as const)("%s: says so and keeps the last good data", async (_name, path, from, to, detail) => {
    const h = await signedIn();
    const before = { courses: h.dataset("six.courses"), schedule: h.dataset("six.schedule") };
    h.world.six.changeLayout(path, from, to);
    expect(h.world.six.page(path)).toContain(to);
    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("changed");
    expect(h.status("six").detail).toContain(detail);
    expect(h.dataset("six.courses")).toEqual(before.courses);
    expect(h.dataset("six.schedule")).toEqual(before.schedule);
    expect(h.vault.secrets.has("six.session")).toBe(true);
  });

  it("an unknown header word changes nothing (SIX's wording isn't what the app reads)", async () => {
    const h = await signedIn();
    const before = h.events.length;
    h.world.six.changeLayout(/\/statusmhs$/, ">Kehadiran</th>", ">Presensi</th>");
    await until(h, h.engine.refresh("six"));
    expect(h.status("six").state).toBe("live");
    // The recorded morning has a class on: its first look at "Tandai Hadir" is news of its own.
    expect(h.events.slice(before).filter((e) => e.type === "dataset" && e.dataset.name !== "six.checkIn")).toEqual([]);
  });
});

/** The other SIX readers (grades, curriculum, KRS, bills) ask for pages through the same client. */
describe("SIX pages for other readers", () => {
  it("know who is signed in and share the same polite line", async () => {
    const { SixClient } = await import("../../src/engine/sources/six/client");
    const h = await startEngine({ start: false });
    const pages = new SixClient(h.world, h.world.clock, PRETEND_SIX_COOKIE, "EdunexPlus/test");
    const [who, bills, again] = await until(h, Promise.all([pages.who(), pages.page("/app/mahasiswa:18223901/keuangan"), pages.who()]));
    expect(who).toEqual({ nim: "18223901", studentId: "2021000001", term: "2026-1" });
    expect(again).toEqual(who);
    expect(bills).toContain("Keuangan");
    const starts = sixRequests(h).map((r) => r.at);
    expect(starts).toHaveLength(3);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(2_000);
  });

  it("an ended session is Unauthorized, and a missing page fails plainly", async () => {
    const { SixClient } = await import("../../src/engine/sources/six/client");
    const h = await startEngine({ start: false });
    const pages = new SixClient(h.world, h.world.clock, PRETEND_SIX_COOKIE, "EdunexPlus/test");
    await expect(until(h, pages.page("/app/mahasiswa:18223901/nothing-here"))).rejects.toMatchObject({
      kind: "Failed",
      message: "SIX answered 404 for /nothing-here",
    });
    h.world.six.expireSession();
    await expect(until(h, pages.page("/app/mahasiswa:18223901/keuangan"))).rejects.toMatchObject({ kind: "Unauthorized" });
  });
});

// biome-ignore lint/suspicious/noExportsInTest: keeps the ClassSession import honest if the schedule's shape changes
export type { ClassSession };
