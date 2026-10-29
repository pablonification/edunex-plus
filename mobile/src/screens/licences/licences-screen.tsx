// Settings › Tentang › Lisensi sumber terbuka (src/app/shell/licences.tsx): the open-source software
// the Android app is built with, how many, and a search; one row each (name, version, licence, a
// link to its source) whose licence text opens under it. The list loads when the Student opens the
// page, never with the app. Each row opens and closes on its own: opening one never closes another,
// which would pull the row the Student pressed, and the text they asked for, out of view.
import { FlashList } from "@shopify/flash-list";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useOpenLink } from "../../../../src/app/hooks";
import { useT } from "../../../../src/app/i18n";
import { findLicences, type Licence, licenceParagraphs } from "../../../../src/app/licences";
import { isWebLink } from "../../../../src/core/links";
import { Button, IconButton } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Notice } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, type, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { loadLicences } from "./load";

type Loaded = { list: readonly Licence[] } | "loading" | "failed";

const keyOf = (entry: Licence) => `${entry.name}@${entry.version ?? ""}`;

/** The rows that are open, with `key` opened, or closed if it was open. */
function toggled(open: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(open);
  if (!next.delete(key)) next.add(key);
  return next;
}

export function LicencesScreen() {
  const t = useT();
  const theme = useTheme();
  const [loaded, setLoaded] = useState<Loaded>("loading");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
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

  const header = (
    <View style={{ paddingTop: space[4], paddingBottom: space[3] }}>
      {list ? (
        <Text size="body" tone="muted">
          {t("licences.intro", { count: list.length })}
        </Text>
      ) : (
        <Skeleton width="80%" height={20} />
      )}
    </View>
  );

  return (
    <View testID="screen.licences" style={{ flex: 1, backgroundColor: theme.color.canvas }}>
      <TopBar title={t("licences.title")} />
      {/* The search stays in view over the rows scrolling under it. */}
      <View style={{ paddingHorizontal: space.page, paddingTop: space[3] }}>
        <View style={[styles.search, { backgroundColor: theme.color.fill }]}>
          <Icons.Search size={16} color={theme.color.faint} />
          <TextInput
            testID="input.licences"
            value={query}
            onChangeText={setQuery}
            placeholder={t("licences.search")}
            placeholderTextColor={theme.color.faint}
            accessibilityLabel={t("licences.search")}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={{ flex: 1, color: theme.color.fg, ...type.body, paddingVertical: 0 }}
          />
          {searching && list && (
            <Text size="small" tone="muted" tabular accessibilityLiveRegion="polite">
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
          extraData={open}
          renderItem={({ item, index }) => {
            const key = keyOf(item);
            return (
              <LicenceRow
                entry={item}
                first={index === 0}
                last={index === shown.length - 1}
                open={open.has(key)}
                onToggle={() => setOpen((was) => toggled(was, key))}
              />
            );
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <Text size="body" tone="muted" style={{ textAlign: "center", paddingVertical: space[8] }}>
              {t("search.noResults", { query: query.trim() })}
            </Text>
          }
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: space[10] }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </View>
  );
}

/** One piece of software: the row opens its licence text under it; the arrow beside it opens its source in the browser. */
function LicenceRow({ entry, first, last, open, onToggle }: { entry: Licence; first: boolean; last: boolean; open: boolean; onToggle: () => void }) {
  const t = useT();
  const theme = useTheme();
  const c = theme.color;
  const openLink = useOpenLink();
  const source = entry.source && isWebLink(entry.source) ? entry.source : null;
  return (
    <View
      style={{
        backgroundColor: c.surface,
        overflow: "hidden",
        borderColor: c.edge,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderTopWidth: first ? StyleSheet.hairlineWidth : 0,
        borderBottomWidth: last ? StyleSheet.hairlineWidth : 0,
        borderTopLeftRadius: first ? radius.xl : 0,
        borderTopRightRadius: first ? radius.xl : 0,
        borderBottomLeftRadius: last ? radius.xl : 0,
        borderBottomRightRadius: last ? radius.xl : 0,
      }}
    >
      {!first && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line }} />}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          testID={`row.licence.${entry.name}`}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          // Read as "zod · 4.6.5 · MIT".
          accessibilityLabel={factsLabel(entry.name, entry.version, entry.licence)}
          android_ripple={{ color: c.selected }}
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: space[2.5],
            minHeight: 52,
            paddingLeft: space[3.5],
            paddingRight: space[1],
          }}
        >
          <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
            <Icons.ChevronRight size={14} color={c.faint} />
          </View>
          <View style={{ flex: 1, minWidth: 0, paddingVertical: space[2] }}>
            <Text size="body" weight="medium" numberOfLines={1}>
              {entry.name}
            </Text>
            <Text size="small" tone="muted" numberOfLines={1}>
              {[entry.version, entry.licence].filter(Boolean).join("  ·  ")}
            </Text>
          </View>
        </Pressable>
        {source ? (
          <View style={{ paddingRight: space[1] }}>
            <IconButton label={t("licences.source", { name: entry.name })} onPress={() => openLink(source)}>
              <Icons.ArrowUpRight size={16} color={c.muted} />
            </IconButton>
          </View>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>
      {open && (
        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: c.line,
            backgroundColor: c.sunken,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
          }}
        >
          {entry.text !== undefined ? (
            <LicenceText text={entry.text} />
          ) : (
            <Text size="small" tone="muted">
              {entry.file ?? ""}
            </Text>
          )}
        </View>
      )}
    </View>
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
      style={{
        borderRadius: radius.xl,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.color.edge,
        backgroundColor: theme.color.surface,
        overflow: "hidden",
      }}
    >
      {[160, 112, 208, 144, 176, 128].map((width, i) => (
        <View
          key={width}
          style={[
            { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line },
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
  search: { flexDirection: "row", alignItems: "center", gap: space[2], height: 44, borderRadius: radius.lg, paddingHorizontal: space[3] },
});
