// "Laporkan masalah" (ADR 0007). First what goes to the app's maintainer, said plainly before
// anything does (what went wrong and on which page, that the page goes along with the Student's
// details taken out, the app and the system; the engine's own words and the page itself in a
// collapsed technical part), an optional note, and the two ways side by side. Then that way, step
// by step, one thing to do at a time: the file is saved, reach the maintainer, send the file there.
// Main saves and opens; the window only names the report it showed.
import { type ReactNode, useEffect, useId, useState } from "react";
import { MAINTAINER_LINE } from "../../core/links";
import { MAX_NOTE, pageLabel, problemHeading, type ReportPreview } from "../../core/report";
import { useFormat, useLang, useT } from "../i18n";
import type { ReportAsk } from "../report";
import { useBridge, useStore } from "../store";
import { GitHubMark, LineLogo } from "../ui/brand";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Card, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { Notice } from "../ui/layout";
import { Dialog, toast } from "../ui/overlays";
import { QrCode } from "../ui/qr-code";

type Via = "line" | "github";
type Saved = { name: string; bytes: number } | null;

export function ReportDialog({ ask, open, onOpenChange }: { ask: ReportAsk | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const bridge = useBridge();
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<Via | null>(null);
  const [chosen, setChosen] = useState<{ via: Via; file: Saved } | null>(null);

  // Each ask is a fresh report: what the app has kept now, scrubbed now.
  useEffect(() => {
    if (!ask) return;
    let current = true;
    setPreview(null);
    setFailed(false);
    setNote("");
    setChosen(null);
    bridge.invoke("report.preview", ask.about).then(
      (report) => current && setPreview(report),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [ask, bridge]);

  const choose = async (via: Via) => {
    if (!preview) return;
    setSaving(via);
    try {
      setChosen({ via, file: (await bridge.invoke("report.save", { id: preview.id, via, note })).file });
    } catch {
      toast(t("report.saveFailed"), "danger");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("report.title")}>
      {failed ? (
        <Notice tone="danger" title={t("report.failed")} />
      ) : !preview ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : chosen ? (
        // "Kembali": to what's sent, to read it again or take the other way; the note stays.
        <Steps preview={preview} note={note} {...chosen} onBack={() => setChosen(null)} onDone={() => onOpenChange(false)} />
      ) : (
        <div className="space-y-6">
          <p className="text-body text-pretty text-muted">{t("report.lead")}</p>
          <WhatsSent preview={preview} />
          <label className="block">
            <span className="mb-2 block px-1 text-small font-semibold text-muted">{t("report.note")}</span>
            <textarea
              value={note}
              maxLength={MAX_NOTE}
              rows={2}
              placeholder={t("report.notePlaceholder")}
              onChange={(event) => setNote(event.target.value)}
              className="block w-full resize-y rounded-lg border border-edge bg-surface px-3 py-2 text-body outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
          </label>
          <section>
            <h3 className="mb-2 px-1 text-small font-semibold text-muted">{t("report.how")}</h3>
            {/* Two ways, side by side: LINE first, since most Students have it and fewer have GitHub. */}
            <div className="grid grid-cols-1 gap-3 min-[30rem]:grid-cols-2">
              <Way
                logo={<LineLogo className="size-8" />}
                label={t("report.line")}
                hint={t("report.lineHint", { id: MAINTAINER_LINE.id })}
                busy={saving === "line"}
                disabled={saving !== null}
                onClick={() => void choose("line")}
              />
              <Way
                logo={<GitHubMark className="size-8 text-fg" />}
                label={t("report.github")}
                hint={t("report.githubHint")}
                busy={saving === "github"}
                disabled={saving !== null}
                onClick={() => void choose("github")}
              />
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}

/** Each problem in a sentence, that its page goes along without the Student's details, the app and the system; the technical part folded away. */
function WhatsSent({ preview }: { preview: ReportPreview }) {
  const t = useT();
  const lang = useLang();
  const heading = useId();
  const details = useId();
  const [technical, setTechnical] = useState(false);
  const { report } = preview;
  return (
    <section aria-labelledby={heading}>
      <h3 id={heading} className="mb-2 px-1 text-small font-semibold text-muted">
        {t("report.sent")}
      </h3>
      <Card className="divide-y divide-line overflow-hidden">
        {report.problems.map((problem) => (
          <div key={problem.feed} className="space-y-1.5 px-4 py-3">
            <p className="text-body font-medium">{problemHeading(problem, lang)}</p>
            {problem.kind === "skipped" && (
              <ul className="space-y-0.5 text-small break-words text-muted">
                {problem.rows.map((row) => (
                  <li key={`${row.row} ${row.why}`}>{row.row}</li>
                ))}
              </ul>
            )}
            {problem.pages.length > 0 && <p className="text-small text-pretty text-muted">{t("report.pageGoes")}</p>}
          </div>
        ))}
        {report.problems.length === 0 && <p className="px-4 py-3 text-small text-pretty text-muted">{t("report.nothingKept")}</p>}
        <p className="px-4 py-3 text-small text-muted">{t("report.app", { version: report.version, os: preview.os })}</p>
        {report.problems.length > 0 && (
          <div className="px-2 py-1.5">
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={technical}
              aria-controls={details}
              icon={<Icons.ChevronRight className={cx("size-3.5 transition-transform duration-150", technical && "rotate-90")} />}
              onClick={() => setTechnical(!technical)}
            >
              {t("report.details")}
            </Button>
            {technical && (
              <div id={details} className="space-y-3 px-2 pt-1.5 pb-2">
                {report.problems.map((problem) => (
                  <div key={problem.feed} className="space-y-2">
                    {(problem.kind === "changed" ? [problem.check] : problem.rows.map((row) => row.why)).map((line) => (
                      <p key={line} className="font-mono text-caption break-words text-muted">
                        {line}
                      </p>
                    ))}
                    {problem.pages.map((page) => (
                      <div key={page.path}>
                        <p className="mb-1 font-mono text-caption text-faint">{pageLabel(page.path)}</p>
                        <pre className="max-h-56 overflow-auto rounded-lg bg-fill p-3 font-mono text-caption whitespace-pre-wrap break-all">{page.body}</pre>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}

/**
 * One way to send it, as one big button: the service's own mark, its name and who reads it there,
 * and a round arrow that's always there, filled with the accent on hover. It sits raised on the
 * dialog, and answers hover and press like a button.
 */
function Way({
  logo,
  label,
  hint,
  busy,
  disabled,
  onClick,
}: {
  logo: ReactNode;
  label: string;
  hint: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const hintId = useId();
  return (
    <button
      type="button"
      aria-describedby={hintId}
      aria-busy={busy || undefined}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cx(
        "group focus-ring flex items-start gap-3.5 rounded-xl border border-edge bg-surface p-4 text-left shadow-card",
        "transition-[border-color,background-color,box-shadow,scale] duration-150 hover:border-accent/50 hover:bg-hover hover:shadow-lift active:scale-[0.99] active:bg-selected",
        "aria-disabled:pointer-events-none aria-disabled:opacity-60",
      )}
    >
      {/* The marks keep their own room: nothing touches them. */}
      <span className="grid size-9 shrink-0 place-items-center">{busy ? <Icons.Loader className="size-5 animate-spin text-muted" /> : logo}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">{label}</span>
        <span id={hintId} className="mt-0.5 block text-small text-pretty text-muted">
          {hint}
        </span>
      </span>
      {/* A round "go" at the end, filled with the accent on hover: this tile is a button. */}
      <span className="grid size-8 shrink-0 place-items-center self-center rounded-full bg-fill text-fg transition-colors duration-150 group-hover:bg-accent group-hover:text-on-accent">
        <Icons.ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-px" weight="bold" />
      </span>
    </button>
  );
}

/**
 * The chosen way, step by step: the file is saved (shown as a file, with where to find it), then
 * what's left for the Student, one thing at a time. On LINE: add the maintainer (the QR code LINE's
 * own page shows on a computer, or their ID), then send the file in that chat, from LINE on the
 * computer or, with LINE only on the phone, after moving the file there. On GitHub: open the issue,
 * filled in, then attach the file. The one primary button is opening GitHub until it's open, then
 * "Selesai".
 */
function Steps({
  preview,
  note,
  via,
  file,
  onBack,
  onDone,
}: {
  preview: ReportPreview;
  note: string;
  via: Via;
  file: Saved;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const bridge = useBridge();
  const [opened, setOpened] = useState(false);
  const id = MAINTAINER_LINE.id;
  const line = via === "line";

  const openGitHub = () =>
    void bridge.invoke("report.open", { id: preview.id, note }).then(
      () => setOpened(true),
      () => toast(t("report.openFailed", { place: "GitHub" }), "danger"),
    );

  const steps: { title: string; hint?: string; done?: boolean; body?: ReactNode }[] = [];
  if (file) steps.push({ title: t("report.saved"), done: true, body: <FileItem preview={preview} file={file} /> });
  if (line) {
    steps.push({
      title: t("report.lineAdd", { id }),
      hint: t("report.lineAddHint", { id }),
      body: <QrCode text={MAINTAINER_LINE.url} label={t("report.qr", { id })} />,
    });
    steps.push({ title: t("report.lineSend", { id }), hint: t("report.lineSendHint") });
  } else {
    steps.push({
      title: t("report.githubOpen"),
      hint: t("report.githubOpenHint"),
      done: opened,
      body: opened ? (
        <Button size="sm" onClick={openGitHub}>
          {t("report.openAgain")}
        </Button>
      ) : (
        <Button variant="primary" onClick={openGitHub}>
          {t("report.githubOpenButton")}
        </Button>
      ),
    });
    steps.push({ title: file ? t("report.githubAttach") : t("report.githubSubmit") });
  }

  return (
    <div className="space-y-6">
      <h3 className="flex items-center gap-2.5 text-title font-semibold">
        {line ? <LineLogo className="size-6" /> : <GitHubMark className="size-6" />}
        {line ? t("report.line") : t("report.github")}
      </h3>
      <ol className="space-y-5">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3.5">
            <span
              className={cx(
                "grid size-6 shrink-0 place-items-center rounded-full text-small font-semibold tabular-nums",
                step.done ? "bg-success-bg text-success-fg" : "bg-fill text-fg",
              )}
            >
              {step.done ? <Icons.Check className="size-3.5" weight="bold" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cx("text-body font-medium", step.done && "text-muted")}>
                {step.title}
                {step.done && <span className="sr-only">, {t("report.stepDone")}</span>}
              </p>
              {step.hint && <p className="mt-0.5 text-small text-pretty text-muted">{step.hint}</p>}
              {step.body && <div className="mt-2.5">{step.body}</div>}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex justify-between gap-2 border-t border-line pt-4">
        <Button onClick={onBack}>{t("action.back")}</Button>
        <Button variant={line || opened ? "primary" : "secondary"} onClick={onDone}>
          {t("report.done")}
        </Button>
      </div>
    </div>
  );
}

/** The saved report as a file: its name and size, and where to find it to drag it. */
function FileItem({ preview, file }: { preview: ReportPreview; file: NonNullable<Saved> }) {
  const t = useT();
  const f = useFormat();
  const bridge = useBridge();
  const store = useStore();
  const reveal = () => void bridge.invoke("report.reveal", { id: preview.id }).catch(() => toast(t("report.revealFailed"), "danger"));
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2.5">
      <Icons.FileText className="size-5 shrink-0 text-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small font-medium">{file.name}</span>
        <span className="block text-caption text-muted tabular-nums">{f.fileSize(file.bytes)}</span>
      </span>
      <Button size="sm" icon={<Icons.FolderDown className="size-3.5" />} onClick={reveal}>
        {t(`file.reveal.${store.platform}`)}
      </Button>
    </div>
  );
}
