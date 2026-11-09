// Notifikasi: one meeting, one row. Edunex announces a meeting ("Pertemuan 3 Proposal TA diumumkan di Edunex") and,
// close by, posts its Teams link or its slides as a material ("Link Teams Pertemuan 03: Jumat, 9 Oktober 2026"): two
// rows about one meeting (round 3's review). The material folds into the meeting's row, which says "link baru" or
// "materi baru" and opens where the material is. Only when sure: the same course, the same meeting number in the
// material's name, and posted within three days of the announcement; otherwise both rows stay.
import type { Alert } from "../../../../src/core/models";

const DAY = 86_400_000;
/** How close the announcement and the material must be posted to be taken as about one meeting. */
const NEAR = 3 * DAY;
/** A meeting's number in a material's name: "Pertemuan 03", "Pert. 3", "Meeting 3". */
const NUMBER = /\b(?:pertemuan|pert\.?|meeting)\s*0*(\d+)\b/i;
/** A material that's a link to join, not a file to read. */
const LINK = /\b(?:link|teams|zoom|meet)\b/i;

export type MeetingExtra = "link" | "material";

export interface SameMeeting {
  /** The material alerts now shown on their meeting's row. */
  folded: ReadonlySet<string>;
  /** A meeting alert's id → the material folded into it, and what it is. */
  joined: ReadonlyMap<string, { material: Alert; extra: MeetingExtra }>;
}

const course = (item: Alert) => (typeof item.title.vars?.course === "string" ? item.title.vars.course : null);

export function sameMeeting(items: readonly Alert[]): SameMeeting {
  const folded = new Set<string>();
  const joined = new Map<string, { material: Alert; extra: MeetingExtra }>();
  const materials = items.filter((item) => item.kind === "newMaterial");
  for (const meeting of items) {
    if (meeting.kind !== "meeting") continue;
    const code = course(meeting);
    const number = Number(meeting.title.vars?.number);
    if (!code || !Number.isFinite(number)) continue;
    const material = materials.find((item) => {
      if (folded.has(item.id) || course(item) !== code || Math.abs(item.at - meeting.at) > NEAR) return false;
      const name = item.body?.vars?.title;
      const said = typeof name === "string" ? NUMBER.exec(name) : null;
      return said !== null && Number(said[1]) === number;
    });
    if (!material) continue;
    const name = String(material.body?.vars?.title ?? "");
    folded.add(material.id);
    joined.set(meeting.id, { material, extra: LINK.test(name) ? "link" : "material" });
  }
  return { folded, joined };
}
