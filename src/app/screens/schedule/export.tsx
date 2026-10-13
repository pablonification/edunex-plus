// "Tambahkan ke kalender HP" (#77): a dialog that finishes the job. First what
// goes in (classes, exams, Task deadlines, ITB's calendar, each with how many)
// and how far ahead, then the system save dialog, then the result: the file's
// name, a way to it in Finder (Explorer, the file manager), and how to get it
// onto an iPhone or an Android phone. It says plainly that the file is a
// one-time copy.
import { useMemo, useState } from "react";
import { wibDay } from "../../../core/course-meetings";
import { PHONE_KINDS, type PhoneKind, phoneItems } from "../../../core/phone-calendar";
import { dayStart, shiftDay } from "../../../core/schedule";
import { ActionError } from "../../bridge";
import { useFormat, useLang, useNow, useT } from "../../i18n";
import { useBridge, useDataset, useStatus, useStore } from "../../store";
import { Button } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { Icons } from "../../ui/icons";
import { Dialog, Tooltip, toast } from "../../ui/overlays";

type Range = "term" | "weeks";
type Step = { step: "choose" } | { step: "saving" } | { step: "done"; file: string; events: number };

const ALL: Record<PhoneKind, boolean> = { classes: true, exams: true, deadlines: true, itb: true };

/** "2026-11" → "2026-11-30". */
const lastDayOf = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  return shiftDay(new Date(Date.UTC(year, index, 1)).toISOString().slice(0, 10), -1);
};

/** Opens the phone calendar dialog; disabled, with the reason, while there's nothing to put in it. */
export function ExportButton({ className }: { className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const schedule = useDataset("six.schedule");
  const tasks = useDataset("edunex.tasks");
  const calendar = useDataset("itb.calendar");
  const anything = Boolean(schedule?.length || tasks?.some((task) => task.dueAt !== null) || calendar?.events.length);
  const button = (
    <Button icon={<Icons.Smartphone className="size-3.5" />} disabled={!anything} onClick={() => setOpen(true)} className={className}>
      {t("schedule.export")}
    </Button>
  );
  return (
    <>
      {anything ? (
        button
      ) : (
        <Tooltip content={t("schedule.export.disabled")}>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a disabled button can't take focus; its wrapper does, so the keyboard reaches the reason */}
          <span tabIndex={0} className={cx("focus-ring inline-flex rounded-lg", className)}>
            {button}
          </span>
        </Tooltip>
      )}
      {open && <ExportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const store = useStore();
  const bridge = useBridge();
  const six = useStatus("six");
  const months = useDataset("six.scheduleMonths");
  const calendar = useDataset("itb.calendar");
  const [include, setInclude] = useState<Record<PhoneKind, boolean>>(ALL);
  const [range, setRange] = useState<Range>("term");
  const [step, setStep] = useState<Step>({ step: "choose" });

  const today = wibDay(now);
  // The end of the term: its UAS's last day, from ITB's calendar.
  const termEnd =
    calendar?.events.filter((e) => e.kind === "uas" && e.lastDay >= today).sort((a, b) => a.firstDay.localeCompare(b.firstDay))[0]?.lastDay ?? null;
  const until = range === "term" && termEnd ? termEnd : shiftDay(today, 27);
  const items = useMemo(
    () => phoneItems((name) => store.dataset(name)?.value as never, lang, now, { from: today, until }),
    // The datasets are read when the dialog opens and whenever the choice changes.
    [store, lang, now, today, until],
  );
  const count = (kind: PhoneKind) => items.filter((item) => item.kind === kind).length;
  const chosen = items.filter((item) => include[item.kind]).length;
  // SIX's timetable comes a month at a time: say where it stops when the range goes past it.
  const lastMonth = [...(months ?? [])].sort().at(-1);
  const sixUntil = lastMonth && include.classes ? lastDayOf(lastMonth) : null;
  const day = (d: string) => `${f.weekdayShort(dayStart(d) + 12 * 3_600_000)}, ${f.dayMonth(dayStart(d) + 12 * 3_600_000)}`;

  const save = async () => {
    setStep({ step: "saving" });
    try {
      const result = await bridge.invoke("schedule.export", { include, from: today, until });
      setStep(result.file ? { step: "done", file: result.file, events: result.events } : { step: "choose" });
    } catch (error) {
      setStep({ step: "choose" });
      toast(error instanceof ActionError && error.kind !== "Failed" ? t("error.action", { message: error.message }) : t("schedule.exportFailed"), "danger");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={t("schedule.export.title")} className="w-[min(560px,calc(100vw-48px))]">
      {step.step === "done" ? (
        <Saved file={step.file} events={step.events} onDone={onClose} />
      ) : (
        <div>
          <p className="text-body text-muted">{t("schedule.export.lead")}</p>

          <fieldset className="mt-5">
            <legend className="mb-2 text-small font-semibold">{t("schedule.export.what")}</legend>
            <ul className="overflow-hidden rounded-xl border border-edge [&>li+li]:border-t [&>li+li]:border-line">
              {PHONE_KINDS.map((kind) => {
                const n = count(kind);
                const hint = kind === "classes" && six.state === "signed-out" && n === 0 ? t("schedule.export.needsSix") : t(`schedule.export.${kind}.hint`);
                return (
                  <li key={kind}>
                    <label className={cx("flex items-center gap-3 px-3.5 py-2.5 transition-colors duration-150 hover:bg-hover", n === 0 && "opacity-60")}>
                      <input
                        type="checkbox"
                        checked={include[kind] && n > 0}
                        disabled={n === 0}
                        onChange={(event) => setInclude((current) => ({ ...current, [kind]: event.target.checked }))}
                        className="size-4 shrink-0 accent-(--accent)"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-medium">{t(`schedule.export.${kind}`)}</span>
                        <span className="block text-small text-muted">{hint}</span>
                      </span>
                      <span className="shrink-0 text-small font-semibold text-muted tabular-nums">{n}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-small font-semibold">{t("schedule.export.range")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(termEnd ? (["term", "weeks"] as const) : (["weeks"] as const)).map((value) => (
                <label
                  key={value}
                  className={cx(
                    "flex cursor-default items-start gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors duration-150",
                    range === value ? "border-accent bg-info-bg/50" : "border-edge hover:bg-hover",
                  )}
                >
                  <input
                    type="radio"
                    name="range"
                    checked={range === value}
                    onChange={() => setRange(value)}
                    className="mt-1 size-4 shrink-0 accent-(--accent)"
                  />
                  <span className="min-w-0">
                    <span className="block text-body font-medium">{t(`schedule.export.range.${value}`)}</span>
                    <span className="block text-small text-muted tabular-nums">
                      {t("schedule.export.range.until", { date: day(value === "term" && termEnd ? termEnd : shiftDay(today, 27)) })}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-small text-muted">
              {t("schedule.export.fromToday")}
              {sixUntil && sixUntil < until && <> {t("schedule.export.sixUntil", { date: day(sixUntil) })}</>}
            </p>
          </fieldset>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="flex min-w-0 flex-1 items-center gap-1.5 text-small text-muted">
              <Icons.Info className="size-3.5 shrink-0" />
              {t("schedule.export.once")}
            </p>
            <div className="flex gap-2">
              <Button onClick={onClose}>{t("action.cancel")}</Button>
              <Button variant="primary" busy={step.step === "saving"} disabled={chosen === 0} onClick={() => void save()}>
                {chosen === 0 ? t("schedule.export.nothing") : t("schedule.export.save", { count: chosen })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** The result: where the file is, and how to get it onto a phone. */
function Saved({ file, events, onDone }: { file: string; events: number; onDone: () => void }) {
  const t = useT();
  const store = useStore();
  const bridge = useBridge();
  const reveal = () =>
    void bridge
      .invoke("schedule.reveal", {})
      .catch((error: unknown) => toast(error instanceof ActionError ? t("error.action", { message: error.message }) : t("schedule.exportFailed"), "danger"));
  const place = store.platform === "darwin" ? "mac" : store.platform === "win32" ? "win" : "linux";
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-bg text-success-fg">
          <Icons.Check className="size-5" weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-title font-semibold">{t("schedule.export.saved", { count: events })}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-fill px-2.5 py-1 text-small font-medium">
              <Icons.Calendar className="size-3.5 shrink-0 text-muted" />
              <span className="truncate">{file}</span>
            </span>
            <Button size="sm" icon={<Icons.FolderDown className="size-3.5" />} onClick={reveal}>
              {t(`schedule.export.reveal.${place}`)}
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-6 text-small font-semibold">{t("schedule.export.toPhone")}</p>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {(["iphone", "android"] as const).map((phone) => (
          <section key={phone} aria-label={t(`schedule.export.${phone}`)} className="rounded-xl bg-sunken px-3.5 py-3">
            <h3 className="flex items-center gap-1.5 text-small font-semibold">
              <Icons.Smartphone className="size-3.5 text-muted" />
              {t(`schedule.export.${phone}`)}
            </h3>
            <ol className="mt-2 space-y-1 text-small text-muted">
              {([1, 2, 3] as const).map((n) => (
                <li key={n} className="flex gap-2">
                  <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-surface text-micro font-semibold text-fg shadow-card tabular-nums">
                    {n}
                  </span>
                  <span>{t(`schedule.export.${phone}.${n}`)}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-small text-muted">
          <Icons.Info className="size-3.5 shrink-0" />
          {t("schedule.export.once")}
        </p>
        <Button variant="primary" onClick={onDone}>
          {t("schedule.export.done")}
        </Button>
      </div>
    </div>
  );
}
