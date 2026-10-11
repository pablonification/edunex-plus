// PROTOTYPE (#83) — throwaway. Variant C "Spaces" — first run. Split screen:
// a brand panel whose slow color blobs are the student's own spaces, and the
// two connection steps (EduNex done, SIX next).
import { useState, type CSSProperties, type ReactNode } from "react";
import { TrafficLights } from "./chrome";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import { BRAND, FOCUS, MUTED, VcStyles, cx, splitCode, withColor } from "./variant-c-ui";

export function SignInScreen({ p }: { p: VariantProps }) {
  const { t, tr, data, go } = p;
  const [six, setSix] = useState<"idle" | "connecting" | "connected">("idle");
  const colors = data.courses.map((c) => c.color);
  const blob = (i: number) => colors[i % colors.length] ?? BRAND;

  const connectSix = () => {
    setSix("connecting");
    // Prototype stand-in for the Microsoft sign-in window.
    window.setTimeout(() => setSix("connected"), 900);
  };

  return (
    <div className="vc-root relative flex h-screen w-screen overflow-hidden bg-[#F6F6F8] text-zinc-900 antialiased dark:bg-[#0F1115] dark:text-zinc-50">
      <VcStyles />
      <div className="vc-drag absolute inset-x-0 top-0 z-10 h-[52px]" aria-hidden />
      <TrafficLights />

      {/* Brand panel */}
      <section className="relative isolate flex w-[46%] min-w-[460px] flex-col justify-between overflow-hidden bg-[linear-gradient(165deg,#1B2160_0%,#11153F_55%,#0B0E2A_100%)] px-12 pt-[76px] pb-12 text-white">
        <div className="absolute inset-0 -z-10" aria-hidden>
          <Blob color={blob(3)} className="-top-[10%] -left-[14%] size-[500px] motion-safe:animate-[vc-blob-1_22s_ease-in-out_infinite]" />
          <Blob color={blob(1)} className="top-[14%] -right-[20%] size-[520px] motion-safe:animate-[vc-blob-2_26s_ease-in-out_infinite]" />
          <Blob color={blob(0)} className="-bottom-[14%] left-[2%] size-[480px] motion-safe:animate-[vc-blob-3_24s_ease-in-out_infinite]" />
          <Blob color={blob(4)} className="top-[38%] left-[26%] size-[320px] opacity-80 motion-safe:animate-[vc-blob-4_20s_ease-in-out_infinite]" />
          <Blob color={blob(2)} className="-right-[10%] -bottom-[18%] size-[380px] opacity-75 motion-safe:animate-[vc-blob-1_28s_ease-in-out_infinite]" />
          {/* Fine grain keeps the large gradients from banding. */}
          <div
            className="absolute inset-0 opacity-[0.10] mix-blend-overlay"
            style={{ backgroundImage: GRAIN, backgroundSize: "180px 180px" }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(180deg,rgba(9,11,32,0)_0%,rgba(9,11,32,0.5)_100%)]" />
        </div>

        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-white/[0.16] ring-1 ring-white/25 backdrop-blur-md ring-inset">
            <span className="vc-display text-[17px] leading-none font-bold tracking-[-0.04em]">e+</span>
          </span>
          <span className="vc-display text-[17px] font-semibold tracking-[-0.01em]">Edunex Plus</span>
        </div>

        <div>
          <p className="vc-display max-w-[440px] text-[38px] leading-[1.08] font-semibold tracking-[-0.025em] text-balance">
            {t("tagline")}
          </p>
          <div className="mt-7 flex items-center gap-2" aria-hidden>
            {data.courses.map((c) => {
              const [letters, digits] = splitCode(c.code);
              return (
                <span
                  key={c.code}
                  style={withColor(c.color)}
                  className="flex size-11 flex-col items-center justify-center rounded-[14px] bg-white/[0.12] leading-none ring-1 ring-white/20 backdrop-blur-md ring-inset"
                >
                  <span className="vc-display text-[13px] font-bold">{letters}</span>
                  <span className="vc-num mt-[3px] text-[9px] font-semibold text-white/75">{digits}</span>
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="relative flex flex-1 items-center justify-center px-10">
        <div className="w-full max-w-[420px]">
          <h1 className="vc-display text-[30px] leading-tight font-semibold tracking-[-0.02em]">{t("welcome")}</h1>

          <ol className="mt-7 space-y-3">
            <Step
              n={1}
              state="done"
              badge={<SourceBadge label="EduNex" tone="#2F6BF0" />}
              title="EduNex"
              aside={
                <span className="inline-flex items-center gap-1 rounded-full bg-[#22A45D]/[0.12] px-2 py-0.5 text-[11.5px] font-semibold text-[#146C3B] dark:bg-[#30D158]/[0.14] dark:text-[#7EE2A0]">
                  <Icons.Check className="size-3.5" strokeWidth={2.6} />
                  {t("connected")}
                </span>
              }
            >
              <span className="vc-num block truncate">
                {data.student.name} · {data.student.nim}
              </span>
              <span className="mt-2 flex items-center gap-1.5">
                {data.courses.map((c) => (
                  <span key={c.code} title={c.code} style={{ backgroundColor: c.color } as CSSProperties} className="size-2.5 rounded-[4px]" />
                ))}
                <span className="vc-num ml-1 text-[11.5px] font-semibold">
                  {data.courses.length} {t("courses").toLowerCase()}
                </span>
              </span>
            </Step>

            <Step
              n={2}
              state={six === "connected" ? "done" : "current"}
              badge={<SourceBadge label="SIX" tone="#0E7C86" />}
              title="SIX"
              aside={
                six === "connected" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#22A45D]/[0.12] px-2 py-0.5 text-[11.5px] font-semibold text-[#146C3B] dark:bg-[#30D158]/[0.14] dark:text-[#7EE2A0]">
                    <Icons.Check className="size-3.5" strokeWidth={2.6} />
                    {t("connected")}
                  </span>
                ) : null
              }
            >
              <span className="block">{t("sign_in_ina")}</span>
              {six !== "connected" && (
                <button
                  type="button"
                  onClick={connectSix}
                  disabled={six === "connecting"}
                  className={cx(
                    "mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-[#2F6BF0] px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(47,107,240,0.9)] transition duration-150 ease-out hover:bg-[#2458D6] disabled:opacity-70 motion-safe:hover:-translate-y-px dark:bg-[#3D7BFF] dark:hover:bg-[#2F6BF0]",
                    FOCUS,
                  )}
                >
                  <MicrosoftMark />
                  {six === "connecting" ? tr({ en: "Connecting…", id: "Menghubungkan…" }) : t("connect_six")}
                </button>
              )}
            </Step>
          </ol>

          <p className={cx("mt-5 flex items-start gap-2 text-[12.5px] leading-snug", MUTED)}>
            <Icons.ShieldCheck className="mt-px size-4 shrink-0 text-[#22A45D] dark:text-[#30D158]" strokeWidth={2} />
            {t("password_note")}
          </p>

          <button
            type="button"
            disabled={six !== "connected"}
            onClick={() => go("today")}
            className={cx(
              "mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[14px] text-[14px] font-semibold transition duration-200 ease-out",
              six === "connected"
                ? "bg-zinc-900 text-white shadow-[0_10px_24px_-12px_rgba(15,20,35,0.6)] hover:bg-zinc-800 motion-safe:hover:-translate-y-px dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                : "cursor-not-allowed bg-zinc-900/[0.06] text-zinc-400 dark:bg-white/[0.06] dark:text-zinc-500",
              FOCUS,
            )}
          >
            {t("continue")}
            <Icons.ChevronRight className="size-4" strokeWidth={2.4} />
          </button>
        </div>
      </section>
    </div>
  );
}

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

function Blob({ color, className }: { color: string; className: string }) {
  return (
    <div
      className={cx("absolute rounded-full mix-blend-screen blur-[64px] will-change-transform", className)}
      style={{ background: `radial-gradient(circle at 50% 50%, ${color} 0%, ${color} 30%, transparent 70%)` }}
    />
  );
}

function SourceBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-[12px] text-[11px] font-bold tracking-[0.02em] text-white shadow-[0_4px_12px_-6px_rgba(0,0,0,0.4)]"
      style={{ backgroundImage: `linear-gradient(145deg, color-mix(in oklab, ${tone} 82%, white), ${tone})` }}
    >
      {label === "EduNex" ? <span className="vc-display text-[15px] font-bold">E</span> : <span className="vc-display text-[12.5px] font-bold">SIX</span>}
    </span>
  );
}

function Step({
  n,
  state,
  badge,
  title,
  aside,
  children,
}: {
  n: number;
  state: "done" | "current";
  badge: ReactNode;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      className={cx(
        "flex gap-3.5 rounded-[20px] p-4 transition duration-200 ease-out",
        state === "current"
          ? "bg-white shadow-[0_1px_2px_rgba(15,20,35,0.05),0_14px_32px_-16px_rgba(15,20,35,0.22)] ring-1 ring-zinc-900/[0.06] dark:bg-[#181A20] dark:ring-white/[0.08]"
          : "bg-white/60 ring-1 ring-zinc-900/[0.05] dark:bg-white/[0.03] dark:ring-white/[0.06]",
      )}
    >
      {badge}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14.5px] font-semibold">
            <span className="sr-only">{n}. </span>
            {title}
          </p>
          {aside}
        </div>
        <div className={cx("mt-1 text-[12.5px]", MUTED)}>{children}</div>
      </div>
    </li>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <rect x="0" y="0" width="7.5" height="7.5" fill="#F25022" />
      <rect x="8.5" y="0" width="7.5" height="7.5" fill="#7FBA00" />
      <rect x="0" y="8.5" width="7.5" height="7.5" fill="#00A4EF" />
      <rect x="8.5" y="8.5" width="7.5" height="7.5" fill="#FFB900" />
    </svg>
  );
}
