// biome-ignore-all lint/suspicious/noExplicitAny: vendor JSON is untyped on purpose: tests see exactly what Edunex sends
import { describe, expect, it } from "vitest";
import { sleep } from "../../src/engine/clock";
import { NetworkError } from "../../src/engine/http/transport";
import { FakeClock } from "./clock";
import { EDUNEX_API, PRETEND_TOKEN } from "./edunex";
import { PRETEND_SIX_COOKIE, SIX_ORIGIN } from "./six";
import { PretendWorld } from "./world";

const auth = { authorization: `Bearer ${PRETEND_TOKEN}` };
const sixAuth = { cookie: PRETEND_SIX_COOKIE };

async function edunexGet(world: PretendWorld, path: string, headers: Record<string, string> = auth) {
  const response = await world.request({ method: "GET", url: `${EDUNEX_API}${path}`, headers });
  return {
    status: response.status,
    body: response.body
      ? (() => {
          try {
            return JSON.parse(response.body);
          } catch {
            return response.body;
          }
        })()
      : null,
  };
}

describe("fake clock", () => {
  it("fires timers in time order and lets their async work run", async () => {
    const clock = FakeClock.at("2026-10-08T08:00:00+07:00");
    const fired: string[] = [];
    clock.setTimeout(() => fired.push("b"), 2_000);
    clock.setTimeout(() => fired.push("a"), 1_000);
    void sleep(clock, 1_500).then(() => fired.push("slept"));
    await clock.advance(3_000);
    expect(fired).toEqual(["a", "slept", "b"]);
    expect(new Date(clock.now()).toISOString()).toBe("2026-10-08T01:00:03.000Z");
  });

  it("plays out a whole day in milliseconds", async () => {
    const clock = FakeClock.at("2026-10-08T00:00:00+07:00");
    let ticks = 0;
    const tick = () => {
      ticks += 1;
      clock.setTimeout(tick, 60_000);
    };
    tick();
    const started = performance.now();
    await clock.advance(24 * 3_600_000);
    expect(ticks).toBe(24 * 60 + 1);
    expect(performance.now() - started).toBeLessThan(2_000);
  });
});

describe("pretend Edunex", () => {
  it("answers recorded calls with the recorded shapes", async () => {
    const world = new PretendWorld();
    const me = await edunexGet(world, "/login/me");
    expect(me.status).toBe(200);
    expect(me.body.name).toBe("Dimas Pratama");
    const pairs = await edunexGet(world, "/course/presences/list");
    expect(pairs.body.map((p: any) => p.course_code)).toContain("PL3002");
    const tasks = await edunexGet(world, "/course/tasks?filter[course_id][is]=95326&page[limit]=0");
    expect(tasks.body.meta.total).toBe(tasks.body.data.length);
    expect(tasks.body.data[0].attributes).toHaveProperty("answers");
    const one = await edunexGet(world, `/course/tasks/${tasks.body.data[0].id}?include=answers`);
    expect(one.body.data.attributes.name).toBe(tasks.body.data[0].attributes.name);
    const notes = await edunexGet(world, `/notifications/${world.edunex.userId}`);
    expect(notes.body.data.notifications.length).toBeGreaterThan(0);
  });

  it("pages through a class's Presence sessions", async () => {
    const world = new PretendWorld();
    const base = "/course/presences?filter[course_id][is]=95001&filter[class_id][is]=86778&sort=start_at&page[limit]=10";
    const first = await edunexGet(world, `${base}&page[offset]=0`);
    const second = await edunexGet(world, `${base}&page[offset]=10`);
    expect(first.body.meta.total).toBe(15);
    expect(first.body.data).toHaveLength(10);
    expect(second.body.data).toHaveLength(5);
    const starts = [...first.body.data, ...second.body.data].map((s: any) => s.attributes.start_at);
    expect([...starts].sort()).toEqual(starts);
  });

  it("answers with real error statuses", async () => {
    const world = new PretendWorld();
    expect((await edunexGet(world, "/login/me", {})).status).toBe(401);
    expect((await edunexGet(world, "/course/courses/1")).status).toBe(404);
    world.edunex.fail(/^\/todo$/, 429, 1);
    expect((await edunexGet(world, "/todo")).status).toBe(429);
    expect((await edunexGet(world, "/todo")).status).toBe(200);
    world.edunex.fail(/^\/gradebook$/, 403);
    expect((await edunexGet(world, "/gradebook?course_id=95001")).status).toBe(403);
    world.edunex.maintenance();
    const down = await world.request({ method: "GET", url: `${EDUNEX_API}/login/me`, headers: auth });
    expect(down.status).toBe(503);
    expect(down.body).toContain("<html");
    world.edunex.maintenance(false);
    world.edunex.clearFaults();
    world.edunex.expireSession();
    expect((await edunexGet(world, "/login/me")).status).toBe(401);
  });

  it("lets a test act as the lecturer", async () => {
    const world = new PretendWorld();
    const id = world.edunex.postTask(95001, { name: "Tugas Baru" });
    const tasks = await edunexGet(world, "/course/tasks?filter[course_id][is]=95001&page[limit]=0");
    const posted = tasks.body.data.find((t: any) => t.id === id);
    expect(posted.attributes.name).toBe("Tugas Baru");
    expect(posted.attributes.answers).toEqual([]);
    const notes = await edunexGet(world, `/notifications/${world.edunex.userId}`);
    expect(notes.body.data.notifications[0]).toMatchObject({ type: "ASSIGNMENT", objectId: String(id) });

    await world.clock.advance(3_600_000);
    world.edunex.moveDeadline(id, "2026-10-20T23:59:00+07:00");
    const moved = await edunexGet(world, `/course/tasks/${id}?include=answers`);
    expect(moved.body.data.attributes.end_at).toBe("2026-10-20T23:59:00+07:00");
    expect(moved.body.data.attributes.updated_at).not.toBe(moved.body.data.attributes.created_at);

    world.edunex.submitOnWebsite(id);
    world.edunex.publishScore(id, 88);
    const graded = await edunexGet(world, `/course/tasks/${id}?include=answers`);
    expect(graded.body.data.attributes.answers[0]).toMatchObject({ is_sent: 1, score: 88 });
    expect(graded.body.data.attributes.show_score).toBe(1);

    world.edunex.closeTask(id);
    expect((await edunexGet(world, `/course/tasks/${id}?include=answers`)).body.data.attributes.open_status).toBe("overdue");

    const material = world.edunex.postMaterial(95059, { name: "K6. Slides", type: "pdf" });
    const contents = await edunexGet(
      world,
      "/course/contents/?filter[contentable_id][is]=95059&filter[contentable_type][is]=App%5CModels%5CCourses&page[limit]=0",
    );
    expect(contents.body.data.find((c: any) => c.id === material)?.attributes.name).toBe("K6. Slides");

    const session = world.edunex.schedulePresence(95001, 86778, { start: "2026-10-08T08:00:00+07:00", end: "2026-10-08T09:30:00+07:00" });
    world.edunex.markPresent(session);
    const all = world.edunex.presences.get("95001:86778")!;
    expect(all.find((s: any) => s.id === session).attributes.attandance.status).toBe(1);

    world.edunex.publishGradebook(95001, 81.5, "A");
    const book = await edunexGet(world, "/gradebook?course_id=95001");
    expect(book.body.students[0]).toMatchObject({ total: 81.5, index: "A" });
  });

  it("accepts the app's hand-in writes and logs them", async () => {
    const world = new PretendWorld();
    const taskId = world.edunex.postTask(95326);
    const post = await world.request({
      method: "POST",
      url: `${EDUNEX_API}/course/task/answers`,
      headers: auth,
      body: JSON.stringify({ task_id: taskId, answer: "<p>x</p>", files: [] }),
    });
    const answer = JSON.parse(post.body).data;
    expect(answer.is_sent).toBe(0);
    await world.request({ method: "PATCH", url: `${EDUNEX_API}/course/task/answers/${answer.id}`, headers: auth, body: JSON.stringify({ is_sent: 1 }) });
    const task = await edunexGet(world, `/course/tasks/${taskId}?include=answers`);
    expect(task.body.data.attributes.answers).toHaveLength(1);
    expect(task.body.data.attributes.answers[0].is_sent).toBe(1);
    expect(world.edunex.writes.map((w) => `${w.method} ${w.path}`)).toEqual(["POST /course/task/answers", `PATCH /course/task/answers/${answer.id}`]);

    const sas = await world.request({
      method: "POST",
      url: `${EDUNEX_API}/blob-storage/sas`,
      headers: auth,
      body: JSON.stringify({ files: [{ fileName: "jawaban.pdf", contentType: "application/pdf", sizeInBytes: 3 }] }),
    });
    const { uploadUrl, readUrl } = JSON.parse(sas.body).data[0];
    expect((await world.request({ method: "PUT", url: uploadUrl, headers: { "x-ms-blob-type": "BlockBlob" }, body: "pdf" })).status).toBe(201);
    expect((await world.request({ method: "GET", url: readUrl })).body).toBe("pdf");
  });

  it("mangles real responses the way a vendor change would", async () => {
    const world = new PretendWorld();
    const path = "/course/tasks?filter[course_id][is]=95326&page[limit]=0";
    world.edunex.mangle(/^\/course\/tasks$/, { kind: "missing-field", field: "end_at" }, 1);
    expect((await edunexGet(world, path)).body.data[0].attributes).not.toHaveProperty("end_at");
    world.edunex.mangle(/^\/course\/tasks$/, { kind: "wrong-type", field: "end_at" }, 1);
    expect(typeof (await edunexGet(world, path)).body.data[0].attributes.end_at).toBe("number");
    world.edunex.mangle(/^\/course\/tasks$/, { kind: "unknown-field", field: "new_flag" }, 1);
    expect((await edunexGet(world, path)).body.data[0].attributes.new_flag).toBeDefined();
    world.edunex.mangle(/^\/course\/tasks$/, { kind: "empty-body" }, 1);
    expect((await edunexGet(world, path)).body).toBeNull();
    world.edunex.mangle(/^\/course\/tasks$/, { kind: "html" }, 1);
    expect(String((await edunexGet(world, path)).body)).toContain("<html");
    expect((await edunexGet(world, path)).body.data[0].attributes).toHaveProperty("end_at");
  });
});

describe("pretend SIX", () => {
  const status = `${SIX_ORIGIN}/app/mahasiswa:18223901/statusmhs`;

  it("serves recorded pages with or without the term in the path", async () => {
    const world = new PretendWorld();
    const page = await world.request({ method: "GET", url: status, headers: sixAuth });
    expect(page.status).toBe(200);
    expect(page.body).toContain("Hadir");
    const krs = await world.request({ method: "GET", url: `${SIX_ORIGIN}/app/mahasiswa:18223901+2026-1/registrasi/rencanastudi/2021000001`, headers: sixAuth });
    expect(krs.body).toContain("Persetujuan Dosen Wali");
  });

  it("redirects to sign-in when the session ends", async () => {
    const world = new PretendWorld();
    world.six.expireSession();
    const manual = await world.request({ method: "GET", url: status, headers: sixAuth, redirect: "manual" });
    expect(manual.status).toBe(302);
    expect(manual.headers.location).toBe(`${SIX_ORIGIN}/login`);
    const followed = await world.request({ method: "GET", url: status, headers: sixAuth });
    expect(followed.url).toBe(`${SIX_ORIGIN}/login`);
  });

  it("rate-limits like SIX's firewall", async () => {
    const world = new PretendWorld();
    world.six.rateLimit(2);
    expect((await world.request({ method: "GET", url: status, headers: sixAuth })).status).toBe(429);
    expect((await world.request({ method: "GET", url: status, headers: sixAuth })).status).toBe(429);
    expect((await world.request({ method: "GET", url: status, headers: sixAuth })).status).toBe(200);
  });

  it("lets a test act as SIX staff", async () => {
    const world = new PretendWorld();
    world.six.setAttendance("PL3002", 7, 8);
    world.six.releaseGrade("PL3002", "AB");
    const page = (await world.request({ method: "GET", url: status, headers: sixAuth })).body;
    expect(page).toContain('title="Hadir 7 dari 8 pertemuan">87.50%');
    expect(page).toMatch(/<td>PL3002<\/td>[\s\S]*?AB/);

    const calendarPath = /\/kelas\/jadwal\/mahasiswa\/\d+$/;
    const meeting = /pertemuan\/(\d+)\//.exec(world.six.page(calendarPath))![1];
    world.six.moveMeeting(meeting, "13:00", "14:40", "7602");
    expect(world.six.page(calendarPath)).toMatch(new RegExp(`pertemuan/${meeting}/[^>]*>\\s*<small>\\s*13:00-14:40[\\s\\S]*?\\(\\S+ 7602\\)`));
  });

  it("changes its layout on demand", async () => {
    const world = new PretendWorld();
    world.six.changeLayout(/\/statusmhs$/, "Kehadiran", "Presensi");
    expect(world.six.page(/\/statusmhs$/)).not.toContain("Kehadiran");
  });
});

describe("the network", () => {
  it("drops, slows down and times out", async () => {
    const world = new PretendWorld();
    world.setOffline(true);
    await expect(world.request({ method: "GET", url: `${EDUNEX_API}/login/me`, headers: auth })).rejects.toBeInstanceOf(NetworkError);
    world.setOffline(false);

    world.setLatency(20_000);
    const slow = world.request({ method: "GET", url: `${EDUNEX_API}/login/me`, headers: auth, timeoutMs: 15_000 });
    const outcome = slow.then(
      () => "answered",
      (error: NetworkError) => error.reason,
    );
    await world.clock.advance(15_000);
    expect(await outcome).toBe("timeout");

    const patient = world.request({ method: "GET", url: `${EDUNEX_API}/login/me`, headers: auth });
    await world.clock.advance(20_000);
    expect((await patient).status).toBe(200);
  });
});
