// An iPhone app's web view has no service workers, and Edunex's website stops on its loading spinner without one
// (Firebase's notifications call navigator.serviceWorker.addEventListener as the page starts): the sign-in never
// finished on the iPhone. mobile/src/host/page-fixes.ts gives those pages a do-nothing stand-in.
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { noServiceWorkerScript } from "../../mobile/src/host/page-fixes";

/** What Firebase's messaging does as Edunex's page loads (@firebase/messaging's window factory). */
const FIREBASE_START = `navigator.serviceWorker.addEventListener("message", function(){}); "started";`;

describe("the web views' service-worker stand-in", () => {
  it("lets Edunex's page start in a web view without service workers (iOS)", () => {
    const page = { navigator: {} as { serviceWorker?: unknown }, Promise, Error };
    expect(() => runInNewContext(FIREBASE_START, page)).toThrow(/addEventListener/);
    runInNewContext(noServiceWorkerScript, page);
    expect(runInNewContext(FIREBASE_START, page)).toBe("started");
  });

  it("offers nothing: no registration, never ready", async () => {
    const page = { navigator: {} as { serviceWorker: { register(): Promise<unknown>; getRegistration(): Promise<unknown> } }, Promise, Error };
    runInNewContext(noServiceWorkerScript, page);
    await expect(page.navigator.serviceWorker.register()).rejects.toThrow();
    await expect(page.navigator.serviceWorker.getRegistration()).resolves.toBeUndefined();
  });

  it("leaves a web view's real service workers alone (Android)", () => {
    const real = { addEventListener() {} };
    const page = { navigator: { serviceWorker: real }, Promise, Error };
    runInNewContext(noServiceWorkerScript, page);
    expect(page.navigator.serviceWorker).toBe(real);
  });
});
