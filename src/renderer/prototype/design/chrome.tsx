// PROTOTYPE (#83) — throwaway. Stand-in for the native macOS traffic lights:
// the app uses a hidden title bar, so the real buttons sit at x=16, y=18 over
// whatever the design puts in the top-left corner. Place this where the
// window's top-left corner is (it positions itself absolutely).
export function TrafficLights({ dimmed = false }: { dimmed?: boolean }) {
  const dot = "size-3 rounded-full ring-[0.5px] ring-black/15 dark:ring-white/10";
  return (
    <div className="pointer-events-none absolute top-[18px] left-[16px] z-50 flex gap-2" aria-hidden>
      <span className={`${dot} ${dimmed ? "bg-black/15 dark:bg-white/15" : "bg-[#FF5F57]"}`} />
      <span className={`${dot} ${dimmed ? "bg-black/15 dark:bg-white/15" : "bg-[#FEBC2E]"}`} />
      <span className={`${dot} ${dimmed ? "bg-black/15 dark:bg-white/15" : "bg-[#28C840]"}`} />
    </div>
  );
}

/** Height of the title-bar band a layout must keep clear for the traffic lights. */
export const TITLEBAR_HEIGHT = 52;
