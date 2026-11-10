// Semua layanan (direction B), behind Beranda's "Lainnya": a search field, then every service the app has in named
// groups (Harian, Akademik, Aplikasi), four across, the same solid tiles as Beranda's, each service once. Typing
// narrows the groups to the services whose name holds what was typed; a group with none left goes. The tiles that
// answer on Beranda (Nilai, UKT, KRS) answer here too, from the same hooks (./tags.ts). The field is quiet: a hairline
// on the page, not a filled bar, so the tiles lead.
import { useState } from "react";
import { TextInput, View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { BHeading, ServiceRow, ServiceTile, useB } from "../../ui/b";
import { Fluent } from "../../ui/fluent";
import { useBottomInset } from "../../ui/insets";
import { Page } from "../../ui/layout";
import { Arrive } from "../../ui/moves";
import { Text, useFieldColors } from "../../ui/text";
import { space } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { SERVICE_GROUPS, type Service } from "./list";
import { useOpenService } from "./open";
import { useServiceTags } from "./tags";

/** A group's services in rows of four. */
function rowsOf(services: readonly Service[]): Service[][] {
  const rows: Service[][] = [];
  for (let i = 0; i < services.length; i += 4) rows.push(services.slice(i, i + 4));
  return rows;
}

export function ServicesScreen() {
  const t = useT();
  const b = useB();
  const open = useOpenService();
  const field = useFieldColors();
  const tags = useServiceTags();
  const bottom = useBottomInset();
  const [query, setQuery] = useState("");
  const asked = query.trim().toLowerCase();
  const groups = SERVICE_GROUPS.map((group) => ({
    ...group,
    services: asked ? group.services.filter((service) => t(service.label).toLowerCase().includes(asked)) : group.services,
  })).filter((group) => group.services.length > 0);
  return (
    <Page testID="screen.services" header={<TopBar title={t("mobile.services.title")} />} background={b.page} keyboardShouldPersistTaps="handled">
      <View
        style={{
          height: 48,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: b.line,
          backgroundColor: b.page,
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingHorizontal: space[4],
          marginTop: space[1],
        }}
      >
        <Fluent name="Search20Regular" color={b.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("mobile.services.search")}
          placeholderTextColor={b.muted}
          accessibilityLabel={t("mobile.services.search")}
          returnKeyType="search"
          autoCorrect={false}
          testID="services.search"
          style={{ flex: 1, height: 48, color: b.fg, fontSize: 16, paddingVertical: 0 }}
          {...field}
        />
      </View>
      {/* The groups arrive once, on the page's first showing in this run; a search's groups are simply there. */}
      {groups.map((group, index) => (
        <Arrive key={group.id} list="services" index={index}>
          <View testID={`section.services.${group.id}`} style={{ marginTop: space[6] }}>
            <BHeading>{t(group.title)}</BHeading>
            <View style={{ gap: space[3] }}>
              {rowsOf(group.services).map((row) => (
                <ServiceRow key={row[0]!.id} count={row.length} top>
                  {row.map((service) => (
                    <ServiceTile
                      key={service.id}
                      icon={service.icon}
                      tone={service.tone}
                      label={t(service.label)}
                      tag={tags[service.id] ?? undefined}
                      lines={2}
                      onPress={() => open(service)}
                      testID={`action.service.${service.id}`}
                    />
                  ))}
                </ServiceRow>
              ))}
            </View>
          </View>
        </Arrive>
      ))}
      {/* The last row's names clear of the phone's own bar: its height and a row's gap after the last group. Every name is
          one line at the usual font size; at a bigger one it may take two, both whole. */}
      {groups.length === 0 && (
        <Text size="bodyLarge" style={{ color: b.muted, textAlign: "center", marginTop: space[8] }}>
          {t("mobile.services.none", { query: query.trim() })}
        </Text>
      )}
      <View style={{ height: space[6] + bottom }} />
    </Page>
  );
}
