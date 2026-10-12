// First run (and after signing out): connect Edunex and SIX. Each sign-in
// happens in a window the app owns, on Microsoft's own page; right after the
// first, the second needs no password again. "Lanjut" leads to a calm
// "reading" step that stays until the first full read is in (counts ticking
// up), so Beranda never flashes half-read; then the shell takes over. Moving
// on also wipes the sign-in windows' Microsoft session.
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
import { Meta } from "../ui/layout";
import { useSignIn } from "./source-status";

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

  const next = () => {
    void bridge.invoke("auth.signInDone", {}).catch(() => undefined);
    setReading(true);
  };

  return (
    <div className="relative h-dvh overflow-y-auto bg-welcome text-fg">
      {store.platform === "darwin" && <div className="drag absolute inset-x-0 top-0 h-[52px]" />}
      <div className="no-drag absolute top-3 right-4 z-10">
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
          <AppMark className="mx-auto block size-16 drop-shadow-[0_8px_18px_rgb(37_99_235/0.35)]" />
          {reading ? (
            <Reading onDone={onDone} />
          ) : (
            <>
              <h1 className="mt-5 text-center text-[24px] leading-8 font-semibold tracking-[-0.02em]">{t("welcome.title")}</h1>
              <p className="mx-auto mt-2 max-w-[400px] text-center text-lead text-muted">{t("welcome.lead")}</p>

              <Card className="mt-7 divide-y divide-line overflow-hidden">
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

              <p className="mt-3 flex items-center justify-center gap-1.5 text-small text-muted">
                <Icons.ShieldCheck className="size-3.5" />
                {t("welcome.passwordNote")}
              </p>
              <p className="mt-1 text-center text-caption text-faint">{t("welcome.readOnly")}</p>
              {store.vault === "memory" && (
                <p className="mt-4 rounded-lg bg-warning-bg px-3.5 py-2.5 text-center text-small text-warning-fg">{t("settings.sessionNotSaved")}</p>
              )}

              <Button variant="primary" size="lg" className="mt-7 w-full" disabled={!edunex && !six} onClick={next} aria-describedby="welcome-next-hint">
                {t("welcome.continue")}
              </Button>
              <p id="welcome-next-hint" className="mt-2 text-center text-small text-muted">
                {!edunex && !six ? t("welcome.continueHint") : edunex !== six ? t(edunex ? "welcome.sixLater" : "welcome.edunexLater") : ""}
              </p>
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

  useEffect(() => {
    if (ready) onDone();
  }, [ready, onDone]);
  useEffect(() => {
    const timer = setTimeout(() => setPatience(true), READ_PATIENCE);
    return () => clearTimeout(timer);
  }, []);

  const both = summary.connected.length === 2;
  const parts = [
    { key: "courses", count: summary.courses, label: t("scan.read.courses", { count: summary.courses }) },
    { key: "tasks", count: summary.tasks, label: t("scan.read.tasks", { count: summary.tasks }) },
    { key: "meetings", count: summary.meetings, label: t("scan.read.meetings", { count: summary.meetings }) },
  ];
  return (
    <div className="mt-6 text-center" aria-live="polite" aria-busy="true">
      <h1 className="text-[24px] leading-8 font-semibold tracking-[-0.02em]">
        {both ? t("welcome.reading") : t("welcome.readingOne", { source: t(`source.${summary.connected[0] ?? "edunex"}`) })}
      </h1>
      <p className="mx-auto mt-2 max-w-[360px] text-lead text-muted">{t("welcome.readingHint")}</p>
      <ul className="mx-auto mt-7 grid max-w-[380px] grid-cols-3 gap-2">
        {parts.map((part) => (
          <li
            key={part.key}
            className={cx("rounded-xl border border-edge bg-surface px-3 py-3 shadow-card transition-opacity duration-300", part.count === 0 && "opacity-60")}
          >
            <span className="block text-[22px] leading-7 font-semibold tabular-nums">{part.count}</span>
            <span className="block text-small text-muted">{part.label.replace(/^\d+\s*/, "")}</span>
          </li>
        ))}
      </ul>
      <p className="mt-6 inline-flex items-center gap-2 text-small text-muted">
        <Icons.Loader className="size-3.5 animate-spin" />
        {t("welcome.readingWait")}
      </p>
      {patience && (
        <div className="mt-4">
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
  const name = t(`source.${source}`);
  const connected = isConnected(status.state);
  // Connected first: the sign-in call can still be finishing while the name is already in.
  let line: ReactNode = detail;
  let waiting = false;
  if (connected && who) line = <Meta>{who}</Meta>;
  else if (connected) line = t("welcome.readingName");
  else if (status.state === "connecting") line = t("status.connecting");
  else if (busy) {
    line = t("welcome.waiting");
    waiting = true;
  }

  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <SourceLogo source={source} className="size-10" />
      <span className="min-w-0 flex-1">
        <span className="block text-lead font-semibold">{name}</span>
        <span className={cx("line-clamp-2 block text-small", connected && who ? "text-fg/80" : "text-muted")}>{line}</span>
        {waiting && <span className="block text-caption text-faint">{t("welcome.waitingHint")}</span>}
      </span>
      {connected ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 text-small font-semibold text-success-fg">
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
