// The phone channel's way out: where its requests go and what they carry, on a
// stand-in for Electron's session (nothing reaches the real ntfy.sh), and that
// a failure never repeats the address, which holds the topic.
import type { Session } from "electron";
import { describe, expect, it } from "vitest";
import { ntfyClient } from "../../src/desktop/ntfy";

const TOPIC = "edunex-pretendtopic001";

function session(answer: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = {
    fetch: (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return answer(url, init);
    },
  } as unknown as Session;
  return { client: ntfyClient(fake), calls };
}

describe("the ntfy client", () => {
  it("publishes as JSON to ntfy.sh, cancels at the topic's sequence ID, and sends no cookies", async () => {
    const { client, calls } = session(async () => new Response("{}", { status: 200 }));
    const message = { topic: TOPIC, sequence_id: "ep-1", title: "Tenggat 24 jam lagi · II4091", message: "Laporan", priority: 3, delay: "1791000000" } as const;
    expect(await client({ method: "POST", message })).toBe(200);
    expect(await client({ method: "DELETE", topic: TOPIC, sequenceId: "ep-1" })).toBe(200);
    expect(calls[0]).toMatchObject({ url: "https://ntfy.sh/", init: { method: "POST", credentials: "omit", headers: { "content-type": "application/json" } } });
    expect(JSON.parse(String(calls[0].init.body))).toEqual(message);
    expect(calls[1]).toMatchObject({ url: `https://ntfy.sh/${TOPIC}/ep-1`, init: { method: "DELETE", credentials: "omit" } });
  });

  it("answers with ntfy's status, and fails without saying where it was going", async () => {
    const busy = session(async () => new Response("", { status: 429 }));
    expect(await busy.client({ method: "DELETE", topic: TOPIC, sequenceId: "ep-1" })).toBe(429);
    const offline = session(async (url) => {
      throw new Error(`net::ERR_INTERNET_DISCONNECTED loading ${url}`);
    });
    const error = await offline.client({ method: "DELETE", topic: TOPIC, sequenceId: "ep-1" }).catch((failure: Error) => failure);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).not.toContain(TOPIC);
  });
});
