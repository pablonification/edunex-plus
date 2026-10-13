// A small iCalendar (RFC 5545) reader for ITB's academic calendar: events
// with their summary, all-day or timed start and end, and simple repeats.
// Written here rather than pulled in as a package; it reads what calendar
// feeds commonly send and refuses anything that isn't a calendar.

export interface IcsEvent {
  uid: string;
  summary: string;
  /** ms since epoch. */
  start: number;
  /** ms since epoch, exclusive. */
  end: number;
  allDay: boolean;
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Times without a zone ("floating") are read as WIB: the calendar is ITB's. */
const DEFAULT_ZONE = "Asia/Jakarta";
const DAY = 86_400_000;
/** Repeats stop after this many occurrences, whatever the rule says. */
const MAX_REPEATS = 500;

export class IcsError extends Error {}

/** Lines folded with a leading space or tab belong to the line before. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((line) => line.length > 0);
}

function parseLine(line: string): Property {
  // The value starts at the first colon outside a quoted parameter.
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) throw new IcsError(`Not a calendar line: ${line.slice(0, 40)}`);
  const [name = "", ...rawParams] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const param of rawParams) {
    const eq = param.indexOf("=");
    if (eq > 0) params[param.slice(0, eq).toUpperCase()] = param.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const unescapeText = (value: string) => value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));

/** The zone's offset from UTC at an instant (ms), using the platform's time zone data. */
function zoneOffset(instant: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - instant;
}

/** A wall-clock time in a zone, as an instant. */
function fromZone(wall: number, zone: string): number {
  let zoneOk = true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
  } catch {
    zoneOk = false;
  }
  const tz = zoneOk ? zone : DEFAULT_ZONE;
  const guess = wall - zoneOffset(wall, tz);
  return wall - zoneOffset(guess, tz);
}

/** A DATE or DATE-TIME value. All-day dates start at midnight WIB. */
function parseTime(property: Property): { at: number; allDay: boolean } {
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(property.value);
  if (date || property.params.VALUE === "DATE") {
    if (!date) throw new IcsError(`Not a date: ${property.value}`);
    return { at: fromZone(Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3])), DEFAULT_ZONE), allDay: true };
  }
  const time = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(property.value);
  if (!time) throw new IcsError(`Not a time: ${property.value}`);
  const [y = 0, mo = 1, d = 1, h = 0, mi = 0, s = 0] = time.slice(1, 7).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  return { at: time[7] ? wall : fromZone(wall, property.params.TZID ?? DEFAULT_ZONE), allDay: false };
}

/** ISO 8601 durations as RFC 5545 writes them: "P1D", "PT2H30M", "P1W". */
function parseDuration(value: string): number {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value);
  if (!m) throw new IcsError(`Not a duration: ${value}`);
  const [, sign, w, d, h, mi, s] = m;
  const ms = ((Number(w ?? 0) * 7 + Number(d ?? 0)) * 24 * 3600 + Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Number(s ?? 0)) * 1000;
  return sign === "-" ? -ms : ms;
}

/**
 * The starts of a repeating event. Supports FREQ (DAILY, WEEKLY, MONTHLY,
 * YEARLY) with INTERVAL, COUNT and UNTIL; a rule using anything more (BYDAY
 * and the like) keeps only its first occurrence rather than guessing.
 */
function repeats(rule: string, first: number, allDay: boolean): number[] {
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=") as [string, string]));
  const freq = parts.FREQ;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq) || Object.keys(parts).some((k) => k.startsWith("BY"))) return [first];
  const interval = Math.max(1, Number(parts.INTERVAL ?? 1));
  const count = parts.COUNT ? Math.min(Number(parts.COUNT), MAX_REPEATS) : MAX_REPEATS;
  const until = parts.UNTIL
    ? parseTime({ name: "UNTIL", params: {}, value: parts.UNTIL }).at + (/T/.test(parts.UNTIL) ? 0 : DAY - 1)
    : Number.POSITIVE_INFINITY;
  // Step in WIB wall-clock time so all-day events stay on midnight.
  const offset = allDay ? zoneOffset(first, DEFAULT_ZONE) : 0;
  const base = new Date(first + offset);
  const out: number[] = [];
  for (let n = 0; out.length < count; n++) {
    const step = n * interval;
    const next = new Date(base);
    if (freq === "DAILY") next.setUTCDate(base.getUTCDate() + step);
    else if (freq === "WEEKLY") next.setUTCDate(base.getUTCDate() + step * 7);
    else if (freq === "MONTHLY") next.setUTCMonth(base.getUTCMonth() + step);
    else next.setUTCFullYear(base.getUTCFullYear() + step);
    // The 31st of a shorter month doesn't exist: that occurrence is skipped, as RFC 5545 says.
    if (freq !== "DAILY" && freq !== "WEEKLY" && next.getUTCDate() !== base.getUTCDate()) continue;
    const at = next.getTime() - offset;
    if (at > until) break;
    out.push(at);
  }
  return out;
}

/** Every event in a calendar; repeats come out as separate events. */
export function parseIcs(text: string): IcsEvent[] {
  const lines = unfold(text.replace(/^﻿/, ""));
  if (lines[0]?.trim().toUpperCase() !== "BEGIN:VCALENDAR") throw new IcsError("Not a calendar");
  const events: IcsEvent[] = [];
  let current: Property[] | null = null;
  let depth = 0; // components nested inside an event (alarms) are skipped
  for (const line of lines) {
    const property = parseLine(line);
    if (property.name === "BEGIN") {
      if (current) depth++;
      else if (property.value.toUpperCase() === "VEVENT") current = [];
      continue;
    }
    if (property.name === "END") {
      if (current && depth > 0) depth--;
      else if (current && property.value.toUpperCase() === "VEVENT") {
        events.push(...toEvents(current));
        current = null;
      }
      continue;
    }
    if (current && depth === 0) current.push(property);
  }
  return events;
}

function toEvents(properties: Property[]): IcsEvent[] {
  const get = (name: string) => properties.find((p) => p.name === name);
  const startProp = get("DTSTART");
  if (!startProp) throw new IcsError("An event has no start");
  const { at: start, allDay } = parseTime(startProp);
  const endProp = get("DTEND");
  const duration = get("DURATION");
  // No end: an all-day event lasts its day; a timed one is an instant.
  const end = endProp ? parseTime(endProp).at : duration ? start + parseDuration(duration.value) : allDay ? start + DAY : start;
  if (end < start) throw new IcsError("An event ends before it starts");
  const uid = get("UID")?.value ?? `${start}`;
  const summary = unescapeText(get("SUMMARY")?.value ?? "").trim();
  const rule = get("RRULE");
  if (!rule) return [{ uid, summary, start, end, allDay }];
  const excluded = new Set(properties.filter((p) => p.name === "EXDATE").flatMap((p) => p.value.split(",").map((value) => parseTime({ ...p, value }).at)));
  return repeats(rule.value, start, allDay)
    .filter((at) => !excluded.has(at))
    .map((at, i) => ({ uid: i === 0 ? uid : `${uid}@${at}`, summary, start: at, end: at + (end - start), allDay }));
}
