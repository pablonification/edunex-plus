// PROTOTYPE (#83) — throwaway. Variant A "Calendar": first run — connect the
// two sources over a soft month grid (the calendar the app is about to fill).
import { useEffect, useState } from "react";
import { TrafficLights } from "./chrome";
import { Icons } from "./icons";
import type { VariantProps } from "./variant-props";
import { DAY, focusRing, ink, keyOf, PrimaryButton } from "./variant-a-kit";

export function SignInScreen(props: VariantProps) {
  const { data, t, go } = props;
  const [six, setSix] = useState<"idle" | "connecting" | "connected">("idle");
  useEffect(() => {
    if (six !== "connecting") return;
    const id = setTimeout(() => setSix("connected"), 1100);
    return () => clearTimeout(id);
  }, [six]);

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-[#FAFAFB] text-[13px] text-[#1D1D1F] dark:bg-[#111113] dark:text-[#F2F2F3]">
      <TrafficLights />
      <div className="absolute inset-x-0 top-0 h-[52px] [-webkit-app-region:drag]" />
      <MonthBackdrop {...props} />

      <main className="relative z-10 w-[440px] rounded-[20px] bg-white/[0.92] p-7 shadow-[0_30px_80px_-24px_rgb(0_0_0/0.28),0_0_0_1px_rgb(0_0_0/0.06)] backdrop-blur-xl dark:bg-[#1C1C1F]/[0.92] dark:shadow-[0_30px_80px_-24px_rgb(0_0_0/0.7),0_0_0_1px_rgb(255_255_255/0.08)] motion-safe:transition-[opacity,translate] motion-safe:duration-300 motion-safe:ease-out motion-safe:starting:translate-y-2 motion-safe:starting:opacity-0">
        <AppMark />
        <h1 className="mt-5 text-[21px] leading-[27px] font-semibold tracking-[-0.02em]">{t("welcome")}</h1>
        <p className={`mt-1.5 text-[13.5px] leading-[19px] ${ink[2]}`}>{t("tagline")}</p>

        <ol className="mt-6 divide-y divide-black/[0.07] overflow-hidden rounded-[13px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)] dark:divide-white/[0.07] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.09)]">
          <li className="flex items-center gap-3 px-3.5 py-3">
            <SourceMark letter="E" from="#3B8BFF" to="#1F5FCC" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] leading-[18px] font-semibold">EduNex</p>
              <p className={`truncate text-[12px] leading-[16px] ${ink[2]}`}>
                {data.student.name}
                {data.student.nim && <span className="tabular-nums"> · {data.student.nim}</span>}
              </p>
            </div>
            <Connected label={t("connected")} />
          </li>
          <li className="flex items-center gap-3 px-3.5 py-3">
            <SourceMark letter="S" from="#F59E5B" to="#D9622B" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] leading-[18px] font-semibold">SIX</p>
              <p className={`truncate text-[12px] leading-[16px] ${ink[2]}`}>{t("sign_in_ina")}</p>
            </div>
            {six === "connected" ? (
              <Connected label={t("connected")} />
            ) : (
              <button
                type="button"
                onClick={() => setSix("connecting")}
                disabled={six === "connecting"}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] bg-white px-2.5 text-[12.5px] font-semibold text-[#1D1D1F] shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.12)] transition duration-150 ease-out enabled:hover:bg-[#F7F7F8] motion-safe:enabled:active:scale-[0.97] disabled:opacity-70 dark:bg-white/[0.08] dark:text-white dark:shadow-[0_0_0_1px_rgb(255_255_255/0.12)] dark:enabled:hover:bg-white/[0.12] ${focusRing}`}
              >
                {six === "connecting" && <Icons.RefreshCw className="size-3.5 motion-safe:animate-spin" strokeWidth={2} />}
                {t("connect_six")}
              </button>
            )}
          </li>
        </ol>

        <p className={`mt-4 flex items-start gap-2 text-[12px] leading-[17px] ${ink[2]}`}>
          <Icons.ShieldCheck className={`mt-px size-4 shrink-0 ${ink[3]}`} />
          {t("password_note")}
        </p>

        <PrimaryButton className="mt-6 h-9 w-full text-[13.5px]" onClick={() => go("today")}>
          {t("continue")}
        </PrimaryButton>
      </main>
    </div>
  );
}

function Connected({ label }: { label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-[#15803D] dark:text-[#4ADE80]">
      <span className="grid size-4 place-items-center rounded-full bg-[#15803D] dark:bg-[#22A55B]">
        <Icons.Check className="size-2.5 text-white" strokeWidth={3.5} />
      </span>
      {label}
    </span>
  );
}

function SourceMark({ letter, from, to }: { letter: string; from: string; to: string }) {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-[9px] text-[15px] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.15)]"
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      {letter}
    </span>
  );
}

/** App mark: a calendar page with a plus. */
function AppMark() {
  return (
    <span
      aria-hidden
      className="grid size-[52px] place-items-center rounded-[14px] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_6px_16px_-6px_rgb(36_104_224/0.6),0_0_0_1px_rgb(0_0_0/0.06)]"
      style={{ background: "linear-gradient(160deg, #4C95FF 0%, #2468E0 60%, #1E56C0 100%)" }}
    >
      <svg viewBox="0 0 24 24" className="size-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M8 3v4M16 3v4M3.5 10h17" />
        <path d="M12 13.2v4.6M9.7 15.5h4.6" strokeWidth={2.1} />
      </svg>
    </span>
  );
}

/** The current month as a faint grid, with class days hinted in course colours. */
function MonthBackdrop({ data, now, lang, f }: VariantProps) {
  const todayKey = keyOf(now.getTime());
  const [y, m] = todayKey.split("-").map(Number);
  const first = Date.UTC(y, m - 1, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 35 }, (_, i) => new Date(first + (i - lead) * DAY).toISOString().slice(0, 10));
  const locale = lang === "id" ? "id-ID" : "en-GB";
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(Date.UTC(2024, 0, 1 + i)).replace(".", ""),
  );
  const colors = new Map(data.courses.map((c) => [c.code, c.color]));
  const byDay = new Map<string, string[]>();
  for (const s of data.sessions) {
    const key = f.dayKey(s.start);
    byDay.set(key, [...(byDay.get(key) ?? []), colors.get(s.courseCode) ?? "#8E8E93"]);
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex flex-col px-6 pt-[60px] pb-6 select-none"
      style={{
        maskImage: "radial-gradient(ellipse 62% 60% at 50% 50%, transparent 20%, black 85%)",
      }}
    >
      <div className="grid grid-cols-7 pb-2">
        {weekdays.map((w) => (
          <span key={w} className="px-2 text-[11px] font-semibold text-black/30 dark:text-white/25">
            {w}
          </span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-5 overflow-hidden rounded-[14px] border border-black/[0.06] dark:border-white/[0.06]">
        {cells.map((key, i) => {
          const inMonth = key.slice(0, 7) === todayKey.slice(0, 7);
          const isToday = key === todayKey;
          const dots = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`flex flex-col gap-1 p-2 ${i % 7 ? "border-l" : ""} ${i >= 7 ? "border-t" : ""} border-black/[0.05] dark:border-white/[0.05]`}
            >
              <span
                className={`grid size-5 place-items-center rounded-full text-[11px] font-medium tabular-nums ${
                  isToday ? "bg-[#2468E0]/80 text-white" : inMonth ? "text-black/35 dark:text-white/30" : "text-black/15 dark:text-white/12"
                }`}
              >
                {Number(key.slice(8))}
              </span>
              {dots.slice(0, 3).map((c, j) => (
                <span key={j} className="h-[7px] rounded-full opacity-[0.28] dark:opacity-[0.35]" style={{ background: c, width: `${88 - j * 14}%` }} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
