// KRS, UKT and ITB calendar alerts (#80):
// - KRS: approved by the advisor, made official, and every course the advisor
//   (or SIX) added, removed, moved or un-approved; kind "krs".
// - UKT: a new bill, then 7 days and 1 day before the next payment is due,
//   and once when it goes overdue, while unpaid; kind "bill".
// - ITB's calendar: the morning a DRS or URS window opens and the morning
//   before it closes (not once the KRS is sent / changed), the morning before
//   ITB's UKT deadline (not once paid), and the morning the questionnaire
//   opens; kind "academic". Short-semester windows don't alert: that
//   semester is optional.
// The center keeps the first sync silent and each group switchable.
import { DAY, rupiah, termVars, wibMorning } from "../../core/academic";
import { wibDay } from "../../core/course-meetings";
import type { AcademicCalendar, AlertText, Bill, KrsChange, KrsPlan } from "../../core/models";
import { krsChanges } from "../../core/models";
import type { StringKey } from "../../core/strings";
import type { AlertDraft, Detector, PlannedAlert } from "./detector";

const MONTHS = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** A WIB day ("2026-08-23") as both languages write it: "23 Agu", "23 Aug". */
export function dayVars(day: string): { dateId: string; dateEn: string } {
  const month = Number(day.slice(5, 7)) - 1;
  const date = Number(day.slice(8, 10));
  return {
    dateId: `${date} ${MONTHS.id[month]}`,
    dateEn: `${date} ${MONTHS.en[month]}`,
  };
}

// ------------------------------------------------------------ KRS

const KRS_TARGET = { screen: "plan", tab: "krs" } as const;

function courseText(change: KrsChange, before: KrsPlan | undefined): AlertText | null {
  switch (change.kind) {
    case "course-added":
      return {
        key: "alert.krs.added",
        vars: { code: change.code, course: change.code },
      };
    case "course-removed":
      return {
        key: "alert.krs.removed",
        vars: { code: change.code, course: change.code },
      };
    case "course-changed": {
      const was = before?.courses.find((c) => c.code === change.code);
      const vars = {
        code: change.code,
        course: change.code,
        classNo: change.classNo,
        sks: change.sks,
      };
      if (was && was.classNo !== change.classNo) return { key: "alert.krs.class", vars };
      if (was && was.sks !== change.sks) return { key: "alert.krs.sks", vars };
      return {
        key: change.approved ? "alert.krs.courseApproved" : "alert.krs.unapproved",
        vars,
      };
    }
    default:
      return null;
  }
}

const STEP_TITLE: Record<"approved" | "legalized", Record<"plan" | "change", StringKey>> = {
  approved: { plan: "alert.krs.approved", change: "alert.krs.changeApproved" },
  legalized: { plan: "alert.krs.official", change: "alert.krs.changeOfficial" },
};

/** The advisor approved the plan or SIX made it official; courses added, removed, moved or un-approved. */
export const krsChanged: Detector = {
  name: "academic.krs",
  watches: ["six.krs"],
  changed(change) {
    if (change.name !== "six.krs" || !change.previous) return [];
    const before = change.previous;
    const plan = change.next;
    const changes = krsChanges(before, plan);
    const drafts: AlertDraft[] = [];
    const common = { kind: "krs", source: "six", target: KRS_TARGET } as const;
    const body = {
      key: "alert.krs.body",
      vars: { count: plan.courses.length, sks: plan.sks },
    } as const;
    const stepped = changes.some((c) => c.kind === "approved");
    for (const c of changes) {
      if (c.kind === "approved" || c.kind === "legalized") {
        drafts.push({
          ...common,
          id: `krs.${c.kind}:${plan.term}:${c.round}:${c.at}`,
          title: { key: STEP_TITLE[c.kind][c.round] },
          body,
        });
        continue;
      }
      // The advisor approving the plan approves its courses too: said once, by the step.
      if (c.kind === "course-changed" && stepped && c.approved && before.courses.find((x) => x.code === c.code)?.classNo === c.classNo) continue;
      const text = courseText(c, before);
      if (!text) continue;
      drafts.push({
        ...common,
        id: `krs.course:${plan.term}:${text.key}:${JSON.stringify(text.vars)}`,
        title: {
          key: "alert.krs.changed",
          vars: { course: "code" in c ? c.code : "" },
        },
        body: text,
      });
    }
    return drafts;
  },
};

// ------------------------------------------------------------ bills

const BILL_TARGET = { screen: "plan", tab: "bills" } as const;

const owed = (bill: Bill) => bill.status === "unpaid" || bill.status === "partly-paid";
const leftText = (bill: Bill) => rupiah(Math.max(0, (bill.amount ?? 0) - (bill.paid ?? 0)));

/** A bill that wasn't there (or was "-") now asks for money. */
export const newBill: Detector = {
  name: "academic.billNew",
  watches: ["six.bills"],
  changed(change) {
    if (change.name !== "six.bills" || !change.previous) return [];
    const before = new Map(change.previous.map((b) => [b.term, b]));
    return change.next
      .filter((bill) => {
        const was = before.get(bill.term);
        return owed(bill) && (!was || was.status === "not-billed");
      })
      .map((bill): AlertDraft => ({
        id: `bill.new:${bill.term}:${bill.amount}`,
        kind: "bill",
        source: "six",
        title: { key: "alert.bill.new", vars: termVars(bill.term) },
        body:
          bill.nextDueAt !== null
            ? {
                key: "alert.bill.newBody",
                vars: {
                  amount: leftText(bill),
                  ...dayVars(wibDay(bill.nextDueAt)),
                },
              }
            : { key: "alert.bill.newNoDate", vars: { amount: leftText(bill) } },
        target: BILL_TARGET,
      }));
  },
};

/** 7 days and 1 day before the next payment is due, and once overdue, while not paid. A moved deadline gets new reminders. */
export const billReminders: Detector = {
  name: "academic.billDue",
  watches: ["six.bills"],
  plan({ get }) {
    const planned: PlannedAlert[] = [];
    for (const bill of get("six.bills") ?? []) {
      if (!owed(bill) || bill.nextDueAt === null) continue;
      const due = bill.nextDueAt;
      const day = wibDay(due);
      const common = {
        kind: "bill",
        source: "six",
        target: BILL_TARGET,
        body: {
          key: "alert.bill.body",
          vars: { amount: leftText(bill), ...dayVars(day) },
        },
      } as const;
      planned.push(
        {
          ...common,
          id: `bill.due7:${bill.term}:${due}`,
          at: wibMorning(day, -7),
          until: wibMorning(day, -1),
          title: { key: "alert.bill.week" },
        },
        {
          ...common,
          id: `bill.due1:${bill.term}:${due}`,
          at: wibMorning(day, -1),
          until: due,
          title: { key: "alert.bill.day" },
        },
        {
          ...common,
          id: `bill.overdue:${bill.term}:${due}`,
          at: due + 1,
          until: due + 7 * DAY,
          title: { key: "alert.bill.overdue" },
        },
      );
    }
    return planned;
  },
};

// ------------------------------------------------------------ ITB's calendar

const DEADLINES_TARGET = { screen: "plan", tab: "deadlines" } as const;

/** The calendar's dates that need the Student, given what SIX says is already done. */
export function calendarReminders(calendar: AcademicCalendar | undefined, krs: KrsPlan | undefined, bills: readonly Bill[] | undefined): PlannedAlert[] {
  const planned: PlannedAlert[] = [];
  const common = {
    kind: "academic",
    source: "itb",
    target: DEADLINES_TARGET,
  } as const;
  for (const event of calendar?.events ?? []) {
    if (!event.term || event.term.endsWith("-3")) continue;
    const plan = krs?.term === event.term ? krs : undefined;
    const vars = dayVars(event.lastDay);
    const id = (what: string) => `academic.${what}:${event.id}:${event.firstDay}:${event.lastDay}`;
    const window = (open: StringKey, closes: StringKey, body: StringKey) => {
      planned.push({
        ...common,
        id: id("open"),
        at: wibMorning(event.firstDay),
        until: event.end,
        title: { key: open },
        body: { key: body, vars },
      });
      if (event.lastDay > event.firstDay)
        planned.push({
          ...common,
          id: id("closes"),
          at: wibMorning(event.lastDay, -1),
          until: event.end,
          title: { key: closes },
          body: { key: body, vars },
        });
    };
    switch (event.kind) {
      case "drs":
        if (!plan || plan.state === "not-sent") window("alert.academic.drsOpen", "alert.academic.drsCloses", "alert.academic.drsBody");
        break;
      case "urs":
        if (!plan?.change?.sentAt) window("alert.academic.ursOpen", "alert.academic.ursCloses", "alert.academic.ursBody");
        break;
      case "ukt-deadline":
        if (bills?.find((b) => b.term === event.term)?.status !== "paid")
          planned.push({
            ...common,
            id: id("ukt"),
            at: wibMorning(event.firstDay, -1),
            until: event.end,
            title: { key: "alert.academic.ukt" },
            body: { key: "alert.academic.uktBody", vars },
          });
        break;
      case "questionnaire":
        planned.push({
          ...common,
          id: id("questionnaire"),
          at: wibMorning(event.firstDay),
          until: event.end,
          title: { key: "alert.academic.questionnaire" },
          body: { key: "alert.academic.questionnaireBody", vars },
        });
        break;
    }
  }
  return planned;
}

/** The plan is redone every few minutes; the reminders only change with the data. */
let remembered: { inputs: unknown[]; planned: PlannedAlert[] } | null = null;

export const academicCalendar: Detector = {
  name: "academic.calendar",
  watches: ["itb.calendar", "six.krs", "six.bills"],
  plan({ get }) {
    const inputs = [get("itb.calendar"), get("six.krs"), get("six.bills")] as const;
    if (!remembered || remembered.inputs.some((input, i) => input !== inputs[i])) remembered = { inputs: [...inputs], planned: calendarReminders(...inputs) };
    return remembered.planned;
  },
};
