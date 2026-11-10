// "Perlu kamu urus"'s rows as data (./urus.tsx draws them; ./strip-facts.ts counts them): apart from the parts that
// draw, so what counts them can be tested without the phone's UI.
import type { NeedDraft } from "../../../../src/core/needs";
import type { AbsenceProblem, ClashProblem } from "./problems";

export interface TodoRow {
  need: NeedDraft;
  code: string | null;
  /** The thing's own name: the Task's title, "Isi Presensi …", "UTS …", "Kirim KRS". */
  title: string;
  /** Its deadline or window in one line, dates written as the app writes them ("Tenggat Jum, 13 Nov, 23:59"). */
  when: string;
  /** Past its deadline: the line in red, with a warning sign. */
  late: boolean;
  /** Doing it counts for attendance (an Edunex Presence): its window, said by TalkBack ("Jum, 13 Nov, 15:00–23:59"). */
  presence: string | null;
  /** A Task whose handing in counts for attendance: "Presensi" at the row's end (the title doesn't say it). */
  presenceTag: boolean;
  /** The course's whole name, for what TalkBack reads (the row shows its tile). */
  course: string;
  /** When it's due by (or starts), for the soonest first. */
  at: number;
}

export type UrusRow =
  | { kind: "absence"; key: string; item: AbsenceProblem }
  | { kind: "clash"; key: string; item: ClashProblem }
  | { kind: "todo"; key: string; item: TodoRow };
