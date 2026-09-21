"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  FAILURE_MESSAGES,
  isRecognitionSupported,
  listenOnce,
  type RecognitionHandle,
} from "@/lib/speech/stt";
import { useStudyStore } from "@/stores/useStudyStore";

const NO_SUBSCRIPTION = () => () => {};
const SERVER_SNAPSHOT = () => false;

function ManualFallback({ reason }: { reason: string }) {
  const { cards, index, selfAssess } = useStudyStore();
  const sentence = cards[index]?.sentence;

  return (
    <div className="border-border space-y-3 rounded-lg border border-dashed p-4">
      <p className="text-warning text-sm font-medium">Transcription unavailable</p>
      <p className="text-muted text-sm">{reason}</p>
      <div className="border-border border-t pt-3">
        <p className="text-muted text-xs tracking-wide uppercase">Say this out loud</p>
        <p className="mt-1 text-lg">{sentence?.en}</p>
      </div>
      <p className="text-muted text-sm">
        Practise it aloud, then grade yourself honestly — this is the same self-assessment the transcript
        would only be advising anyway.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void selfAssess(true)}
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          I said it correctly
        </button>
        <button
          type="button"
          onClick={() => void selfAssess(false)}
          className="border-border rounded-lg border px-4 py-2 text-sm"
        >
          I struggled with it
        </button>
      </div>
    </div>
  );
}

export function SpeakInput() {
  const { micState, micFailure, transcript, setMicState, setMicFailure, setTranscript, index } =
    useStudyStore();

  const supported = useSyncExternalStore(NO_SUBSCRIPTION, isRecognitionSupported, SERVER_SNAPSHOT);
  const handleRef = useRef<RecognitionHandle | null>(null);

  // Recognition must not keep running once the card changes or the screen unmounts.
  useEffect(() => {
    return () => handleRef.current?.stop();
  }, [index]);

  if (!supported) return <ManualFallback reason={FAILURE_MESSAGES.unsupported} />;
  if (micState === "failed" && micFailure) {
    return <ManualFallback reason={FAILURE_MESSAGES[micFailure]} />;
  }

  if (micState === "idle") {
    return (
      <div className="border-border space-y-3 rounded-lg border p-4">
        <p className="text-sm font-medium">Before turning on the microphone</p>
        <ul className="text-muted list-disc space-y-1 pl-5 text-sm">
          <li>
            Your browser may send the audio to an external speech service to transcribe it. In Chrome and Edge
            it does.
          </li>
          <li>This app never records, keeps or uploads audio — only the text that comes back.</li>
          <li>
            The score compares that text to the sentence. It is <strong>transcript similarity</strong>, not an
            assessment of your pronunciation.
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setMicState("consented")}
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          Enable microphone
        </button>
        <button
          type="button"
          onClick={() => setMicFailure("permission-denied")}
          className="text-muted block text-xs underline"
        >
          Practise without the microphone instead
        </button>
      </div>
    );
  }

  const listening = micState === "listening";

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={listening}
        onClick={() => {
          setMicState("listening");
          handleRef.current = listenOnce({
            lang: "en-US",
            onListening: () => setMicState("listening"),
            onTranscript: (text) => setTranscript(text),
            onFailure: (failure) => setMicFailure(failure),
            onEnd: () => {
              handleRef.current = null;
              // Leave a failure state alone; otherwise return to the ready state.
              if (useStudyStore.getState().micState === "listening") setMicState("consented");
            },
          });
        }}
        className="border-border flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-4 text-sm font-medium disabled:opacity-60"
      >
        {listening ? "Listening…" : transcript ? "Record again" : "Start speaking"}
      </button>

      {transcript !== null ? (
        <div className="border-border rounded-lg border p-3">
          <p className="text-muted text-xs tracking-wide uppercase">Transcript</p>
          <p className="mt-1 text-lg">{transcript || "(nothing transcribed)"}</p>
          <p className="text-muted mt-2 text-xs">
            This is what the browser heard. Compared as text, not as pronunciation.
          </p>
        </div>
      ) : (
        <p className="text-muted text-sm">
          Press the button, then say: it is checked against the sentence you just heard.
        </p>
      )}

      <button
        type="button"
        onClick={() => setMicFailure("permission-denied")}
        className="text-muted text-xs underline"
      >
        Microphone not working? Practise manually
      </button>
    </div>
  );
}
