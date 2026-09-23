import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { deleteDatabase } from "@/lib/db/client";
import { downloadText, readFileAsText } from "@/lib/importexport/download";
import { countSessions, getSession, listRecentSessions, putSession } from "@/lib/db/repositories/sessions";
import { isSoundSupported, playMiss, playSuccess } from "@/lib/audio/feedback";
import { studySessionSchema, type StudySession } from "@/lib/models";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

describe("downloadText", () => {
  let created: string[];
  let revoked: string[];
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    created = [];
    revoked = [];
    clicked = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        const url = `blob:${created.length}`;
        created.push(url);
        void blob;
        return url;
      },
      revokeObjectURL: (url: string) => revoked.push(url),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports success only once the browser has accepted the download", () => {
    expect(downloadText("backup.json", '{"a":1}')).toBe(true);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("backup.json");
  });

  it("returns false rather than claiming a backup exists that does not", () => {
    // The caller shows "saved" from this boolean; a throw here would be reported as
    // success by anything that only catches at a higher level.
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => {
        throw new Error("blocked");
      },
      revokeObjectURL: () => {},
    });

    expect(downloadText("backup.json", "{}")).toBe(false);
  });

  it("cleans up the object URL either way", () => {
    downloadText("backup.json", "{}");
    expect(revoked).toEqual(created);
  });

  it("leaves no anchor behind in the document", () => {
    downloadText("backup.json", "{}");
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
  });

  it("reads a file back as text", async () => {
    const file = new File(['{"formatVersion":1}'], "backup.json", { type: "application/json" });
    expect(await readFileAsText(file)).toBe('{"formatVersion":1}');
  });
});

describe("study sessions", () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  function session(id: string, startedAt: number): StudySession {
    return studySessionSchema.parse({
      id,
      kind: "lesson",
      startedAt,
      createdAt: startedAt,
      updatedAt: startedAt,
    });
  }

  it("round-trips a session", async () => {
    await putSession(session("s1", NOW));
    expect((await getSession("s1"))?.startedAt).toBe(NOW);
    expect(await countSessions()).toBe(1);
  });

  it("returns undefined for a session that was never written", async () => {
    expect(await getSession("nope")).toBeUndefined();
  });

  it("lists the most recent first", async () => {
    await putSession(session("old", NOW - 2 * DAY));
    await putSession(session("newest", NOW));
    await putSession(session("middle", NOW - DAY));

    expect((await listRecentSessions()).map((s) => s.id)).toEqual(["newest", "middle", "old"]);
  });

  it("honours the limit", async () => {
    for (let i = 0; i < 5; i++) await putSession(session(`s${i}`, NOW - i * DAY));
    expect(await listRecentSessions(2)).toHaveLength(2);
  });

  it("rejects a malformed session rather than storing it", async () => {
    await expect(putSession({ id: "" } as unknown as StudySession)).rejects.toThrow();
  });
});

describe("feedback sounds", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "AudioContext");
  });

  it("reports itself unsupported when the browser has no Web Audio", () => {
    Reflect.deleteProperty(window, "AudioContext");
    expect(isSoundSupported()).toBe(false);
  });

  it("stays silent instead of throwing when there is no Web Audio", () => {
    Reflect.deleteProperty(window, "AudioContext");
    expect(() => playSuccess()).not.toThrow();
    expect(() => playMiss()).not.toThrow();
  });

  it("plays a rising pair for a pass and a single low tone for a miss", () => {
    const gainNode = {
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    };
    const makeOscillator = () => ({
      type: "",
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    });
    const oscillators: ReturnType<typeof makeOscillator>[] = [];

    class FakeContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createGain = () => gainNode;
      createOscillator = () => {
        const o = makeOscillator();
        oscillators.push(o);
        return o;
      };
      resume = vi.fn();
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeContext });

    expect(isSoundSupported()).toBe(true);

    playSuccess();
    expect(oscillators.map((o) => o.frequency.value)).toEqual([660, 880]);

    oscillators.length = 0;
    playMiss();
    // A miss is one lower tone, so feedback never sounds punitive.
    expect(oscillators.map((o) => o.frequency.value)).toEqual([220]);
  });
});

describe("the repository helpers the screens use less often", () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  const word = (id: string, en: string) => ({
    id,
    en,
    th: "คำ",
    forms: [],
    contexts: [],
    saved: false,
    exampleSentenceIds: [],
    tags: [],
    level: "A1" as const,
    source: "builtin" as const,
    createdAt: NOW,
    updatedAt: NOW,
  });

  it("writes a batch of vocabulary in one transaction", async () => {
    const { putVocabularyEntries, countVocabulary, deleteVocabularyEntry } =
      await import("@/lib/db/repositories/vocabulary");

    await putVocabularyEntries([word("v1", "blocker"), word("v2", "deploy")]);
    expect(await countVocabulary()).toBe(2);

    await deleteVocabularyEntry("v1");
    expect(await countVocabulary()).toBe(1);
  });

  it("rejects the whole batch rather than writing half of it", async () => {
    const { putVocabularyEntries, countVocabulary } = await import("@/lib/db/repositories/vocabulary");

    await expect(putVocabularyEntries([word("v1", "fine"), { ...word("v2", ""), en: "" }])).rejects.toThrow();
    // Validation happens before the transaction opens, so nothing was written.
    expect(await countVocabulary()).toBe(0);
  });

  it("lists lessons by level and deletes one", async () => {
    const { putLesson, listLessonsByLevel, deleteLesson, countLessons } =
      await import("@/lib/db/repositories/lessons");
    const lesson = (id: string, level: "A1" | "B1") => ({
      id,
      title: id,
      titleTh: "บทเรียน",
      tags: [],
      level,
      sentenceIds: [],
      source: "builtin" as const,
      createdAt: NOW,
      updatedAt: NOW,
    });

    await putLesson(lesson("a1", "A1"));
    await putLesson(lesson("b1", "B1"));

    expect((await listLessonsByLevel("A1")).map((l) => l.id)).toEqual(["a1"]);
    await deleteLesson("a1");
    expect(await countLessons()).toBe(1);
  });

  it("deletes a meta key", async () => {
    const { setMeta, getMeta, deleteMeta } = await import("@/lib/db/repositories/meta");

    await setMeta("seed", { version: 4 });
    expect(await getMeta("seed")).toEqual({ version: 4 });

    await deleteMeta("seed");
    expect(await getMeta("seed")).toBeUndefined();
  });

  it("reads a single attempt back by id", async () => {
    const { addAttempt, getAttempt } = await import("@/lib/db/repositories/attempts");
    const { attemptSchema } = await import("@/lib/models");

    await addAttempt(
      attemptSchema.parse({
        id: "a1",
        sessionId: "s",
        progressId: "sentence:x:th2en",
        itemType: "sentence",
        itemId: "x",
        direction: "th2en",
        mode: "translate",
        prompt: "p",
        userAnswer: "u",
        expectedAnswer: "e",
        verdict: "correct",
        grade: 3,
        createdAt: NOW,
      }),
    );

    expect((await getAttempt("a1"))?.itemId).toBe("x");
    expect(await getAttempt("missing")).toBeUndefined();
  });
});
