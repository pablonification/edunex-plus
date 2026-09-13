import { describe, expect, it } from "vitest";
import { deriveSubmissionStatus, parseIsSent } from "./submission";

const NOW = Date.parse("2026-09-13T12:00:00.000Z");
const FUTURE = "2026-09-14T23:59:00.000Z";
const PAST = "2026-09-01T23:59:00.000Z";

describe("submission status (is_sent only)", () => {
  it("normalizes the vendor is_sent bit across numeric, string, and boolean shapes", () => {
    expect(parseIsSent(1)).toBe(true);
    expect(parseIsSent("1")).toBe(true);
    expect(parseIsSent(true)).toBe(true);
    expect(parseIsSent(0)).toBe(false);
    expect(parseIsSent("0")).toBe(false);
    expect(parseIsSent(false)).toBe(false);
    expect(parseIsSent(null)).toBeNull();
    expect(parseIsSent(undefined)).toBeNull();
    expect(parseIsSent("yes")).toBeNull();
  });

  it("marks sent answers submitted regardless of the deadline", () => {
    expect(deriveSubmissionStatus(true, FUTURE, NOW)).toBe("submitted");
    expect(deriveSubmissionStatus(true, PAST, NOW)).toBe("submitted");
    expect(deriveSubmissionStatus(true, null, NOW)).toBe("submitted");
  });

  it("marks unsent answers overdue only past the deadline", () => {
    expect(deriveSubmissionStatus(false, FUTURE, NOW)).toBe("draft");
    expect(deriveSubmissionStatus(false, PAST, NOW)).toBe("overdue");
    expect(deriveSubmissionStatus(null, PAST, NOW)).toBe("overdue");
    expect(deriveSubmissionStatus(null, FUTURE, NOW)).toBe("draft");
    expect(deriveSubmissionStatus(null, null, NOW)).toBe("draft");
  });

  it("treats missing or unparseable deadlines as not overdue", () => {
    expect(deriveSubmissionStatus(false, null, NOW)).toBe("draft");
    expect(deriveSubmissionStatus(false, "not-a-date", NOW)).toBe("draft");
    expect(deriveSubmissionStatus(undefined, PAST, NOW)).toBe("overdue");
  });
});
