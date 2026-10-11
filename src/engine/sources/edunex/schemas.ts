// What the engine needs from Edunex responses, verified against recordings
// (test/fixtures/edunex). Unknown extra fields are ignored; a missing or
// mistyped field the app relies on fails the check.
import { z } from "zod";

/** GET /login/me — also the liveness check. Edunex keeps the student number in `code`. */
export const LoginMe = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
});

/** GET /course/presences/list — the Student's course and class pairs for the current period. */
export const CoursePairs = z.array(
  z.object({
    course_id: z.number(),
    course_code: z.string(),
    courses_name: z.string(),
    class_id: z.number(),
    class_name: z.string(),
    semester: z.string(),
    year: z.string(),
  }),
);

/** GET /notifications/{userId} — Edunex's new-item signals. `isRead` is never changed by the app. */
export const NotificationFeed = z.object({
  data: z.object({
    notifications: z.array(
      z.object({
        type: z.string(),
        title: z.string(),
        objectId: z.union([z.string(), z.number()]),
        date: z.string(),
        message: z.string().nullish(),
      }),
    ),
  }),
});
