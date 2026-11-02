# 16. The Student comments under their answer

Status: accepted (2026-10-28). Widens [the only writes](../../API.md#the-only-writes): handing in a Task,
and now a comment under the Student's own answer.

## Context

A lecturer handed a Student's Task back for revision (#263's sequel). On Edunex that's "Revision
Request": the answer is unsent again, and the lecturer's feedback is often a message in the thread
under the answer (`/course/comments`), not a note on the answer itself. Edunex's website lets the
Student write in that thread too, the box under their answer ("Add Comment"), to ask what to fix
or to say what they changed.

The app reads the thread, but the only writes it made were handing in. A Student reading their
lecturer's feedback in the app had to open the website to answer it.

## Decision

- **The Student can write under their own answer.** One kind of message only: text, in the thread
  under an answer of theirs to a personal Task, as the website's comment box sends it
  (`POST /course/comments` with `comment`, `commentable_id`, `commentable_type: "task_answer"`).
  No files (the website's box has none for a Student), no reply-to (its form never sends one), no
  editing or deleting (the website has neither), never under a group's answer or anything else.
- **Explicit only, once.** It goes on Kirim (or ⌘↵) and nothing else, one at a time per Task, after
  reading the Task back (gone, a group Task, or no answer yet: refused, nothing sent).
- **Cleaned as an answer is.** The same tidy formatting (`cleanAnswer`), since Edunex shows it to
  lecturers as written.
- **Confirmed by reading back.** "Sent" only when the thread, read again, holds it as the
  Student's. Otherwise "unconfirmed", and the screen says so.

## Consequences

- Guardrails 3 and 5 in API.md name this write beside handing in. The privacy page says the app
  sends what the Student writes to their lecturer.
- Every rule of the hand-in writes holds for it: the User-Agent, a `401` asks the liveness check,
  the error table, and the pretend Edunex in tests takes it as the website would.
- Taken from the website's code (`createAnswerComment` in `js/app.79bf84f4.js`, the form in
  `js/components/content/reader/task-reader.2eb63cbd.js`), like the hand-in writes. Only a real
  comment from the app proves the request.
