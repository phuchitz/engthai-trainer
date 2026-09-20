import { describe, it, expect } from "vitest";
import {
  MS_PER_DAY,
  addLocalDays,
  isSameLocalDay,
  localDateKey,
  localDaysBetween,
  startOfLocalDay,
} from "@/lib/srs";

/** Guards the assumptions every other date test in this file rests on. */
describe("test environment", () => {
  it("runs in the pinned timezone", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Bangkok");
    expect(new Date("2026-01-01T00:00:00Z").getTimezoneOffset()).toBe(-420);
  });
});

describe("startOfLocalDay", () => {
  it("returns local midnight", () => {
    const result = new Date(startOfLocalDay(Date.parse("2026-09-20T15:42:07+07:00")));
    expect([result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds()]).toEqual([
      0, 0, 0, 0,
    ]);
    expect(localDateKey(result.getTime())).toBe("2026-09-20");
  });

  it("is idempotent", () => {
    const once = startOfLocalDay(Date.parse("2026-09-20T15:42:07+07:00"));
    expect(startOfLocalDay(once)).toBe(once);
  });

  it("maps every instant in a local day to the same midnight", () => {
    const morning = startOfLocalDay(Date.parse("2026-09-20T00:00:00+07:00"));
    const night = startOfLocalDay(Date.parse("2026-09-20T23:59:59+07:00"));
    expect(morning).toBe(night);
  });

  it("puts late-evening local time on the correct day despite a different UTC date", () => {
    // 23:30 in Bangkok is already the next day in UTC.
    expect(localDateKey(startOfLocalDay(Date.parse("2026-09-20T23:30:00+07:00")))).toBe("2026-09-20");
  });
});

describe("addLocalDays", () => {
  const base = Date.parse("2026-09-20T15:42:07+07:00");

  it("returns midnight of the target day", () => {
    expect(localDateKey(addLocalDays(base, 1))).toBe("2026-09-21");
    expect(new Date(addLocalDays(base, 1)).getHours()).toBe(0);
  });

  it("normalises to today when adding zero days", () => {
    expect(addLocalDays(base, 0)).toBe(startOfLocalDay(base));
  });

  it("crosses a month boundary", () => {
    expect(localDateKey(addLocalDays(Date.parse("2026-09-29T10:00:00+07:00"), 3))).toBe("2026-10-02");
  });

  it("crosses a year boundary", () => {
    expect(localDateKey(addLocalDays(Date.parse("2026-12-30T10:00:00+07:00"), 5))).toBe("2027-01-04");
  });

  it("handles a leap day", () => {
    expect(localDateKey(addLocalDays(Date.parse("2028-02-28T10:00:00+07:00"), 1))).toBe("2028-02-29");
    expect(localDateKey(addLocalDays(Date.parse("2028-02-28T10:00:00+07:00"), 2))).toBe("2028-03-01");
  });

  it("accepts a long interval", () => {
    expect(localDateKey(addLocalDays(Date.parse("2026-09-20T10:00:00+07:00"), 365))).toBe("2027-09-20");
  });

  it("is a pure function of the calendar day, not the time of day", () => {
    const early = addLocalDays(Date.parse("2026-09-20T00:05:00+07:00"), 6);
    const late = addLocalDays(Date.parse("2026-09-20T23:55:00+07:00"), 6);
    expect(early).toBe(late);
  });
});

describe("localDaysBetween", () => {
  it("counts calendar days, not elapsed 24-hour periods", () => {
    const late = Date.parse("2026-09-20T23:00:00+07:00");
    const early = Date.parse("2026-09-21T01:00:00+07:00");
    expect(localDaysBetween(late, early)).toBe(1);
  });

  it("is zero within one day and negative going backwards", () => {
    const a = Date.parse("2026-09-20T01:00:00+07:00");
    const b = Date.parse("2026-09-20T22:00:00+07:00");
    expect(localDaysBetween(a, b)).toBe(0);
    expect(localDaysBetween(b, addLocalDays(a, -2))).toBe(-2);
  });
});

describe("isSameLocalDay", () => {
  it("compares by calendar day", () => {
    expect(
      isSameLocalDay(Date.parse("2026-09-20T00:01:00+07:00"), Date.parse("2026-09-20T23:59:00+07:00")),
    ).toBe(true);
    expect(
      isSameLocalDay(Date.parse("2026-09-20T23:59:00+07:00"), Date.parse("2026-09-21T00:01:00+07:00")),
    ).toBe(false);
  });
});

describe("localDateKey", () => {
  it("zero-pads month and day", () => {
    expect(localDateKey(Date.parse("2026-01-05T10:00:00+07:00"))).toBe("2026-01-05");
  });

  it("matches the schema format used for streaks", () => {
    expect(localDateKey(Date.now())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("MS_PER_DAY", () => {
  it("is a nominal day", () => {
    expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
  });
});
