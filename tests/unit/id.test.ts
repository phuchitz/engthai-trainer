import { describe, it, expect } from "vitest";
import { newId, isId, progressId } from "@/lib/utils/id";

describe("newId", () => {
  it("produces 26-character Crockford base32 ids", () => {
    expect(isId(newId())).toBe(true);
  });

  it("is unique across a tight loop", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newId()));
    expect(ids.size).toBe(5000);
  });

  it("sorts lexicographically by creation order within a millisecond", () => {
    const ids = Array.from({ length: 200 }, () => newId(1_700_000_000_000));
    expect([...ids].sort()).toEqual(ids);
  });

  it("sorts lexicographically across milliseconds", () => {
    const earlier = newId(1_700_000_000_000);
    const later = newId(1_700_000_000_001);
    expect(earlier < later).toBe(true);
  });
});

describe("isId", () => {
  it("rejects ambiguous Crockford characters and wrong lengths", () => {
    expect(isId("short")).toBe(false);
    expect(isId("I".repeat(26))).toBe(false);
    expect(isId(null)).toBe(false);
  });
});

describe("progressId", () => {
  it("is deterministic per item and direction", () => {
    expect(progressId("sentence", "abc", "en2th")).toBe("sentence:abc:en2th");
    expect(progressId("sentence", "abc", "th2en")).not.toBe(progressId("sentence", "abc", "en2th"));
  });
});
