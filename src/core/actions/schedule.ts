// Actions for Jadwal (#77): saving the phone calendar file.
import { z } from "zod";

export const scheduleActions = {
  /**
   * Writes classes with rooms, exams and Task deadlines to an .ics file the
   * Student picks in the system save dialog. Importing it again updates the
   * events. `file`: null when the Student closed the dialog.
   */
  "schedule.export": {
    input: z.object({}),
    output: z.object({ file: z.string().nullable(), events: z.number() }),
  },
} as const;
