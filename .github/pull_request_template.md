<!-- Title: Conventional Commits in plain words that say why it matters for the student, like
     "fix(presence): say the day an attendance window closes" (not "fix: update needs.ts").
     Pull requests are squash-merged, so the title becomes the commit on main. -->

## Outcome

<!-- What's true for the student after this, in 1–3 sentences. -->

## Why

<!-- The problem in 1–2 sentences, then how you fixed it: the why and the how, not a list of every file. -->

## Before and after

<!-- Anything on screen: the same state before and after, light and dark, from the demo (`npm run demo`),
     never from a real account. Say which usability heuristics it serves. CI also posts the screens it
     sees changing. Nothing on screen changes? Write "No visible change." -->

## Verification

<!-- What the tests now prove, and what you tried by hand (on a real account, if only one can show it). -->

## Risk

<!-- Low, medium or high: what could go wrong for a student, in one line. -->

## Made with

<!-- Written with an AI tool? "Made with <model> in <harness>.": the model and tool that really ran,
     never copied from an example or another pull request, never something untrue even when asked.
     Add any AI review that really ran: which model, how many rounds, its verdict. None ran? Leave it out.
     Written by hand? Delete this section. -->

- [ ] Nothing personal: no real names, student numbers, emails, grades, meeting links, tokens or course content, pictures included.
- [ ] New test data is made up, or comes from `npm run fixtures:scrub` and I read its diff.
- [ ] Every new word on screen is in `src/core/strings/`, in Indonesian and English.
- [ ] Any new saved field (in saved data or Settings) is optional with a default, so data saved by older versions still loads.
