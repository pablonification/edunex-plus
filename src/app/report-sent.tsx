// After a report went to the maintainer's relay (ADR 0014), from "Kirim langsung" or by itself: it
// says so, names its public issue and opens it, and takes the Student's story, which goes on that
// issue for anyone to read (said under the box). Also the box itself, which "Laporkan masalah"
// uses for its note.
import { useState } from "react";
import type { ReportIssue } from "../core/models";
import { MAX_NOTE } from "../core/report";
import type { StringKey } from "../core/strings";
import { errorKey } from "./bridge";
import { useT } from "./i18n";
import { useBridge } from "./store";
import { Button } from "./ui/controls";
import { Icons } from "./ui/icons";

/** Why a story didn't go, in the Student's words. */
const STORY_PROBLEM: Record<"personal" | "gone" | "busy" | "failed", StringKey> = {
  personal: "report.storyPersonal",
  gone: "report.storyGone",
  busy: "report.sendBusy",
  failed: "report.storyFailed",
};

/** A short box for the Student's own words: its question, and what happens to them under it. */
export function NoteField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block px-1 text-small font-semibold text-muted">{label}</span>
      <textarea
        value={value}
        maxLength={MAX_NOTE}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="block w-full resize-y rounded-lg border border-edge bg-surface px-3 py-2 text-body outline-none placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      {hint && <span className="mt-1.5 block px-1 text-caption text-pretty text-faint">{hint}</span>}
    </label>
  );
}

export function ReportSent({ id, issue, duplicate = false }: { id: string | null; issue: ReportIssue | null; duplicate?: boolean }) {
  const t = useT();
  const bridge = useBridge();
  const [story, setStory] = useState("");
  const [sending, setSending] = useState(false);
  const [added, setAdded] = useState(false);
  const [problem, setProblem] = useState<StringKey | null>(null);

  const openIssue = (number: number) =>
    void bridge.invoke("report.openIssue", { number }).then(
      () => setProblem(null),
      () => setProblem("report.openIssueFailed"),
    );
  const addStory = async () => {
    if (!id || !story.trim() || sending) return;
    setSending(true);
    setProblem(null);
    try {
      const { result } = await bridge.invoke("report.note", { sent: id, note: story.trim() });
      if (result === "added") setAdded(true);
      else setProblem(STORY_PROBLEM[result]);
    } catch (error) {
      setProblem(errorKey(error, "report.storyFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-body font-semibold">
          <Icons.CheckCircle className="size-4 shrink-0 text-success-fg" weight="bold" />
          {t("report.sentTitle")}
        </p>
        <p className="mt-0.5 text-small text-pretty text-muted">
          {issue ? t(duplicate ? "report.sentDuplicate" : "report.sentIssue", { number: issue.number }) : t("report.sentLater")}
        </p>
      </div>
      {issue && (
        <Button size="sm" icon={<Icons.ArrowUpRight className="size-3.5" />} onClick={() => openIssue(issue.number)}>
          {t("report.seeIssue")}
        </Button>
      )}
      {id &&
        (added ? (
          <p className="flex items-center gap-2 text-small text-muted">
            <Icons.Check className="size-3.5 shrink-0 text-success-fg" weight="bold" />
            {t("report.storyAdded")}
          </p>
        ) : (
          <div className="space-y-2">
            <NoteField label={t("report.story")} value={story} onChange={setStory} placeholder={t("report.storyPlaceholder")} hint={t("report.storyPublic")} />
            <Button size="sm" busy={sending} disabled={!story.trim()} onClick={() => void addStory()}>
              {t("report.storySend")}
            </Button>
          </div>
        ))}
      {problem && (
        <p role="alert" className="text-small text-pretty text-danger-fg">
          {t(problem)}
        </p>
      )}
    </div>
  );
}
