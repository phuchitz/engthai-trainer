import { describe, it, expect } from "vitest";
import {
  activeMs,
  formatDuration,
  StudyTimer,
  DEFAULT_IDLE_TIMEOUT_MS,
  type TimelineEvent,
} from "@/lib/gamification";

const T0 = 1_700_000_000_000;
const SECOND = 1000;
const MINUTE = 60 * SECOND;

const at = (type: TimelineEvent["type"], offsetMs: number): TimelineEvent => ({ type, at: T0 + offsetMs });

describe("activeMs — the basics", () => {
  it("is zero with no events", () => {
    expect(activeMs([], T0)).toBe(0);
  });

  it("counts a short uninterrupted stretch in full", () => {
    expect(activeMs([at("start", 0)], T0 + 5 * SECOND)).toBe(5 * SECOND);
  });

  it("never returns a negative total when an end precedes the start", () => {
    expect(activeMs([at("start", 10 * SECOND)], T0)).toBe(0);
  });

  it("sorts events that arrive out of order", () => {
    const events = [at("stop", 5 * SECOND), at("start", 0)];
    expect(activeMs(events, T0 + 60 * SECOND)).toBe(5 * SECOND);
  });
});

describe("activeMs — background time is excluded", () => {
  it("counts nothing while hidden", () => {
    const events = [at("start", 0), at("hidden", 5 * SECOND), at("visible", 5 * MINUTE)];
    // Five seconds before hiding, five after becoming visible again.
    expect(activeMs(events, T0 + 5 * MINUTE + 5 * SECOND)).toBe(10 * SECOND);
  });

  it("excludes an hour in the background entirely", () => {
    const events = [at("start", 0), at("hidden", 2 * SECOND), at("visible", 60 * MINUTE)];
    expect(activeMs(events, T0 + 60 * MINUTE)).toBe(2 * SECOND);
  });

  it("stops accruing when the tab is hidden and never returns", () => {
    const events = [at("start", 0), at("hidden", 3 * SECOND)];
    expect(activeMs(events, T0 + 30 * MINUTE)).toBe(3 * SECOND);
  });

  it("handles several hide/show cycles", () => {
    const events = [
      at("start", 0),
      at("hidden", 2 * SECOND),
      at("visible", 10 * SECOND),
      at("hidden", 13 * SECOND),
      at("visible", 40 * SECOND),
    ];
    // 2 + 3 + 4 seconds of foreground.
    expect(activeMs(events, T0 + 44 * SECOND)).toBe(9 * SECOND);
  });
});

describe("activeMs — idle time is capped", () => {
  it("counts at most the idle timeout when nothing happens", () => {
    expect(activeMs([at("start", 0)], T0 + 10 * MINUTE)).toBe(DEFAULT_IDLE_TIMEOUT_MS);
  });

  it("counts a long gap between keystrokes only up to the timeout", () => {
    const events = [at("start", 0), at("activity", 5 * MINUTE)];
    expect(activeMs(events, T0 + 5 * MINUTE)).toBe(DEFAULT_IDLE_TIMEOUT_MS);
  });

  it("counts a steady stream of activity in full", () => {
    const events: TimelineEvent[] = [at("start", 0)];
    for (let i = 1; i <= 6; i++) events.push(at("activity", i * 30 * SECOND));
    expect(activeMs(events, T0 + 3 * MINUTE)).toBe(3 * MINUTE);
  });

  it("caps each idle stretch separately rather than once overall", () => {
    const events = [at("start", 0), at("activity", 5 * MINUTE), at("activity", 10 * MINUTE)];
    // Two gaps, each capped at the timeout.
    expect(activeMs(events, T0 + 10 * MINUTE)).toBe(2 * DEFAULT_IDLE_TIMEOUT_MS);
  });

  it("respects a custom idle timeout", () => {
    expect(activeMs([at("start", 0)], T0 + 10 * MINUTE, 5 * SECOND)).toBe(5 * SECOND);
  });

  it("treats activity as evidence of presence even after hiding", () => {
    const events = [at("start", 0), at("hidden", SECOND), at("activity", 10 * MINUTE)];
    // One second before hiding; the activity reopens the clock but credits nothing itself.
    expect(activeMs(events, T0 + 10 * MINUTE + 2 * SECOND)).toBe(3 * SECOND);
  });
});

describe("activeMs — stop is terminal", () => {
  it("counts up to the stop and no further", () => {
    expect(activeMs([at("start", 0), at("stop", 4 * SECOND)], T0 + 10 * MINUTE)).toBe(4 * SECOND);
  });

  it("ignores events after the stop, so a stale listener cannot inflate the total", () => {
    const events = [
      at("start", 0),
      at("stop", 4 * SECOND),
      at("activity", 5 * SECOND),
      at("visible", 6 * SECOND),
    ];
    expect(activeMs(events, T0 + 10 * MINUTE)).toBe(4 * SECOND);
  });
});

describe("activeMs — purity", () => {
  it("does not mutate the events it is given", () => {
    const events = [at("stop", 5 * SECOND), at("start", 0)];
    const snapshot = events.map((e) => e.type);
    activeMs(events, T0 + 10 * SECOND);
    expect(events.map((e) => e.type)).toEqual(snapshot);
  });

  it("returns the same total for the same input", () => {
    const events = [at("start", 0), at("activity", 30 * SECOND), at("hidden", 40 * SECOND)];
    expect(activeMs(events, T0 + MINUTE)).toBe(activeMs(events, T0 + MINUTE));
  });
});

describe("StudyTimer", () => {
  it("accumulates from construction", () => {
    const timer = new StudyTimer(T0);
    expect(timer.elapsed(T0 + 3 * SECOND)).toBe(3 * SECOND);
  });

  it("excludes a background stretch", () => {
    const timer = new StudyTimer(T0);
    timer.mark("hidden", T0 + 2 * SECOND);
    timer.mark("visible", T0 + 5 * MINUTE);
    expect(timer.elapsed(T0 + 5 * MINUTE + SECOND)).toBe(3 * SECOND);
  });

  it("freezes once stopped", () => {
    const timer = new StudyTimer(T0);
    const stopped = timer.stop(T0 + 4 * SECOND);
    expect(stopped).toBe(4 * SECOND);
    expect(timer.elapsed(T0 + 10 * MINUTE)).toBe(4 * SECOND);
  });

  it("caps an idle card at the timeout", () => {
    const timer = new StudyTimer(T0);
    expect(timer.stop(T0 + 30 * MINUTE)).toBe(DEFAULT_IDLE_TIMEOUT_MS);
  });
});

describe("formatDuration", () => {
  it("shows seconds under a minute", () => {
    expect(formatDuration(45 * SECOND)).toBe("45s");
  });

  it("shows minutes", () => {
    expect(formatDuration(5 * MINUTE)).toBe("5m");
  });

  it("shows hours and minutes", () => {
    expect(formatDuration(90 * MINUTE)).toBe("1h 30m");
  });

  it("shows zero as seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });
});
