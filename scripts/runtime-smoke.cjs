const { Cause, Context, Effect, Exit, Layer } = require("effect");
const {
  composeApplicationLayer,
  createApplicationRuntime,
} = require("../dist/main/effect/runtime.js");

const Resource = Context.Service("EdunexPlus/RuntimeSmokeScriptResource");
const events = [];
const layer = Layer.effect(
  Resource,
  Effect.acquireRelease(
    Effect.sync(() => {
      events.push("acquire");
      return { value: "ready" };
    }),
    () => Effect.sync(() => events.push("release")),
  ),
);

const runtime = createApplicationRuntime(composeApplicationLayer(layer));

runtime
  .fork(Effect.never)
  .then(async (fiber) => {
    await runtime.runPromise(
      Effect.gen(function* () {
        const resource = yield* Resource;
        if (resource.value !== "ready") throw new Error("runtime resource was not acquired");
      }),
    );
    await runtime.shutdown();

    const exit = fiber.pollUnsafe();
    if (
      exit === undefined ||
      !Exit.isFailure(exit) ||
      !Cause.hasInterrupts(exit.cause) ||
      events.join(",") !== "acquire,release"
    ) {
      throw new Error("runtime shutdown left work or resources behind");
    }

    console.log("runtime smoke: startup acquired and shutdown released all resources and fibers");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
