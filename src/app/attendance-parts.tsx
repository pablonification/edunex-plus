// Attendance pieces shared by Presensi, Beranda's course cards and the
// course page: the absence bar with its words ("Jatah absen", "Terpakai 1× ·
// sisa 1×"), Presensi's Targets panel (the default and every course's own:
// its course contract may ask for more or less than the Student's default),
// and the course page's own target control. Changing a target is a setting:
// it never sends an alert.
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { type AttendanceHealth, percent } from "../core/attendance";
import type { Settings } from "../core/models";
import { BAR_TEXT, budgetLabel, budgetWords, STATE_TONE } from "./attendance-labels";
import { errorKey } from "./bridge";
import { useT } from "./i18n";
import { useBridge, useSettings } from "./store";
import { Button, Stepper } from "./ui/controls";
import { cx } from "./ui/cx";
import { CourseCode, Tag } from "./ui/display";
import { Icons } from "./ui/icons";
import { Meta } from "./ui/layout";
import { AbsenceBar } from "./ui/meter";
import { Popover, toast } from "./ui/overlays";

const MIN = 50;
const MAX = 100;
const STEP = 5;

/** The Student's targets: the default, each course's own, and the way to change them (Settings merges shallowly, so the whole map goes). */
export function useTargets() {
  const t = useT();
  const bridge = useBridge();
  const { attendanceTarget, attendanceTargets } = useSettings();
  const save = (patch: Partial<Settings>) => void bridge.invoke("settings.update", patch).catch((error: unknown) => toast(t(errorKey(error)), "danger"));
  return {
    target: attendanceTarget,
    /** Course codes with their own target, and the target. */
    own: attendanceTargets,
    setDefault: (value: number) => save({ attendanceTarget: value }),
    /** `null`: the course follows the default again. */
    setOwn: (code: string, value: number | null) => {
      const next = { ...attendanceTargets };
      if (value === null) delete next[code];
      else next[code] = value;
      save({ attendanceTargets: next });
    },
  };
}

/** "− 80% +", in steps of 5 between 50 and 100; its buttons name the course (`code`), or the default. */
export function TargetStepper({ value, onChange, code }: { value: number; onChange: (value: number) => void; code?: string }) {
  const t = useT();
  return (
    <Stepper
      value={value}
      onChange={onChange}
      min={MIN}
      max={MAX}
      step={STEP}
      format={(v) => `${v}%`}
      lowerLabel={code ? t("presence.target.lowerFor", { code }) : t("presence.target.lower")}
      raiseLabel={code ? t("presence.target.raiseFor", { code }) : t("presence.target.raise")}
    />
  );
}

/**
 * "Target 80% ▾" on the course page: the course's target, a click from
 * changing it for that course alone, or going back to the default.
 */
export function CourseTarget({ code, className }: { code: string; className?: string }) {
  const t = useT();
  const { target, own, setOwn } = useTargets();
  const [open, setOpen] = useState(false);
  const mine = Object.hasOwn(own, code) ? own[code] : null;
  const value = mine ?? target;
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={t("presence.target.course", { code })}
      align="end"
      className="w-[280px] p-4"
      trigger={
        <Button
          size="sm"
          icon={<Icons.Target className="size-3.5" />}
          aria-label={t("presence.target.for", { value, code })}
          className={cx("tabular-nums", className)}
        >
          {t("presence.target", { value })}
          <Icons.ChevronDown className="size-3" />
        </Button>
      }
    >
      <p className="text-body font-semibold">{t("presence.target.course", { code })}</p>
      <p className="mt-0.5 text-small text-muted">{t(mine === null ? "presence.target.followsDefault" : "presence.target.ownSet")}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <TargetStepper value={value} onChange={(next) => setOwn(code, next)} code={code} />
        {mine !== null && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOwn(code, null);
              // The button goes with the course's own target: close, so focus lands back on "Target 80%".
              setOpen(false);
            }}
          >
            {t("presence.target.useDefault", { value: target })}
          </Button>
        )}
      </div>
      <p className="mt-3 text-caption text-faint">{t("presence.target.contract")}</p>
    </Popover>
  );
}

/**
 * Presensi's one Targets panel: the default first, then every course with its
 * own stepper, an "Own target" tag and the way back to the default.
 * `focus`: the course whose stepper takes focus as it opens (a row's "Change
 * target"). Tab past its last control closes it, as Escape and a click
 * outside do; focus goes back to what opened it.
 */
export function TargetsPanel({
  courses,
  open,
  onOpenChange,
  focus,
  trigger,
}: {
  courses: readonly { code: string; name: string; color: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focus: string | null;
  trigger: ReactNode;
}) {
  const t = useT();
  const { target, own, setDefault, setOwn } = useTargets();
  const panel = `targets-panel`;
  const close = (next: boolean) => {
    onOpenChange(next);
    // Opened from a row whose "Ubah target" went with the change (the course is back in reach): focus lands on the Targets button.
    if (!next)
      setTimeout(() => {
        if (document.activeElement === document.body || !document.activeElement?.isConnected)
          document.querySelector<HTMLElement>("[data-targets-trigger]")?.focus();
      }, 0);
  };
  const tabOut = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])")];
    if (document.activeElement !== controls.at(-1)) return;
    event.preventDefault();
    close(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={close}
      label={t("settings.attendance.target")}
      align="end"
      className="w-[min(340px,calc(100vw-40px))] p-4"
      initialFocus={() => (focus ? document.querySelector<HTMLElement>(`#${panel} [data-target="${focus}"] button`) : null)}
      trigger={trigger}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: listens for Tab past the panel's last control, which its buttons get first */}
      <div id={panel} onKeyDown={tabOut}>
        <p className="text-title font-semibold">{t("settings.attendance.target")}</p>
        <p className="mt-1 text-small text-muted">{t("presence.target.contract")}</p>
        <ul className="mt-3 divide-y divide-line">
          <TargetRow
            name={t("presence.targets.default")}
            hint={t("settings.attendance.targetHintOwn")}
            stepper={<TargetStepper value={target} onChange={setDefault} />}
          />
          {courses.map((course) => {
            const mine = Object.hasOwn(own, course.code) ? own[course.code] : null;
            return (
              <TargetRow
                key={course.code}
                code={course.code}
                title={
                  <span className="flex min-w-0 items-center gap-1.5">
                    <CourseCode code={course.code} color={course.color} className="text-small" />
                    {mine !== null && <Tag>{t("presence.targets.own")}</Tag>}
                  </span>
                }
                name={course.name}
                reset={
                  mine !== null ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="-ml-2 h-6 px-2"
                      aria-label={t("presence.targets.useDefaultFor", { code: course.code, value: target })}
                      onClick={(event) => {
                        // The row stays, its stepper now the default's: focus stays on this row's stepper.
                        event.currentTarget.closest("li")?.querySelector<HTMLElement>("[data-target] button")?.focus();
                        setOwn(course.code, null);
                      }}
                    >
                      {t("presence.targets.useDefault", { value: target })}
                    </Button>
                  ) : null
                }
                stepper={<TargetStepper value={mine ?? target} onChange={(next) => setOwn(course.code, next)} code={course.code} />}
              />
            );
          })}
        </ul>
      </div>
    </Popover>
  );
}

/** One target: what it's for (a course, or the default), and its stepper. */
function TargetRow({
  code,
  title,
  name,
  hint,
  reset,
  stepper,
}: {
  code?: string;
  title?: ReactNode;
  name: string;
  hint?: string;
  reset?: ReactNode;
  stepper: ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        {title ?? <p className="text-small font-semibold">{name}</p>}
        {/* A course's name, cut to one line: whole on hover. */}
        {title && (
          <p className="truncate text-caption text-muted" title={name}>
            {name}
          </p>
        )}
        {hint && <p className="text-caption text-muted">{hint}</p>}
        {reset}
      </div>
      <span data-target={code ?? "default"} className="flex shrink-0">
        {stepper}
      </span>
    </li>
  );
}

/**
 * "Jatah absen" with the absence bar and its words ("Terpakai 1× · sisa 1×"),
 * the same on every screen; the one piece the bar's look lives behind.
 * `row`: a Presensi row's budget (right-aligned beside the course, under its
 * name when the row is narrow); `header`: the course page, with SIX's count
 * under it (the one place with a share); `card`: Beranda's course cards.
 * `own`: the course has its own target ("· target 75%"). Nothing where the
 * course has no budget to show.
 */
export function AbsenceBudget({
  health,
  place,
  own = false,
  soFar = false,
  className,
}: {
  health: AttendanceHealth;
  place: "row" | "header" | "card";
  own?: boolean;
  soFar?: boolean;
  className?: string;
}) {
  const t = useT();
  const words = budgetWords(t, health, soFar);
  const share = health.held ? percent(health.attended ?? 0, health.held) : 0;
  const over = health.state === "met" || health.state === "missed";
  const count =
    place === "header" && health.held ? (
      <p className="mt-0.5 text-caption text-faint tabular-nums">
        {over ? t("presence.row.final", { percent: share }) : t("presence.row.count", { attended: health.attended ?? 0, held: health.held, percent: share })}
      </p>
    ) : null;
  if (!words) {
    // Lectures over: the final word, calm, instead of a budget.
    if (place === "row" || !over) return null;
    return (
      <div className={cx("min-w-0", className)}>
        <p className={cx("text-small font-semibold", STATE_TONE[health.state])}>{budgetLabel(t, health)}</p>
        {count}
      </div>
    );
  }
  const bar = words.bar && (
    <AbsenceBar
      allowed={words.bar.allowed}
      used={words.bar.used}
      over={words.bar.over}
      estimate={words.bar.estimate}
      tone={words.tone}
      size={place === "row" ? "sm" : "md"}
      label={words.label}
    />
  );
  const text = (
    // On a row the words sit at its end: each "·" goes with the fact before it, so a wrapped line still ends right.
    <Meta align={place === "row" ? "end" : "start"} className="text-small text-muted tabular-nums">
      {words.lead ?? ""}
      <span className={cx("font-semibold", BAR_TEXT[words.tone])}>{words.bold}</span>
      {own ? t("presence.row.ownTarget", { value: health.target }) : ""}
    </Meta>
  );
  if (place === "row")
    return (
      // Wide: the label and bar over the words, at the row's end. Narrow (zoomed in): under the name, on one wrapping line.
      <div
        className={cx(
          "flex flex-wrap items-center gap-x-3 gap-y-1 @[37.5rem]:flex-col @[37.5rem]:flex-nowrap @[37.5rem]:items-end @[37.5rem]:gap-y-1",
          className,
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-caption text-faint">{t("presence.bar.label")}</span>
          {bar}
        </span>
        {text}
      </div>
    );
  return (
    <div className={cx("min-w-0", className)}>
      <p className={cx("font-medium text-muted", place === "header" ? "text-small" : "text-caption")}>{t("presence.bar.label")}</p>
      {bar && <div className="mt-1.5 flex">{bar}</div>}
      <div className="mt-1">{text}</div>
      {count}
    </div>
  );
}
