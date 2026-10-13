// Actions for Jadwal (#77): saving the phone calendar file, and showing it
// in the system's file manager afterwards.
import { z } from "zod";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const scheduleActions = {
  /**
   * Writes classes with rooms, exams, Task deadlines and ITB's calendar to
   * an .ics file the Student picks in the system save dialog: the kinds they
   * chose, from `from` to `until` (WIB days; everything when left out).
   * Importing it again updates the events. `file`: the file's name, null
   * when the Student closed the dialog.
   */
  "schedule.export": {
    input: z.object({
      include: z.object({ classes: z.boolean(), exams: z.boolean(), deadlines: z.boolean(), itb: z.boolean() }).partial().optional(),
      from: Day.optional(),
      until: Day.optional(),
    }),
    output: z.object({ file: z.string().nullable(), events: z.number() }),
  },
  /** Shows the calendar file saved last in Finder (Explorer, the file manager). Only that file. */
  "schedule.reveal": {
    input: z.object({}),
    output: z.object({}),
  },
} as const;
