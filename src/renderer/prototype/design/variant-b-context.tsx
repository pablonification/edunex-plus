// PROTOTYPE (#83) — throwaway. Variant B ("Lists"): what every screen of the
// variant shares — the prototype props, the derived data and navigation.
import { createContext, useContext } from "react";
import type { Model } from "./variant-b-model";
import type { VariantProps } from "./variant-props";

/** The Tasks screen has two smart lists: every Task, or the coming weeks day by day. */
export type TasksView = "all" | "upcoming";
export type SidebarKey = "today" | "upcoming" | "all" | `course:${string}`;

export interface Nav {
  today(): void;
  tasks(view: TasksView): void;
  task(id: string): void;
  course(code: string): void;
  back(): void;
}

export interface VB {
  p: VariantProps;
  m: Model;
  nav: Nav;
  view: TasksView;
  active: SidebarKey;
  backLabel: string;
}

export const VBContext = createContext<VB | null>(null);

export function useVB(): VB {
  const value = useContext(VBContext);
  if (!value) throw new Error("useVB() used outside Variant B");
  return value;
}
