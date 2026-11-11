// The phone's "Edunex Plus" calendar as every screen sees it (mobile/src/screens/schedule/phone-calendar.ts), against
// a pretend phone calendar: a date added on Kalender akademik is known to be there (a second tap is a state, not an
// error), comes out again, is told apart from one Jadwal's "Kalender HP" switch keeps, and goes with the calendar
// when the switch is turned off. Made-up events only.
import { beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => {
  interface Event {
    id: string;
    calendarId: string;
    title: string;
    startDate: Date;
    endDate: Date;
  }
  const state = {
    access: "granted" as "granted" | "denied" | "undetermined",
    /** Times the system was asked for calendar access. */
    asked: 0,
    calendars: [] as { id: string; title: string }[],
    events: new Map<string, Event>(),
    files: new Map<string, string>(),
    next: 1,
  };
  const eventOf = (event: Event) => ({
    ...event,
    update: async (details: Partial<Event>) => void Object.assign(state.events.get(event.id) ?? {}, details),
    delete: async () => void state.events.delete(event.id),
  });
  const calendarOf = (calendar: { id: string; title: string }) => ({
    ...calendar,
    allowsModifications: true,
    source: { id: "local", isLocalAccount: true },
    listEvents: async () => [...state.events.values()].filter((e) => e.calendarId === calendar.id).map(eventOf),
    createEvent: async (details: { title: string; startDate: Date; endDate: Date }) => {
      const event = { id: `event-${state.next++}`, calendarId: calendar.id, title: details.title, startDate: details.startDate, endDate: details.endDate };
      state.events.set(event.id, event);
      return eventOf(event);
    },
    delete: async () => {
      state.calendars = state.calendars.filter((c) => c.id !== calendar.id);
      for (const event of [...state.events.values()]) if (event.calendarId === calendar.id) state.events.delete(event.id);
    },
  });
  const permission = () => ({ granted: state.access === "granted", canAskAgain: state.access === "undetermined" });
  return { state, eventOf, calendarOf, permission };
});

vi.mock("../../mobile/node_modules/expo-calendar", () => ({
  EntityTypes: { EVENT: "event" },
  Availability: { FREE: "free", BUSY: "busy" },
  CalendarAccessLevel: { OWNER: "owner" },
  getCalendarPermissions: async () => phone.permission(),
  requestCalendarPermissions: async () => {
    phone.state.asked++;
    return phone.permission();
  },
  getCalendars: async () => phone.state.calendars.map(phone.calendarOf),
  getDefaultCalendarSync: () => ({ source: { id: "local" } }),
  createCalendar: async (details: { title: string }) => {
    const calendar = { id: `calendar-${phone.state.next++}`, title: details.title };
    phone.state.calendars.push(calendar);
    return phone.calendarOf(calendar);
  },
  ExpoCalendarEvent: {
    get: async (id: string) => {
      const event = phone.state.events.get(id);
      if (!event) throw new Error("no such event");
      return phone.eventOf(event);
    },
  },
}));
vi.mock("../../mobile/node_modules/expo-file-system", () => ({
  Paths: { document: "document", cache: "cache" },
  File: class {
    private readonly path: string;
    constructor(dir: string, name: string) {
      this.path = `${dir}/${name}`;
    }
    get exists() {
      return phone.state.files.has(this.path);
    }
    textSync() {
      return phone.state.files.get(this.path) ?? "";
    }
    writeSync(text: string) {
      phone.state.files.set(this.path, text);
    }
    delete() {
      phone.state.files.delete(this.path);
    }
  },
}));
vi.mock("../../mobile/node_modules/expo-sharing", () => ({}));
vi.mock("../../mobile/node_modules/react-native", () => ({ Platform: { OS: "ios" }, Linking: {} }));

import { itbItem, itbUid, placement } from "../../mobile/src/screens/schedule/calendar-plan";
import { addToPhoneCalendar, checkPlaced, placedNow, removeFromPhoneCalendar, removePhoneCalendar } from "../../mobile/src/screens/schedule/phone-calendar";

const NOTHING = { from: 0, until: 0 };
const date = itbItem({ id: "made-up-1", title: "Batas akhir sesuatu", firstDay: "2026-11-30", lastDay: "2026-12-11" }, "Dari Kalender ITB");
const other = itbItem({ id: "made-up-2", title: "Hari libur", firstDay: "2026-12-25", lastDay: "2026-12-25" }, "Dari Kalender ITB");
const uid = itbUid("made-up-1");
const where = (switchOn: boolean, uids = [uid]) => placement(uids, placedNow(), switchOn);

beforeEach(async () => {
  phone.state.access = "granted";
  await removePhoneCalendar();
  phone.state.calendars = [];
  phone.state.events.clear();
  phone.state.files.clear();
  phone.state.asked = 0;
});

describe("a date in the phone's calendar", () => {
  it("is known to be there once added, so a second tap has a state to show instead of an error", async () => {
    expect(where(false)).toBe("none");
    expect(await addToPhoneCalendar([date], new Set(), NOTHING)).toEqual({ kind: "added", events: 1 });
    expect(where(false)).toBe("added");
    expect(phone.state.calendars.map((c) => c.title)).toEqual(["Edunex Plus"]);
    // Added again (from another screen, or by Jadwal's switch): the same event, never a copy.
    await addToPhoneCalendar([date], new Set(), NOTHING);
    expect(phone.state.events.size).toBe(1);
  });

  it("on an iPhone, a date over several days ends on its last day (an iPhone counts the end day in)", async () => {
    await addToPhoneCalendar([date], new Set(), NOTHING);
    const [event] = [...phone.state.events.values()];
    expect(event?.startDate.toISOString()).toBe("2026-11-30T05:00:00.000Z");
    expect(event?.endDate.toISOString()).toBe("2026-12-11T05:00:00.000Z");
  });

  it("comes out again, and only it", async () => {
    await addToPhoneCalendar([date, other], new Set(), NOTHING);
    expect(await removeFromPhoneCalendar([uid])).toBe("removed");
    expect(where(false)).toBe("none");
    expect([...phone.state.events.values()].map((e) => e.title)).toEqual(["Hari libur"]);
  });

  it("is no longer there once the Student deleted it in the phone's own calendar app", async () => {
    await addToPhoneCalendar([date], new Set(), NOTHING);
    phone.state.events.clear();
    await checkPlaced([uid]);
    expect(where(false)).toBe("none");
  });

  it("says calendar access is off, and asks the system only when it can still be asked", async () => {
    phone.state.access = "denied";
    expect(await addToPhoneCalendar([date], new Set(), NOTHING)).toEqual({ kind: "denied" });
    expect(phone.state.asked).toBe(0);
    expect(where(false)).toBe("none");
  });
});

describe("Jadwal's switch and a date added on its own, one calendar", () => {
  it("a date the switch keeps shows as in the calendar, kept by the switch, not to take out one by one", async () => {
    await addToPhoneCalendar([date], new Set([uid]), NOTHING, { kept: true });
    expect(where(true)).toBe("kept");
    // Added on its own first, then the switch came on and took it over.
    await addToPhoneCalendar([other], new Set(), NOTHING);
    expect(where(true, [itbUid("made-up-2")])).toBe("added");
    await addToPhoneCalendar([other], new Set(), NOTHING, { kept: true });
    expect(where(true, [itbUid("made-up-2")])).toBe("kept");
  });

  it("a date added on its own stays when the switch writes, while ITB still lists it; gone from ITB, it comes out", async () => {
    const span = { from: Date.parse("2026-11-01T00:00:00+07:00"), until: Date.parse("2026-12-31T00:00:00+07:00") };
    await addToPhoneCalendar([date], new Set(), NOTHING);
    await addToPhoneCalendar([other], new Set([other.uid, uid]), span, { kept: true });
    expect(where(true)).toBe("added");
    await addToPhoneCalendar([other], new Set([other.uid]), span, { kept: true });
    expect(where(true)).toBe("none");
    expect([...phone.state.events.values()].map((e) => e.title)).toEqual(["Hari libur"]);
  });

  it("turning the switch off takes the calendar off the phone, and every screen knows", async () => {
    await addToPhoneCalendar([date], new Set(), NOTHING);
    await addToPhoneCalendar([other], new Set([other.uid, uid]), NOTHING, { kept: true });
    await removePhoneCalendar();
    expect(phone.state.calendars).toEqual([]);
    expect(placedNow().size).toBe(0);
    expect(where(false)).toBe("none");
  });

  it("an exam with one sitting in and one not is offered whole", async () => {
    await addToPhoneCalendar([date], new Set(), NOTHING);
    expect(where(false, [uid, itbUid("made-up-2")])).toBe("none");
    expect(where(false, [])).toBe("none");
  });
});
