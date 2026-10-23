// "Laporkan masalah" (ADR 0007): what goes to the app's maintainer, shown before anything does (the
// app's version and system, which page and which check, the page itself, scrubbed on this
// computer), an optional note, then two ways side by side: a new GitHub issue, or the maintainer's
// LINE. Main saves the file, copies, opens; the window only names the report it showed.
import { type ReactNode, useEffect, useId, useState } from "react";
import { MAINTAINER_LINE } from "../../core/links";
import { hasPages, MAX_NOTE, pageLabel, problemHeading, type ReportPreview } from "../../core/report";
import { useLang, useT } from "../i18n";
import type { ReportAsk } from "../report";
import { useBridge } from "../store";
import { Button } from "../ui/controls";
import { Card, Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { Notice } from "../ui/layout";
import { Dialog, toast } from "../ui/overlays";

type Via = "github" | "line";

export function ReportDialog({ ask, open, onOpenChange }: { ask: ReportAsk | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const bridge = useBridge();
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Via | null>(null);
  const [sent, setSent] = useState<{ via: Via; file: string | null } | null>(null);

  // Each ask is a fresh report: what the app has kept now, scrubbed now.
  useEffect(() => {
    if (!ask) return;
    let current = true;
    setPreview(null);
    setFailed(false);
    setNote("");
    setSent(null);
    bridge.invoke("report.preview", ask.about).then(
      (report) => current && setPreview(report),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [ask, bridge]);

  const send = async (via: Via) => {
    if (!preview) return;
    setBusy(via);
    try {
      setSent({ via, file: (await bridge.invoke("report.send", { id: preview.id, via, note })).file });
    } catch {
      toast(t("report.sendFailed"), "danger");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("report.title")}>
      {failed ? (
        <Notice tone="danger" title={t("report.failed")} />
      ) : !preview ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : sent ? (
        <Sent preview={preview} note={note} {...sent} onDone={() => onOpenChange(false)} />
      ) : (
        <div className="space-y-6">
          <p className="text-body text-pretty text-muted">{t("report.lead")}</p>
          <WhatsSent preview={preview} />
          <label className="block">
            <span className="mb-1.5 block px-1 text-small font-semibold text-muted">{t("report.note")}</span>
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
            {/* Two ways, side by side: neither is the other's fallback. */}
            <div className="grid grid-cols-1 gap-3 min-[30rem]:grid-cols-2">
              <Way
                icon={<Icons.GitHub className="size-5" />}
                label={t("report.github")}
                hint={t("report.githubHint")}
                busy={busy === "github"}
                disabled={busy !== null}
                onClick={() => void send("github")}
              />
              <Way
                icon={<Icons.Chat className="size-5" />}
                label={t("report.line")}
                hint={t("report.lineHint", { id: MAINTAINER_LINE.id })}
                busy={busy === "line"}
                disabled={busy !== null}
                onClick={() => void send("line")}
              />
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}

/** The app, then each page the app couldn't read: which, what didn't fit or which rows, and the page itself to read through. */
function WhatsSent({ preview }: { preview: ReportPreview }) {
  const t = useT();
  const lang = useLang();
  const heading = useId();
  const [shown, setShown] = useState<string | null>(null);
  const { report } = preview;
  return (
    <section aria-labelledby={heading}>
      <h3 id={heading} className="mb-2 px-1 text-small font-semibold text-muted">
        {t("report.sent")}
      </h3>
      <Card className="divide-y divide-line overflow-hidden">
        <p className="px-4 py-3 text-body">{t("report.app", { version: report.version, os: preview.os })}</p>
        {report.problems.length === 0 && <p className="px-4 py-3 text-small text-pretty text-muted">{t("report.nothingKept")}</p>}
        {report.problems.map((problem) => (
          <div key={problem.feed} className="space-y-1.5 px-4 py-3">
            <p className="text-body font-medium">{problemHeading(problem, lang)}</p>
            {problem.kind === "changed" ? (
              <p className="text-small break-words text-muted">{t("report.check", { check: problem.check })}</p>
            ) : (
              <ul className="space-y-0.5 text-small break-words text-muted">
                {problem.rows.map((row) => (
                  <li key={`${row.row} ${row.why}`}>{row.row}</li>
                ))}
              </ul>
            )}
            {problem.pages.map((page, i) => {
              const key = `${problem.feed} ${i}`;
              const open = shown === key;
              return (
                <div key={key}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-ml-2.5"
                    aria-expanded={open}
                    icon={<Icons.FileText className="size-3.5" />}
                    onClick={() => setShown(open ? null : key)}
                  >
                    {open ? t("report.hidePage") : t("report.showPage")}
                    {problem.pages.length > 1 && <span className="font-normal text-faint">{pageLabel(page.path)}</span>}
                  </Button>
                  {open && (
                    <pre className="mt-1.5 max-h-64 overflow-auto rounded-lg bg-fill p-3 font-mono text-caption whitespace-pre-wrap break-all">{page.body}</pre>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Card>
      {hasPages(preview) && <p className="mt-1.5 px-1 text-caption text-faint">{t("report.scrubbed")}</p>}
    </section>
  );
}

function Way({
  icon,
  label,
  hint,
  busy,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <span className="text-muted">{icon}</span>
      <p className="flex-1 text-small text-pretty text-muted">{hint}</p>
      <Button variant="primary" busy={busy} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}>
        {label}
      </Button>
    </Card>
  );
}

/** What's left to do on GitHub or LINE, with the file to send along, and the LINE ID said plainly. */
function Sent({ preview, note, via, file, onDone }: { preview: ReportPreview; note: string; via: Via; file: string | null; onDone: () => void }) {
  const t = useT();
  const bridge = useBridge();
  const reveal = () => void bridge.invoke("report.reveal", { id: preview.id }).catch(() => toast(t("report.sendFailed"), "danger"));
  const copy = () =>
    void bridge.invoke("report.copy", { id: preview.id, note }).then(
      () => toast(t("report.copied"), "success"),
      () => toast(t("report.sendFailed"), "danger"),
    );
  const openLine = () => void bridge.invoke("shell.openExternal", { url: MAINTAINER_LINE.url }).catch(() => toast(t("report.sendFailed"), "danger"));
  const line = via === "line";
  return (
    <div className="space-y-5">
      <Notice tone="success" title={line ? t("report.lineOpened") : t("report.githubOpened")}>
        {line
          ? file
            ? t("report.lineFile", { id: MAINTAINER_LINE.id, file })
            : t("report.lineNoFile", { id: MAINTAINER_LINE.id })
          : file
            ? t("report.githubFile", { file })
            : t("report.githubNoFile")}
      </Notice>
      {line && <p className="px-1 text-small text-pretty text-muted">{t("report.lineId", { id: MAINTAINER_LINE.id })}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {line && <Button onClick={copy}>{t("report.copy")}</Button>}
        {line && <Button onClick={openLine}>{t("report.openLine")}</Button>}
        {file && (
          <Button icon={<Icons.FolderDown className="size-3.5" />} onClick={reveal}>
            {t("report.showFile")}
          </Button>
        )}
        <Button variant="primary" onClick={onDone}>
          {t("report.done")}
        </Button>
      </div>
    </div>
  );
}
