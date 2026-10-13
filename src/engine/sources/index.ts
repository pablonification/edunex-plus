// Every source the engine runs.
import { edunex } from "./edunex";
import { itb } from "./itb";
import { six } from "./six";
import type { Source } from "./source";

// Each source has its own session type; the engine checks sessions against the source's own schema.
// biome-ignore lint/suspicious/noExplicitAny: a list of differently-typed sources
export type AnySource = Source<any>;

export const SOURCES: readonly AnySource[] = [edunex, six, itb];
