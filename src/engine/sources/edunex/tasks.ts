// EduNex Tasks: every Task of the term with the Student's answers (#72), and
// handing one in (#73).
import type { SourceAction, SourceContext } from "../source";
import type { EdunexClient } from "./client";
import type { EdunexSession } from "./session";

export function registerTaskFeeds(_context: SourceContext, _client: EdunexClient): void {}

export const taskActions: Record<string, SourceAction<EdunexSession>> = {};
