<!-- Write for someone who uses the app but doesn't read code: plain words, no jargon. -->

## What changes for the student

<!-- What they'll see or notice, in a few sentences. If nothing visible changes, say so and say what it's for. -->

## Screenshots

<!-- Before and after, for anything on screen. Take them from the demo (`npm run demo`), never from a real account.
     When a pull request touches the screens, CI also attaches pictures of every screen. -->

## How it was tested

<!-- Tests added or changed, and what you tried in the app. -->

## What to try on a real account

<!-- What only a real Edunex or SIX account can show, step by step. Leave it empty if nothing. -->

## Risk

<!-- Low, medium or high, and why, in one sentence. -->

## Checklist

- [ ] Nothing personal in this change: no real names, student numbers, emails, grades, meeting links, tokens or course content, screenshots included.
- [ ] New test data is made up, or comes from `npm run fixtures:scrub` and I read its diff.
- [ ] Every new word on screen is in `src/core/strings/`, in Indonesian and English.
- [ ] Any new saved field (in saved data or Settings) is optional with a default, so data saved by older versions still loads.
