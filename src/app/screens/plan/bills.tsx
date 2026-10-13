// Rencana studi tab — UKT: bills, instalments and deadlines (#80). This
// semester's and next semester's bill with what's paid and the next deadline,
// SIX's last day next to ITB's calendar deadline, an overdue bill said
// plainly, then every term's bill. View only: the app never pays.
import { type BillUrgency, billLeft, billNeedsStudent, billUrgency, currentTerm, nextTerm, rupiah, uktDeadline } from "../../../core/academic";
import type { Bill } from "../../../core/models";
import { useFormat, useNow, useT } from "../../i18n";
import { useDataset } from "../../store";
import { cx } from "../../ui/cx";
import { Card, SectionTitle } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Notice } from "../../ui/layout";
import { useTermYears } from "./projection";
import { SixNeeded } from "./six-needed";

export const ready = true;

/** Bills overdue or due within a week. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  const bills = useDataset("six.bills");
  const now = useNow();
  const value = bills?.filter((bill) => billNeedsStudent(bill, now)).length ?? 0;
  return value > 0 ? { value, tone: "warning" } : null;
}

/** This term: SIX's (the KRS page, then the status page), else from the calendar. */
export function useThisTerm(): string | null {
  const krs = useDataset("six.krs");
  const student = useDataset("six.student");
  const calendar = useDataset("itb.calendar");
  const now = useNow();
  return currentTerm(krs?.term ?? student?.term, calendar, now);
}

const STATUS: Record<BillUrgency, { tone: string; icon: typeof Icons.Clock }> = {
  paid: { tone: "text-success-fg", icon: Icons.CheckCircle },
  "not-billed": { tone: "bg-neutral-bg text-neutral-fg", icon: Icons.Circle },
  overdue: { tone: "bg-danger-bg text-danger-fg", icon: Icons.AlertTriangle },
  soon: { tone: "bg-warning-bg text-warning-fg", icon: Icons.Clock },
  due: { tone: "bg-neutral-bg text-neutral-fg", icon: Icons.Clock },
  "no-date": { tone: "bg-neutral-bg text-neutral-fg", icon: Icons.Clock },
};

function StatusChip({ bill }: { bill: Bill }) {
  const t = useT();
  const now = useNow();
  const urgency = billUrgency(bill, now);
  const { tone, icon: Icon } = STATUS[urgency];
  const label = urgency === "overdue" ? t("bills.status.overdue") : t(`bills.status.${bill.status}`);
  return (
    <span className={cx("inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-caption font-semibold whitespace-nowrap", tone)}>
      <Icon className="size-3" weight="bold" />
      {label}
    </span>
  );
}

const notBilled = (term: string): Bill => ({
  term,
  amount: null,
  paid: null,
  status: "not-billed",
  dueDate: null,
  dueAt: null,
  instalments: [],
  nextDueAt: null,
});

const dayMs = (iso: string) => Date.parse(`${iso}T12:00:00+07:00`);

export function Tab(_: { onCalendar?: () => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const termYears = useTermYears();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  if (!bills) return <SixNeeded icon={<Icons.Wallet className="size-5" />} title={t("bills.needSix")} body={t("bills.needSixBody")} />;
  const billed = bills.filter((b) => b.status !== "not-billed");
  const current = (term && bills.find((b) => b.term === term)) || billed.at(-1);
  // SIX lists a term's row only once the term is set up: until then it isn't billed either.
  const next = current && (bills.find((b) => b.term === nextTerm(current.term)) ?? notBilled(nextTerm(current.term)));
  const overdue = bills.filter((b) => billUrgency(b, now) === "overdue");
  return (
    <div className="@container space-y-8">
      {overdue.map((bill) => (
        <div key={bill.term} role="alert">
          <Notice tone="danger" title={t("bills.overdue", { term: termYears(bill.term), date: f.dayMonth(bill.nextDueAt!), amount: rupiah(billLeft(bill)) })} />
        </div>
      ))}
      {current && (
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
          <BillCard label={t("bills.thisTerm")} bill={current} />
          {next && <BillCard label={t("bills.nextTerm")} bill={next} />}
        </div>
      )}
      <section>
        <SectionTitle>{t("bills.history")}</SectionTitle>
        <List label={t("bills.history")}>
          {[...billed].reverse().map((bill) => (
            <li key={bill.term} className="grid grid-cols-[minmax(0,1fr)_auto_110px_130px] items-center gap-4 px-4 py-3 text-body">
              <span className="font-medium">{termYears(bill.term)}</span>
              <span className="text-right tabular-nums">
                {bill.amount !== null ? rupiah(bill.amount) : "—"}
                {bill.instalments.length > 0 && (
                  <span className="ml-2 text-caption text-faint">{t("bills.inInstalments", { count: bill.instalments.length })}</span>
                )}
              </span>
              <span className="text-right text-small text-muted tabular-nums">
                {bill.dueDate ? `${f.dayMonth(dayMs(bill.dueDate))} ${bill.dueDate.slice(0, 4)}` : "—"}
              </span>
              <span className="text-right">
                <StatusChip bill={bill} />
              </span>
            </li>
          ))}
        </List>
        <p className="mt-2 text-caption text-faint">
          <Meta>
            {t("bills.from")}
            {t("bills.viewOnly")}
          </Meta>
        </p>
      </section>
    </div>
  );
}

/** One deadline to follow: the earlier of SIX's and ITB's calendar, with the other explained. */
function deadlineOf(bill: Bill, itbDay: string | null): { day: string; other: { day: string; source: "six" | "itb" } | null } | null {
  const six = bill.dueDate;
  if (!six && !itbDay) return null;
  if (!six) return { day: itbDay!, other: null };
  if (!itbDay || itbDay === six) return { day: six, other: null };
  return itbDay < six ? { day: itbDay, other: { day: six, source: "six" } } : { day: six, other: { day: itbDay, source: "itb" } };
}

function BillCard({ label, bill }: { label: string; bill: Bill }) {
  const t = useT();
  const f = useFormat();
  const termYears = useTermYears();
  const calendar = useDataset("itb.calendar");
  const itb = uktDeadline(calendar, bill.term);
  const billedNow = bill.status !== "not-billed";
  const deadline = deadlineOf(bill, itb?.lastDay ?? null);
  const paidInstalments = (() => {
    let paid = bill.paid ?? 0;
    return bill.instalments.map((i) => {
      const covered = paid >= i.amount;
      paid -= i.amount;
      return covered;
    });
  })();
  return (
    <Card className="flex flex-col px-5 py-4">
      <p className="text-small font-medium text-muted">
        {label} · {termYears(bill.term)}
      </p>
      {billedNow ? (
        <>
          <p className="mt-1 text-[24px] leading-8 font-semibold tabular-nums">{bill.amount !== null ? rupiah(bill.amount) : "—"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusChip bill={bill} />
            {bill.status === "partly-paid" && bill.paid !== null && (
              <span className="text-small text-muted tabular-nums">
                {t("bills.paidOf", { paid: rupiah(bill.paid) })} · {t("bills.left", { amount: rupiah(billLeft(bill)) })}
              </span>
            )}
            {bill.nextDueAt !== null && <span className="text-small font-medium tabular-nums">{t("bills.nextDue", { date: f.dayMonth(bill.nextDueAt) })}</span>}
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-title font-medium text-muted">{t("bills.notBilled")}</p>
          <p className="mt-0.5 text-small text-muted">
            {deadline ? t("bills.expect", { date: f.dayMonth(dayMs(deadline.day)).replace(" ", "\u00a0") }) : t("bills.expectNoDate")}
          </p>
        </>
      )}
      {billedNow && deadline && (
        <div className="mt-3 border-t border-line pt-3 text-small">
          <p className="flex items-center justify-between gap-3">
            <span className="text-muted">{t("bills.deadline")}</span>
            <span className={cx("font-semibold tabular-nums", bill.status === "paid" && "font-normal text-muted")}>{f.dayMonth(dayMs(deadline.day))}</span>
          </p>
          {deadline.other && (
            <p className="mt-0.5 text-caption text-faint">
              {t(deadline.other.source === "six" ? "bills.otherSix" : "bills.otherItb", { date: f.dayMonth(dayMs(deadline.other.day)) })}
            </p>
          )}
        </div>
      )}
      {bill.instalments.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <h3 className="mb-1.5 text-caption font-medium text-muted">{t("bills.instalments")}</h3>
          <ul className="space-y-1 text-small">
            {bill.instalments.map((instalment, i) => (
              <li key={instalment.number} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
                <span className="flex items-center gap-1.5">
                  {paidInstalments[i] ? <Icons.CheckCircle className="size-3.5 text-success-fg" /> : <Icons.Circle className="size-3.5 text-faint" />}
                  {t("bills.instalment", { number: instalment.number })}
                </span>
                <span className="tabular-nums">{rupiah(instalment.amount)}</span>
                <span className="text-muted tabular-nums">{f.dayMonth(dayMs(instalment.dueDate))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
