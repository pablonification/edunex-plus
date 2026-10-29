// The Modul tab on the phone (S17, src/app/screens/course/modules.tsx): no two panes. First Edunex's
// table of contents ("Daftar isi": each Edunex course's course-wide items as its Introduction, then
// every module Edunex lists by Edunex's own number, the ones not opened yet greyed; the joint
// class's after the class's own). Tapping one opens it on the same screen: its Tasks and materials,
// drawn the way Edunex draws them (notes and pictures in full, a link by its own words, every other
// kind with the one action that fits it), each with who posted it and when; "Daftar isi" (and
// Android's Back) goes back to the list. Files download once and open in the phone's own apps
// (../../parts/files.tsx); highlights and page notes stay on the desktop (A14).

import { useFocusEffect } from "expo-router";
import { ShareNetworkIcon } from "phosphor-react-native/src/icons/ShareNetwork";
import { type ReactNode, useCallback } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from "react-native";
import { useOpenExternal, useOpenLink } from "../../../../src/app/hooks";
import { type Format, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { type CoursePage, isOpenTask } from "../../../../src/app/screens/course/data";
import {
  edunexMaterialUrl,
  type MaterialKind,
  materialAction,
  materialKind,
  newestWithContent,
  uploadExtension,
  VICON_PROVIDERS,
} from "../../../../src/core/course-materials";
import { linkHost } from "../../../../src/core/links";
import type { Material } from "../../../../src/core/models";
import { taskStatus } from "../../../../src/core/tasks";
import { useEdunexFile } from "../../parts/files";
import { LecturerHtml } from "../../parts/lecturer-html";
import { Button, IconButton } from "../../ui/controls";
import { EmptyState, Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { TaskRow } from "../tasks/rows";
import { contentsOf, countFacts, dayAndTime, type Entry, entrySlug, latest, WEEK } from "./contents";

/**
 * `module`: the Edunex module shown (picked here, or asked for by search, an alert or a Task's way
 * up), or a course's Introduction (introModule); without one, the table of contents.
 */
export function ModulesTab({ page, module, onPick, onList }: { page: CoursePage; module?: number; onPick: (module: number) => void; onList: () => void }) {
  const t = useT();
  const theme = useTheme();
  const entries = contentsOf(page, t);
  const opened = entries.filter((e) => !e.unopened);
  // A Task's module the contents don't list as opened (Edunex's outline leaves it out): where its Tasks are, the Introduction.
  const named =
    module === undefined ? undefined : (opened.find((e) => e.id === String(module)) ?? opened.find((e) => e.tasks.some((task) => task.moduleId === module)));

  if (!entries.length) return <EmptyState icon={<Icons.BookOpen size={20} color={theme.color.muted} />} title={t("course.noMaterials")} />;
  if (named) return <ModulePage entry={named} anyContent={entries.some((e) => e.tasks.length || e.materials.length)} onList={onList} />;
  return <Contents entries={entries} onPick={onPick} />;
}

function Contents({ entries, onPick }: { entries: Entry[]; onPick: (module: number) => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const c = theme.color;
  const opened = entries.filter((e) => !e.unopened);
  // The newest with something in it, the one the desktop opens by itself: marked here, so it's the first to look at.
  const newest = opened[newestWithContent(opened.map((e) => ({ hasContent: e.tasks.length + e.materials.length > 0, at: latest(e), parent: e.parent })))];
  const firstParent = entries.findIndex((e) => e.parent);
  // Said once per list rather than on every greyed row, so grey isn't the only sign; each row says it to a screen reader.
  const unopenedNote = (
    <Text size="caption" tone="faint" style={{ marginBottom: space[2] }} importantForAccessibility="no">
      {t("course.unopenedNote")}
    </Text>
  );
  const heading = (text: string, top: boolean) => (
    <Text size="small" weight="semibold" tone="muted" accessibilityRole="header" style={{ marginTop: top ? 0 : space[6], marginBottom: space[2] }}>
      {text}
    </Text>
  );
  const groups = firstParent === -1 ? [entries] : [entries.slice(0, firstParent), entries.slice(firstParent)];

  return (
    <View testID="list.course.contents">
      {groups.map((group, g) => (
        <View key={g === 0 ? "own" : "joint"}>
          {heading(g === 0 ? t("course.contents") : t("course.jointClass"), g === 0)}
          {group.some((e) => e.unopened) && unopenedNote}
          <View style={[styles.list, { borderColor: c.edge, backgroundColor: c.surface }]}>
            {group.map((entry, i) => {
              const divider = i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line } : null;
              const label = entry.intro ? "" : t("course.module", { no: entry.label ?? "" });
              const whose = entry.parent ? t("course.jointClass") : null;
              if (entry.unopened) {
                // A date already past while it's still closed would read as "opened on": then it's just greyed.
                const opens = entry.opensAt !== null && entry.opensAt > now ? t("course.opensOn", { when: dayAndTime(f, entry.opensAt) }) : "";
                // As on Edunex: listed, greyed, and nothing to open until the lecturer opens it.
                return (
                  <View
                    key={entry.id}
                    testID={`row.module.${entrySlug(t, entry)}`}
                    accessible
                    accessibilityLabel={factsLabel(label, opens, `${entry.title}, ${t("course.unopened")}`, whose)}
                    style={[styles.entry, { paddingVertical: space[2.5] }, divider]}
                  >
                    <Meta tone="faint" size="caption">
                      {label}
                      {opens}
                    </Meta>
                    <Text size="small" tone="faint" numberOfLines={2}>
                      {entry.title}
                    </Text>
                  </View>
                );
              }
              const open = entry.tasks.filter((task) => isOpenTask(task, now)).length;
              const empty = entry.tasks.length + entry.materials.length === 0;
              const fresh = !empty && (latest(entry) ?? 0) > now - WEEK;
              const facts = empty ? [] : countFacts(t, entry);
              return (
                <Pressable
                  key={entry.id}
                  testID={`row.module.${entrySlug(t, entry)}`}
                  accessibilityRole="button"
                  accessibilityLabel={factsLabel(
                    label,
                    ...facts,
                    entry.title,
                    whose,
                    open > 0 ? t("course.openTasks", { count: open }) : null,
                    fresh ? t("course.new") : null,
                  )}
                  onPress={() => onPick(Number(entry.id))}
                  android_ripple={{ color: c.selected }}
                  style={[
                    styles.entry,
                    { flexDirection: "row", alignItems: "center", gap: space[3] },
                    divider,
                    entry === newest && { backgroundColor: c.sunken },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* Edunex's own label above the title ("Modul 7"), then what's in it. */}
                    <Meta tone="faint" size="caption">
                      {label}
                      {facts}
                    </Meta>
                    <Text size={empty ? "small" : "body"} tone={empty ? "muted" : "fg"} weight={empty ? "regular" : "medium"} numberOfLines={2}>
                      {entry.title}
                    </Text>
                  </View>
                  {(open > 0 || fresh) && (
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      {open > 0 && <Tag tone="warning">{t("course.openTasks", { count: open })}</Tag>}
                      {fresh && <Tag tone="info">{t("course.new")}</Tag>}
                    </View>
                  )}
                  <Icons.ChevronRight size={16} color={c.faint} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** One module (or a course's Introduction), on its own: its Tasks, then its materials. */
function ModulePage({ entry, anyContent, onList }: { entry: Entry; anyContent: boolean; onList: () => void }) {
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  // Android's Back goes to the table of contents first, as the button at the top does: only while the course is the
  // screen in front, so Back from a Task opened here closes the Task.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        onList();
        return true;
      });
      return () => sub.remove();
    }, [onList]),
  );
  return (
    <View testID={`page.module.${entry.id}`}>
      <View style={{ marginLeft: -space[3], marginBottom: space[3], flexDirection: "row" }}>
        <Button variant="ghost" size="sm" icon={<Icons.ChevronLeft size={16} color={theme.color.muted} />} onPress={onList} testID="action.courseContents">
          {t("course.contents")}
        </Button>
      </View>
      <Meta size="small">
        <Text size="small" weight="semibold" tone="muted">
          {entry.intro ? t("course.courseWide") : t("course.module", { no: entry.label ?? "" })}
        </Text>
        {entry.parent ? t("course.jointClass") : ""}
      </Meta>
      <Text size="heading" weight="semibold" accessibilityRole="header" style={{ marginTop: space[1], marginBottom: space[5], letterSpacing: -0.3 }}>
        {entry.title}
      </Text>
      {entry.tasks.length === 0 && entry.materials.length === 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icons.Inbox size={16} color={theme.color.muted} />
          <Text size="body" tone="muted">
            {t(anyContent ? "course.moduleEmpty" : "course.noMaterials")}
          </Text>
        </View>
      ) : (
        <View style={{ gap: space[6] }}>
          {entry.tasks.length > 0 && (
            <View>
              <Text size="small" weight="semibold" tone="muted" style={{ marginBottom: space[2] }}>
                {t("course.tasks")}
              </Text>
              <View style={[styles.list, { borderColor: theme.color.edge, backgroundColor: theme.color.surface }]}>
                {entry.tasks.map((task, i) => (
                  <View key={task.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line } : null}>
                    <TaskRow task={task} status={taskStatus(task, now)} meta="none" />
                  </View>
                ))}
              </View>
            </View>
          )}
          {entry.materials.length > 0 && (
            <View>
              <Text size="small" weight="semibold" tone="muted" style={{ marginBottom: space[2] }}>
                {t("course.materials")}
              </Text>
              <View style={[styles.list, { borderColor: theme.color.edge, backgroundColor: theme.color.surface }]}>
                {entry.materials.map((material, i) => (
                  <View key={material.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line } : null}>
                    <MaterialRow material={material} />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const KIND_ICON: Record<MaterialKind, (typeof Icons)[keyof typeof Icons]> = {
  pdf: Icons.FileText,
  vicon: Icons.Video,
  note: Icons.StickyNote,
  video: Icons.Video,
  audio: Icons.FileText,
  link: Icons.Link,
  file: Icons.Paperclip,
  image: Icons.Image,
  page: Icons.Globe,
  interactive: Icons.Layers,
  other: Icons.BookOpen,
};

/** `"` and `<` kept out of a picture's address, for the one-picture HTML an image material is drawn from. */
const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function MaterialRow({ material }: { material: Material }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const c = theme.color;
  const openExternal = useOpenExternal();
  const openLink = useOpenLink();
  const kind = materialKind(material.type);
  const action = materialAction(material);
  const Icon = KIND_ICON[kind];
  const icon = (
    <View style={[styles.icon, { backgroundColor: c.fill }]}>
      <Icon size={16} color={c.muted} />
    </View>
  );

  // Notes and pictures are read right here, in full, as on Edunex: the title, what the lecturer posted, and who and when.
  if (action.kind === "note" || action.kind === "image")
    return (
      <View testID={`row.material.${material.id}`} style={[styles.material, { alignItems: "flex-start" }]}>
        {icon}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="body" weight="medium" style={{ paddingTop: 5 }}>
            {material.title}
          </Text>
          <View style={{ marginTop: space[2] }}>
            {action.kind === "image" ? (
              // The picture through the same reader as a note's pictures (Edunex's storage, read in by the host).
              <LecturerHtml html={`<img src="${attr(action.url)}">`} pictureAlt={material.title} />
            ) : action.html ? (
              <LecturerHtml html={action.html} />
            ) : (
              <Text size="body" tone="muted">
                {t("note.empty")}
              </Text>
            )}
          </View>
          <Credits material={material} f={f} />
        </View>
      </View>
    );

  const size = material.sizeBytes ? f.fileSize(material.sizeBytes) : null;
  const upload = uploadExtension(material.type);
  const where = action.kind === "open" ? linkHost(action.url) : null;
  // What it is ("ZIP"; "Kelas online", "Microsoft Teams"), then its size or where it goes.
  let what: string[];
  if (kind === "pdf") what = [t("material.pdf")];
  else if (upload) what = [upload.slice(1).toUpperCase()];
  else if (kind === "vicon") what = [t("material.vicon"), ...(VICON_PROVIDERS[material.type] ? [VICON_PROVIDERS[material.type]!] : [])];
  else what = [t(`material.${kind}`)];
  const facts = [...what, kind !== "vicon" && where ? where : kind !== "vicon" && size ? size : ""];
  const body = (title: ReactNode) => (
    <View style={{ flex: 1, minWidth: 0 }}>
      {title}
      <View style={{ marginTop: 2 }}>
        <Meta numberOfLines={1}>{facts}</Meta>
      </View>
      <Credits material={material} f={f} />
    </View>
  );
  const plainTitle = (
    <Text size="body" weight="medium" numberOfLines={3}>
      {material.title}
    </Text>
  );

  if (action.kind === "download") return <FileRow material={material} url={action.url} name={action.name} icon={icon} body={body(plainTitle)} />;

  // A lecturer's link is its title, opened like a link in a note (any web page, in the browser).
  if (kind === "link" && action.kind === "open") return <LinkRow material={material} url={action.url} icon={icon} body={body} facts={facts} />;

  let button: ReactNode;
  switch (action.kind) {
    case "join":
      button = (
        <Button size="sm" icon={<Icons.ArrowUpRight size={14} />} label={`${t("material.join")}: ${material.title}`} onPress={() => openExternal(action.url)}>
          {t("material.join")}
        </Button>
      );
      break;
    case "open":
      button = (
        <Button
          size="sm"
          icon={<Icons.ArrowUpRight size={14} />}
          label={`${t("material.open")}: ${material.title}, ${t("link.opensIn", { host: where ?? action.url })}`}
          onPress={() => openLink(action.url)}
        >
          {t("material.open")}
        </Button>
      );
      break;
    default:
      button = (
        <Button
          size="sm"
          icon={<Icons.ArrowUpRight size={14} />}
          label={`${t("action.openInEdunex")}: ${material.title}`}
          onPress={() => openExternal(action.url || edunexMaterialUrl(material))}
        >
          {t("action.openInEdunex")}
        </Button>
      );
  }
  return (
    <View testID={`row.material.${material.id}`} style={[styles.material, { alignItems: "flex-start" }]}>
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: space[2] }}>
        {body(plainTitle)}
        <View style={{ flexDirection: "row" }}>{button}</View>
      </View>
    </View>
  );
}

/** A lecturer's link: the row is the link, its title in the link's color. */
function LinkRow({
  material,
  url,
  icon,
  body,
  facts,
}: {
  material: Material;
  url: string;
  icon: ReactNode;
  body: (title: ReactNode) => ReactNode;
  facts: string[];
}) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenLink();
  return (
    <Pressable
      testID={`row.material.${material.id}`}
      accessibilityRole="link"
      accessibilityLabel={factsLabel(material.title, ...facts)}
      accessibilityHint={t("link.opensIn", { host: linkHost(url) ?? url })}
      onPress={() => open(url)}
      android_ripple={{ color: theme.color.selected }}
      style={styles.material}
    >
      {icon}
      {body(
        <Text size="body" weight="medium" numberOfLines={3} style={{ color: theme.color.accentFg, textDecorationLine: "underline" }}>
          {material.title}
        </Text>,
      )}
      <Icons.ArrowUpRight size={16} color={theme.color.faint} />
    </Pressable>
  );
}

/** A file on Edunex: the row opens it in the phone's app (downloading it once); Share once it's here. */
function FileRow({ material, url, name, icon, body }: { material: Material; url: string; name: string; icon: ReactNode; body: ReactNode }) {
  const t = useT();
  const theme = useTheme();
  const file = useEdunexFile({ url, name }, edunexMaterialUrl(material));
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressable
        testID={`row.material.${material.id}`}
        accessibilityRole="button"
        accessibilityLabel={t("mobile.file.openFor", { name: material.title })}
        accessibilityState={{ busy: file.busy }}
        onPress={() => void file.open()}
        android_ripple={{ color: theme.color.selected }}
        style={[styles.material, { flex: 1, paddingRight: file.here ? space[1] : space[4] }]}
      >
        {icon}
        {body}
        {file.busy ? <ActivityIndicator size="small" color={theme.color.faint} /> : !file.here && <Icons.Download size={18} color={theme.color.faint} />}
      </Pressable>
      {file.here && (
        <View style={{ paddingRight: space[1] }}>
          <IconButton label={t("mobile.file.shareFor", { name: material.title })} onPress={file.share}>
            {/* Android's share glyph, as parts/files.tsx draws it. */}
            <ShareNetworkIcon size={18} color={theme.color.muted} />
          </IconButton>
        </View>
      )}
    </View>
  );
}

/** Under each item, as on Edunex: who posted it and when, and who last changed it and when; once when they're the same moment. */
function Credits({ material, f }: { material: Material; f: Format }) {
  const t = useT();
  const { postedAt, updatedAt, createdBy, updatedBy } = material;
  const changed = updatedAt !== null && (postedAt === null || Math.abs(updatedAt - postedAt) >= 60_000);
  const posted =
    postedAt === null
      ? ""
      : createdBy
        ? t("material.createdBy", { name: createdBy, when: dayAndTime(f, postedAt) })
        : t("note.posted", { when: dayAndTime(f, postedAt) });
  const updated = !changed
    ? ""
    : updatedBy && updatedBy !== createdBy
      ? t("material.updatedBy", { name: updatedBy, when: dayAndTime(f, updatedAt) })
      : t("note.updated", { when: dayAndTime(f, updatedAt) });
  if (!posted && !updated) return null;
  return (
    <View style={{ marginTop: space[1] }}>
      <Meta tone="faint" size="caption">
        {posted}
        {updated}
      </Meta>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  entry: { paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 48 },
  material: { flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  icon: { width: 32, height: 32, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
});
