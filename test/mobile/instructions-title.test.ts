import { describe, expect, it } from "vitest";
import { withoutTitleLine } from "../../mobile/src/screens/tasks/instructions";

const title = "Tugas 3 - Analisis Pasar";

describe("a Task's instructions without its name as their first line", () => {
  it("drops a first paragraph that is the name", () => {
    expect(withoutTitleLine("<p><strong>Tugas 3: Analisis Pasar</strong></p><p>Kerjakan soal 1-5.</p>", title)).toBe("<p>Kerjakan soal 1-5.</p>");
  });

  it("drops a first line that starts with the name, up to its <br>", () => {
    expect(withoutTitleLine("<p>TUGAS 3 Analisis Pasar (individu)<br>Kerjakan soal 1-5.</p>", title)).toBe("<p>Kerjakan soal 1-5.</p>");
    expect(withoutTitleLine("Tugas 3 – Analisis Pasar<br>Kerjakan soal 1-5.", title)).toBe("Kerjakan soal 1-5.");
  });

  it("keeps instructions that start with anything else", () => {
    const html = "<p>Baca bab 3, lalu kerjakan Tugas 3 - Analisis Pasar.</p>";
    expect(withoutTitleLine(html, title)).toBe(html);
    expect(withoutTitleLine("<p>Tugas 31 Analisis</p><p>x</p>", "Tugas 3")).toBe("<p>Tugas 31 Analisis</p><p>x</p>");
  });

  it("keeps the name when it's all that's written", () => {
    expect(withoutTitleLine("<p>Tugas 3 - Analisis Pasar</p>", title)).toBe("<p>Tugas 3 - Analisis Pasar</p>");
  });
});
