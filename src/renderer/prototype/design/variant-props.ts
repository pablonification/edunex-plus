// PROTOTYPE (#83) — throwaway. What every design variant receives. Each
// variant renders the whole app (its own shell, navigation and screens).
import type { JSX } from "react";
import type { Course, DesignData, Task } from "./data";
import type { Format, Lang, StringKey } from "./i18n";
import type { Screen } from "./params";

export interface VariantProps {
  data: DesignData;
  /** The demo's "now" (a real moment when a Presence window was open). */
  now: Date;
  screen: Screen;
  /** Navigate within the variant; opts pick which Task / course to show. */
  go: (screen: Screen, opts?: { task?: string; course?: string; tab?: string; overlay?: string }) => void;
  /** The Task shown on the Task page, with any ?status= preview applied. */
  task: Task;
  /** The course shown on the course page. */
  course: Course;
  lang: Lang;
  /** Shared copy from i18n.ts. */
  t: (key: StringKey) => string;
  /** Variant-specific copy: tr({ en: "…", id: "…" }). */
  tr: (text: { en: string; id: string }) => string;
  /** Human time formatting in WIB for the current language. */
  f: Format;
  dark: boolean;
}

export interface VariantModule {
  key: string;
  name: string;
  Component: (props: VariantProps) => JSX.Element;
}
