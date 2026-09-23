import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { hasVoiceFor, isSpeechSupported, listVoices, speak, stopSpeaking } from "@/lib/speech/tts";
import {
  FAILURE_MESSAGES,
  isRecognitionSupported,
  listenOnce,
  type RecognitionFailure,
} from "@/lib/speech/stt";

/**
 * The Web Speech API is not in jsdom, so both wrappers are exercised against a mock.
 *
 * What this can prove: every failure path reports the case the UI distinguishes, and a
 * missing API degrades rather than throws. What it cannot prove: that a real browser
 * actually emits these events, or that a real microphone works — see the e2e speech
 * coverage and the manual notes in the README.
 */

type Utterance = { text: string; lang: string; rate: number; voice: unknown; onend: null | (() => void) };

function mockSynthesis(voices: { name: string; lang: string }[] = []) {
  const spoken: Utterance[] = [];
  const cancel = vi.fn();

  class FakeUtterance {
    lang = "";
    rate = 1;
    voice: unknown = null;
    onend: null | (() => void) = null;
    onerror: null | (() => void) = null;
    constructor(public text: string) {}
  }

  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: {
      getVoices: () => voices,
      speak: (u: Utterance) => spoken.push(u),
      cancel,
    },
  });

  return { spoken, cancel };
}

function removeSynthesis() {
  Reflect.deleteProperty(window, "speechSynthesis");
}

afterEach(() => {
  vi.unstubAllGlobals();
  removeSynthesis();
});

describe("text to speech, when the browser has none", () => {
  beforeEach(removeSynthesis);

  it("reports itself unsupported instead of throwing", () => {
    expect(isSpeechSupported()).toBe(false);
    expect(listVoices()).toEqual([]);
    expect(hasVoiceFor("en")).toBe(false);
  });

  it("returns false from speak rather than failing", () => {
    // The caller uses this to disable the button and say why; an exception here would
    // take the whole exercise down with it.
    expect(speak("Where are you going?")).toBe(false);
  });

  it("makes stopping a no-op", () => {
    expect(() => stopSpeaking()).not.toThrow();
  });
});

describe("text to speech, with voices installed", () => {
  it("finds a voice by language prefix, case-insensitively", () => {
    mockSynthesis([{ name: "Thai", lang: "th-TH" }]);
    expect(hasVoiceFor("th")).toBe(true);
    expect(hasVoiceFor("TH")).toBe(true);
    expect(hasVoiceFor("en")).toBe(false);
  });

  it("speaks with the requested language and rate", () => {
    const { spoken } = mockSynthesis([{ name: "English", lang: "en-US" }]);

    expect(speak("Where are you going?", { lang: "en-US", rate: 0.8 })).toBe(true);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe("Where are you going?");
    expect(spoken[0].lang).toBe("en-US");
    expect(spoken[0].rate).toBe(0.8);
  });

  it("cancels anything queued first, so a second tap does not play both", () => {
    const { cancel } = mockSynthesis([{ name: "English", lang: "en-US" }]);
    speak("one");
    speak("two");
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("prefers a named voice when the learner has chosen one", () => {
    const { spoken } = mockSynthesis([
      { name: "Default EN", lang: "en-US" },
      { name: "Chosen EN", lang: "en-GB" },
    ]);

    speak("hello", { lang: "en-US", voiceName: "Chosen EN" });
    expect((spoken[0].voice as { name: string }).name).toBe("Chosen EN");
  });

  it("falls back to any voice for the language when the named one is gone", () => {
    // Voices come and go with the OS; a stale name must not silence the button.
    const { spoken } = mockSynthesis([{ name: "Default EN", lang: "en-US" }]);
    speak("hello", { lang: "en-US", voiceName: "Uninstalled Voice" });
    expect((spoken[0].voice as { name: string }).name).toBe("Default EN");
  });

  it("speaks with no voice assigned when none matches the language", () => {
    const { spoken } = mockSynthesis([{ name: "Thai", lang: "th-TH" }]);
    expect(speak("hello", { lang: "en-US" })).toBe(true);
    expect(spoken[0].voice).toBe(null);
  });

  it("refuses to speak empty text", () => {
    const { spoken } = mockSynthesis([{ name: "English", lang: "en-US" }]);
    expect(speak("   ")).toBe(false);
    expect(spoken).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- speech recognition

type Handlers = {
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
};

function mockRecognition(options: { throwOnStart?: boolean } = {}) {
  const instances: (Handlers & { lang: string; started: boolean; stopped: boolean })[] = [];

  class FakeRecognition {
    lang = "";
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    started = false;
    stopped = false;
    onresult: Handlers["onresult"] = null;
    onerror: Handlers["onerror"] = null;
    onend: Handlers["onend"] = null;
    onaudiostart: Handlers["onaudiostart"] = null;

    constructor() {
      instances.push(this as never);
    }
    start() {
      if (options.throwOnStart) throw new Error("already started");
      this.started = true;
    }
    stop() {
      this.stopped = true;
    }
    abort() {}
  }

  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  return { instances };
}

function removeRecognition() {
  Reflect.deleteProperty(window, "SpeechRecognition");
  Reflect.deleteProperty(window, "webkitSpeechRecognition");
}

describe("speech recognition, when the browser has none", () => {
  beforeEach(removeRecognition);
  afterEach(removeRecognition);

  it("says so through the failure callback and returns no handle", () => {
    const onFailure = vi.fn();
    const handle = listenOnce({ onTranscript: vi.fn(), onFailure, onEnd: vi.fn() });

    expect(isRecognitionSupported()).toBe(false);
    expect(handle).toBeNull();
    expect(onFailure).toHaveBeenCalledWith("unsupported");
  });

  it("names the browsers that can and cannot do it", () => {
    expect(FAILURE_MESSAGES.unsupported).toMatch(/Chrome and Edge/);
    expect(FAILURE_MESSAGES.unsupported).toMatch(/Firefox/);
  });
});

describe("speech recognition failures each reach the UI as their own case", () => {
  afterEach(removeRecognition);

  it.each([
    ["not-allowed", "permission-denied"],
    ["service-not-allowed", "permission-denied"],
    ["audio-capture", "no-microphone"],
    ["no-speech", "no-speech"],
    ["network", "network"],
    ["aborted", "aborted"],
    ["something-new-from-the-spec", "unknown"],
  ] as const)("%s becomes %s", (error, expected) => {
    const { instances } = mockRecognition();
    const onFailure = vi.fn();
    listenOnce({ onTranscript: vi.fn(), onFailure, onEnd: vi.fn() });

    instances[0].onerror?.({ error });
    expect(onFailure).toHaveBeenCalledWith(expected);
  });

  it("offers manual practice in every message the learner can hit", () => {
    // Every failure path has to leave a way to keep working, not a dead end.
    const recoverable: RecognitionFailure[] = ["permission-denied", "no-microphone", "no-speech", "unknown"];
    for (const failure of recoverable) {
      expect(FAILURE_MESSAGES[failure], failure).toMatch(/grade yourself/);
    }
  });

  it("reports no-speech when the browser ends silently, with no error at all", () => {
    // Chrome does exactly this when it hears nothing.
    const { instances } = mockRecognition();
    const onFailure = vi.fn();
    const onEnd = vi.fn();
    listenOnce({ onTranscript: vi.fn(), onFailure, onEnd });

    instances[0].onend?.();
    expect(onFailure).toHaveBeenCalledWith("no-speech");
    expect(onEnd).toHaveBeenCalled();
  });

  it("reports aborted when a pass is already running", () => {
    mockRecognition({ throwOnStart: true });
    const onFailure = vi.fn();
    const onEnd = vi.fn();

    expect(listenOnce({ onTranscript: vi.fn(), onFailure, onEnd })).toBeNull();
    expect(onFailure).toHaveBeenCalledWith("aborted");
    expect(onEnd).toHaveBeenCalled();
  });
});

describe("a successful recognition pass", () => {
  afterEach(removeRecognition);

  it("hands back the transcript and nothing else", () => {
    const { instances } = mockRecognition();
    const onTranscript = vi.fn();
    listenOnce({ lang: "en-US", onTranscript, onFailure: vi.fn(), onEnd: vi.fn() });

    instances[0].onresult?.({ results: [[{ transcript: "where are you going" }]] });
    expect(onTranscript).toHaveBeenCalledWith("where are you going");
  });

  it("does not then claim it heard nothing when the pass ends", () => {
    const { instances } = mockRecognition();
    const onFailure = vi.fn();
    listenOnce({ onTranscript: vi.fn(), onFailure, onEnd: vi.fn() });

    instances[0].onresult?.({ results: [[{ transcript: "hello" }]] });
    instances[0].onend?.();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("uses the requested language", () => {
    const { instances } = mockRecognition();
    listenOnce({ lang: "th-TH", onTranscript: vi.fn(), onFailure: vi.fn(), onEnd: vi.fn() });
    expect(instances[0].lang).toBe("th-TH");
  });

  it("announces when the microphone actually goes live", () => {
    const { instances } = mockRecognition();
    const onListening = vi.fn();
    listenOnce({ onTranscript: vi.fn(), onFailure: vi.fn(), onEnd: vi.fn(), onListening });

    instances[0].onaudiostart?.();
    expect(onListening).toHaveBeenCalled();
  });

  it("treats an empty result as an empty transcript rather than crashing", () => {
    const { instances } = mockRecognition();
    const onTranscript = vi.fn();
    listenOnce({ onTranscript, onFailure: vi.fn(), onEnd: vi.fn() });

    instances[0].onresult?.({ results: [] });
    expect(onTranscript).toHaveBeenCalledWith("");
  });

  it("can be stopped, and stopping twice is harmless", () => {
    const { instances } = mockRecognition();
    const handle = listenOnce({ onTranscript: vi.fn(), onFailure: vi.fn(), onEnd: vi.fn() });

    handle?.stop();
    expect(instances[0].stopped).toBe(true);
    expect(() => handle?.stop()).not.toThrow();
  });
});
