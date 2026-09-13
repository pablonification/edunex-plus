# Effect runtime foundation

Issue #50 selects one Effect v4 release for the application and its Vitest
integration:

- `effect`: `4.0.0-rc.115`
- `@effect/vitest`: `4.0.0-rc.115`
- `vitest`: `5.0.0` (the matching test integration accepts `>=5.0.0 <6.0.0`)

The versions are exact in `package.json` and `package-lock.json`. No Effect 3
package is installed. The main-process runtime is built with
`ManagedRuntime.make` once per process. Long-lived work must be forked through
the runtime's managed scope; application shutdown closes that scope, which
interrupts owned fibers and releases layer resources.

## CommonJS compatibility decision

Captured on 2026-09-14 (Asia/Jakarta) with Node `v22.22.1`, npm `9.2.0`, and
Electron `44.2.0`:

- Use TypeScript's `module: Node16` and `moduleResolution: Node16` resolver
  mode, while leaving the package without a `type: module` declaration. That
  keeps the emitted Electron main and preload outputs CommonJS while allowing
  TypeScript to understand Effect's ESM package metadata.
- Do not change the package-level module boundary. The existing Electron main
  and preload outputs remain CommonJS.
- The compiled runtime is required from a CommonJS smoke script after
  `npm run build:node`, proving the selected Effect package loads at the
  existing boundary. The same script also proves managed resource and fiber
  shutdown.

Run the proof with:

```sh
npm run build:node
npm run smoke:runtime
```

The only Node-specific Effect loader is `src/main/effect/effect-runtime.ts`.
Shared conventions are exposed as `createEffectConventions` without a runtime
Node import: the main process instantiates them with that loader, while a
future renderer consumer can instantiate them with its bundled ESM Effect
import. Renderer and preload contracts do not import the foundation yet.

Issue #51 composes the replaceable platform services described in
[`platform-services.md`](./platform-services.md) into this same managed
runtime. Long-lived Electron resources are released by the layer finalizer;
feature modules receive service contracts instead of importing host APIs.

## Dependency-installed baseline

This baseline was recorded after `npm ci` and before adding the Effect
dependencies, so it is the reference point for later migration parity:

```text
npm ci       pass; 257 packages added; 0 vulnerabilities
npm run build (typecheck) pass; Node build and renderer TypeScript check
npm test     pass; 32 test files, 208 tests
npm run build pass; Node build, renderer typecheck, and Vite production build
```

The baseline was already green. Any later failure in the Effect migration must
be separated from an installation or toolchain failure by repeating
`npm ci` first.

## Error and schema conventions

- Decode `unknown` only at a named boundary with `decodeBoundary`.
- Use schema-backed `Schema.TaggedError` classes for typed failures. Include
  stable operation/boundary metadata only; operation identifiers are restricted
  to safe lowercase names and unsafe values become `unknown`. Never put raw
  causes, request bodies, tokens, or passwords in the error fields.
- Preserve unexpected failures in Effect's `Cause`, then use `safeCause` or
  `formatSafeCause` for diagnostics. These helpers retain failure/defect/
  interruption shape and safe error tags without rendering arbitrary messages.
- Wrap credentials and similar private values with `SensitiveStringSchema` /
  `sensitiveString`. Its encoder is deliberately disabled, preventing an
  accidental JSON or IPC serialization.
