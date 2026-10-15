import { describe, it, expect } from "vitest";
import {
  GREAT_PRAISE,
  LANGUAGES,
  PERFECT_PRAISE,
  STRINGS,
  isUiLanguage,
  pickPhrase,
  t,
  translator,
  type StringKey,
} from "@/lib/i18n";

const KEYS = Object.keys(STRINGS) as StringKey[];

describe("the dictionary", () => {
  it("carries both languages for every key", () => {
    // TypeScript already rejects a half-written phrase; this catches an empty one,
    // which it cannot.
    for (const key of KEYS) {
      for (const language of LANGUAGES) {
        expect(STRINGS[key][language].trim(), `${key}.${language}`).not.toBe("");
      }
    }
  });

  it("writes the Thai side in Thai", () => {
    // Product names and bare placeholders are the only reasonable exceptions.
    const exempt = new Set<StringKey>(["app.name", "learn.xp"]);
    for (const key of KEYS) {
      if (exempt.has(key)) continue;
      expect(STRINGS[key].th, key).toMatch(/[฀-๿]/);
    }
  });

  it("gives both languages the same placeholders", () => {
    // A placeholder dropped in translation renders a sentence with a hole in it.
    const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of KEYS) {
      expect(names(STRINGS[key].th), key).toEqual(names(STRINGS[key].en));
    }
  });

  it("does not leave a key in English on the Thai side", () => {
    // A copy-paste that forgot to translate is invisible until someone reads it.
    const suspicious = KEYS.filter(
      (key) => STRINGS[key].en === STRINGS[key].th && !/^(app\.name|learn\.xp)$/.test(key),
    );
    expect(suspicious).toEqual([]);
  });
});

describe("t", () => {
  it("returns the phrase for the language asked for", () => {
    expect(t("nav.lessons", "en")).toBe("Lessons");
    expect(t("nav.lessons", "th")).toBe("บทเรียน");
  });

  it("fills placeholders", () => {
    expect(t("learn.card.of", "en", { index: 3, total: 10 })).toBe("Card 3 of 10");
    expect(t("learn.card.of", "th", { index: 3, total: 10 })).toBe("ข้อ 3 จาก 10");
  });

  it("leaves an unfilled placeholder visible rather than blank", () => {
    // "Card {index} of 10" is a bug someone reports; "Card  of 10" is one nobody does.
    expect(t("learn.card.of", "en", { total: 10 })).toBe("Card {index} of 10");
  });

  it("ignores parameters a phrase does not use", () => {
    expect(t("nav.review", "en", { unused: 1 })).toBe("Review");
  });

  it("binds to one language through translator", () => {
    const th = translator("th");
    expect(th("nav.settings")).toBe("ตั้งค่า");
    expect(th("lessons.sentences", { count: 7 })).toContain("7");
  });
});

describe("isUiLanguage", () => {
  it.each([
    ["en", true],
    ["th", true],
    ["jp", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("%s", (value, expected) => {
    expect(isUiLanguage(value)).toBe(expected);
  });
});

describe("praise", () => {
  it("picks deterministically, so a re-render does not re-roll it", () => {
    expect(pickPhrase(PERFECT_PRAISE, 7)).toBe(pickPhrase(PERFECT_PRAISE, 7));
  });

  it("stays inside the list for any seed", () => {
    for (const seed of [0, 1, 99, -4, 1_000_000]) {
      expect(PERFECT_PRAISE).toContain(pickPhrase(PERFECT_PRAISE, seed));
    }
  });

  it("varies across cards rather than saying one thing forever", () => {
    const used = new Set(Array.from({ length: 12 }, (_, i) => pickPhrase(PERFECT_PRAISE, i)));
    expect(used.size).toBeGreaterThan(1);
  });

  it("has praise for both passing bands", () => {
    expect(PERFECT_PRAISE.length).toBeGreaterThan(1);
    expect(GREAT_PRAISE.length).toBeGreaterThan(1);
  });
});
