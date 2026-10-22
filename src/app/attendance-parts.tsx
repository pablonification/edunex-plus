// Attendance pieces shared by Presensi, Beranda's course cards and the
// course page: the count with one meter against the course's target, and
// the control that sets a course's own target (its course contract may ask
// for more or less than the Student's default). Changing a target is a
// setting: it never sends an alert.
import { type ReactNode, useState } from "react";
import { type AttendanceHealth, percent } from "../core/attendance";
import { DEFAULT_SETTINGS, type Settings } from "../core/models";
import { METER_TONE, STATE_TONE } from "./attendance-labels";
import { errorKey } from "./bridge";
import { useT } from "./i18n";
import { useBridge, useSettings } from "./store";
import { Button, Stepper } from "./ui/controls";
import { cx } from "./ui/cx";
import { Icons } from "./ui/icons";
import { ShareMeter } from "./ui/meter";
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
 * The Student's default target, for every course without its own; "Kembali
 * ke 80%" when it moved. `onReset`: that button goes once pressed, so the
 * panel holding it closes and focus goes back to what opened it.
 */
export function DefaultTarget({ onReset }: { onReset?: () => void }) {
  const { target, setDefault } = useTargets();
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3">
      <TargetStepper value={target} onChange={setDefault} />
      {target !== DEFAULT_SETTINGS.attendanceTarget && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDefault(DEFAULT_SETTINGS.attendanceTarget);
            onReset?.();
          }}
        >
          {t("presence.target.reset", { value: DEFAULT_SETTINGS.attendanceTarget })}
        </Button>
      )}
    </div>
  );
}

/**
 * "Target 80%": a course's target, a click from changing it for that course
 * alone, or going back to the default. `onOpenChange`: Presensi holds its
 * rows still while the panel is open.
 */
export function CourseTarget({ code, className, onOpenChange }: { code: string; className?: string; onOpenChange?: (open: boolean) => void }) {
  const t = useT();
  const { target, own, setOwn } = useTargets();
  const [open, setOpen] = useState(false);
  const mine = Object.hasOwn(own, code) ? own[code] : null;
  const value = mine ?? target;
  const toggle = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  return (
    <Popover
      open={open}
      onOpenChange={toggle}
      label={t("presence.target.course", { code })}
      align="end"
      className="w-[280px] p-4"
      trigger={
        <button
          type="button"
          aria-label={t("presence.target.for", { value, code })}
          className={cx(
            "focus-ring inline-flex items-center gap-0.5 rounded text-small text-muted tabular-nums transition-colors duration-150 hover:text-fg",
            className,
          )}
        >
          {t("presence.target", { value })}
          <Icons.ChevronDown className="size-3" />
        </button>
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
              toggle(false);
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
 * "Kehadiran 4/6 · 66%" over one meter with the course's target as a tick,
 * and, when there's no room to spare, what that means in words (never color
 * alone). `aside` sits at the end of the words' line (the target control).
 */
export function AttendanceSummary({
  health,
  words,
  aside,
  className,
}: {
  health: AttendanceHealth;
  words?: string | null;
  aside?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const attended = health.attended ?? 0;
  const held = health.held ?? 0;
  const share = percent(attended, held);
  return (
    <div className={className}>
      <p className="flex items-baseline justify-between gap-2 text-small">
        <span className="font-medium text-muted">{t("course.attendance")}</span>
        <span className="font-semibold text-fg tabular-nums">{t("course.attendanceShare", { attended, held, percent: share })}</span>
      </p>
      <ShareMeter
        className="mt-1.5"
        share={share}
        target={health.target}
        tone={METER_TONE[health.state]}
        label={t("presence.meter.target", { attended, held, share, target: health.target })}
      />
      {(words || aside) && (
        <p className="mt-1.5 flex items-baseline justify-between gap-2 text-small">
          <span className={cx("min-w-0 font-semibold", STATE_TONE[health.state])}>{words}</span>
          {aside}
        </p>
      )}
    </div>
  );
}
