// Rencana studi: the study planner, the curriculum map, KRS, UKT and ITB's
// academic deadlines (#79, #80). Each tab is its own file under ./plan/ and
// shows once it's built (its `ready` flag); the screen shows once one is.
import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { type StringKey, useT } from "../i18n";
import { cx } from "../ui/cx";
import * as bills from "./plan/bills";
import * as curriculum from "./plan/curriculum";
import * as deadlines from "./plan/deadlines";
import * as krs from "./plan/krs";
import * as planner from "./plan/planner";

type Badge = { value: number; tone: "neutral" | "warning" } | null;

const TABS = [
  ["planner", planner],
  ["curriculum", curriculum],
  ["krs", krs],
  ["bills", bills],
  ["deadlines", deadlines],
] as const;
type TabId = (typeof TABS)[number][0];

const shown = TABS.filter(([, tab]) => tab.ready);

export const ready = shown.length > 0;

/** The tabs' counts together: what needs the Student (warnings) first. */
export function useBadge(): Badge {
  // Every tab's hook runs on every render, in the same order.
  const badges = TABS.map(([, tab]) => tab.useBadge()).filter((badge, i): badge is NonNullable<Badge> => badge !== null && TABS[i][1].ready);
  const warnings = badges.filter((badge) => badge.tone === "warning");
  const pick = warnings.length ? warnings : badges;
  if (!pick.length) return null;
  return { value: pick.reduce((sum, badge) => sum + badge.value, 0), tone: warnings.length ? "warning" : "neutral" };
}

export function PlanScreen({ tab }: { tab?: string }) {
  const t = useT();
  const first = shown[0]?.[0] ?? "planner";
  const [current, setCurrent] = useState<TabId>(shown.some(([id]) => id === tab) ? (tab as TabId) : first);
  if (!shown.length) return null;
  return (
    <div className="mx-auto max-w-[1180px] px-10 pt-7 pb-20">
      <h1 className="text-title font-semibold tracking-tight">{t("nav.plan")}</h1>
      <Tabs.Root value={current} onValueChange={(value) => setCurrent(value as TabId)}>
        <Tabs.List aria-label={t("nav.plan")} className="mt-5 flex gap-6 border-b border-line">
          {shown.map(([id]) => (
            <Tabs.Trigger
              key={id}
              value={id}
              className={cx(
                "focus-ring relative -mb-px flex h-10 items-center gap-1.5 rounded-t-sm border-b-2 text-body font-medium transition-colors duration-150",
                "border-transparent text-muted hover:text-fg data-[state=active]:border-fg data-[state=active]:text-fg",
              )}
            >
              {t(`plan.tab.${id}` as StringKey)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {shown.map(([id, { Tab }]) => (
          <Tabs.Content key={id} value={id} className="focus-ring rounded-sm pt-6">
            <Tab />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
}
