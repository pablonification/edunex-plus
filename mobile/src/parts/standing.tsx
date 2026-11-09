// Akademik's and Nilai's leading card, inside its Panel: one focal point, the IPK, big and counting up once; then the
// SKS passed as a smaller figure over a thin bar of the SKS needed to graduate ("125 dari 144", the bar 125/144). Two
// figures the same size read as two answers of the same weight (round 3's judge); the bar shows how far along, so no
// line says it again. `aside` sits on the IPK's baseline (Nilai's predicate, as plain words), `children` under the IPK
// (Nilai's last semester's IP).
import type { ReactNode } from "react";
import { View } from "react-native";
import { useLang, useT } from "../../../src/app/i18n";
import { CountUp } from "../ui/expressive";
import { Figure, FigureDash, FigureLabel } from "../ui/group";
import { Meter } from "../ui/meter";
import { Text } from "../ui/text";
import { font, space, useTheme } from "../ui/theme";

export function StandingFigures({
  id,
  ipk,
  sks,
  need,
  aside,
  children,
}: {
  /** The figures' count-up ids: each screen's own. */
  id: "academic" | "grades";
  ipk: number | null;
  sks: number | null;
  need: number;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const v = useTheme().v4;
  const of = t("mobile.academic.sksOf", { need });
  return (
    <View style={{ gap: space[4] }}>
      <View style={{ gap: space[1] }}>
        <FigureLabel>{t("grades.chart.ipk")}</FigureLabel>
        <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: space[3] }}>
          {ipk === null ? <FigureDash /> : <Figure id={`${id}.ipk`} value={ipk} decimals={2} comma={lang === "id"} />}
          {aside}
        </View>
        {children}
      </View>
      <View style={{ gap: space[2] }}>
        {/* The label at the start, the figure at the end, wrapping under it at a big font size. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: space[3] }}>
          <FigureLabel>{t("grades.sksPassed")}</FigureLabel>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[1] }}>
            {sks === null ? (
              <Text size="titleMedium" style={{ color: v.fg }}>
                -
              </Text>
            ) : (
              <CountUp id={`${id}.sks`} value={sks} style={{ fontFamily: font.display.bold, fontSize: 20, lineHeight: 26, color: v.fg }} />
            )}
            <Text size="bodyMedium" style={{ color: v.muted }}>
              {of}
            </Text>
          </View>
        </View>
        {sks !== null && need > 0 && <Meter value={sks / need} label={`${t("grades.sksPassed")} ${sks} ${of}`} />}
      </View>
    </View>
  );
}
