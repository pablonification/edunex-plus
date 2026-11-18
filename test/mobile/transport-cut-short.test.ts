// #384: on Android, expo/fetch's text() resolves with whatever had arrived when the connection drops or the app's
// time limit cancels the request, instead of failing. An answer cut short by the time limit is no answer in time,
// never a page to read (where a half answer would read as Edunex changing).
import { afterEach, describe, expect, it, vi } from "vitest";
import { NetworkError } from "../../src/engine/http/transport";

const answers = vi.hoisted(() => ({ text: async () => "" }));

vi.mock("../../mobile/src/host/version", () => ({ R3_GUARD: false }));
vi.mock("../../mobile/src/host/guard", () => ({ guardedTransport: (transport: unknown) => transport }));
vi.mock("../../mobile/node_modules/expo/build/winter/fetch/index.js", () => ({
  fetch: async () => ({ status: 200, url: "", headers: new Headers({ "content-type": "application/json" }), text: () => answers.text() }),
}));

const { phoneTransport } = await import("../../mobile/src/host/transport");
const ASK = { method: "GET", url: "https://api-edunex.cognisia.id/course/courses/93409", timeoutMs: 1_000 } as const;

afterEach(() => vi.useRealTimers());

describe("the phone's transport", () => {
  it("an answer the time limit cut short is no answer in time, not a page", async () => {
    vi.useFakeTimers();
    // The body stops coming; the limit cancels the request, and text() still resolves with what had arrived.
    answers.text = () => new Promise((done) => setTimeout(() => done('{"data":{"attributes":{"na'), 1_500));
    const asked = phoneTransport.request(ASK);
    const failed = expect(asked).rejects.toEqual(new NetworkError("timeout", "No answer within 1 s"));
    await vi.advanceTimersByTimeAsync(2_000);
    await failed;
  });

  it("a whole answer in time is passed on as it came", async () => {
    answers.text = async () => '{"data":[]}';
    await expect(phoneTransport.request(ASK)).resolves.toMatchObject({ status: 200, body: '{"data":[]}' });
  });
});
