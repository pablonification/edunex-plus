// The first-run scan (#81, spec story 68): once the first full sync of Edunex
// (and SIX when connected) is done, a short dialog of what the app found,
// each line with its number and the screen that shows it. It opens by itself
// once (a setting remembers) and only with something to say; Settings opens
// it again. The findings come from src/core/first-scan.ts.
import { Component, type ComponentType, type ReactNode, useEffect, useId, useMemo, useRef } from "react";
import { percent } from "../../core/attendance";
import { takeHomeOnly } from "../../core/exam-sources";
import { type Finding, firstScan, notable, scanReady, scanSummary } from "../../core/first-scan";
import type { DatasetName } from "../../core/models";
import type { Route } from "../../core/route";
import { type Format, type Translate, useFormat, useNow, useT } from "../i18n";
import { useNav } from "../nav";
import { useSaved } from "../saved";
import { useBridge, useSettings, useStatus } from "../store";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { EmptyState } from "../ui/display";
import { type IconProps, Icons } from "../ui/icons";
import { factsLabel, Meta } from "../ui/layout";
import { Dialog } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { isBuilt } from "./built";

/** What the scan reads. */
const SCANNED: readonly DatasetName[] = [
  "six.student",
  "six.courses",
  "six.schedule",
  "six.scheduleMonths",
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

const ICON: Record<Finding["kind"], ComponentType<IconProps>> = {
  attendance: Icons.Hand,
  clash: Icons.Overlap,
  unusedPresence: Icons.EyeOff,
  exams: Icons.GraduationCap,
  notInSix: Icons.CalendarClock,
  edited: Icons.PenLine,
  ipk: Icons.Flag,
  unread: Icons.AlertTriangle,
};

const TONE: Record<Finding["tone"], string> = {
  danger: "bg-danger-bg text-danger-fg",
  warning: "bg-warning-bg text-warning-fg",
  info: "bg-info-bg text-info-fg",
  success: "bg-success-bg text-success-fg",
};

/**
 * The dialog and, until it was shown once, the watch for the first full sync.
 * `blocked`: another dialog is open, so the scan waits its turn.
 */
export function FirstScan({ open, onOpenChange, blocked }: { open: boolean; onOpenChange: (open: boolean) => void; blocked: boolean }) {
  const t = useT();
  const { go } = useNav();
  const { firstScanDone } = useSettings();
  const goTo = (route: Route) => {
    onOpenChange(false);
    go(route);
  };
  return (
    <>
      {!firstScanDone && (
        <Quiet>
          <Watch blocked={blocked} onShow={() => onOpenChange(true)} />
        </Quiet>
      )}
      <Dialog open={open} onOpenChange={onOpenChange} title={t("scan.heading")} className="w-[min(640px,calc(100vw-48px))]">
        <PanelBoundary name="first-run scan" compact>
          <Findings onGo={goTo} />
        </PanelBoundary>
      </Dialog>
    </>
  );
}

/** What the scan reasons from, as the window has it now. */
function useScan(computing: boolean) {
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

/** Once the first full sync is done: remember it, and open the scan only with something to say. */
function Watch({ blocked, onShow }: { blocked: boolean; onShow: () => void }) {
  const bridge = useBridge();
  const { ready, findings } = useScan(false);
  const done = useRef(false);
  useEffect(() => {
    if (!ready || blocked || done.current) return;
    done.current = true;
    void bridge.invoke("settings.update", { firstScanDone: true }).catch(() => undefined);
    if (findings.length) onShow();
  }, [ready, blocked, findings.length, bridge, onShow]);
  return null;
}

/** The watch has nothing to show: if it breaks, the scan just doesn't open by itself (Settings still opens it, with the error). */
class Quiet extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[first-run scan]", error);
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}

function Findings({ onGo }: { onGo: (route: Route) => void }) {
  const t = useT();
  const { saved, statuses, findings } = useScan(true);
  const summary = scanSummary(saved, statuses);
  const count = notable(findings);
  const heading =
    count === 0
      ? null
      : summary.read.length === 1
        ? t(summary.read[0] === "edunex" ? "scan.title.edunex" : "scan.title.six", { count })
        : t("scan.title", { count });
  return (
    <>
      <Summary summary={summary} />
      {heading && <h3 className="mt-1.5 text-heading font-semibold tracking-[-0.01em]">{heading}</h3>}
      {findings.length ? (
        <ol className="mt-4 overflow-hidden rounded-xl border border-edge">
          {findings.map((finding, i) => (
            <li key={finding.kind} className={cx(i > 0 && "border-t border-line")}>
              <Line finding={finding} onGo={onGo} />
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4">
          <EmptyState icon={<Icons.CheckCircle className="size-5" />} title={t("scan.empty")} />
        </div>
      )}
      {/* Always in reach, however long the list. */}
      <div className="sticky -bottom-5 -mx-5 mt-5 -mb-5 flex items-center justify-between gap-3 border-t border-line bg-raised px-5 py-3">
        <span className="text-small text-muted">{t("scan.later")}</span>
        <Button variant="primary" onClick={() => onGo({ screen: "home" })}>
          {t("scan.goHome")}
        </Button>
      </div>
    </>
  );
}

/**
 * "Edunex dan SIX terhubung · 5 mata kuliah, 10 tugas dibaca". No meeting count:
 * the reading step hands over before SIX's timetable is in, so its running count
 * ("25 pertemuan") would look contradicted by a final one here.
 */
function Summary({ summary }: { summary: ReturnType<typeof scanSummary> }) {
  const t = useT();
  if (!summary.read.length) return null;
  const names = summary.connected.map((source) => t(`source.${source}`));
  const connected = names.length ? t("scan.connected", { sources: names.length === 2 ? t("scan.and", { a: names[0], b: names[1] }) : names[0] }) : null;
  const read = [t("scan.read.courses", { count: summary.courses }), summary.tasks ? t("scan.read.tasks", { count: summary.tasks }) : null].filter(Boolean);
  return (
    <p className="flex items-center gap-2 text-small font-medium text-muted">
      <Icons.CheckCircle className="size-4 shrink-0 text-success-fg" weight="bold" />
      <Meta>
        {connected}
        {t("scan.read", { list: read.join(", ") })}
      </Meta>
    </p>
  );
}

/** One finding: its number in the title, a few specifics, its sources, and the screen that shows it. */
function Line({ finding, onGo }: { finding: Finding; onGo: (route: Route) => void }) {
  const t = useT();
  const f = useFormat();
  const id = useId();
  const Icon = ICON[finding.kind];
  const { title, lines, note } = describe(finding, t, f);
  const route = finding.routes.find(isBuilt) ?? { screen: "home" };
  return (
    <button
      type="button"
      aria-labelledby={`${id}-title`}
      aria-describedby={lines.length || note ? `${id}-detail` : undefined}
      onClick={() => onGo(route)}
      className="flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-hover focus-visible:-outline-offset-2"
    >
      <span aria-hidden className={cx("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", TONE[finding.tone])}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span id={`${id}-title`} className="block text-body font-semibold">
          {title}
        </span>
        <span id={`${id}-detail`} className="mt-1 block text-small text-muted">
          {lines.map((line) => (
            <Meta key={line}>{line}</Meta>
          ))}
          {note && <span className="block">{note}</span>}
        </span>
      </span>
      <Icons.ChevronRight className="mt-1 size-4 shrink-0 text-faint transition-opacity duration-150" />
    </button>
  );
}

/** "Kam 15 Okt, 11:00" */
const day = (f: Format, at: number) => (Math.abs(f.dayOffset(at)) <= 1 ? f.relativeDay(at) : `${f.weekdayShort(at)} ${f.dayMonth(at)}`);

/** The first few, then "and N more". */
function few<T>(items: readonly T[], line: (item: T) => string, t: Translate): string[] {
  const shown = items.slice(0, SHOWN).map(line);
  return items.length > SHOWN ? [...shown, t("scan.more", { count: items.length - SHOWN })] : shown;
}

/** A finding in words. */
function describe(finding: Finding, t: Translate, f: Format): { title: string; lines: string[]; note: string | null } {
  switch (finding.kind) {
    case "attendance":
      return {
        title: t("scan.attendance.title", { count: finding.count }),
        lines: few(
          finding.courses,
          (health) => {
            const vars = { code: health.code, attended: health.attended ?? 0, held: health.held ?? 0, target: health.target };
            if (health.state === "out") return t("scan.attendance.out", { ...vars, best: percent(health.best ?? 0) });
            if (health.state === "none") return t("scan.attendance.none", vars);
            if (health.toRecover !== null) return t("scan.attendance.below", { ...vars, count: health.toRecover });
            return t("scan.attendance.one", vars);
          },
          t,
        ),
        note: null,
      };
    case "clash": {
      const when = (o: { start: number; end: number }) => `${day(f, o.start)}, ${f.timeRange(o.start, o.end)}`;
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
            const disagree = exam.disagree && t("exam.disagree");
            const session = exam.six[0];
            if (session)
              return factsLabel(t("scan.exams.at", { name: kind, code, when: `${day(f, session.start)}, ${f.time(session.start)}` }), session.room, disagree);
            if (exam.at !== null) {
              if (takeHomeOnly(exam)) return t("scan.exams.takeHome", { code, when: `${day(f, exam.at)}, ${f.time(exam.at)}` });
              return factsLabel(t("scan.exams.at", { name: exam.edunex[0]?.title ?? kind, code, when: `${day(f, exam.at)}, ${f.time(exam.at)}` }), disagree);
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
              t("scan.notInSix.meeting", { code, number: meeting.number, when: `${day(f, meeting.start)}, ${f.timeRange(meeting.start, meeting.end)}` }),
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
