// The app asking about problem reports (ADR 0014), quietly, in the window's corner and under any
// dialog, only while the app has the maintainer's relay. The first time it keeps a problem it asks
// once whether reports like it should go by themselves ("Kirim otomatis", "Tanya tiap kali",
// "Jangan kirim"); closed, that's "ask each time". In that mode, each new problem asks again, with a
// way to look at its report, which "Kirim langsung" sends from. A report that went by itself while
// the window was open says so, with the box for the Student's story. Nothing here sends a report:
// the engine does, as the Student said (src/engine/report/outbox.ts). It leaves the way it came.
import { type ReactNode, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReportAsking, ReportSending, SentReport } from "../../core/models";
import { problemHeading, systemOf } from "../../core/report";
import type { StringKey } from "../../core/strings";
import { errorKey } from "../bridge";
import { useLang, useT } from "../i18n";
import { openReport } from "../report";
import { ReportSent } from "../report-sent";
import { useBridge, useDataset, useStore } from "../store";
import { Button, IconButton } from "../ui/controls";
import { Icons } from "../ui/icons";
import { Presence, usePresence } from "../ui/motion/presence";

export function ReportAskCard() {
  const store = useStore();
  const reports = useDataset("app.reports");
  // Reports that went before the window opened were said then.
  const [before] = useState(() => new Set((reports?.sent ?? []).map(sentKey)));
  const [closed, setClosed] = useState<string | null>(null);
  const asking = store.relay ? reports?.asking : null;
  const fresh = store.relay && !asking ? reports?.sent.find((sent) => sent.how === "auto" && !before.has(sentKey(sent))) : undefined;
  const showFresh = fresh && sentKey(fresh) !== closed;
  return (
    <Presence>
      {asking ? (
        <Asking key={`ask ${asking.feed} ${asking.at}`} asking={asking} />
      ) : showFresh ? (
        <Corner key={`sent ${sentKey(fresh)}`} label={null} onClose={() => setClosed(sentKey(fresh))}>
          <ReportSent id={fresh.id} issue={fresh.issue} />
        </Corner>
      ) : null}
    </Presence>
  );
}

const sentKey = (sent: SentReport) => `${sent.at} ${sent.id}`;

function Asking({ asking }: { asking: ReportAsking }) {
  const t = useT();
  const lang = useLang();
  const bridge = useBridge();
  const [pending, setPending] = useState<ReportSending | null>(null);
  const [problem, setProblem] = useState<StringKey | null>(null);
  const heading = problemHeading({ feed: asking.feed, kind: asking.kind, rows: asking.rowsLeftOut }, lang);
  const choose = (reportSending: ReportSending) => {
    if (pending) return;
    setPending(reportSending);
    setProblem(null);
    void bridge
      .invoke("settings.update", { reportSending, reportAsked: true })
      .catch((error: unknown) => setProblem(errorKey(error)))
      .finally(() => setPending(null));
  };
  const close = () => void bridge.invoke("report.dismiss", {}).catch((error: unknown) => setProblem(errorKey(error)));
  const look = () => openReport({ source: systemOf(asking), datasets: asking.datasets.length ? asking.datasets : undefined });
  const said = problem && (
    <p role="alert" className="mt-2 text-small text-pretty text-danger-fg">
      {t(problem)}
    </p>
  );

  if (!asking.first)
    return (
      <Corner label={heading} onClose={close}>
        <p className="text-small text-pretty text-muted">{t("report.ask.each")}</p>
        <Button size="sm" variant="primary" className="mt-3" onClick={look}>
          {t("report.ask.seeReport")}
        </Button>
        {said}
      </Corner>
    );
  return (
    <Corner label={t("report.ask.title")} onClose={close}>
      <p className="text-small text-pretty text-muted">
        {heading}. {t("report.ask.body")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" busy={pending === "auto"} onClick={() => choose("auto")}>
          {t("report.ask.auto")}
        </Button>
        <Button size="sm" busy={pending === "ask"} onClick={() => choose("ask")}>
          {t("report.ask.ask")}
        </Button>
        <Button size="sm" variant="ghost" busy={pending === "never"} onClick={() => choose("never")}>
          {t("report.ask.never")}
        </Button>
      </div>
      <Button size="sm" variant="ghost" className="mt-1 -ml-2" icon={<Icons.Eye className="size-3.5" />} onClick={look}>
        {t("report.ask.see")}
      </Button>
      {said}
    </Corner>
  );
}

/** A quiet card in the window's corner: a title (or none), what it says, and a way to close it. It rises in, and leaves the way it came. */
function Corner({ label, onClose, children }: { label: string | null; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const title = useId();
  const ref = useRef<HTMLElement>(null);
  const exit = usePresence()?.exit;
  useLayoutEffect(() => {
    if (!exit || !ref.current) return;
    ref.current.setAttribute("inert", "");
    return exit(ref.current);
  }, [exit]);
  return (
    <section
      ref={ref}
      data-report-ask
      aria-labelledby={label ? title : undefined}
      aria-label={label ? undefined : t("report.sentTitle")}
      className="fixed right-5 bottom-5 z-(--z-float) w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border border-edge bg-raised p-4 shadow-pop motion-safe:animate-toast-in"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {label && (
            <h2 id={title} className="mb-1 text-body font-semibold text-pretty">
              {label}
            </h2>
          )}
          {children}
        </div>
        <IconButton label={t("action.close")} size="sm" className="-mt-1 -mr-1" onClick={onClose}>
          <Icons.X className="size-4" />
        </IconButton>
      </div>
    </section>
  );
}
