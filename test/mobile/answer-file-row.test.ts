// A file's row in a Task's answer (mobile/src/screens/tasks/hand-in.tsx) carries one mark per state: its leading badge
// (mobile/src/parts/files.tsx's FileBadge) is the spinner while it uploads, the warning when it failed, the file's
// kind when it's there. On an iPhone a second spinner under the row's words read as two things happening. Read from
// the source: the rows are drawn by React Native, which these tests don't run.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(import.meta.dirname, "../..", file), "utf8");

describe("a file's row in a Task's answer", () => {
  const handIn = read("mobile/src/screens/tasks/hand-in.tsx");
  const row = handIn.slice(handIn.indexOf("function FileRowView"));

  it("draws its state once, as the leading badge", () => {
    expect(row.match(/<FileBadge /g)).toHaveLength(1);
    expect(row).toContain("<FileBadge name={name} state={state} />");
  });

  it("draws no second spinner beside it while the file uploads", () => {
    expect(row).not.toMatch(/ActivityIndicator|indeterminate/);
    expect(handIn).not.toMatch(/import \{[^}]*ActivityIndicator[^}]*\} from "react-native"/);
  });

  it("says the upload in words on the row's second line", () => {
    expect(handIn).toContain('factsLabel(t(item.state === "uploaded" ? "handIn.notSaved" : "handIn.uploading"), f.fileSize(item.size))');
  });

  it("the badge is a spinner only while the file waits or uploads", () => {
    const badge = read("mobile/src/parts/files.tsx");
    const body = badge.slice(badge.indexOf("export function FileBadge"), badge.indexOf("/** A lecturer's file on its own tonal card"));
    expect(body.match(/<ActivityIndicator /g)).toHaveLength(1);
    expect(body).toMatch(/state === "uploading" \|\| state === "waiting" \? \(\s*<ActivityIndicator /);
  });
});
