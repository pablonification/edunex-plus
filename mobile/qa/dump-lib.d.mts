// Types for mobile/qa/dump-lib.mjs, so the tests can import it.
export interface DumpNode {
  id: string;
  cls: string;
  pkg: string;
  text: string;
  desc: string;
  clickable: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  children: DumpNode[];
  parent: DumpNode | null;
  system: boolean;
}
export interface Dump {
  root: DumpNode;
  nodes: DumpNode[];
  width: number;
  height: number;
  format: "xml" | "maestro";
}
export declare const WORD: RegExp;
export declare function wordsIn(text: string): number;
export declare function flatten(root: DumpNode): DumpNode[];
export declare function readDump(raw: string, options?: { app?: string }): Dump;
export declare function readDumpFile(file: string, options?: { app?: string }): Dump;
export declare function widthOf(node: DumpNode): number;
export declare function heightOf(node: DumpNode): number;
export declare function within(node: DumpNode): DumpNode[];
export declare function insideTap(node: DumpNode): boolean;
export declare function labelOf(node: DumpNode): string;
export declare function isLabelled(node: DumpNode): boolean;
export declare function shareInside(node: DumpNode, rect: { x1: number; y1: number; x2: number; y2: number }): number;
export declare function describe(node: DumpNode): string;
