// A hand-in on its way keeps "Perbarui otomatis" from restarting the app under
// it (src/desktop/main.ts asks handingInNow each minute): from picking the
// files to the submit, and not a moment longer, whether it went through or not.
import { describe, expect, it } from "vitest";
import { handInHandlers, handingInNow } from "../../src/desktop/hand-in";
import type { Engine } from "../../src/engine/engine";

describe("a hand-in on its way", () => {
  it("counts while it's being sent, and stops counting once it's done or failed", async () => {
    const answers: { resolve: (value: unknown) => void; reject: (error: Error) => void }[] = [];
    const engine = {
      act: () => new Promise((resolve, reject) => answers.push({ resolve, reject })),
    } as unknown as Engine;
    const handlers = handInHandlers(engine, async () => []);
    expect(handingInNow()).toBe(false);

    const submit = handlers["tasks.submit"]({ taskId: "t1" } as never);
    expect(handingInNow()).toBe(true);
    const comment = handlers["tasks.comment"]({ taskId: "t1", text: "x" } as never).catch(() => undefined);
    answers[0]!.resolve({});
    await submit.catch(() => undefined);
    expect(handingInNow()).toBe(true);
    answers[1]!.reject(new Error("offline"));
    await comment;
    expect(handingInNow()).toBe(false);
  });

  it("counts while the file picker is open", async () => {
    let close: () => void = () => undefined;
    const handlers = handInHandlers({} as Engine, () => new Promise((resolve) => (close = () => resolve([]))));
    const picking = handlers["tasks.pickFiles"]({});
    expect(handingInNow()).toBe(true);
    close();
    await picking;
    expect(handingInNow()).toBe(false);
  });
});
