// Settings › Tentang › Lisensi sumber terbuka (src/app/shell/licences.tsx; round 2, v4): the open-source
// software the Android app is built with, how many, and a search; one row each in one white card on v4's
// grey page (the name, its version and licence as the one meta line). A row is one target: its sheet holds
// the licence text and the link to its source. The list loads when the Student opens the page, never with
// the app.
import { FlashList } from "@shopify/flash-list";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useOpenLink } from "../../../../src/app/hooks";
import { useT } from "../../../../src/app/i18n";
import { findLicences, type Licence, licenceParagraphs } from "../../../../src/app/licences";
import { isWebLink } from "../../../../src/core/links";
import { Button } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { CARD_RADIUS, GroupRow } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { useBottomInset } from "../../ui/insets";
import { factsLabel, Notice } from "../../ui/layout";
import { Sheet } from "../../ui/sheet";
import { Text, useFieldColors } from "../../ui/text";
import { space, type, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { loadLicences } from "./load";

type Loaded = { list: readonly Licence[] } | "loading" | "failed";

const keyOf = (entry: Licence) => `${entry.name}@${entry.version ?? ""}`;

export function LicencesScreen() {
  const fieldColors = useFieldColors();
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
  const bottom = useBottomInset();
  const [loaded, setLoaded] = useState<Loaded>("loading");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Licence | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is "Coba lagi"; it changing is what reads the list again
  useEffect(() => {
    let current = true;
    setLoaded("loading");
    loadLicences().then(
      (list) => current && setLoaded({ list }),
      () => current && setLoaded("failed"),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const list = typeof loaded === "object" ? loaded.list : null;
  const shown = useMemo(() => (list ? findLicences(list, query) : []), [list, query]);
  const searching = query.trim() !== "";

  // What the list is, before the search, as the desktop's.
  const intro = list ? (
    <Text size="bodyMedium" style={{ color: v.muted }}>
      {t("licences.intro", { count: list.length })}
    </Text>
  ) : loaded === "loading" ? (
    <Skeleton width="80%" height={19} />
  ) : null;
  const header = <View style={{ height: space[3] }} />;

  return (
    <View testID="screen.licences" style={{ flex: 1, backgroundColor: v.page }}>
      <TopBar v4 title={t("licences.title")} />
      {/* The intro, then the search, both in view over the rows scrolling under them. */}
      <View style={{ paddingHorizontal: space.page, paddingTop: space[3], gap: space[3] }}>
        {intro}
        <View style={[styles.search, { backgroundColor: v.card }]}>
          <Icons.Search size={20} color={v.muted} />
          <TextInput
            {...fieldColors}
            testID="input.licences"
            value={query}
            onChangeText={setQuery}
            placeholder={t("licences.search")}
            placeholderTextColor={v.muted}
            accessibilityLabel={t("licences.search")}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={{ flex: 1, color: v.fg, ...type.body, paddingVertical: 0 }}
          />
          {searching && list && (
            <Text size="bodyMedium" tabular accessibilityLiveRegion="polite" style={{ color: v.muted }}>
              {t("search.count", { count: shown.length })}
            </Text>
          )}
        </View>
      </View>
      {loaded === "failed" ? (
        <View style={{ padding: space.page }} accessibilityLiveRegion="polite">
          <Notice
            tone="warning"
            title={t("licences.failed")}
            action={
              <Button size="sm" onPress={() => setAttempt((n) => n + 1)} testID="action.tryAgain">
                {t("action.tryAgain")}
              </Button>
            }
          />
        </View>
      ) : !list ? (
        <View style={{ paddingHorizontal: space.page }}>
          {header}
          <Loading />
        </View>
      ) : (
        <FlashList
          data={shown as Licence[]}
          keyExtractor={keyOf}
          renderItem={({ item, index }) => <LicenceRow entry={item} first={index === 0} last={index === shown.length - 1} onPress={() => setPicked(item)} />}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text size="bodyLarge" style={{ color: v.muted, textAlign: "center", paddingVertical: space[8] }}>
              {t("search.noResults", { query: query.trim() })}
            </Text>
          }
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: space[10] + bottom }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
      <LicenceSheet entry={picked} onClose={() => setPicked(null)} />
    </View>
  );
}

/** One piece of software as a row of the list's one white card: its name, version and licence. It opens its sheet. */
function LicenceRow({ entry, first, last, onPress }: { entry: Licence; first: boolean; last: boolean; onPress: () => void }) {
  const v = useTheme().v4;
  return (
    <View
      style={{
        backgroundColor: v.card,
        overflow: "hidden",
        borderTopLeftRadius: first ? CARD_RADIUS : 0,
        borderTopRightRadius: first ? CARD_RADIUS : 0,
        borderBottomLeftRadius: last ? CARD_RADIUS : 0,
        borderBottomRightRadius: last ? CARD_RADIUS : 0,
      }}
    >
      <GroupRow
        first={first}
        // A long name wraps instead of being cut off.
        title={entry.name}
        meta={factsLabel(entry.version, entry.licence)}
        onPress={onPress}
        accessibilityRole="button"
        // Read as "zod · 4.6.5 · MIT".
        accessibilityLabel={factsLabel(entry.name, entry.version, entry.licence)}
        testID={`row.licence.${entry.name}`}
      />
    </View>
  );
}

/** A piece of software's sheet: its licence text, and its source in the browser as the one button. */
function LicenceSheet({ entry, onClose }: { entry: Licence | null; onClose: () => void }) {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
  const openLink = useOpenLink();
  const source = entry?.source && isWebLink(entry.source) ? entry.source : null;
  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      title={entry?.name}
      testID="sheet.licence"
      background={v.card}
      footer={
        source ? (
          <Button
            variant="tonal"
            icon={<Icons.ArrowUpRight size={18} color={theme.color.onSecondaryContainer} />}
            onPress={() => openLink(source)}
            testID="action.licenceSource"
          >
            {t("licences.source", { name: entry!.name })}
          </Button>
        ) : undefined
      }
    >
      {entry ? (
        <View style={{ gap: space[3], paddingBottom: space[2] }}>
          <Text size="bodyMedium" style={{ color: v.muted }}>
            {factsLabel(entry.version, entry.licence)}
          </Text>
          {entry.text !== undefined ? (
            <LicenceText text={entry.text} />
          ) : (
            <Text size="bodyMedium" style={{ color: v.muted }}>
              {entry.file ?? ""}
            </Text>
          )}
        </View>
      ) : null}
    </Sheet>
  );
}

/** A licence's own words, in paragraphs that fit the column; a rule between the licences of one entry's files. */
function LicenceText({ text }: { text: string }) {
  const theme = useTheme();
  const paragraphs = useMemo(() => licenceParagraphs(text), [text]);
  return (
    <View style={{ gap: space[2] }}>
      {paragraphs.map((paragraph, i) =>
        paragraph === "---" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the paragraphs of one text, in their order; they have nothing else to be told apart by
          <View key={i} style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.color.line }} />
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the paragraphs of one text, in their order; they have nothing else to be told apart by
          <Text key={i} size="caption" tone="muted" selectable>
            {paragraph}
          </Text>
        ),
      )}
    </View>
  );
}

/** Rows in the shape of the list while it loads. */
function Loading() {
  const theme = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ borderRadius: CARD_RADIUS, backgroundColor: theme.v4.card, overflow: "hidden" }}
    >
      {[160, 112, 208, 144, 176, 128].map((width, i) => (
        <View
          key={width}
          style={[
            { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
            i > 0 && { borderTopWidth: 1, borderTopColor: theme.v4.line },
          ]}
        >
          <Skeleton width={width} />
          <View style={{ flex: 1 }} />
          <Skeleton width={48} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 48, borderRadius: 24, paddingHorizontal: space[4] },
});
