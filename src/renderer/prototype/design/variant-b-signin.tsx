// PROTOTYPE (#83) — throwaway. Variant B ("Lists"): first run, Apple-style
// onboarding — app icon, large title, one line of subtitle, the two sources as
// a grouped list (EduNex connected, SIX to connect), the password note, Continue.
import { useEffect, useId, useRef, useState } from "react";
import { TrafficLights } from "./chrome";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import { Button, More, cx, ink } from "./variant-b-ui";

export function SignInScreen({ p }: { p: VariantProps }) {
  const { t, tr, data, go } = p;
  const [six, setSix] = useState<"idle" | "busy" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const connectSix = () => {
    // Production: opens Microsoft's INA sign-in in its own window.
    setSix("busy");
    timer.current = window.setTimeout(() => setSix("done"), 900);
  };

  return (
    <div
      className={cx(
        "relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden",
        "bg-[#F5F5F7] dark:bg-[#161618]",
        ink.primary,
      )}
    >
      <TrafficLights />
      {/* soft light behind the icon, so the sheet doesn't feel flat */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[18%] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,122,255,0.10),transparent)] dark:bg-[radial-gradient(closest-side,rgba(10,132,255,0.16),transparent)]"
      />

      <div className="relative flex w-[460px] flex-col items-center text-center motion-safe:animate-[vb-in_320ms_ease-out]">
        <AppIcon />
        <h1 className="mt-7 text-[30px] font-bold leading-9 tracking-[-0.025em]">{t("welcome")}</h1>
        <p className={cx("mt-2 max-w-[380px] text-[15px] leading-[22px]", ink.secondary)}>{t("tagline")}</p>

        <ul
          className={cx(
            "mt-9 w-full overflow-hidden rounded-[14px] bg-white text-left",
            "shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.05)]",
            "dark:bg-[#1F1F22] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]",
          )}
        >
          <li className="flex items-center gap-3.5 px-4 py-3.5">
            <SourceTile kind="edunex" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold leading-5">EduNex</div>
              <div className={cx("text-[12.5px] leading-[18px]", ink.secondary)}>
                {data.student.name} · {data.student.nim}
              </div>
            </div>
            <Connected label={t("connected")} />
          </li>
          <li className="mx-4 h-px bg-black/[0.07] dark:bg-white/[0.08]" aria-hidden />
          <li className="flex items-center gap-3.5 px-4 py-3.5">
            <SourceTile kind="six" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold leading-5">SIX</div>
              <div className={cx("text-[12.5px] leading-[18px]", ink.secondary)}>
                {six === "done" ? `${data.student.name} · ${data.student.nim}` : t("sign_in_ina")}
              </div>
            </div>
            {six === "done" ? (
              <Connected label={t("connected")} />
            ) : (
              <Button kind="tinted" size="sm" onClick={connectSix} disabled={six === "busy"} className="min-w-[96px]">
                {six === "busy" && <More.Spinner className="size-3.5 motion-safe:animate-spin" />}
                {tr({ en: "Connect", id: "Hubungkan" })}
              </Button>
            )}
          </li>
        </ul>

        <p className={cx("mt-4 flex items-center justify-center gap-1.5 text-[12.5px] leading-[18px]", ink.secondary)}>
          <Icons.ShieldCheck className="size-[15px] shrink-0" />
          {t("password_note")}
        </p>

        <Button kind="primary" size="lg" className="mt-10 min-w-[240px]" onClick={() => go("today")}>
          {t("continue")}
        </Button>
      </div>
    </div>
  );
}

function Connected({ label }: { label: string }) {
  return (
    <span className={cx("flex shrink-0 items-center gap-1.5 text-[13px] font-medium", ink.green)}>
      <span className="grid size-[18px] place-items-center rounded-full bg-[#2EA44F] text-white">
        <Icons.Check className="size-3" strokeWidth={3} />
      </span>
      {label}
    </span>
  );
}

function SourceTile({ kind }: { kind: "edunex" | "six" }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid size-9 shrink-0 place-items-center rounded-[9px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]",
        kind === "edunex"
          ? "bg-gradient-to-b from-[#3D8BFF] to-[#0A6CF0]"
          : "bg-gradient-to-b from-[#7A6CF5] to-[#5747E0]",
      )}
    >
      {kind === "edunex" ? <Icons.BookOpen className="size-[18px]" strokeWidth={2} /> : <Icons.GraduationCap className="size-[19px]" strokeWidth={2} />}
    </span>
  );
}

/** Edunex Plus: a calendar page with a check — schedule and Tasks in one place. */
function AppIcon() {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 96 96"
      className="size-[96px] drop-shadow-[0_10px_18px_rgba(0,80,200,0.25)] dark:drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A97FF" />
          <stop offset="1" stopColor="#0A63E8" />
        </linearGradient>
        <linearGradient id={`${id}-page`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E9F1FF" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="22" fill={`url(#${id}-bg)`} />
      <rect x="0.75" y="0.75" width="94.5" height="94.5" rx="21.25" fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.5" />
      <rect x="22" y="25" width="52" height="49" rx="11" fill={`url(#${id}-page)`} />
      <path d="M22 36c0-6.075 4.925-11 11-11h30c6.075 0 11 4.925 11 11v2H22z" fill="#FF3B30" />
      <rect x="33" y="19" width="6" height="13" rx="3" fill="#fff" />
      <rect x="57" y="19" width="6" height="13" rx="3" fill="#fff" />
      <path d="M36 55.5l7.5 7.5 16-16.5" fill="none" stroke="#0A63E8" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
