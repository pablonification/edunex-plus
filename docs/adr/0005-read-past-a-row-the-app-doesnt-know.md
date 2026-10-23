# 5. Read past a row the app doesn't know, and say so where it's shown

Status: accepted (2026-10-23). Changes how [0001](0001-v2-engine-and-shell.md) shows a vendor
change: a row SIX shows that the app doesn't understand no longer turns SIX's status to "changed".
A page whose layout changed still does.

## Context

The SIX readers were strict on purpose: anything they couldn't place for certain made the whole
page "SIX changed something", so a change never turned into a silent blank (0001). Each check was
right about the page, but a check about one row failed the whole page too.

A Student's fees page showed a row labelled "SPI", the development fee some intakes pay once on
entry (#210). The bills reader expected a term in every row, refused the page, and SIX's status
turned red on every screen, though every bill on it was readable and the sign-in was fine. Pages
differ from one Student to another (their fees, grades, curriculum, scheme), so another account will
show another row nobody recorded, and the app can't record every account's pages first.

## Decision

- **A row the app doesn't understand is left out, and the rest of the page reads.** The readers read
  a page's rows one by one (`src/engine/sources/skipped.ts`); a row whose check fails is kept with
  what it shows on SIX and what didn't fit. It applies to the rows of SIX's fees, transcript,
  curriculum position, KRS, curriculum list and structure, scheme registrations and this term's
  course list.
- **What holds the rows stays strict.** A table that's gone, its columns, a heading the rows under it
  belong to (a year of bills, a semester of the transcript) still make the page "changed": a row read
  under the wrong term is worse than a row left out.
- **More rows left out than read is a change, not odd rows.** SIX writing every grade another way would
  leave out every graded course and read only this term's ungraded ones; that's the page changing.
- **The Student is told, on the screen that shows that data.** What each read left out is kept in
  `six.skipped`, by dataset, and a read without any clears it. The fees, KRS, curriculum, planner,
  grades and Presence screens say how many rows SIX shows that the app doesn't recognise yet, show
  them as SIX writes them, and open that page on SIX. It's a quiet note, not a warning: everything
  else on the page is there.
- **The month timetable stays strict.** A class meeting left out could make a day look free on Home
  and in Schedule, and the app never calls a day free that it couldn't read. ITB's public course
  catalog stays as it is too: it's the same page for everyone, and one program that fails already
  leaves the others readable.

## Consequences

- A new kind of row on one Student's page no longer hides everything else on it, or turns SIX red.
- A row left out is never silent: the screen says so, with the row, until a read no longer leaves it out.
- What a row left out carries is missing until the app learns it (a fee, a course). The note says to
  check SIX, and the row's text says which.
- Each reader's tests check both: a row it doesn't recognise is left out with the rest read as before,
  and a layout change is still refused.
