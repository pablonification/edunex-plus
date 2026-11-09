// The timing recorder (scripts/record-sync-timings.mjs) against the pretend Edunex, SIX and ITB: one sync,
// every request timed, nothing in it that names the Student, and nothing but reads let through.
import { describe, expect, it } from "vitest";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { pathPattern } from "../pretend/network";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import { recordingTransport, recordSync } from "./sync-timings";

describe("the sync timing recorder", () => {
  it("times one whole sync, request by request, with every id left out", async () => {
    const world = new PretendWorld();
    world.setLatency(400);
    const timings = await recordSync({
      transport: world,
      clock: world.clock,
      sessions: { edunex: PRETEND_TOKEN, six: PRETEND_SIX_COOKIE },
      wait: (ms) => world.clock.advance(ms),
      note: "pretend",
    });
    expect(timings.refused).toEqual([]);
    expect(timings.requests.length).toBeGreaterThan(20);
    expect(timings.requests.every((r) => r.ms === 400 && r.method === "GET")).toBe(true);
    const names = timings.datasets.map((d) => d.name);
    expect(names).toEqual(expect.arrayContaining(["edunex.tasks", "edunex.presence", "six.schedule", "six.courses", "six.transcript", "itb.calendar"]));
    expect(timings.feeds.find((f) => f.name === "six.schedule")?.ok).toBe(true);
    expect(timings.totalMs).toBeGreaterThan(0);
    // No NIM, SIX student id, course id or query in what it writes.
    const text = JSON.stringify(timings);
    expect(text).not.toMatch(/\d{6,}|\?|khongguan|pretend-edunex-token/);
  });

  it("refuses anything that would write, and says so", async () => {
    const world = new PretendWorld();
    const recording = recordingTransport(world, world.clock, () => 0);
    await expect(recording.transport.request({ method: "POST", url: "https://api-edunex.cognisia.id/course/answers" })).rejects.toThrow(/only lets reads/);
    expect(recording.refused).toEqual([{ host: "api-edunex.cognisia.id", method: "POST", pathPattern: "/course/answers" }]);
    expect(world.log).toEqual([]);
  });

  it("writes each path with its ids, NIM and months left out", () => {
    expect(pathPattern("https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/123456?bulan=202610")).toBe(
      "/app/:id/kelas/jadwal/mahasiswa/:id",
    );
    expect(pathPattern("https://api-edunex.cognisia.id/notifications/4242")).toBe("/notifications/:id");
    expect(pathPattern("https://api-edunex.cognisia.id/course/contents/?filter[contentable_id][is]=1")).toBe("/course/contents/");
  });
});
