// Rencana studi › UKT on the phone (src/app/screens/plan/bills.tsx, S15; round 2, v4): bills, instalments and
// deadlines in one column. View only: the app never pays.
// 1. An overdue bill, said plainly in red at the top.
// 2. One card for this semester's bill, led by what's still to pay, big (or "Lunas"), with the deadline to follow a
//    quiet line under it (SIX's last day and ITB's calendar's, the earlier one), and SIX's bill page as the one button
//    while there's something to pay.
// 3. Its instalments, then next semester's bill as a row (not billed yet: by when it will be due).
// 4. Every term's bill as a row: the term, SIX's last day, the amount, and a pill only on one that isn't paid.
import { View } from "react-native";
import { useThisTerm } from "../../../../src/app/deadlines";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { type BillUrgency, billLeft, billUrgency, nextTerm, rupiah, uktDeadline } from "../../../../src/core/academic";
import { SIX_WEB, sixPageOf } from "../../../../src/core/links";
import type { Bill } from "../../../../src/core/models";
import { SixPageNote } from "../../parts/six-page-note";
import { BigButton } from "../../ui/big-button";
import { Rise } from "../../ui/expressive";
import { Group, GroupRow, Heading, IconTile, Panel, Pill, type PillTone } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { font, space, useTheme } from "../../ui/theme";
import { useTermYears } from "./projection";
import { SixNeeded } from "./six-needed";

const RISE = "plan-bills";

/** A bill's state as a pill: red once overdue, amber when due soon, green when paid, quiet otherwise. */
const TONE: Record<BillUrgency, PillTone> = {
  paid: "ok",
  "not-billed": "plain",
  unknown: "plain",
  overdue: "red",
  soon: "amber",
  due: "plain",
  "no-date": "plain",
};

function StatusPill({ bill }: { bill: Bill }) {
  const t = useT();
  const now = useNow();
  const urgency = billUrgency(bill, now);
  return <Pill tone={TONE[urgency]}>{urgency === "overdue" ? t("bills.status.overdue") : t(`bills.status.${bill.status}`)}</Pill>;
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
  const theme = useTheme();
  const v = theme.v4;
  const termYears = useTermYears();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  if (!bills)
    return (
      <SixNeeded
        datasets={["six.bills"]}
        icon={<Icons.Wallet size={20} color={theme.color.muted} />}
        title={t("bills.needSix")}
        body={t("bills.needSixBody")}
      />
    );
  const billed = bills.filter((b) => b.status !== "not-billed");
  const current = (term && bills.find((b) => b.term === term)) || billed.at(-1);
  // SIX lists a term's row only once the term is set up: until then it isn't billed either.
  const next = current && (bills.find((b) => b.term === nextTerm(current.term)) ?? notBilled(nextTerm(current.term)));
  const overdue = bills.filter((b) => billUrgency(b, now) === "overdue");
  const allPaid = billed.length > 0 && billed.every((b) => b.status === "paid");
  let rise = 0;
  return (
    <View style={{ gap: space[3] }}>
      {overdue.map((bill) => (
        <Panel
          key={bill.term}
          tint={v.redBg}
          accessibilityRole="alert"
          style={{ padding: space[4], flexDirection: "row", gap: space[3], alignItems: "flex-start" }}
        >
          <Icons.AlertTriangle size={20} color={v.redFg} weight="bold" />
          <Text size="bodyLarge" weight="medium" style={{ color: v.redFg, flex: 1 }}>
            {t("bills.overdue", { term: termYears(bill.term), date: f.dayMonth(bill.nextDueAt!), amount: rupiah(billLeft(bill)) })}
          </Text>
        </Panel>
      ))}
      <SixPageNote datasets={["six.bills"]} />
      {current && (
        <Rise screen={RISE} index={rise++}>
          <Lead bill={current} />
        </Rise>
      )}
      {current && current.instalments.length > 0 && (
        <Rise screen={RISE} index={rise++}>
          <Instalments bill={current} />
        </Rise>
      )}
      {next && (
        <Rise screen={RISE} index={rise++}>
          <NextTerm bill={next} />
        </Rise>
      )}
      {/* "Lunas" on every row would bury the one that isn't: a paid row stays quiet, and all paid is said once. */}
      <Rise screen={RISE} index={rise++}>
        <View testID="section.billsHistory">
          <Heading trailing={allPaid ? <Pill tone="ok">{t("bills.allPaid")}</Pill> : undefined}>{t("bills.history")}</Heading>
          <Group>
            {[...billed].reverse().map((bill, i) => (
              <GroupRow
                key={bill.term}
                first={i === 0}
                testID={`row.bill.${bill.term}`}
                title={termYears(bill.term)}
                // "Batas bayar di SIX 15 Jan 2026": a date on its own under a term reads as when it was paid.
                meta={factsLabel(
                  bill.dueDate && t("mobile.bills.due", { date: `${f.dayMonth(dayMs(bill.dueDate))} ${bill.dueDate.slice(0, 4)}` }),
                  bill.instalments.length > 0 && t("bills.inInstalments", { count: bill.instalments.length }),
                )}
                trailing={
                  <View style={{ alignItems: "flex-end", gap: space[1] }}>
                    <Text size="bodyLarge" weight="medium" tabular style={{ color: v.fg }}>
                      {bill.amount !== null ? rupiah(bill.amount) : "-"}
                    </Text>
                    {bill.status !== "paid" && <StatusPill bill={bill} />}
                  </View>
                }
              />
            ))}
          </Group>
        </View>
      </Rise>
    </View>
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

function useDeadline(bill: Bill) {
  const calendar = useDataset("itb.calendar");
  return deadlineOf(bill, uktDeadline(calendar, bill.term)?.lastDay ?? null);
}

/** The leading card: this semester's bill, what's left to pay (or "Lunas") big, the deadline to follow under it. */
function Lead({ bill }: { bill: Bill }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const now = useNow();
  const termYears = useTermYears();
  const student = useDataset("six.student");
  const deadline = useDeadline(bill);
  const billedNow = bill.status !== "not-billed";
  const paid = bill.status === "paid";
  const overdue = billUrgency(bill, now) === "overdue";
  const big = (text: string, color: string, size = 40) => (
    <Text style={{ fontFamily: font.display.extrabold, fontSize: size, lineHeight: Math.round(size * 1.15), letterSpacing: -1, color }} tabular>
      {text}
    </Text>
  );
  // What's left: the whole bill, or the rest of one partly paid.
  const due = bill.status === "partly-paid" ? billLeft(bill) : bill.amount;
  const deadlineLine = deadline ? t("mobile.bills.deadlineOn", { date: f.dayMonth(dayMs(deadline.day)) }) : null;
  // Which of two deadlines to follow matters only while there's something to pay: once paid, the other is only a fact.
  const other =
    deadline?.other &&
    (paid
      ? t(deadline.other.source === "six" ? "mobile.bills.paidOtherSix" : "mobile.bills.paidOtherItb", { date: f.dayMonth(dayMs(deadline.other.day)) })
      : t(deadline.other.source === "six" ? "bills.otherSix" : "bills.otherItb", { date: f.dayMonth(dayMs(deadline.other.day)) }));
  return (
    <Panel testID={`card.bill.${bill.term}`} style={{ padding: space[5], gap: space[2] }}>
      <Text size="bodyMedium" style={{ color: v.muted }}>
        {factsLabel(t("bills.thisTerm"), termYears(bill.term))}
      </Text>
      {!billedNow ? (
        <>
          {big(t("bills.notBilled"), v.muted, 28)}
          <Text size="bodyMedium" style={{ color: v.muted }}>
            {deadline ? t("bills.expect", { date: f.dayMonth(dayMs(deadline.day)).replace(" ", " ") }) : t("bills.expectNoDate")}
          </Text>
        </>
      ) : paid ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Icons.CheckCircle size={32} color={v.okFg} weight="fill" />
            {big(t("bills.status.paid"), v.okFg)}
          </View>
          <Text size="bodyLarge" tabular style={{ color: v.fg2 }}>
            {factsLabel(bill.amount !== null ? rupiah(bill.amount) : null, deadlineLine)}
          </Text>
          {other ? (
            <Text size="bodyMedium" style={{ color: v.muted }}>
              {other}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          {big(due !== null ? rupiah(due) : "-", overdue ? v.redFg : v.fg, 36)}
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
            <StatusPill bill={bill} />
            {bill.status === "partly-paid" && bill.paid !== null && (
              <Text size="bodyMedium" tabular style={{ color: v.muted }}>
                {factsLabel(t("bills.paidOf", { paid: rupiah(bill.paid) }), bill.amount !== null && rupiah(bill.amount))}
              </Text>
            )}
          </View>
          <Text size="bodyLarge" weight="medium" tabular style={{ color: overdue ? v.redFg : v.fg }}>
            {bill.nextDueAt !== null ? t("bills.nextDue", { date: f.dayMonth(bill.nextDueAt) }) : deadlineLine}
          </Text>
          {bill.nextDueAt !== null && deadlineLine && f.dayMonth(bill.nextDueAt) !== f.dayMonth(dayMs(deadline!.day)) ? (
            <Text size="bodyMedium" tabular style={{ color: v.muted }}>
              {deadlineLine}
            </Text>
          ) : null}
          {other ? (
            <Text size="bodyMedium" style={{ color: v.muted }}>
              {other}
            </Text>
          ) : null}
          <View style={{ marginTop: space[2] }}>
            <BigButton
              icon={<Icons.ArrowUpRight size={18} color={v.onBrand} />}
              onPress={() => open(student ? sixPageOf("six.bills", student) : SIX_WEB)}
              testID="action.bills.openSix"
            >
              {t("mobile.bills.openSix")}
            </BigButton>
          </View>
        </>
      )}
    </Panel>
  );
}

/** This semester's instalments: each covered by what's paid (a check), its amount and its date. */
function Instalments({ bill }: { bill: Bill }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  // Each instalment covered by what's paid; unknown (null) when SIX writes the payment in a way the app can't read yet.
  const paidInstalments = (() => {
    let paid = bill.paid ?? 0;
    return bill.instalments.map((i) => {
      const covered = paid >= i.amount;
      paid -= i.amount;
      return bill.status === "unknown" ? null : covered;
    });
  })();
  return (
    <View>
      <Heading first>{t("bills.instalments")}</Heading>
      <Group>
        {bill.instalments.map((instalment, i) => (
          <GroupRow
            key={instalment.number}
            first={i === 0}
            leading={
              <IconTile
                tone={paidInstalments[i] ? "ok" : "plain"}
                icon={(color) =>
                  paidInstalments[i] === null ? (
                    <Icons.Info size={22} color={color} />
                  ) : paidInstalments[i] ? (
                    <Icons.Check size={22} color={color} weight="bold" />
                  ) : (
                    <Icons.Circle size={20} color={color} />
                  )
                }
              />
            }
            title={t("bills.instalment", { number: instalment.number })}
            meta={f.dayMonth(dayMs(instalment.dueDate))}
            trailing={
              <Text size="bodyLarge" weight="medium" tabular style={{ color: v.fg }}>
                {rupiah(instalment.amount)}
              </Text>
            }
          />
        ))}
      </Group>
    </View>
  );
}

/** Next semester's bill as one row: billed (its amount and state), or not yet (by when it will be due). */
function NextTerm({ bill }: { bill: Bill }) {
  const t = useT();
  const f = useFormat();
  const termYears = useTermYears();
  const deadline = useDeadline(bill);
  return (
    <Group testID={`card.bill.${bill.term}`}>
      <GroupRow
        first
        leading={<IconTile tone="plain" icon={(color) => <Icons.Wallet size={22} color={color} />} />}
        title={t("bills.nextTerm")}
        meta={factsLabel(
          termYears(bill.term),
          bill.amount !== null && rupiah(bill.amount),
          deadline && t("mobile.bills.deadlineOn", { date: f.dayMonth(dayMs(deadline.day)) }),
        )}
        trailing={<StatusPill bill={bill} />}
      />
    </Group>
  );
}
