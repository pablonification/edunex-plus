// First run (and after signing out): connect Edunex and SIX. Each sign-in
// happens in a window the app owns, on Microsoft's own page; right after the
// first, the second needs no password again. "Lanjut" leads to a calm
// "reading" step that stays until the first full read is in (counts ticking
// up), so Beranda never flashes half-read; then the shell takes over. Moving
// on also wipes the sign-in windows' Microsoft session.
//
// It is seen once, so it moves more than the rest of the app (the first run in
// docs/design-system.md's Motion): its parts arrive one after another, a line
// that says something new rises in, a source that connects shows "Terhubung"
// growing in where its button was, the app's mark glides down as the form
// gives way to the reading step, the counts tick up, and once the step is in,
// "Beranda siap" holds a moment before the app comes in.
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { homeReady, scanSummary } from "../../core/first-scan";
import type { DatasetName, SourceId } from "../../core/models";
import { useT } from "../i18n";
import { displayName } from "../names";
import { useSaved } from "../saved";
import { useBridge, useDataset, useSettings, useStatus, useStore } from "../store";
import { AppMark, SourceLogo } from "../ui/brand";
import { Button, Segmented } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card } from "../ui/display";
import { Icons } from "../ui/icons";
import { Meta, Stat, StatRow } from "../ui/layout";
import { stillMotion } from "../ui/motion/animate";
import { AnimatedNumber } from "../ui/motion/animated-number";
import { ARRIVAL_STAGGER, ARRIVE, ARRIVE_MARK, arriveAt } from "../ui/motion/arrival";
import { useGlide } from "../ui/motion/glide";
import { DURATION } from "../ui/motion/tokens";
import { useSignIn, useSignInNote } from "./source-status";

/** What the reading step counts, and what decides it's done (src/core/first-scan.ts homeReady). */
const READ: readonly DatasetName[] = [
  "six.student",
  "six.courses",
  "six.schedule",
  "six.scheduleMonths",
  "six.transcript",
  "edunex.courses",
  "edunex.tasks",
  "edunex.outline",
  "edunex.materials",
  "edunex.presence",
  "edunex.announcements",
  "edunex.exams",
  "itb.calendar",
];

/** The reading step never holds the Student longer than this: Beranda shows what's in, the rest arrives there. */
const READ_PATIENCE = 20_000;

/** Once Beranda's parts are in, "Beranda siap" shows this long before the app comes in, so the moment lands. With Reduce motion, straight in. */
const READY_BEAT = 600;

/** The reading step's parts start arriving this far into the mark's glide down to them. */
const AFTER_GLIDE = 100;

/** By then the reading step's own parts are in (its status line is the fourth): "Beranda siap" waits for that, so it is seen arriving, and heard. */
const STEP_ARRIVED = AFTER_GLIDE + 3 * ARRIVAL_STAGGER + DURATION.slow;

/** A count as it ticks up: whole numbers only, never "24,6" on the way to 25. */
const whole = (count: number) => String(Math.round(count));

const isConnected = (state: string) => state !== "signed-out" && state !== "expired";

export function Welcome({ onDone }: { onDone: () => void }) {
  const t = useT();
  const store = useStore();
  const bridge = useBridge();
  const settings = useSettings();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const edunex = isConnected(useStatus("edunex").state);
  const six = isConnected(useStatus("six").state);
  const [reading, setReading] = useState(false);
  const mark = useGlide<HTMLDivElement>();
  const hint = !edunex && !six ? "connectFirst" : edunex !== six ? (edunex ? "sixLater" : "edunexLater") : null;
  const changed = useChanged(hint);

  const next = () => {
    void bridge.invoke("auth.signInDone", {}).catch(() => undefined);
    mark.before();
    setReading(true);
  };

  return (
    <div className="relative h-dvh overflow-y-auto bg-welcome text-fg">
      {/* The window moves by its top band, which stays put when a short window scrolls; the language choice keeps clear of Windows' window buttons. */}
      <div className="drag fixed inset-x-0 top-0 h-(--title-bar)" />
      <div className="no-drag fixed top-3 right-[calc(--spacing(4)+var(--window-controls))] z-10">
        <Segmented
          label={t("settings.language")}
          value={settings.lang}
          onChange={(lang) => void bridge.invoke("settings.update", { lang }).catch(() => undefined)}
          options={[
            { value: "id", label: "Indonesia" },
            { value: "en", label: "English" },
          ]}
        />
      </div>
      <main className="grid min-h-full place-items-center px-6 py-16">
        <div className="w-full max-w-[460px]">
          {/* Stays through the reading step, so it glides to its new place there instead of jumping. */}
          <div ref={mark.ref} className="mx-auto size-16">
            <AppMark className={cx("block size-16", ARRIVE_MARK)} />
          </div>
          {reading ? (
            <Reading onDone={onDone} />
          ) : (
            <>
              <h1 className={cx("mt-5 text-center text-display font-semibold tracking-[-0.02em]", ARRIVE)} style={arriveAt(1)}>
                {t("welcome.title")}
              </h1>
              <p className={cx("mx-auto mt-2 max-w-[400px] text-center text-lead text-muted", ARRIVE)} style={arriveAt(2)}>
                {t("welcome.lead")}
              </p>

              <div className={cx("mt-7", ARRIVE)} style={arriveAt(3)}>
                <Card className="divide-y divide-line overflow-hidden">
                  <SourceRow
                    source="edunex"
                    detail={t("welcome.edunexDetail")}
                    who={account ? [displayName(account.name), account.nim] : null}
                    primary={!edunex && !six}
                  />
                  <SourceRow
                    source="six"
                    detail={t("welcome.sixDetail")}
                    who={student ? [displayName(student.name), student.program ?? student.nim] : null}
                    primary={false}
                  />
                </Card>
              </div>

              <div className={ARRIVE} style={arriveAt(4)}>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-small text-muted">
                  <Icons.ShieldCheck className="size-3.5" />
                  {t("welcome.passwordNote")}
                </p>
                <p className="mt-1 text-center text-caption text-faint">{t("welcome.readOnly")}</p>
                {store.vault === "memory" && (
                  <p className="mt-4 rounded-lg bg-warning-bg px-3.5 py-2.5 text-center text-small text-warning-fg">{t("settings.sessionNotSaved")}</p>
                )}
              </div>

              <div className={ARRIVE} style={arriveAt(5)}>
                <Button variant="primary" size="lg" className="mt-7 w-full" disabled={!edunex && !six} onClick={next} aria-describedby="welcome-next-hint">
                  {t("welcome.continue")}
                </Button>
                <p id="welcome-next-hint" key={hint} className={cx("mt-2 text-center text-small text-muted", changed && hint && "motion-safe:animate-line-in")}>
                  {hint === "connectFirst" ? t("welcome.continueHint") : hint ? t(`welcome.${hint}`) : ""}
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** "Membaca Edunex dan SIX…": counts ticking up until the first full read is in. */
function Reading({ onDone }: { onDone: () => void }) {
  const t = useT();
  const saved = useSaved(READ);
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const itb = useStatus("itb");
  const statuses = useMemo(() => [edunex, six, itb], [edunex, six, itb]);
  const ready = homeReady(saved, statuses);
  const summary = scanSummary(saved, statuses);
  const [patience, setPatience] = useState(false);
  /** The step's own parts have arrived (at once with motion off). */
  const [arrived, setArrived] = useState(stillMotion);
  /** Beranda's parts are in, and so are the step's: "Beranda siap" shows, then the app comes in. */
  const [landed, setLanded] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (arrived) return;
    const timer = setTimeout(() => setArrived(true), STEP_ARRIVED);
    return () => clearTimeout(timer);
  }, [arrived]);
  useEffect(() => {
    if (!ready) return;
    if (stillMotion()) done.current();
    else if (arrived) setLanded(true);
  }, [ready, arrived]);
  // Only on its own clock: the window redrawing as the rest arrives doesn't hold it back.
  useEffect(() => {
    if (!landed) return;
    const timer = setTimeout(() => done.current(), READY_BEAT);
    return () => clearTimeout(timer);
  }, [landed]);
  useEffect(() => {
    const timer = setTimeout(() => setPatience(true), READ_PATIENCE);
    return () => clearTimeout(timer);
  }, []);

  const both = summary.connected.length === 2;
  const parts = [
    { key: "courses", count: summary.courses, label: t("scan.count.courses") },
    { key: "tasks", count: summary.tasks, label: t("scan.count.tasks") },
    { key: "meetings", count: summary.meetings, label: t("scan.count.meetings") },
  ];
  return (
    <div className="mt-6 text-center" aria-live="polite" aria-busy={!landed}>
      <h1 className={cx("text-display font-semibold tracking-[-0.02em]", ARRIVE)} style={arriveAt(0, AFTER_GLIDE)}>
        {both ? t("welcome.reading") : t("welcome.readingOne", { source: t(`source.${summary.connected[0] ?? "edunex"}`) })}
      </h1>
      <p className={cx("mx-auto mt-2 max-w-[360px] text-lead text-muted", ARRIVE)} style={arriveAt(1, AFTER_GLIDE)}>
        {t("welcome.readingHint")}
      </p>
      <div className={ARRIVE} style={arriveAt(2, AFTER_GLIDE)}>
        <StatRow className="mx-auto mt-7 max-w-[380px]">
          {parts.map((part) => (
            <Stat key={part.key} size="heading" label={part.label} value={<AnimatedNumber value={part.count} format={whole} />} />
          ))}
        </StatRow>
      </div>
      <div className={ARRIVE} style={arriveAt(3, AFTER_GLIDE)}>
        {landed ? (
          <p className="mt-6 inline-flex items-center gap-2 text-small font-semibold text-success-fg motion-safe:animate-line-in">
            <Icons.CheckCircle className="size-3.5 motion-safe:animate-grow-in" weight="bold" />
            {t("welcome.readingDone")}
          </p>
        ) : (
          <p className="mt-6 inline-flex items-center gap-2 text-small text-muted">
            <Icons.Loader className="size-3.5 animate-spin" />
            {t("welcome.readingWait")}
          </p>
        )}
      </div>
      {patience && (
        <div className="mt-4 motion-safe:animate-line-in">
          <Button variant="secondary" onClick={onDone}>
            {t("welcome.readingSkip")}
          </Button>
        </div>
      )}
    </div>
  );
}

function SourceRow({
  source,
  detail,
  who,
  primary,
}: {
  source: Extract<SourceId, "edunex" | "six">;
  detail: string;
  /** Who is signed in: their name, then their NIM or program. */
  who: readonly string[] | null;
  primary: boolean;
}) {
  const t = useT();
  const status = useStatus(source);
  const { signIn, busy } = useSignIn();
  const note = useSignInNote(source);
  const name = t(`source.${source}`);
  const connected = isConnected(status.state);
  // Connected first: the sign-in call can still be finishing while the name is already in.
  let line: ReactNode = detail;
  let hint: string | null = null;
  /** What the line says, as a word, so it rises in when that changes (not when the language does). */
  let says = "detail";
  if (connected && who) {
    line = <Meta>{who}</Meta>;
    says = "who";
  } else if (connected) {
    line = t("welcome.readingName");
    says = "readingName";
  } else if (status.state === "connecting") {
    line = t("status.connecting");
    says = "connecting";
  } else if (note) {
    // Microsoft handed back: the sign-in window is out of sight while the app reads the session.
    line = note.text;
    hint = note.hint;
    says = note.slow ? "slow" : "finishing";
  } else if (busy) {
    line = t("welcome.waiting");
    hint = t("welcome.waitingHint");
    says = "waiting";
  }
  const changed = useChanged(says);

  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <SourceLogo source={source} className="size-10" />
      <span className="min-w-0 flex-1">
        <span className="block text-lead font-semibold">{name}</span>
        <span
          key={says}
          className={cx(
            "line-clamp-2 block text-small",
            connected && who ? "text-fg/80" : note?.slow ? "text-warning-fg" : "text-muted",
            changed && "motion-safe:animate-line-in",
          )}
        >
          {line}
        </span>
        {hint && (
          <span key={`${says}-hint`} className={cx("block text-caption text-faint", changed && "motion-safe:animate-line-in")}>
            {hint}
          </span>
        )}
      </span>
      {connected ? (
        // Grows in where the button was.
        <span
          className={cx(
            "inline-flex shrink-0 origin-right items-center gap-1.5 text-small font-semibold text-success-fg",
            changed && "motion-safe:animate-grow-in",
          )}
        >
          <Icons.CheckCircle className="size-4" />
          {t("welcome.connected")}
        </span>
      ) : (
        <Button
          variant={primary ? "primary" : "secondary"}
          busy={busy}
          aria-label={t("welcome.connectSource", { source: name })}
          onClick={() => void signIn(source)}
        >
          {t("welcome.connect")}
        </Button>
      )}
    </div>
  );
}

/** Whether `value` is no longer what it was on the first draw: what arrived with the screen doesn't animate again, a change since does. */
function useChanged(value: string | null): boolean {
  const first = useRef(value);
  return value !== first.current;
}
