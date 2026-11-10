// What the Student chose for each placed widget, by Android's widget id: the course a "Satu mata kuliah" widget shows
// (./configure.tsx). A small file of its own beside the engine's, read with the widget's drawing; a widget removed takes
// its choice with it.
import { File, Paths } from "expo-file-system";

const file = () => new File(Paths.document, "widget-choices.json");

type Choices = Record<string, string>;

function readAll(): Choices {
  try {
    const f = file();
    if (!f.exists) return {};
    const saved = JSON.parse(f.textSync()) as unknown;
    return saved !== null && typeof saved === "object" ? (saved as Choices) : {};
  } catch {
    return {};
  }
}

function writeAll(choices: Choices): void {
  try {
    file().writeSync(JSON.stringify(choices));
  } catch {
    // The widget falls back to the course with the next class.
  }
}

/** The course chosen for widget `id`, or null (then it shows the one with the next class). */
export function chosenCourse(id: number): string | null {
  return readAll()[String(id)] ?? null;
}

export function chooseCourse(id: number, code: string): void {
  writeAll({ ...readAll(), [String(id)]: code });
}

export function forgetChoice(id: number): void {
  const choices = readAll();
  if (!(String(id) in choices)) return;
  delete choices[String(id)];
  writeAll(choices);
}
