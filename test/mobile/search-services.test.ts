// Search on the phone: every service is found by the name its tile carries tonight, Materi and Ujian included, and the
// typed part of a name is what gets marked.
import { describe, expect, it } from "vitest";
import { markedSpans, matchServices, SEARCH_SERVICES } from "../../mobile/src/screens/search/services";

const ids = (query: string) => matchServices(query).map((service) => service.id);

describe("search's services", () => {
  it("finds each service by its name, in Indonesian and in English", () => {
    expect(ids("materi")).toContain("material");
    expect(ids("ujian")).toContain("exams");
    expect(ids("exam")).toContain("exams");
    expect(ids("ukt")).toEqual(["bills"]);
    expect(ids("nilai")).toContain("grades");
    expect(ids("notif")).toContain("alerts");
    expect(ids("")).toEqual([]);
  });

  it("lists each service once", () => {
    const all = SEARCH_SERVICES.map((service) => service.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("marks the typed part of a name, case forgiven", () => {
    expect(markedSpans("Statistika Dasar", "dasar")).toEqual([
      ["Statistika ", false],
      ["Dasar", true],
    ]);
    expect(markedSpans("UKT", "")).toEqual([["UKT", false]]);
  });
});
