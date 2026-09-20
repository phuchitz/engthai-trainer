"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { BAND_LABELS } from "@/lib/answer";
import { CATEGORY_INFO } from "@/lib/models";
import { isSpeechSupported, speak } from "@/lib/speech/tts";
import { useStudyStore } from "@/stores/useStudyStore";
import { NavIcon } from "@/components/layout/NavIcon";
import { AnswerDiff, DiffLegend } from "./AnswerDiff";
import { Shortcut } from "./Shortcut";

const SPEAKER_ICON = "M11 5 6 9H2v6h4l5 4V5Zm4.5 3a5 5 0 0 1 0 8m2.5-11a9 9 0 0 1 0 14";

const BAND_TONE = {
  perfect: "text-success",
  great: "text-success",
  good: "text-warning",
  tryAgain: "text-danger",
} as const;

const NO_SUBSCRIPTION = () => () => {};
const SPEECH_SERVER_SNAPSHOT = () => false;

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="bg-surface-muted text-muted rounded-md px-2 py-1 text-xs">{children}</span>;
}

export function DictationCard() {
  const {
    cards,
    index,
    phase,
    answer,
    hintUsed,
    outcome,
    sessionXp,
    cardsToday,
    dailyGoal,
    streak,
    submitting,
    setAnswer,
    showHint,
    markTtsUsed,
    submit,
    retry,
    skip,
    next,
  } = useStudyStore();

  const sentence = cards[index];
  const inputRef = useRef<HTMLInputElement>(null);
  // Prerendered HTML cannot know whether this browser speaks, so the server snapshot is
  // false and the real value arrives on hydration. Support never changes after load, so
  // there is nothing to subscribe to.
  const speechAvailable = useSyncExternalStore(NO_SUBSCRIPTION, isSpeechSupported, SPEECH_SERVER_SNAPSHOT);

  const play = useCallback(() => {
    if (!sentence) return;
    markTtsUsed();
    speak(sentence.en, { lang: "en-US" });
  }, [sentence, markTtsUsed]);

  // Refocus whenever a new card appears or the learner retries, so typing can resume
  // without reaching for the mouse.
  useEffect(() => {
    if (phase === "prompt") inputRef.current?.focus();
  }, [phase, index]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey) return;

      // Alt combinations do not produce characters, so these stay usable while the
      // answer field has focus — which it almost always does in dictation.
      if (event.altKey) {
        const handlers: Record<string, (() => void) | undefined> = {
          p: play,
          h: phase === "prompt" ? showHint : undefined,
          s: phase === "prompt" ? () => void skip() : undefined,
          r: phase === "graded" ? retry : undefined,
        };
        const handler = handlers[event.key.toLowerCase()];
        if (handler) {
          event.preventDefault();
          handler();
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (phase === "prompt") void submit();
        else if (phase === "graded") void next();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, play, showHint, skip, retry, submit, next]);

  if (!sentence) return null;

  const graded = phase === "graded" && outcome !== null;
  const goalPercent = dailyGoal > 0 ? Math.min(100, Math.round((cardsToday / dailyGoal) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div className="text-muted flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <span className="flex items-center gap-3 tabular-nums">
          <span>+{sessionXp} XP</span>
          <span>🔥 {streak}</span>
          <span>
            Goal {cardsToday}/{dailyGoal} ({goalPercent}%)
          </span>
        </span>
      </div>

      <div className="border-border bg-surface rounded-xl border p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge>{sentence.level}</Badge>
          <Badge>{CATEGORY_INFO[sentence.category].label}</Badge>
          <Badge>Dictation</Badge>
        </div>

        <button
          type="button"
          onClick={play}
          disabled={!speechAvailable}
          className="bg-accent text-accent-foreground flex w-full items-center justify-center gap-2 rounded-lg px-4 py-4 text-sm font-medium disabled:opacity-50"
        >
          <NavIcon path={SPEAKER_ICON} className="size-5" />
          Listen
          <Shortcut keys="Alt+P" />
        </button>

        {!speechAvailable ? (
          <p className="text-muted mt-2 text-xs">
            This browser has no speech synthesis, so the sentence is shown instead of played.
          </p>
        ) : null}

        {!speechAvailable && !graded ? <p className="mt-3 text-lg">{sentence.en}</p> : null}

        <label htmlFor="dictation-answer" className="text-muted mt-5 mb-2 block text-sm">
          Type what you hear, in English
        </label>
        <input
          id="dictation-answer"
          ref={inputRef}
          value={graded ? outcome.result.normalizedUser : answer}
          onChange={(e) => setAnswer(e.target.value)}
          readOnly={graded}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          lang="en"
          className="border-border bg-background focus:border-accent w-full rounded-lg border px-3 py-2.5 text-lg outline-none read-only:opacity-60"
          placeholder="…"
        />

        {hintUsed && !graded ? (
          <div className="border-border mt-4 space-y-1 rounded-lg border border-dashed p-3">
            <p lang="th" className="text-sm">
              {sentence.th}
            </p>
            {sentence.hint ? (
              <p className="text-muted text-xs" lang="th">
                {sentence.hint}
              </p>
            ) : null}
          </div>
        ) : null}

        {!graded ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || answer.trim().length === 0}
              className="bg-foreground text-background rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Check
              <Shortcut keys="Enter" />
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={hintUsed}
              className="border-border rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Hint
              <Shortcut keys="Alt+H" />
            </button>
            <button
              type="button"
              onClick={() => void skip()}
              disabled={submitting}
              className="text-muted rounded-lg px-4 py-2 text-sm"
            >
              Skip
              <Shortcut keys="Alt+S" />
            </button>
          </div>
        ) : null}
      </div>

      {graded ? <Feedback /> : null}
    </div>
  );
}

function Feedback() {
  const { cards, index, outcome, vocabulary, retry, next } = useStudyStore();
  const sentence = cards[index];
  if (!outcome || !sentence) return null;

  const { result } = outcome;

  return (
    <div className="border-border bg-surface space-y-4 rounded-xl border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-lg font-semibold ${BAND_TONE[result.band]}`}>{BAND_LABELS[result.band]}</p>
        <p className="text-muted text-sm tabular-nums">{result.accuracy}%</p>
      </div>

      <div>
        <AnswerDiff ops={result.ops} />
        <DiffLegend />
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-muted text-xs tracking-wide uppercase">Answer</p>
        <p className="text-lg">{sentence.en}</p>
        <p lang="th" className="text-muted">
          {sentence.th}
        </p>
        {sentence.transliteration ? <p className="text-muted text-xs">{sentence.transliteration}</p> : null}
      </div>

      {sentence.notes ? (
        <div className="border-border border-t pt-4">
          <p className="text-muted text-xs tracking-wide uppercase">Grammar</p>
          <p lang="th" className="mt-1 text-sm">
            {sentence.notes}
          </p>
        </div>
      ) : null}

      {sentence.exampleEn ? (
        <div className="border-border border-t pt-4">
          <p className="text-muted text-xs tracking-wide uppercase">Another example</p>
          <p className="mt-1 text-sm">{sentence.exampleEn}</p>
          {sentence.exampleTh ? (
            <p lang="th" className="text-muted text-sm">
              {sentence.exampleTh}
            </p>
          ) : null}
        </div>
      ) : null}

      {vocabulary.length > 0 ? (
        <div className="border-border border-t pt-4">
          <p className="text-muted text-xs tracking-wide uppercase">Vocabulary</p>
          <ul className="mt-2 space-y-1">
            {vocabulary.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-4 text-sm">
                <span>{entry.en}</span>
                <span lang="th" className="text-muted">
                  {entry.th}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-border border-t pt-4">
        <p className="text-sm">
          {outcome.xpAwarded > 0 ? (
            <span className="text-success font-medium">+{outcome.xpAwarded} XP</span>
          ) : outcome.xpWasNew ? (
            <span className="text-muted">No XP — that answer was not a pass.</span>
          ) : (
            <span className="text-muted">Already earned XP for this card today.</span>
          )}
        </p>
        {!outcome.scheduled ? (
          <p className="text-muted mt-1 text-xs">
            Schedule already updated for this card today, so this attempt was practice only.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void next()}
          className="bg-accent text-accent-foreground rounded-lg px-4 py-2 text-sm font-medium"
        >
          Next
          <Shortcut keys="Enter" />
        </button>
        <button type="button" onClick={retry} className="border-border rounded-lg border px-4 py-2 text-sm">
          Retry
          <Shortcut keys="Alt+R" />
        </button>
      </div>
    </div>
  );
}
