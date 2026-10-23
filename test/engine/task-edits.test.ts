// What a lecturer changed in a Task, seam 1: two copies of a made-up Task
// compared field by field (the instructions by their text, read as the engine
// reads them), the records kept per edit, several edits told as one, and what
// the screens make of them.
import { describe, expect, it } from "vitest";
import { putAway, taskDoneKey } from "../../src/core/done";
import { Datasets, type Task, type TaskAnswer, type TaskEdit } from "../../src/core/models";
import { taskNeed } from "../../src/core/needs";
import { dateMove, editView, mergeEdits, nextEdits, taskChanges, titleOnly } from "../../src/core/task-edits";
import { instructionsText } from "../../src/engine/sources/edunex/instructions-text";
import { aTask } from "../kit/tasks";

const at = (iso: string) => Date.parse(`${iso}+07:00`);
/** Handed in on 1 Oct, before every edit here. */
const sent: TaskAnswer = {
  id: 1,
  sent: true,
  text: "<p>Jawaban</p>",
  files: [],
  createdAt: null,
  updatedAt: null,
  sentAt: at("2026-10-01T10:00:00"),
  reviewedAt: null,
};
const task = (fields: Partial<Task> = {}): Task =>
  aTask({
    id: 117001,
    courseCode: "II4091",
    courseId: 95001,
    title: "Tugas 01 Bab I",
    status: "submitted",
    dueAt: at("2026-10-09T23:59:00"),
    postedAt: at("2026-09-10T10:00:00"),
    instructions: "<p>Tulis Bab I.</p>",
    files: [{ name: "template.docx", url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-template" }],
    group: false,
    ...fields,
  });
const changes = (old: Task, next: Task) => taskChanges(old, next, instructionsText);

describe("what's compared", () => {
  it("each field the Student acts on, in the order a reader wants it", () => {
    const old = task();
    const next = task({
      dueAt: at("2026-10-12T23:59:00"),
      opensAt: at("2026-09-11T08:00:00"),
      instructions: "<p>Tulis Bab I dengan template baru.</p>",
      files: [{ name: "brief-v2.pdf", url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-brief" }],
      title: "Tugas 01 Bab I (revisi)",
      lateAllowed: true,
      fileRequired: true,
      group: true,
      kind: "uts",
    });
    expect(changes(old, next).map((c) => c.kind)).toEqual([
      "deadline",
      "opens",
      "instructions",
      "files",
      "title",
      "lateAllowed",
      "fileRequired",
      "group",
      "examKind",
    ]);
    expect(changes(old, next)[0]).toEqual({ kind: "deadline", from: old.dueAt, to: next.dueAt });
    expect(changes(old, next).find((c) => c.kind === "instructions")).toEqual({
      kind: "instructions",
      before: "Tulis Bab I.",
      after: "Tulis Bab I dengan template baru.",
    });
    expect(changes(old, next).find((c) => c.kind === "files")).toEqual({ kind: "files", added: next.files, removed: old.files });
  });

  it("markup alone isn't a change; a swapped picture or a changed link is", () => {
    const old = task({ instructions: "<p>Tulis&nbsp;Bab I.</p><ul><li>Satu</li></ul>" });
    expect(changes(old, task({ instructions: "<div>Tulis Bab I.</div><ul><li> Satu </li></ul>" }))).toEqual([]);
    const picture = task({ instructions: '<p>Lihat <img src="https://example.com/a.png" alt="diagram"></p>' });
    expect(changes(picture, task({ instructions: '<p>Lihat <img src="https://example.com/b.png" alt="diagram"></p>' })).map((c) => c.kind)).toEqual([
      "instructions",
    ]);
    const link = task({ instructions: '<p><a href="https://example.com/form-1">Formulir</a></p>' });
    expect(changes(link, task({ instructions: '<p><a href="https://example.com/form-2">Formulir</a></p>' })).map((c) => c.kind)).toEqual(["instructions"]);
  });

  it("the text keeps its lines and list marks, and drops scripts", () => {
    expect(instructionsText("<h2>Ketentuan</h2><ol><li>Satu</li><li>Dua</li></ol><p>Kirim<br>sebelum Senin.</p><script>x()</script>")).toBe(
      "Ketentuan\n1. Satu\n2. Dua\nKirim\nsebelum Senin.",
    );
    // A paragraph inside a list item stays beside its mark.
    expect(instructionsText("<ul><li><p>Satu</p></li><li><p>Dua</p></li></ul>")).toBe("• Satu\n• Dua");
  });

  it("odd markup never stops the Tasks being saved: a stray % in a picture's link, a pasted picture with no name", () => {
    expect(instructionsText('<p><img src="https://example.com/Nilai 100%.png"></p>')).toBe("[gambar: Nilai 100%.png] (https://example.com/Nilai 100%.png)");
    expect(instructionsText('<p><img src="data:image/png;base64,iVBORw0KGgo="></p>')).toMatch(/^\[gambar\] \(data:[0-9a-f]{12}\)$/);
  });

  it("not what moves without an edit, nor a group flag that wasn't read before", () => {
    const old = task({ group: undefined });
    expect(changes(old, task({ group: false, closed: true, score: 90, status: "closed" }))).toEqual([]);
  });

  it("a file at a new link is one removed and one added (History says replaced)", () => {
    const old = task();
    const next = task({ files: [{ name: "template.docx", url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-template-v2" }] });
    expect(changes(old, next)).toEqual([{ kind: "files", added: next.files, removed: old.files }]);
  });
});

describe("the records", () => {
  const old = task({ editedAt: null });
  const edited = (iso: string, fields: Partial<Task> = {}) => task({ editedAt: at(iso), ...fields });

  it("one per edit Edunex marks, against the copy kept until now; none without an earlier copy of the Task", () => {
    const now = at("2026-10-07T21:45:00");
    const next = edited("2026-10-07T21:41:00", { dueAt: at("2026-10-12T23:59:00") });
    expect(nextEdits([], [old], [next], now, instructionsText)).toEqual([
      { taskId: 117001, at: at("2026-10-07T21:41:00"), since: old.postedAt, seenAt: now, changes: [{ kind: "deadline", from: old.dueAt, to: next.dueAt }] },
    ]);
    // A Task new to the list is a new Task, never an edit; the same edit seen again isn't a second record.
    expect(nextEdits([], [], [next], now, instructionsText)).toEqual([]);
    const once = nextEdits([], [old], [next], now, instructionsText);
    expect(nextEdits(once, [next], [next], now + 1, instructionsText)).toEqual(once);
  });

  it("an edit that changes nothing compared is an empty record", () => {
    expect(nextEdits([], [old], [edited("2026-10-07T21:41:00")], 0, instructionsText)[0]?.changes).toEqual([]);
  });

  it("the newest three per Task, none for a Task that's gone, and what's written always loads", () => {
    let copy = old;
    let edits: TaskEdit[] = [];
    for (let day = 1; day <= 5; day++) {
      const next = edited(`2026-10-0${day}T10:00:00`, { title: `Tugas 01 versi ${day}` });
      edits = nextEdits(edits, [copy], [next], 0, instructionsText);
      copy = next;
    }
    expect(edits.map((e) => e.at)).toEqual([at("2026-10-05T10:00:00"), at("2026-10-04T10:00:00"), at("2026-10-03T10:00:00")]);
    expect(nextEdits(edits, [copy], [], 0, instructionsText)).toEqual([]);

    // A huge text and many files stay within what loading accepts.
    const big = edited("2026-10-06T10:00:00", {
      instructions: `<p>${"kata ".repeat(6000)}</p>`,
      files: Array.from({ length: 60 }, (_, i) => ({ name: `f${i}.pdf`, url: `https://edunexfixture.blob.core.windows.net/edunex/fixture-${i}` })),
    });
    const written = nextEdits(edits, [copy], [big], 0, instructionsText);
    expect(written[0]?.changes.find((c) => c.kind === "instructions")).toMatchObject({ cut: true });
    expect(Datasets["edunex.taskEdits"].safeParse(written).success).toBe(true);

    // 120 Tasks edited three times each: 300 records, still loading.
    const many: TaskEdit[] = Array.from({ length: 360 }, (_, i) => ({ taskId: i % 120, at: i, since: null, seenAt: 0, changes: [] }));
    const tasks = Array.from({ length: 120 }, (_, i) => task({ id: i, editedAt: 1000 }));
    const kept = nextEdits(many, tasks, tasks, 0, instructionsText);
    expect(kept).toHaveLength(300);
    expect(Datasets["edunex.taskEdits"].safeParse(kept).success).toBe(true);
  });
});

describe("several edits as one, and what the screens make of them", () => {
  const edit = (iso: string, changes: TaskEdit["changes"]): TaskEdit => ({ taskId: 117001, at: at(iso), since: null, seenAt: 0, changes });
  const d1 = at("2026-10-09T23:59:00");
  const d2 = at("2026-10-12T23:59:00");
  const d3 = at("2026-10-14T23:59:00");

  it("A → B → C reads as A → C; changed and changed back drops out; files added then removed cancel", () => {
    const file = { name: "brief.pdf", url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-brief" };
    expect(
      mergeEdits([
        edit("2026-10-07T10:00:00", [
          { kind: "deadline", from: d1, to: d2 },
          { kind: "instructions", before: "A", after: "B" },
          { kind: "files", added: [file], removed: [] },
        ]),
        edit("2026-10-08T10:00:00", [
          { kind: "deadline", from: d2, to: d3 },
          { kind: "instructions", before: "B", after: "C" },
          { kind: "lateAllowed", from: false, to: true },
          { kind: "files", added: [], removed: [file] },
        ]),
        edit("2026-10-09T10:00:00", [{ kind: "lateAllowed", from: true, to: false }]),
      ]),
    ).toEqual([
      { kind: "deadline", from: d1, to: d3 },
      { kind: "instructions", before: "A", after: "C" },
    ]);
  });

  it("a view: unknown without a record, none with nothing changed, known with the changes since the version last checked", () => {
    const t = task({ editedAt: at("2026-10-08T10:00:00") });
    expect(editView(task(), [], [])).toBeNull();
    expect(editView(t, [], [])).toMatchObject({ state: "unknown", record: null });
    expect(editView(t, [edit("2026-10-08T10:00:00", [])], [])).toMatchObject({ state: "none" });
    const records = [
      edit("2026-10-07T10:00:00", [{ kind: "deadline", from: d1, to: d2 }]),
      edit("2026-10-08T10:00:00", [{ kind: "title", from: "A", to: "B" }]),
    ];
    expect(editView(t, records, [])?.changes.map((c) => c.kind)).toEqual(["deadline", "title"]);
    // The first edit was checked: only the second is news.
    const checkedFirst = putAway([], taskDoneKey({ ...t, editedAt: at("2026-10-07T10:00:00") }, "edited"), "checked", 0);
    expect(editView(t, records, checkedFirst)).toMatchObject({ state: "known", checked: undefined, changes: [{ kind: "title", from: "A", to: "B" }] });
    // A re-save that changed nothing compared doesn't hide the change before it, nor bring back one already checked.
    const resaved = { ...t, editedAt: at("2026-10-09T10:00:00") };
    const withResave = [...records, edit("2026-10-09T10:00:00", [])];
    expect(editView(resaved, withResave, [])).toMatchObject({ state: "known", record: { at: at("2026-10-08T10:00:00") } });
    expect(editView(resaved, withResave, [])?.changes.map((c) => c.kind)).toEqual(["deadline", "title"]);
    expect(editView(resaved, withResave, putAway([], taskDoneKey(t, "edited"), "checked", 0))?.checked?.how).toBe("checked");
    const need = taskNeed({ ...resaved, status: "submitted", answer: sent }, at("2026-10-09T12:00:00"), withResave);
    expect(need).toMatchObject({ reason: "edited", editAt: at("2026-10-08T10:00:00") });
    // Alone, an edit that changed nothing compared is "none", and no item.
    expect(taskNeed({ ...t, status: "submitted", answer: sent }, at("2026-10-08T12:00:00"), [edit("2026-10-08T10:00:00", [])])).toBeNull();
    // This very version checked.
    const checked = putAway([], taskDoneKey(t, "edited"), "checked", 0);
    expect(editView(t, records, checked)?.checked?.how).toBe("checked");
  });

  it("one date moving is said by name; a new title alone is History's", () => {
    expect(dateMove([{ kind: "deadline", from: d1, to: d2 }])).toEqual({ kind: "deadline", from: d1, to: d2 });
    expect(
      dateMove([
        { kind: "deadline", from: d1, to: d2 },
        { kind: "lateAllowed", from: false, to: true },
      ]),
    ).toBeNull();
    expect(titleOnly([{ kind: "title", from: "A", to: "B" }])).toBe(true);
    expect(titleOnly([])).toBe(false);
  });
});
