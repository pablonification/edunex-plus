// The first-run scan's data and words, copied from the desktop's src/app/shell/first-scan.tsx (its
// DOM-free helpers: what the scan reads, useScan, and describe), so both apps reason over the same
// datasets with src/core/first-scan.ts and say each finding in the same words.
import { useMemo } from "react";
import { type Format, type Translate, useNow } from "../../../../src/app/i18n";
import { useSaved } from "../../../../src/app/saved";
import { useSettings, useStatus } from "../../../../src/app/store";
import { percent } from "../../../../src/core/attendance";
import { takeHomeOnly } from "../../../../src/core/exam-sources";
import { type Finding, firstScan, scanReady } from "../../../../src/core/first-scan";
import type { DatasetName } from "../../../../src/core/models";
import { dayWord, together } from "../../parts/day-word";
import { factsLabel } from "../../ui/layout";

/** What the scan reads. */
const SCANNED: readonly DatasetName[] = [
  "six.student",
  "six.courses",
  // Whether SIX's course list lost a row: then this term's Edunex courses it doesn't name stay.
  "six.skipped",
  "six.schedule",
  "six.scheduleMonths",
  "six.scheduleUnread",
  "six.transcript",
  "six.progress",
  "six.krs",
  "edunex.courses",
  "edunex.tasks",
  "edunex.outline",
  "edunex.materials",
  "edunex.presence",
  "edunex.announcements",
  "edunex.exams",
  "itb.calendar",
  "itb.catalog",
];

/** Lines say at most this many courses, exams or meetings, then "and N more". */
const SHOWN = 3;

/** What the scan reasons from, as the app has it now. */
export function useScan(computing: boolean) {
  const { attendanceTarget, attendanceTargets } = useSettings();
  const now = useNow();
  const saved = useSaved(SCANNED);
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const itb = useStatus("itb");
  const statuses = useMemo(() => [edunex, six, itb], [edunex, six, itb]);
  const ready = scanReady(saved, statuses);
  const findings = useMemo(
    () => (computing || ready ? firstScan({ saved, statuses, targets: { attendanceTarget, attendanceTargets }, now }) : []),
    [computing, ready, saved, statuses, attendanceTarget, attendanceTargets, now],
  );
  return { saved, statuses, ready, findings };
}

/** "Kam 15 Okt", or "hari ini", "besok", "kemarin": every line here says its day mid-sentence ("Berikutnya besok"). */
const day = (f: Format, t: Translate, at: number) => (Math.abs(f.dayOffset(at)) <= 1 ? dayWord(f, t, at) : together(`${f.weekdayShort(at)} ${f.dayMonth(at)}`));

/** The first few, then "and N more". */
function few<T>(items: readonly T[], line: (item: T) => string, t: Translate): string[] {
  const shown = items.slice(0, SHOWN).map(line);
  return items.length > SHOWN ? [...shown, t("scan.more", { count: items.length - SHOWN })] : shown;
}

/** A finding in words. */
export function describe(finding: Finding, t: Translate, f: Format): { title: string; lines: string[]; note: string | null } {
  switch (finding.kind) {
    case "attendance":
      return {
        title: t("scan.attendance.title", { count: finding.count }),
        lines: few(
          finding.courses,
          (health) => {
            const vars = { code: health.code, attended: health.attended ?? 0, held: health.held ?? 0, target: health.target };
            // Only these two are listed: an absence still allowed is no risk.
            return health.state === "out" ? t("scan.attendance.out", { ...vars, best: percent(health.best ?? 0) }) : t("scan.attendance.none", vars);
          },
          t,
        ),
        note: null,
      };
    case "clash": {
      const when = (o: { start: number; end: number }) => `${day(f, t, o.start)}, ${f.timeRange(o.start, o.end)}`;
      const [first] = finding.overlaps;
      if (finding.overlaps.length === 1)
        return {
          title: t("scan.clash.one", { a: first.codes[0], b: first.codes[1], count: first.count }),
          lines: [],
          note: `${t("scan.clash.next", { when: when(first) })} ${t("scan.clash.krs")}`,
        };
      return {
        title: t("scan.clash.title", { count: finding.count }),
        lines: few(finding.overlaps, (o) => t("scan.clash.pair", { a: o.codes[0], b: o.codes[1], count: o.count, when: when(o) }), t),
        note: t("scan.clash.krs"),
      };
    }
    case "unusedPresence":
      return {
        title: t("scan.unused.title", { count: finding.count }),
        lines: few(finding.courses, (c) => t("scan.unused.course", { code: c.code, count: c.absent, attended: c.attended, held: c.held }), t),
        note: t("scan.unused.note"),
      };
    case "exams":
      return {
        title: t("scan.exams.title", { count: finding.count }),
        lines: few(
          finding.exams,
          (exam) => {
            const code = exam.courseCode;
            const kind = t(`exam.kind.${exam.kind}`);
            const apart = exam.takeHomeApart;
            // Different days for a sitting is a question for the lecturer; a take-home due another day is only its second part.
            const note = exam.disagree ? t("exam.disagree") : apart !== null && t("home.need.exam.takeHome", { date: day(f, t, apart) });
            const session = exam.six[0];
            if (session)
              return factsLabel(t("scan.exams.at", { name: kind, code, when: `${day(f, t, session.start)}, ${f.time(session.start)}` }), session.room, note);
            if (exam.at !== null) {
              if (takeHomeOnly(exam)) return t("scan.exams.takeHome", { kind, code, when: `${day(f, t, exam.at)}, ${f.time(exam.at)}` });
              return factsLabel(t("scan.exams.at", { name: exam.edunex[0]?.title ?? kind, code, when: `${day(f, t, exam.at)}, ${f.time(exam.at)}` }), note);
            }
            if (exam.week) return t("scan.exams.week", { kind, code, range: f.dayRange(exam.week.firstDay, exam.week.lastDay) });
            return t("scan.exams.noDate", { name: kind, code });
          },
          t,
        ),
        note: null,
      };
    case "notInSix":
      return {
        title: t("scan.notInSix.title", { count: finding.count }),
        lines: few(
          finding.meetings,
          ({ code, meeting }) =>
            factsLabel(
              t("scan.notInSix.meeting", { code, number: meeting.number, when: `${day(f, t, meeting.start)}, ${f.timeRange(meeting.start, meeting.end)}` }),
              meeting.online && t("scan.notInSix.online"),
            ),
          t,
        ),
        note: t("scan.notInSix.note"),
      };
    case "edited":
      return {
        title: t("scan.edited.title", { count: finding.count }),
        lines: [],
        note: [finding.afterSubmit ? t("scan.edited.afterSubmit", { count: finding.afterSubmit }) : null, t("scan.edited.silent")].filter(Boolean).join(" "),
      };
    case "ipk": {
      const level = (band: "summa" | "magna" | "cum") => t(`scan.ipk.level.${band}`);
      return {
        title: t("scan.ipk.title", { ipk: f.number(finding.ipk, 2), band: finding.band ? level(finding.band) : t("scan.ipk.below") }),
        lines: [],
        note: finding.next
          ? t("scan.ipk.next", { gap: f.number(finding.next.min - finding.ipk, 2), band: level(finding.next.level), min: f.number(finding.next.min, 2) })
          : finding.blocked
            ? finding.blocked.reason === "retake"
              ? t("scan.ipk.retake", { band: level(finding.blocked.level) })
              : t("scan.ipk.time")
            : null,
      };
    }
    case "unread":
      return {
        title: t("scan.unread.title", { count: finding.count }),
        lines: finding.parts.map(
          (part) =>
            `${t(`scan.unread.${part.state as "offline" | "changed" | "expired"}`, { source: part.catalog ? t("scan.unread.catalog") : t(`source.${part.source}`) })}${part.missing.length ? `: ${part.missing.map((name) => t(`scan.part.${name}`)).join(", ")}` : ""}`,
        ),
        note: null,
      };
  }
}
