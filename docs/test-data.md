# Test data from real sessions

Edunex Plus is tested against what Edunex and SIX really send, not against
hand-written samples. The data comes from a recorded session of a real
Student account, with every personal detail replaced before it is committed.

## The pieces

| Piece | What it does |
|---|---|
| `scripts/record-session.cjs` (`npm run record`) | Opens Edunex and SIX in two windows on a throwaway in-memory session. You sign in yourself and browse; it saves what the sites request and receive to `.scratch/recordings/<time>/` (git-ignored). |
| `scripts/scrub-recording.mjs` (`npm run fixtures:scrub`) | Turns the recordings into `test/fixtures/` with personal details replaced, and writes the real values it replaced to `.scratch/private-identity.json` (git-ignored). |
| `test/kit/fixtures.ts` | Loads recorded responses: `edunexJson(path, query)`, `sixPage(path)`, `publicPage(name)`. |
| `test/kit/builder.ts` | "Real record, changed on purpose": `withFields(record, patch)` and `withItem(list, where, patch)` change only the fields a test is about. |
| `test/kit/privacy.test.ts` | Fails the run if anything personal is in `test/fixtures/`. |

## The recorder is read-only

Every request that could change something (anything but GET, HEAD and
OPTIONS) to Edunex, SIX or Edunex's file storage is blocked and logged to
`blocked.jsonl`. Edunex's own website tries a few in the background ("I'm
online" pings, marking notifications read); those are blocked too.

It never saves Microsoft or ITB sign-in pages beyond their address, nor
cookies, `Authorization` headers, form tokens, login tokens or uploaded
file contents.

## Refreshing the test data

1. `npm run record` (in shells that export `ELECTRON_RUN_AS_NODE=1`:
   `env -u ELECTRON_RUN_AS_NODE npm run record`). Sign in to both systems
   and visit: Edunex home, each course with its modules, Tasks, Presence and
   gradebook, a few Task pages; SIX status, schedule, KRS, transcripts,
   curriculum, finance and the course questionnaire. Close the windows.
2. `npm run fixtures:scrub`. It reads every recording in
   `.scratch/recordings` (later ones win) and rewrites `test/fixtures/`.
3. `npm test`. The privacy test checks the result against the real values
   the scrubber replaced, plus patterns (student numbers, emails, phone
   numbers, meeting and file links, tokens) that must never appear.
4. Read the diff of `test/fixtures/` before committing.

## What the scrubber replaces

- The Student: name, student number (NIM), Edunex and SIX ids, email,
  phone, address, birth details, profile photo. Their written answers and
  any lecturer comments on them.
- Other people: every lecturer and assistant name (titles kept), classmates'
  student numbers in file names, the academic advisor's chat messages.
- Links and secrets: online-meeting links, meeting IDs and passcodes, file
  links on Edunex's storage, course join tokens.
- Records: grades (swapped per course; IP and IPK are recomputed so every
  page still adds up) and money amounts (scaled, so instalments still sum).

Pages that hold passwords or family data (SIX's control panel, master data,
student ID card, PDDikti) are never exported.

Fake values are stable: the same real value always becomes the same fake
one, so ids, file names and links still match across responses.
