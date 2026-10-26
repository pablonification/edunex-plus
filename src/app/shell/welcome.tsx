// First run (and after signing out): connect Edunex and SIX. Each sign-in
// happens in a window the app owns, on Microsoft's own page; right after the
// first, the second needs no password again. Moving on wipes the sign-in
// windows' Microsoft session. The reading step stays until Beranda has what it
// shows (src/core/first-scan.ts homeReady), so Beranda never opens half-read.
//
// It is the app's first impression and seen once, so it is a scene of its own
// (the first run in docs/design-system.md's Motion), after Dia, Arc and Droppy:
// a dark stage lit by one light that comes from the app's mark (ui/motion/
// ascii-light.ts). It opens on a credit ("from ITB STUDENTS", the little word
// turning to "for"), then the mark and the promise. Connecting puts the app
// between Edunex and SIX, each linking to it as it connects. Reading shows the
// Student's real Beranda, scaled down in a window the light sits behind, coming
// into focus as the read comes in; "Buka Edunex Plus" grows that window into the
// app. Soft sound marks the moments (welcome-sound.ts). With Reduce motion it
// starts at the promise, nothing moves, and the steps just change.
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { firstRead, homeReady, type ScanPart, scanSummary } from "../../core/first-scan";
import type { DatasetName, SourceId } from "../../core/models";
import { useT } from "../i18n";
import { displayName, firstName } from "../names";
import { useSaved } from "../saved";
import { useBridge, useDataset, useSettings, useStatus, useStore } from "../store";
import { AppMark, SourceLogo } from "../ui/brand";
import { IconButton, Segmented } from "../ui/controls";
import { cx } from "../ui/cx";
import { Icons } from "../ui/icons";
import { Meta } from "../ui/layout";
import { animate, stillMotion } from "../ui/motion/animate";
import { AnimatedNumber } from "../ui/motion/animated-number";
import { ARRIVE, ARRIVE_MARK, ARRIVE_SCENE, ARRIVE_WORD, arriveAt, WORD_STAGGER } from "../ui/motion/arrival";
import { type AsciiLight, createAsciiLight, lightAt } from "../ui/motion/ascii-light";
import { CARRIED, changeScene } from "../ui/motion/scene";
import { EASE } from "../ui/motion/tokens";
import { pauseUnseen } from "../ui/motion/visible";
import { useSignIn, useSignInNote } from "./source-status";
import { setSound, sound, soundOn } from "./welcome-sound";

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

/** The reading step never holds the Student longer than this: "Buka Edunex Plus" shows, Beranda shows what's in, the rest arrives there. */
const READ_PATIENCE = 20_000;

/** The line saying what's still coming in stays at least this long, so it can be read. */
const NARRATION_DWELL = 700;

/** The opening, in ms: the credit's lines come in, the little word turns, then it fades and the promise comes. */
const CREDIT = { in: 250, turn: 1500, out: 2900, done: 3300 } as const;

/** How far the light reaches from its source on each step, in px of an 800 px tall window. */
const REACH = { hello: 175, connect: 125, reading: 330 } as const;

/** The reading step's window onto Beranda, at most this wide (and never more than this share of the window). */
const PREVIEW = { width: 680, share: 0.56 } as const;

/** A count as it ticks up: whole numbers only, never "24,6" on the way to 25. */
const whole = (count: number) => String(Math.round(count));

const isConnected = (state: string) => state !== "signed-out" && state !== "expired";

type Step = "opening" | "hello" | "connect" | "reading";

export function Welcome({ onDone, app }: { onDone: () => void; app: ReactNode }) {
  const t = useT();
  const bridge = useBridge();
  const settings = useSettings();
  const [step, setStep] = useState<Step>(() => (stillMotion() ? "hello" : "opening"));
  const [muted, setMuted] = useState(!soundOn());
  const light = useRef<AsciiLight | null>(null);
  /** Points the light at an element's middle, reaching `reach` px (of an 800 px window), easing over `ms`. */
  const aim = useCallback((element: HTMLElement | null, reach: number, ms = 1000) => {
    if (!element || !light.current) return;
    const box = element.getBoundingClientRect();
    const height = window.innerHeight;
    void light.current.tween(lightAt(box.left + box.width / 2, box.top + box.height / 2, (reach * height) / 800), ms);
  }, []);
  const go = (next: Step) => {
    sound.move();
    changeScene(next === "reading" ? "reading" : "connect", () => setStep(next));
  };

  return (
    <div className="stage-dark relative h-dvh overflow-y-auto bg-stage text-fg">
      <Light step={step} onReady={(made) => (light.current = made)} />
      {/* The window moves by its top band, which stays put when a short window scrolls; its controls keep clear of Windows' window buttons. */}
      <div className="drag fixed inset-x-0 top-0 h-(--title-bar)" />
      <div
        className={cx("no-drag fixed top-3 right-[calc(--spacing(4)+var(--window-controls))] z-10 flex items-center gap-2", ARRIVE)}
        style={arriveAt(0, 2400)}
      >
        <IconButton
          label={muted ? t("welcome.soundOn") : t("welcome.soundOff")}
          onClick={() => {
            setSound(muted);
            setMuted(!muted);
          }}
        >
          {muted ? <Icons.SpeakerOff className="size-4" /> : <Icons.Speaker className="size-4" />}
        </IconButton>
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
      <main className="relative grid min-h-full place-items-center px-6 py-12">
        {step === "opening" && <Credit onDone={() => setStep("hello")} />}
        {step === "hello" && <Hello light={light} aim={aim} onNext={() => go("connect")} />}
        {step === "connect" && (
          <Connect
            aim={aim}
            onNext={() => {
              void bridge.invoke("auth.signInDone", {}).catch(() => undefined);
              go("reading");
            }}
          />
        )}
        {step === "reading" && <Reading light={light} aim={aim} app={app} onDone={onDone} />}
      </main>
      {step !== "opening" && (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-7 flex justify-center gap-1.5">
          {(["hello", "connect", "reading"] as const).map((one) => (
            <span
              key={one}
              className={cx("h-1.5 rounded-full transition-[width,background-color] duration-500 ease-scene", one === step ? "w-5 bg-fg/85" : "w-1.5 bg-fg/25")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The stage's light: made once, rests while the window is hidden, gone with the welcome screen. */
function Light({ step, onReady }: { step: Step; onReady: (light: AsciiLight | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ready = useRef(onReady);
  useLayoutEffect(() => {
    if (!canvas.current) return;
    const made = createAsciiLight(canvas.current);
    ready.current(made);
    return () => {
      made?.stop();
      ready.current(null);
    };
  }, []);
  return (
    <div aria-hidden data-loop ref={pauseUnseen} data-step={step} className="pointer-events-none fixed inset-0">
      <canvas ref={canvas} className="block size-full" />
    </div>
  );
}

/** "from ITB STUDENTS", the little word turning to "for": who made it, and who it's for. Any key or click moves on. */
function Credit({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [turned, setTurned] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const timers = [
      setTimeout(() => {
        setTurned(true);
        sound.turn();
      }, CREDIT.turn),
      setTimeout(() => setLeaving(true), CREDIT.out),
      setTimeout(() => done.current(), CREDIT.done),
    ];
    const skip = () => done.current();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      for (const timer of timers) clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);
  const from = t("welcome.credit.from");
  const forWord = t("welcome.credit.for");
  return (
    <p
      className={cx(
        "text-center font-serif text-fg/85 transition-[opacity,filter] duration-500 ease-standard",
        ARRIVE_SCENE,
        leaving && "opacity-0 blur-[10px]",
      )}
      style={arriveAt(0, CREDIT.in)}
    >
      <span className="sr-only">{`${from} ${t("welcome.credit.who")}, ${forWord} ${t("welcome.credit.who")}`}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {/* Both words share one slot, right against the name; the slot narrows as the word turns, so the line stays centred. */}
        <Turn from={from} to={forWord} turned={turned} />
        <span className="ml-2 text-credit tracking-[0.2em]">{t("welcome.credit.who")}</span>
      </span>
    </p>
  );
}

/** One word turning into another in place: the first blurs away upward as the second sharpens in. */
function Turn({ from, to, turned }: { from: string; to: string; turned: boolean }) {
  const slot = useRef<HTMLSpanElement>(null);
  const first = useRef<HTMLSpanElement>(null);
  const second = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!turned || !slot.current || !first.current || !second.current) return;
    const widths = [first.current.offsetWidth, second.current.offsetWidth];
    const moves = [
      animate(slot.current, [{ width: `${widths[0]}px` }, { width: `${widths[1]}px` }], { duration: 650, delay: 120, easing: EASE.scene, fill: "forwards" }),
      animate(
        first.current,
        [
          { opacity: 1, filter: "blur(0)", transform: "none" },
          { opacity: 0, filter: "blur(8px)", transform: "translateY(-0.35em)" },
        ],
        {
          duration: 450,
          easing: EASE.standard,
          fill: "forwards",
        },
      ),
      animate(
        second.current,
        [
          { opacity: 0, filter: "blur(8px)", transform: "translateY(0.35em)" },
          { opacity: 1, filter: "blur(0)", transform: "none" },
        ],
        {
          duration: 650,
          delay: 180,
          easing: EASE.out,
          fill: "backwards",
        },
      ),
    ];
    return () => {
      for (const move of moves) move?.cancel();
    };
  }, [turned]);
  return (
    <span ref={slot} className="inline-grid grid-cols-[100%] justify-items-[unsafe_end] text-credit-word text-fg/60 italic">
      <span ref={first} className={cx("[grid-area:1/1]", turned && stillMotion() && "opacity-0")}>
        {from}
      </span>
      <span ref={second} className={cx("[grid-area:1/1]", !turned && "opacity-0")}>
        {to}
      </span>
    </span>
  );
}

/** The app's mark, lit from behind by the stage's light, and carried from one step to the next. */
function Mark({ size, markRef }: { size: "large" | "medium"; markRef?: (element: HTMLDivElement | null) => void }) {
  return (
    <div ref={markRef} className={cx("relative shrink-0", size === "large" ? "size-26" : "size-19")} style={{ viewTransitionName: CARRIED.mark }}>
      <AppMark className="welcome-mark block size-full" />
    </div>
  );
}

/** The promise: the mark in its light, then "Edunex and SIX, finally in one place." */
function Hello({
  light,
  aim,
  onNext,
}: {
  light: React.RefObject<AsciiLight | null>;
  aim: (element: HTMLElement | null, reach: number, ms?: number) => void;
  onNext: () => void;
}) {
  const t = useT();
  const mark = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    aim(mark.current, REACH.hello, 0);
    light.current?.start();
    sound.open();
    const reaim = () => aim(mark.current, REACH.hello, 0);
    window.addEventListener("resize", reaim);
    return () => window.removeEventListener("resize", reaim);
  }, [aim, light]);
  useEffect(() => {
    const enter = (event: KeyboardEvent) => {
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) onNext();
    };
    window.addEventListener("keydown", enter);
    return () => window.removeEventListener("keydown", enter);
  }, [onNext]);
  return (
    <div className="flex flex-col items-center pt-24 text-center">
      <div className={ARRIVE_MARK} style={arriveAt(0, 500)}>
        <Mark size="large" markRef={(element) => (mark.current = element)} />
      </div>
      <h1 className="mt-36 text-hero font-bold tracking-[-0.022em]">
        <Words text={t("welcome.headline1")} at={900} /> <br />
        <Words text={t("welcome.headline2")} at={900 + 3 * WORD_STAGGER} />
      </h1>
      <p className={cx("mt-4 max-w-[420px] text-pitch text-muted text-balance", ARRIVE_SCENE)} style={arriveAt(0, 1600)}>
        {t("welcome.pitch")}
      </p>
      <div className={ARRIVE_SCENE} style={arriveAt(0, 1800)}>
        <Pill
          className="mt-8"
          aria-label={t("welcome.start")}
          onClick={() => {
            sound.tap();
            onNext();
          }}
        >
          {t("welcome.start")}
          <kbd aria-hidden className="welcome-key">
            ↵
          </kbd>
        </Pill>
      </div>
    </div>
  );
}

/** Edunex and SIX either side of the app, each linking to it as it connects. */
function Connect({ aim, onNext }: { aim: (element: HTMLElement | null, reach: number, ms?: number) => void; onNext: () => void }) {
  const t = useT();
  const store = useStore();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const edunex = isConnected(useStatus("edunex").state);
  const six = isConnected(useStatus("six").state);
  const { signIn, busy } = useSignIn();
  const [sixAsked, setSixAsked] = useState(false);
  const mark = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    aim(mark.current, REACH.connect);
    const reaim = () => aim(mark.current, REACH.connect, 0);
    window.addEventListener("resize", reaim);
    return () => window.removeEventListener("resize", reaim);
  }, [aim]);
  const both = edunex && six;
  const bothChanged = useChanged(String(both));
  useEffect(() => {
    if (both && bothChanged) sound.both();
  }, [both, bothChanged]);
  const name = account ? firstName(account.name) : student ? firstName(student.name) : null;
  const connected = edunex || six;
  const title = connected ? (name ? t("welcome.connectedTitle", { name }) : t("welcome.connectedTitlePlain")) : t("welcome.connectTitle");
  const lead =
    both && !sixAsked ? t("welcome.sixCameAlong") : edunex !== six ? t(edunex ? "welcome.sixLater" : "welcome.edunexLater") : t("welcome.connectLead");
  // One big button, as in the prototype: Edunex first (SIX usually comes along on the same sign-in), then whichever is
  // still apart, with a quiet Lanjut beside it once one is in.
  const offer = !edunex ? "edunex" : !six ? "six" : null;
  const connect = (source: "edunex" | "six") => {
    sound.tap();
    if (source === "six") setSixAsked(true);
    void signIn(source);
  };
  const next = () => {
    sound.tap();
    onNext();
  };

  return (
    <div className="flex w-full max-w-[760px] flex-col items-center pt-8 text-center">
      <div className="flex w-full items-center justify-center">
        <SourceTile source="edunex" who={account ? [displayName(account.name), account.nim] : null} />
        <Link on={edunex} side="left" />
        <Mark size="medium" markRef={(element) => (mark.current = element)} />
        <Link on={six} side="right" />
        {/* Before anything is in, SIX's own logo connects SIX first (the big button is Edunex's). */}
        <SourceTile
          source="six"
          who={student ? [displayName(student.name), student.program ?? student.nim] : null}
          busy={busy}
          onConnect={connected ? undefined : () => connect("six")}
        />
      </div>
      <h2 className="mt-20 text-scene font-bold tracking-[-0.02em]">
        <Words text={title} at={300} />
      </h2>
      <p key={lead} className={cx("mt-4 max-w-[500px] text-pitch text-muted text-balance", ARRIVE_SCENE)} style={arriveAt(0, 650)}>
        {lead}
      </p>
      <div className={cx("mt-8 flex items-center gap-3", ARRIVE_SCENE)} style={arriveAt(0, 800)}>
        {connected && (
          <Pill quiet={!!offer} onClick={next}>
            {t("welcome.continue")}
          </Pill>
        )}
        {offer && (
          <Pill busy={busy} aria-label={t("welcome.connectSource", { source: t(`source.${offer}`) })} onClick={() => connect(offer)}>
            {busy ? t("welcome.waitingShort") : t("welcome.connectSource", { source: t(`source.${offer}`) })}
          </Pill>
        )}
      </div>
      {busy && <p className="mt-3 text-small text-faint motion-safe:animate-line-in">{t("welcome.waitingHint")}</p>}
      <p className={cx("mt-4 max-w-[520px] text-caption text-faint", ARRIVE_SCENE)} style={arriveAt(0, 950)}>
        {t("welcome.readOnly")}
      </p>
      {store.vault === "memory" && <p className="mt-4 rounded-lg bg-warning-bg px-3.5 py-2.5 text-small text-warning-fg">{t("settings.sessionNotSaved")}</p>}
    </div>
  );
}

/** A hairline from a system to the app: dashed while apart, drawn solid when it connects. */
function Link({ on, side }: { on: boolean; side: "left" | "right" }) {
  return (
    <span aria-hidden className="welcome-link relative mx-4 h-0.5 w-26 shrink">
      <span
        className={cx(
          "absolute inset-0 rounded-full transition-transform duration-700 ease-scene",
          side === "left" ? "origin-left" : "origin-right",
          on ? "scale-x-100" : "scale-x-0",
        )}
      />
    </span>
  );
}

/** One system: its logo (a check once connected), its name, and who is signed in. */
function SourceTile({
  source,
  who,
  busy = false,
  onConnect,
}: {
  source: Extract<SourceId, "edunex" | "six">;
  /** Who is signed in: their name, then their NIM or program. */
  who: readonly string[] | null;
  /** Connect's sign-in is under way. */
  busy?: boolean;
  /** Its logo connects it, when the big button is the other system's. */
  onConnect?: () => void;
}) {
  const t = useT();
  const status = useStatus(source);
  const note = useSignInNote(source);
  const name = t(`source.${source}`);
  const connected = isConnected(status.state);
  const joined = useChanged(String(connected)) && connected;
  useEffect(() => {
    if (joined) sound.connected(source);
  }, [joined, source]);
  let line: ReactNode = t("welcome.notConnected");
  let hint: string | null = null;
  let says = "apart";
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
  }
  const changed = useChanged(says);
  const logo = <SourceLogo source={source} className="size-16 shadow-[0_10px_24px_-8px_rgb(0_0_0/0.7)] ring-1 ring-white/12" />;
  return (
    <div className="flex w-[220px] shrink-0 flex-col items-center">
      <span className="relative">
        {onConnect ? (
          <button
            type="button"
            aria-label={t("welcome.connectSource", { source: name })}
            aria-busy={busy || undefined}
            className="welcome-logo focus-ring block"
            onClick={() => {
              if (!busy) onConnect();
            }}
          >
            {logo}
          </button>
        ) : (
          logo
        )}
        {connected && (
          <span
            className={cx(
              "welcome-check absolute -right-1.5 -bottom-1.5 grid size-5.5 place-items-center rounded-full text-white",
              joined && "motion-safe:animate-grow-in",
            )}
          >
            <Icons.Check className="size-3" weight="bold" />
          </span>
        )}
      </span>
      <span className="mt-4 text-lead font-semibold">{name}</span>
      <span
        key={says}
        className={cx(
          "mt-0.5 max-w-full text-small",
          connected ? "truncate text-muted" : note?.slow ? "text-warning-fg" : "text-faint",
          changed && "motion-safe:animate-line-in",
        )}
      >
        {line}
      </span>
      {/* Hung below the tile, so both logos stay level with the app's mark. */}
      <span className="relative self-stretch">
        {hint && <span className={cx("absolute inset-x-0 top-1 text-caption text-faint", changed && "motion-safe:animate-line-in")}>{hint}</span>}
      </span>
    </div>
  );
}

/** "Membaca semestermu": the Student's own Beranda in a window, coming into focus as the read comes in. */
function Reading({
  light,
  aim,
  app,
  onDone,
}: {
  light: React.RefObject<AsciiLight | null>;
  aim: (element: HTMLElement | null, reach: number, ms?: number) => void;
  app: ReactNode;
  onDone: () => void;
}) {
  const t = useT();
  const saved = useSaved(READ);
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const itb = useStatus("itb");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const statuses = useMemo(() => [edunex, six, itb], [edunex, six, itb]);
  const ready = homeReady(saved, statuses);
  const summary = scanSummary(saved, statuses);
  const read = firstRead(saved, statuses);
  const coming = useSteady(read.next ? `${read.next.source} ${read.next.part}` : null, NARRATION_DWELL);
  const comingChanged = useChanged(coming);
  const readyChanged = useChanged(String(ready));
  const parts = useRef(read.progress);
  const [patience, setPatience] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const size = useWindowSize();
  const width = Math.min(PREVIEW.width, size.width * PREVIEW.share);
  const fit = width / size.width;

  useLayoutEffect(() => {
    aim(preview.current, REACH.reading, 1400);
    void light.current?.tween({ fade: 0.7 }, 1400);
  }, [aim, light]);
  useEffect(() => {
    const timer = setTimeout(() => setPatience(true), READ_PATIENCE);
    return () => clearTimeout(timer);
  }, []);
  // Each part that comes in: a quiet note, a step higher.
  useEffect(() => {
    if (read.progress > parts.current && read.progress < 1) sound.read(Math.round(read.progress * 6) - 1);
    parts.current = read.progress;
  }, [read.progress]);
  useEffect(() => {
    if (!ready || !readyChanged) return;
    sound.ready();
    void light.current?.tween({ fade: 1.3 }, 450).then(() => light.current?.tween({ fade: 0.85 }, 900));
  }, [ready, readyChanged, light]);

  const open = () => {
    if (leaving) return;
    sound.tap();
    sound.arrive();
    setLeaving(true);
    const box = preview.current;
    const content = inner.current;
    if (!box || !content || stillMotion()) return onDone();
    // Out of the page at the same place, then out to the window's edges, while the Beranda inside grows to its true size.
    const from = box.getBoundingClientRect();
    Object.assign(box.style, {
      position: "fixed",
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      zIndex: "20",
    });
    const grow = { duration: 1050, delay: 120, easing: "cubic-bezier(0.65, 0, 0.15, 1)", fill: "forwards" } as const;
    const growing = animate(
      box,
      [
        { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`, borderRadius: "12px" },
        { left: "0px", top: "0px", width: `${window.innerWidth}px`, height: `${window.innerHeight}px`, borderRadius: "0px" },
      ],
      grow,
    );
    animate(content, [{ transform: `scale(${fit})` }, { transform: "scale(1)" }], grow);
    void light.current?.tween({ fade: 0 }, 1100);
    if (growing) growing.onfinish = onDone;
    else onDone();
  };

  const name = account ? firstName(account.name) : student ? firstName(student.name) : null;
  const title = ready ? (name ? t("welcome.readyTitle", { name }) : t("welcome.readyTitlePlain")) : t("welcome.readingTitle");
  const [source, part] = (coming?.split(" ") ?? []) as ["edunex" | "six", ScanPart] | [];
  const counts = [
    { key: "courses", count: summary.courses },
    { key: "tasks", count: summary.tasks },
    { key: "meetings", count: summary.meetings },
  ] as const;
  // Sharper as more is in: from a blur to the real thing.
  const progress = ready ? 1 : read.progress;
  const focus = `blur(${(16 * (1 - progress) ** 1.6).toFixed(1)}px) brightness(${(0.6 + 0.4 * progress).toFixed(2)}) saturate(${(0.4 + 0.6 * progress).toFixed(2)})`;

  return (
    <div className="flex flex-col items-center text-center" aria-live="polite" aria-busy={!ready}>
      <div
        ref={preview}
        aria-hidden
        className={cx("welcome-window relative overflow-hidden rounded-xl", ARRIVE_SCENE)}
        style={{ ...arriveAt(0, 150), width, height: size.height * fit }}
      >
        {/* The Student's own Beranda, at the window's size, scaled down; it can't be reached until it opens. */}
        <div
          ref={inner}
          inert
          className="welcome-app absolute top-0 left-0 origin-top-left text-left text-fg transition-[filter] duration-700 ease-out"
          style={{ width: size.width, height: size.height, transform: `scale(${fit})`, filter: leaving ? "none" : focus }}
        >
          {app}
        </div>
      </div>
      <div className={cx("flex flex-col items-center transition-[opacity,filter] duration-300", leaving && "opacity-0 blur-[8px]")}>
        <h2 className="mt-20 text-scene font-bold tracking-[-0.02em]">
          <Words text={title} at={350} />
        </h2>
        <div className={cx("mt-3 flex justify-center text-title text-muted tabular-nums", ARRIVE_SCENE)} style={arriveAt(0, 650)}>
          <Meta>
            {counts.map((one) => (
              <span key={one.key}>
                <span className="font-semibold text-fg">
                  <AnimatedNumber value={one.count} format={whole} />
                </span>{" "}
                {t(`welcome.count.${one.key}`, { count: one.count })}
              </span>
            ))}
          </Meta>
        </div>
        <div className={cx("mt-2 h-5", ARRIVE_SCENE)} style={arriveAt(0, 800)}>
          {ready ? (
            <p className="inline-flex items-center gap-2 text-small text-muted motion-safe:animate-line-in">
              <span className="size-1.5 rounded-full bg-live" />
              {t("welcome.readingDone")}
            </p>
          ) : (
            <p className="inline-flex items-center gap-2 text-small text-faint">
              <Icons.Loader className="size-3.5 animate-spin" />
              <span className="sr-only">{t("welcome.readingWait")}</span>
              {/* What's still coming in, for the eye: read out, it would be a new line every second. */}
              <span aria-hidden key={coming ?? "wait"} className={cx(comingChanged && "motion-safe:animate-line-in")}>
                {source && part ? <Meta>{[t(`source.${source}`), t(`scan.part.${part}`)]}</Meta> : t("welcome.readingWait")}
              </span>
            </p>
          )}
        </div>
        {/* Its place is kept from the start, so nothing above moves when it comes. */}
        <div className="mt-6 h-12">
          {(ready || patience) && (
            <Pill className="motion-safe:animate-line-in" onClick={open}>
              {t("welcome.open")}
            </Pill>
          )}
        </div>
      </div>
    </div>
  );
}

/** The welcome's own button: the app's primary button at its most tactile (styles.css, .welcome-pill). */
function Pill({
  busy = false,
  quiet = false,
  className,
  children,
  onClick,
  ...rest
}: {
  busy?: boolean;
  /** Glass instead of blue: the other way on, beside the big button. */
  quiet?: boolean;
  className?: string;
  children: ReactNode;
  onClick: () => void;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      onClick={() => {
        if (!busy) onClick();
      }}
      className={cx("welcome-pill focus-ring", quiet && "welcome-pill-quiet", className)}
      {...rest}
    >
      {busy && <Icons.Loader className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/** A title that comes in a word at a time from `at` ms; said in another language later, at once. */
function Words({ text, at }: { text: string; at: number }) {
  const first = useRef(text);
  const start = text === first.current ? at : 0;
  return text.split(" ").map((word, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a word is its place in the title (one can come twice); another title remounts them all
    <span key={`${text}-${i}`}>
      {i > 0 && " "}
      <span className={cx("inline-block", ARRIVE_WORD)} style={arriveAt(i, start, WORD_STAGGER)}>
        {word}
      </span>
    </span>
  ));
}

/** The window's size, kept up to date. */
function useWindowSize() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth || 1280, height: window.innerHeight || 800 }));
  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth || 1280, height: window.innerHeight || 800 });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

/** Whether `value` is no longer what it was on the first draw: what arrived with the screen doesn't animate again, a change since does. */
function useChanged(value: string | null): boolean {
  const first = useRef(value);
  return value !== first.current;
}

/** `value`, changing at most once every `ms`: a line that changes as things come in stays long enough to be read. */
function useSteady<T>(value: T, ms: number): T {
  const [shown, setShown] = useState(value);
  const since = useRef(0);
  useEffect(() => {
    if (Object.is(value, shown)) return;
    const timer = setTimeout(
      () => {
        since.current = performance.now();
        setShown(value);
      },
      Math.max(0, since.current + ms - performance.now()),
    );
    return () => clearTimeout(timer);
  }, [value, shown, ms]);
  return shown;
}
