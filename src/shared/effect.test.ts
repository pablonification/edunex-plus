import { expect, it } from "@effect/vitest";
import * as EffectModule from "effect";
import { createEffectConventions } from "./effect";

it("instantiates from a host-provided Effect module", () => {
  const conventions = createEffectConventions(EffectModule);
  const secret = conventions.sensitiveString("renderer-secret");

  expect(String(secret)).toBe("<redacted>");
  expect(() =>
    EffectModule.Schema.encodeSync(conventions.SensitiveStringSchema)(secret),
  ).toThrow();
});
