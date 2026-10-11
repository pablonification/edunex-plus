// Writes the phone calendar file (#77, user story 79): an iCalendar (RFC 5545)
// file of classes with rooms, exams and Task deadlines. Importing it again
// updates the events instead of adding copies: every event keeps a stable
// UID, and SEQUENCE and LAST-MODIFIED grow with each export, so the newer copy
// wins. Times are WIB wall-clock times with TZID=Asia/Jakarta and the zone
// itself (VTIMEZONE) in the file, so the phone shows them right in any zone.

export const ICS_ZONE = "Asia/Jakarta";
const WIB = 7 * 3_600_000;
/** SEQUENCE counts seconds since this moment: it only ever grows. */
const SEQUENCE_EPOCH = Date.UTC(2024, 0, 1);
/** An item that would end when it starts lasts this long instead. */
const SHORTEST = 30 * 60_000;

export interface IcsItem {
  /** Stable across exports: the same class, exam or Task always gets the same one. */
  uid: string;
  summary: string;
  /** ms since epoch. */
  start: number;
  /** ms since epoch, after `start` (a deadline is a short event ending at it). */
  end: number;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  /** Doesn't make the Student busy (a deadline). */
  free?: boolean;
}

/** Text values escape backslashes, semicolons, commas and line breaks. */
const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** "20261008T080000" in WIB. */
const wibStamp = (ms: number) => new Date(ms + WIB).toISOString().slice(0, 19).replace(/[-:]/g, "");
/** "20261008T010000Z". */
const utcStamp = (ms: number) => `${new Date(ms).toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;

/** Lines longer than 75 octets continue on the next line after a space, never inside a character. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts toward their 75.
    if (size + bytes > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The calendar file's text. `now` stamps the export: DTSTAMP, LAST-MODIFIED and SEQUENCE. */
export function writeIcs(items: readonly IcsItem[], options: { name: string; now: number }): string {
  const { now } = options;
  const sequence = Math.max(0, Math.floor((now - SEQUENCE_EPOCH) / 1000));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Edunex Plus//Jadwal//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `X-WR-TIMEZONE:${ICS_ZONE}`,
    "BEGIN:VTIMEZONE",
    `TZID:${ICS_ZONE}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0700",
    "TZOFFSETTO:+0700",
    "TZNAME:WIB",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const item of items) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.uid}`,
      `DTSTAMP:${utcStamp(now)}`,
      `LAST-MODIFIED:${utcStamp(now)}`,
      `SEQUENCE:${sequence}`,
      `DTSTART;TZID=${ICS_ZONE}:${wibStamp(item.start)}`,
      // RFC 5545: the end must come after the start, or some calendars refuse the event.
      `DTEND;TZID=${ICS_ZONE}:${wibStamp(item.end > item.start ? item.end : item.start + SHORTEST)}`,
      `SUMMARY:${escapeText(item.summary)}`,
    );
    if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
    if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`);
    if (item.url) lines.push(`URL:${item.url}`);
    lines.push(`TRANSP:${item.free ? "TRANSPARENT" : "OPAQUE"}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
