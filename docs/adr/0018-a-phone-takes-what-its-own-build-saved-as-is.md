# 18. A phone takes what its own build saved as is

Status: accepted (2026-11-10). Narrows the load-time check in `src/engine/store/datasets.ts` on the
phone's release builds. The desktop and every dev build still check every saved dataset.

## Context

Every start checked each saved dataset against its schema (zod) before Beranda could draw, so a file
from an older version whose shape no longer fits is left out rather than drawn wrong. On a mid-range
phone (Snapdragon 720G, Hermes) that check was most of `engine.load`'s 330–364 ms, and the cold start
(Android's START to Beranda drawn) was 1.4–1.7 s against a target of 1.0 s. Checking after the first
frame instead would draw a file of the wrong shape before the check could leave it out.

## Decision

- **A release build carries a stamp of its datasets' schemas** (`mobile/scripts/shapes-stamp.js`: a
  hash of every file in `src/core` and of zod's version, in `app.config`'s `extra.shapes`).
  `test/mobile/cold-start.test.ts` checks the schemas are built from nothing outside `src/core`.
- **Each dataset is saved with that stamp, and a file with the same stamp loads without the check**:
  this very build wrote it, from values it had already drawn.
- **Any other file is checked as before** (the first start after an update, a file from a dev build),
  and once the screens are up (`engine.start`) it is saved again with the new stamp, so the check
  runs once per update, not on every start.

## Consequences

- A value this build saved that its own schema wouldn't take (a reader's bug the types didn't catch)
  is no longer left out at the next start; it's drawn as it was drawn when it was read.
- Any change in `src/core` makes a new stamp, even one that leaves the schemas alone: that update's
  first start checks everything once, as every start did before.
