// Types for mobile/qa/flows-check.mjs, so the tests can import it.
export interface FlowId {
  line: number;
  id: string;
  found: boolean;
  failing: boolean;
  pending?: string | null;
  negative?: boolean;
  absentOk?: boolean;
  history?: boolean;
  closest?: string | null;
}
export interface FlowReport {
  file: string;
  ids: FlowId[];
  history: boolean;
  owner: string | null;
}
export declare function check(): FlowReport[];
export declare function idExists(id: string): boolean;
export declare function appIds(): string[];
