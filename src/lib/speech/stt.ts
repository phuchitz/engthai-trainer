/**
 * Speech recognition, used only to obtain a **transcript**.
 *
 * What this is not: pronunciation assessment. The browser returns its best guess at the
 * words, and the app compares that text to the target. A low score can mean the learner
 * said it wrong, or that recognition misheard a perfectly good Thai-accented sentence.
 * Every label in the UI says "transcript", and the learner can always override.
 *
 * No audio is captured, buffered or stored anywhere: only the text the browser hands back.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return getConstructor() !== null;
}

export type RecognitionFailure =
  "unsupported" | "permission-denied" | "no-microphone" | "no-speech" | "network" | "aborted" | "unknown";

export const FAILURE_MESSAGES: Record<RecognitionFailure, string> = {
  unsupported: "This browser cannot transcribe speech. Chrome and Edge can; Firefox cannot.",
  "permission-denied": "Microphone access was blocked. You can still practise out loud and grade yourself.",
  "no-microphone": "No microphone was found. You can still practise out loud and grade yourself.",
  "no-speech": "Nothing was heard. Try again, or practise out loud and grade yourself.",
  network: "Speech recognition needs a network connection and could not reach the service.",
  aborted: "Listening stopped before anything was transcribed.",
  unknown: "Speech recognition failed. You can still practise out loud and grade yourself.",
};

/** Maps the spec's error strings onto the cases the UI distinguishes. */
function toFailure(error: string): RecognitionFailure {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "permission-denied";
    case "audio-capture":
      return "no-microphone";
    case "no-speech":
      return "no-speech";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

export type RecognitionHandle = {
  stop: () => void;
};

export type ListenOptions = {
  lang?: string;
  onTranscript: (transcript: string) => void;
  onFailure: (failure: RecognitionFailure) => void;
  onEnd: () => void;
  /** Fires once the microphone is actually live, so the UI can say "listening". */
  onListening?: () => void;
};

/**
 * Starts one recognition pass. Returns null when the browser has no support at all,
 * having already reported `unsupported` through `onFailure`.
 */
export function listenOnce(options: ListenOptions): RecognitionHandle | null {
  const Recognition = getConstructor();
  if (!Recognition) {
    options.onFailure("unsupported");
    return null;
  }

  const recognition = new Recognition();
  recognition.lang = options.lang ?? "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let settled = false;

  recognition.onaudiostart = () => options.onListening?.();

  recognition.onresult = (event) => {
    settled = true;
    const transcript = event.results?.[0]?.[0]?.transcript ?? "";
    options.onTranscript(transcript);
  };

  recognition.onerror = (event) => {
    settled = true;
    options.onFailure(toFailure(event.error));
  };

  recognition.onend = () => {
    // Chrome ends silently when it hears nothing at all, with no error event.
    if (!settled) options.onFailure("no-speech");
    options.onEnd();
  };

  try {
    recognition.start();
  } catch {
    // Thrown when a previous pass is still running.
    settled = true;
    options.onFailure("aborted");
    options.onEnd();
    return null;
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    },
  };
}
